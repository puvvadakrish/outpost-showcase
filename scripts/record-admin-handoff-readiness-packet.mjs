#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const PACKET_PATH =
  process.env.OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH ??
  "artifacts/admin-launch-readiness/admin-handoff-readiness-packet.json";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  invariant(value, `${name} required.`);
  return value;
}

function optionalEnv(name) {
  return process.env[name]?.trim() ?? "";
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
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      text
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, path = "artifact") {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
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
    invariant(!secretKey, `${path}.${key} is secret-shaped.`);
    assertNoSecretShapedKeys(nested, `${path}.${key}`);
  }
}

function normalizeArtifactPath(artifactPath, envName) {
  assertNoSecretShapedValue(artifactPath, envName);
  invariant(!isAbsolute(artifactPath), `${envName} must be repo-relative.`);
  const resolvedPath = resolve(process.cwd(), artifactPath);
  const repoRoot = resolve(process.cwd());
  const relativePath = relative(repoRoot, resolvedPath);
  invariant(relativePath && !relativePath.startsWith("..") && !relativePath.includes(`..${sep}`), `${envName} must stay inside repo.`);
  invariant(relativePath.startsWith(`artifacts${sep}`) || relativePath === "artifacts", `${envName} must stay under artifacts/.`);
  invariant(existsSync(resolvedPath), `${envName} not found: ${artifactPath}.`);
  return { relativePath: relativePath.split(sep).join("/"), resolvedPath };
}

function readArtifact(artifactPath, envName) {
  const normalized = normalizeArtifactPath(artifactPath, envName);
  const raw = readFileSync(normalized.resolvedPath, "utf8");
  assertNoSecretShapedValue(raw, envName);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, envName);
  return {
    ...normalized,
    artifact,
    sha256: createHash("sha256").update(raw).digest("hex")
  };
}

function normalizedPreviewOrigin(value, label) {
  invariant(typeof value === "string" && value.trim(), `${label} required.`);
  assertNoSecretShapedValue(value, label);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  invariant(parsed.protocol === "https:", `${label} must use https.`);
  invariant(parsed.hostname.endsWith(".vercel.app"), `${label} must be a Vercel Preview origin.`);
  invariant(!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), `${label} must not be local.`);
  invariant(!parsed.username && !parsed.password, `${label} must not include credentials.`);
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/u, "");
}

function assertContext(artifact, { branchName, previewUrl }, label) {
  const artifactPreview = artifact.preview_url ?? artifact.previewUrl;
  const artifactBranch = artifact.neon_branch_name ?? artifact.neon_proof_branch;
  invariant(normalizedPreviewOrigin(artifactPreview, `${label} Preview URL`) === previewUrl, `${label} Preview URL mismatch.`);
  invariant(artifactBranch === branchName, `${label} Neon branch mismatch.`);
}

function assertLaunchReadiness(artifact) {
  invariant(artifact.status === "admin_launch_readiness_exported", "Launch-readiness artifact status invalid.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Launch-readiness public self-serve must stay blocked.");
  const liveGate = artifact.gates?.find((gate) => /live-provider/iu.test(gate.label ?? ""));
  const selfServeGate = artifact.gates?.find((gate) => gate.label === "Public self-serve launch");
  invariant(liveGate?.state === "blocked", "Launch-readiness live-provider gate must stay blocked.");
  invariant(selfServeGate?.state === "blocked", "Launch-readiness public self-serve gate must stay blocked.");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runCommand(args, env, label) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, label);
  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }
  return output;
}

function runNeonPsql(config, args) {
  return runCommand(
    [
      "neon",
      ...withNeonApiKey([
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
      ])
    ],
    {},
    "Neon Admin handoff packet record"
  );
}

function insertRecord(config, record) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-admin-handoff-packet-record-"));
  const sqlPath = join(tempDir, "record.sql");
  try {
    writeFileSync(
      sqlPath,
      `
\\set ON_ERROR_STOP on
insert into admin_handoff_packet_records (
  id,
  status,
  app_origin,
  neon_branch_name,
  packet_path,
  packet_sha256,
  readiness_state,
  proof_freshness_sha256,
  next_actions_sha256,
  launch_readiness_sha256,
  public_self_serve_launch_allowed,
  live_provider_enablement_allowed,
  replay_verified,
  reviewer_label,
  review_note_present,
  recorded_at
) values (
  ${sqlLiteral(record.id)},
  'admin_handoff_packet_recorded',
  ${sqlLiteral(record.appOrigin)},
  ${sqlLiteral(record.neonBranchName)},
  ${sqlLiteral(record.packetPath)},
  ${sqlLiteral(record.packetSha256)},
  ${sqlLiteral(record.readinessState)},
  ${sqlLiteral(record.proofFreshnessSha256)},
  ${sqlLiteral(record.nextActionsSha256)},
  ${sqlLiteral(record.launchReadinessSha256)},
  false,
  false,
  true,
  ${sqlLiteral(record.reviewerLabel)},
  ${record.reviewNotePresent ? "true" : "false"},
  now()
)
on conflict (packet_sha256) do nothing
returning id;
`,
      "utf8"
    );
    return runNeonPsql(config, ["-t", "-A", "-f", sqlPath]).trim();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const config = readHostedReadinessConfig();
  const packet = readArtifact(PACKET_PATH, "OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH");
  const artifact = packet.artifact;
  invariant(artifact.artifact_kind === "admin_handoff_readiness_packet", "Packet kind mismatch.");
  invariant(artifact.status === "admin_handoff_readiness_packet_exported", "Packet status mismatch.");
  invariant(["action_required", "ready"].includes(artifact.readiness_state), "Packet readiness state invalid.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Packet public self-serve must stay blocked.");
  invariant(artifact.live_provider_enablement_allowed === false, "Packet live providers must stay blocked.");
  invariant(!/^production$/iu.test(artifact.neon_branch_name), "Refusing Admin handoff packet record against production branch.");
  invariant(!/outpost-neon-spike/iu.test(artifact.neon_branch_name), "Refusing Admin handoff packet record against migration spike branch.");
  invariant(artifact.neon_branch_name === config.branchName, "Packet Neon branch must match OUTPOST_NEON_BRANCH_NAME.");
  const appOrigin = normalizedPreviewOrigin(artifact.preview_url, "Packet Preview URL");
  if (process.env.NEXT_PUBLIC_OUTPOST_APP_URL) {
    invariant(
      appOrigin === normalizedPreviewOrigin(process.env.NEXT_PUBLIC_OUTPOST_APP_URL, "NEXT_PUBLIC_OUTPOST_APP_URL"),
      "Packet Preview URL must match NEXT_PUBLIC_OUTPOST_APP_URL."
    );
  }

  const proofFreshness = readArtifact(requireEnv("OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH"), "OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH");
  const nextActions = readArtifact(requireEnv("OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH"), "OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH");
  const launchReadiness = readArtifact(requireEnv("OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH"), "OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH");
  invariant(artifact.packet_inputs?.proof_freshness_export === proofFreshness.relativePath, "Packet proof freshness input path mismatch.");
  invariant(artifact.packet_inputs?.next_actions_export === nextActions.relativePath, "Packet next-actions input path mismatch.");
  invariant(artifact.packet_inputs?.launch_readiness_export === launchReadiness.relativePath, "Packet launch-readiness input path mismatch.");
  assertContext(proofFreshness.artifact, { branchName: artifact.neon_branch_name, previewUrl: appOrigin }, "Proof freshness");
  assertContext(nextActions.artifact, { branchName: artifact.neon_branch_name, previewUrl: appOrigin }, "Next-actions");
  assertContext(launchReadiness.artifact, { branchName: artifact.neon_branch_name, previewUrl: appOrigin }, "Launch-readiness");
  invariant(proofFreshness.artifact.status === "admin_proof_freshness_exported", "Proof freshness artifact status invalid.");
  invariant(proofFreshness.artifact.overall_state === "fresh", "Proof freshness must be fresh.");
  invariant(nextActions.artifact.status === "admin_operator_next_action_queue_exported", "Next-actions artifact status invalid.");
  invariant(nextActions.artifact.proof_freshness?.state === "fresh", "Next-actions proof freshness must be fresh.");
  assertLaunchReadiness(launchReadiness.artifact);

  const reviewerLabel = requireEnv("OUTPOST_ADMIN_HANDOFF_READINESS_REVIEWER");
  assertNoSecretShapedValue(reviewerLabel, "OUTPOST_ADMIN_HANDOFF_READINESS_REVIEWER");
  const reviewNote = optionalEnv("OUTPOST_ADMIN_HANDOFF_READINESS_REVIEW_NOTE");
  assertNoSecretShapedValue(reviewNote, "OUTPOST_ADMIN_HANDOFF_READINESS_REVIEW_NOTE");
  const record = {
    appOrigin,
    id: `admin_handoff_packet_${createHash("sha256").update(`${packet.sha256}:${reviewerLabel}`).digest("hex").slice(0, 16)}`,
    launchReadinessSha256: launchReadiness.sha256,
    neonBranchName: artifact.neon_branch_name,
    nextActionsSha256: nextActions.sha256,
    packetPath: packet.relativePath,
    packetSha256: packet.sha256,
    proofFreshnessSha256: proofFreshness.sha256,
    readinessState: artifact.readiness_state,
    reviewerLabel,
    reviewNotePresent: reviewNote.length > 0
  };
  const insertedId = insertRecord(config, record);
  console.log("Admin handoff readiness packet record import");
  console.log(`Packet: ${record.packetPath}`);
  console.log(`Packet SHA256: ${record.packetSha256}`);
  console.log(insertedId ? `Inserted: ${insertedId}` : "Already recorded: packet digest");
  console.log("Replay verified: true");
  console.log("Public self-serve and live-provider gates: blocked");
}

main();
