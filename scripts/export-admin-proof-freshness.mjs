#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const EXPORT_PATH =
  process.env.OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH ??
  "artifacts/admin-launch-readiness/admin-proof-freshness.json";
const STATES = new Set(["blocked", "fresh", "missing", "stale"]);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  invariant(value, `${name} required.`);
  return value;
}

function numberEnv(name) {
  const value = Number.parseInt(requireEnv(name), 10);
  invariant(Number.isInteger(value) && value >= 0, `${name} must be a non-negative integer.`);
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
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      text
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function normalizeArtifactPath(rawPath) {
  const artifactPath = rawPath.trim();
  invariant(artifactPath, "OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH required.");
  const resolvedPath = resolve(artifactPath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo = !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isInsideArtifacts = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);
  invariant(!isInsideRepo || isInsideArtifacts, "Admin proof freshness export must live under gitignored artifacts/.");
  return { relativePath: isInsideRepo ? repoRelativePath : artifactPath, resolvedPath };
}

function normalizedPreviewOrigin(rawUrl, envName) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${envName} must be a valid URL.`);
  }
  invariant(parsed.protocol === "https:", `${envName} must use https.`);
  invariant(!parsed.username && !parsed.password, `${envName} must not include credentials.`);
  const hostname = parsed.hostname.replace(/^\[|\]$/gu, "");
  invariant(!["localhost", "127.0.0.1", "::1"].includes(hostname), `${envName} must not be local.`);
  return parsed.origin;
}

function assertFreshnessCounts({ blocked, fresh, missing, stale, state }) {
  invariant(STATES.has(state), "Admin proof freshness overall state invalid.");
  if (state === "fresh") {
    invariant(fresh > 0 && stale === 0 && missing === 0 && blocked === 0, "Fresh proof state requires only fresh counts.");
  } else if (state === "missing") {
    invariant(missing > 0 && stale === 0 && blocked === 0, "Missing proof state requires missing count.");
  } else if (state === "stale") {
    invariant(stale > 0 && blocked === 0, "Stale proof state requires stale count.");
  } else {
    invariant(blocked > 0, "Blocked proof state requires blocked count.");
  }
}

function main() {
  const { relativePath, resolvedPath } = normalizeArtifactPath(EXPORT_PATH);
  const previewUrl = normalizedPreviewOrigin(
    requireEnv("OUTPOST_ADMIN_PROOF_FRESHNESS_PREVIEW_URL"),
    "OUTPOST_ADMIN_PROOF_FRESHNESS_PREVIEW_URL"
  );
  const branchName = requireEnv("OUTPOST_NEON_BRANCH_NAME");
  const overallState = requireEnv("OUTPOST_ADMIN_PROOF_FRESHNESS_OVERALL");
  const counts = {
    blocked: numberEnv("OUTPOST_ADMIN_PROOF_FRESHNESS_BLOCKED_COUNT"),
    fresh: numberEnv("OUTPOST_ADMIN_PROOF_FRESHNESS_FRESH_COUNT"),
    missing: numberEnv("OUTPOST_ADMIN_PROOF_FRESHNESS_MISSING_COUNT"),
    stale: numberEnv("OUTPOST_ADMIN_PROOF_FRESHNESS_STALE_COUNT")
  };
  const nextCommand = requireEnv("OUTPOST_ADMIN_PROOF_FRESHNESS_NEXT_COMMAND");

  assertFreshnessCounts({ ...counts, state: overallState });
invariant(!/^production$/iu.test(branchName), "Refusing Admin proof freshness export against production branch.");
invariant(!/outpost-neon-spike/iu.test(branchName), "Refusing Admin proof freshness export against migration spike branch.");
  invariant(
    !/\b(?:approve|approval|sendInvite|sendEmail|enableProvider|billing|pos|memberLedger)\b/iu.test(nextCommand),
    "Proof freshness next command includes blocked browser/live-provider affordance."
  );

  const artifact = {
    artifact_kind: "admin_proof_freshness",
    blocked_gates: [
      "Browser approval buttons",
      "Public self-serve launch",
      "Invite delivery",
      "Notification sending",
      "Phone/email providers",
      "Billing",
      "POS/access control/member-ledger writes"
    ],
    counts,
    generated_at: new Date().toISOString(),
    live_provider_enablement_allowed: false,
    neon_branch_name: branchName,
    next_command: nextCommand,
    overall_state: overallState,
    preview_url: previewUrl,
    public_self_serve_launch_allowed: false,
    status: "admin_proof_freshness_exported"
  };
  const raw = `${JSON.stringify(artifact, null, 2)}\n`;
  assertNoSecretShapedValue(raw, "Admin proof freshness export");

  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, raw, "utf8");
  const sha256 = createHash("sha256").update(raw).digest("hex");

  console.log("Admin proof freshness export");
  console.log(`Artifact: ${relativePath}`);
  console.log(`SHA256: ${sha256}`);
  console.log(`Overall: ${overallState}`);
  console.log("Public self-serve and live-provider gates: blocked");
}

main();
