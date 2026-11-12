#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";

const PACKET_PATH =
  process.env.OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH ??
  "artifacts/admin-launch-readiness/admin-handoff-readiness-packet.json";
const PROOF_PATH =
  process.env.OUTPOST_ADMIN_HANDOFF_READINESS_HOSTED_PROOF_PATH ??
  "artifacts/admin-launch-readiness/admin-handoff-readiness-hosted-proof.json";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  invariant(value, `${name} required.`);
  assertNoSecretShapedValue(value, name);
  return value;
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
  invariant(!secretValue, `${label} contains secret-shaped value.`);
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
    invariant(!secretKey, `${label} contains secret-shaped key at ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function normalizeArtifactPath(rawPath, label, { mustExist = true } = {}) {
  invariant(rawPath?.trim(), `${label} required.`);
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);
  assertNoSecretShapedValue(rawPath, label);
  const resolvedPath = resolve(rawPath.trim());
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo = repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);
  invariant(
    !isInsideRepo || isIgnoredArtifactPath,
    `${label} must live under gitignored artifacts/ when it is repo-local.`
  );
  if (mustExist) {
    invariant(existsSync(resolvedPath), `${label} does not exist: ${rawPath}`);
  }
  return {
    inputPath: rawPath.trim(),
    relativePath: isInsideRepo ? repoRelativePath : rawPath.trim(),
    resolvedPath
  };
}

function readJsonArtifact(rawPath, label) {
  const normalized = normalizeArtifactPath(rawPath, label);
  const raw = readFileSync(normalized.resolvedPath, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
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
  invariant(parsed.hostname.endsWith(".vercel.app"), `${label} must be a protected Vercel Preview origin.`);
  invariant(!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), `${label} must not be local.`);
  invariant(!parsed.username && !parsed.password, `${label} must not include credentials.`);
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/u, "");
}

function runNodeScript(scriptPath, env, label) {
  const result = spawnSync("node", [scriptPath], {
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

function writeJsonArtifact(rawPath, artifact) {
  const normalized = normalizeArtifactPath(rawPath, "OUTPOST_ADMIN_HANDOFF_READINESS_HOSTED_PROOF_PATH", {
    mustExist: false
  });
  assertNoSecretShapedKeys(artifact, "Admin handoff hosted proof summary");
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "Admin handoff hosted proof summary");
  mkdirSync(dirname(normalized.resolvedPath), { recursive: true });
  writeFileSync(normalized.resolvedPath, serialized, "utf8");
  return normalized.relativePath;
}

function main() {
  const config = readHostedReadinessConfig();
  const packet = readJsonArtifact(PACKET_PATH, "OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH");
  const previewUrl = normalizedPreviewOrigin(packet.artifact.preview_url, "packet Preview URL");

  invariant(packet.artifact.status === "admin_handoff_readiness_packet_exported", "Packet status mismatch.");
  invariant(packet.artifact.neon_branch_name === config.branchName, "Packet branch must match OUTPOST_NEON_BRANCH_NAME.");
  invariant(!/^production$/iu.test(config.branchName), "Refusing Admin handoff hosted proof against production branch.");
  invariant(!/outpost-neon-spike/iu.test(config.branchName), "Refusing Admin handoff hosted proof against migration spike branch.");
  if (process.env.NEXT_PUBLIC_OUTPOST_APP_URL) {
    invariant(
      previewUrl === normalizedPreviewOrigin(process.env.NEXT_PUBLIC_OUTPOST_APP_URL, "NEXT_PUBLIC_OUTPOST_APP_URL"),
      "Packet Preview URL must match NEXT_PUBLIC_OUTPOST_APP_URL."
    );
  }

  const sharedEnv = {
    OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH: packet.inputPath,
    OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH: requireEnv("OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH"),
    OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH: requireEnv("OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH"),
    OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH: requireEnv("OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH")
  };

  const replayOutput = runNodeScript("scripts/replay-admin-handoff-readiness-packet.mjs", sharedEnv, "Admin handoff packet replay");
  const recordOutput = runNodeScript(
    "scripts/record-admin-handoff-readiness-packet.mjs",
    {
      ...sharedEnv,
      OUTPOST_ADMIN_HANDOFF_READINESS_REVIEWER: requireEnv("OUTPOST_ADMIN_HANDOFF_READINESS_REVIEWER")
    },
    "Admin handoff packet record import"
  );

  const summary = {
    status: "admin_handoff_readiness_hosted_proof_passed",
    generated_at: new Date().toISOString(),
    preview_url: previewUrl,
    neon_branch_name: config.branchName,
    packet_path: packet.relativePath,
    packet_sha256: packet.sha256,
    packet_readiness_state: packet.artifact.readiness_state,
    replay_verified: replayOutput.includes("Replay verified"),
    record_import_verified: recordOutput.includes("Replay verified: true"),
    public_self_serve_launch_allowed: false,
    live_provider_enablement_allowed: false,
    no_live_provider_boundaries: [
      "public_self_signup",
      "invite_delivery",
      "notification_sending",
      "phone_provider_activation",
      "email_provider_activation",
      "billing",
      "pos",
      "access_control",
      "member_ledger_writes"
    ]
  };
  const proofPath = writeJsonArtifact(PROOF_PATH, summary);
  console.log("Admin handoff readiness hosted proof");
  console.log(`Packet: ${packet.relativePath}`);
  console.log(`Packet SHA256: ${packet.sha256}`);
  console.log(`Proof summary: ${proofPath}`);
  console.log("Replay verified: true");
  console.log("Record import verified: true");
  console.log("Public self-serve and live-provider gates remain blocked.");
}

main();
