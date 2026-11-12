#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text
    );

  invariant(!secretValue, `${label} contains a secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretShapedKeys(item, label, [...trail, String(index)]));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("privatekey") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("signature") ||
      normalizedKey.includes("jwt");

    invariant(!secretKey, `${label} contains a secret-shaped key at ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function normalizeArtifactPath(rawPath, label) {
  invariant(rawPath?.trim(), `${label} is required.`);
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);
  assertNoSecretShapedValue(rawPath, label);

  const artifactPath = rawPath.trim();
  const resolvedPath = resolve(artifactPath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo =
    repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);

  invariant(!isInsideRepo || isIgnoredArtifactPath, `${label} must live under gitignored artifacts/ when repo-local.`);
  invariant(existsSync(artifactPath), `${label} was not found at ${artifactPath}.`);
  return artifactPath;
}

function normalizePreviewOrigin(rawUrl) {
  invariant(rawUrl?.trim(), "NEXT_PUBLIC_OUTPOST_APP_URL or deployment URL argument is required.");
  const withProtocol = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  let url;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("Preview origin is not a valid URL.");
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(url.protocol === "https:", "Customer handoff proof import must use an https Preview URL.");
  invariant(!localHosts.has(url.hostname), "Refusing customer handoff proof import against a local app URL.");
  invariant(url.hostname.endsWith(".vercel.app"), "Customer handoff proof import must target a vercel.app Preview URL.");
  invariant(!url.username && !url.password, "Preview URL must not include embedded credentials.");
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runCommand(args, label) {
  const result = spawnSync(args[0], args.slice(1), { cwd: process.cwd(), encoding: "utf8", env: process.env });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, label);
  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }
  return result.stdout;
}
function runNeonPsql(config, args) {
  return runCommand(
    ["neon", ...withNeonApiKey([
      "connection-string",
      config.branchName,
      "--project-id",
      config.projectId,
      "--database-name",
      config.databaseName,
      "--role-name",
      ROLE_NAME,
      "--psql",
      "--",
      ...args
    ])],
    "Neon customer handoff proof record"
  );
}

function runPsqlScript(config, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-customer-handoff-proof-"));
  const scriptPath = join(tempDir, "proof.sql");

  try {
    writeFileSync(scriptPath, sql);
    return runNeonPsql(config, ["-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function requireSafeString(value, label) {
  invariant(typeof value === "string" && value.trim().length > 0, `${label} is required.`);
  const trimmed = value.trim();
  assertNoSecretShapedValue(trimmed, label);
  return trimmed;
}

function requireCustomerParticipant(value) {
  const participant = requireSafeString(value, "gate participant");
  const internalPattern = /\b(?:dry[-\s]?run|internal|smoke|test|disposable|throwaway|operator|founder[-\s]?admin|outpost)\b/iu;
  invariant(
    !internalPattern.test(participant),
    "gate participant must be the external beta owner or customer, not an internal dry-run label."
  );
  return participant;
}

function normalizeOrigin(value, label) {
  const url = normalizePreviewOrigin(requireSafeString(value, label));
  return url;
}

function assertBlockedGate(gate, key, expected) {
  invariant(gate.gates?.[key] === expected, `gate ${key} must be ${expected}.`);
}

function validateGateRecord(gate, config, sourceSha256, appOrigin) {
  invariant(gate?.status === "customer_observed_beta_handoff_gate_passed", "gate status not passed.");
  invariant(
    gate.evidence_basis === "validated_packet_and_customer_observed_completion_artifacts" ||
      gate.evidence_basis === "validated_admin_handoff_packet_customer_packet_and_completion_artifacts",
    "gate evidence basis must be validated packet customer-observed completion artifacts."
  );
  invariant(!Number.isNaN(Date.parse(gate.session_at)), "gate session_at must be valid date.");
  invariant(!Number.isNaN(Date.parse(gate.generated_at)), "gate generated_at must be valid date.");
  invariant(gate.neon_proof_branch === config.branchName, "gate Neon proof branch must match OUTPOST_NEON_BRANCH_NAME.");
  invariant(normalizeOrigin(gate.preview_url, "gate Preview URL") === appOrigin, "gate Preview URL must match import Preview origin.");
  assertBlockedGate(gate, "customer_observed", "passed");
  assertBlockedGate(gate, "live_providers", "blocked");
  assertBlockedGate(gate, "self_serve", "blocked");
  assertBlockedGate(gate, "invite_delivery", "blocked");
  assertBlockedGate(gate, "notifications", "blocked");
  assertBlockedGate(gate, "phone_email_providers", "blocked");
  assertBlockedGate(gate, "billing_pos_member_ledger", "blocked");
  invariant(gate.gates?.unexpected_data === "none_reported", "gate unexpected_data must be none_reported.");
  const requiredNonGoals = new Set([
    "public_self_signup",
    "invite_delivery",
    "notification_sending",
    "phone_provider_activation",
    "email_provider_activation",
    "billing",
    "pos",
    "access_control",
    "member_ledger_writes"
  ]);
  for (const nonGoal of requiredNonGoals) {
    invariant(gate.non_goals?.includes(nonGoal), `gate must keep ${nonGoal} blocked.`);
  }
  const adminHandoffPacketSha256 = gate.admin_handoff_packet_sha256 ?? null;
  if (adminHandoffPacketSha256 !== null) {
    invariant(
      typeof adminHandoffPacketSha256 === "string" && /^[a-f0-9]{64}$/u.test(adminHandoffPacketSha256),
      "gate admin handoff packet digest must be sha256."
    );
  }
  const observerLabel = requireSafeString(gate.observer, "gate observer");
  const participantLabel = requireCustomerParticipant(gate.participant);
  invariant(
    participantLabel.toLowerCase() !== observerLabel.toLowerCase(),
    "gate participant must be distinct from internal observer."
  );
  const betaOwnerLabel = requireSafeString(gate.beta_owner, "gate beta owner");
  const gymName = requireSafeString(gate.gym, "gate gym");
  return {
    appOrigin,
    adminHandoffPacketSha256,
    betaOwnerLabel,
    gateGeneratedAt: gate.generated_at,
    gymName,
    id: `customer_handoff_gate_${sourceSha256.slice(0, 24)}`,
    neonBranchName: gate.neon_proof_branch,
    observerLabel,
    participantLabel,
    sessionAt: gate.session_at,
    sourceArtifactSha256: sourceSha256,
    status: gate.status,
    summary: {
      admin_handoff_packet_linked: Boolean(adminHandoffPacketSha256),
      admin_handoff_packet_sha256: adminHandoffPacketSha256,
      gates: {
        customer_observed: "passed",
        invite_delivery: "blocked",
        live_providers: "blocked",
        notifications: "blocked",
        phone_email_providers: "blocked",
        self_serve: "blocked",
        unexpected_data: "none_reported"
      },
      non_goals: Array.from(requiredNonGoals).sort()
    }
  };
}
function readGateArtifact(gatePath) {
  const source = readFileSync(gatePath, "utf8");
  assertNoSecretShapedValue(source, "customer handoff gate artifact");
  const sourceSha256 = createHash("sha256").update(source).digest("hex");
  let gate;

  try {
    gate = JSON.parse(source);
  } catch (error) {
    throw new Error(`customer handoff gate artifact must be valid JSON: ${error instanceof Error ? error.message : error}`);
  }

  assertNoSecretShapedKeys(gate, "customer handoff gate artifact");
  return { gate, sourceSha256 };
}

function recordCustomerHandoffGate(config, record) {
  runPsqlScript(
    config,
    `
insert into customer_handoff_gate_records (
  id,
  status,
  gym_name,
  beta_owner_label,
  participant_label,
  observer_label,
  app_origin,
  neon_branch_name,
  session_at,
  gate_generated_at,
  source_artifact_sha256,
  admin_handoff_packet_sha256,
  summary
) values (
  ${sqlLiteral(record.id)},
  ${sqlLiteral(record.status)},
  ${sqlLiteral(record.gymName)},
  ${sqlLiteral(record.betaOwnerLabel)},
  ${sqlLiteral(record.participantLabel)},
  ${sqlLiteral(record.observerLabel)},
  ${sqlLiteral(record.appOrigin)},
  ${sqlLiteral(record.neonBranchName)},
  ${sqlLiteral(record.sessionAt)}::timestamptz,
  ${sqlLiteral(record.gateGeneratedAt)}::timestamptz,
  ${sqlLiteral(record.sourceArtifactSha256)},
  ${record.adminHandoffPacketSha256 ? sqlLiteral(record.adminHandoffPacketSha256) : "null"},
  ${sqlLiteral(JSON.stringify(record.summary))}::jsonb
) on conflict (id) do nothing;
`
  );
}

function main() {
  const appOrigin = normalizePreviewOrigin(process.env.NEXT_PUBLIC_OUTPOST_APP_URL ?? process.argv[2]);
  const gatePath = normalizeArtifactPath(process.env.OUTPOST_BETA_HANDOFF_GATE_PATH, "OUTPOST_BETA_HANDOFF_GATE_PATH");
  const config = readHostedReadinessConfig();
  invariant(config.branchName !== "production", "Refusing customer handoff proof import against the Neon production branch.");
  const { gate, sourceSha256 } = readGateArtifact(gatePath);
  const record = validateGateRecord(gate, config, sourceSha256, appOrigin);

  recordCustomerHandoffGate(config, record);
  console.log("Customer handoff gate proof record imported.");
  console.log(`Preview: ${record.appOrigin}`);
  console.log(`Neon branch: ${record.neonBranchName}`);
  console.log(`Gym: ${record.gymName}`);
  console.log(`Artifact sha256: ${record.sourceArtifactSha256}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
