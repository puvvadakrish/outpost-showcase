#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const EXPORT_PATH =
  process.env.OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH ??
  "artifacts/admin-launch-readiness/admin-operator-next-actions.json";

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
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      text
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, path = "artifact") {
  if (!value || typeof value !== "object") {
    return;
  }
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
    invariant(
      !secretKey,
      `${path}.${key} is a secret-shaped key.`
    );
    assertNoSecretShapedKeys(nested, `${path}.${key}`);
  }
}

function normalizeArtifactPath(rawPath) {
  const artifactPath = rawPath.trim();
  invariant(artifactPath, "OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH required.");
  const resolvedPath = resolve(artifactPath);
  const repoRoot = process.cwd();
  const relativePath = relative(repoRoot, resolvedPath);
  const insideRepo = !relativePath.startsWith("..") && !isAbsolute(relativePath);
  const insideArtifacts = relativePath === "artifacts" || relativePath.startsWith(`artifacts${sep}`);
  invariant(!insideRepo || insideArtifacts, "Admin next-action export must live under gitignored artifacts/.");
  invariant(existsSync(resolvedPath), `Admin next-action export not found: ${artifactPath}.`);
  return { relativePath: insideRepo ? relativePath : artifactPath, resolvedPath };
}

function assertHttpsNonLocal(value, label) {
  invariant(typeof value === "string", `${label} must be a string.`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  invariant(parsed.protocol === "https:", `${label} must use https.`);
  invariant(!parsed.username && !parsed.password, `${label} must not include credentials.`);
  const hostname = parsed.hostname.replace(/^\[|\]$/gu, "");
  invariant(!["localhost", "127.0.0.1", "::1"].includes(hostname), `${label} must not be local.`);
}

function assertArtifactShape(artifact) {
  invariant(artifact.artifact_kind === "admin_operator_next_action_queue", "Admin next-action artifact kind mismatch.");
  invariant(artifact.status === "admin_operator_next_action_queue_exported", "Admin next-action artifact status mismatch.");
  assertHttpsNonLocal(artifact.preview_url, "Admin next-action Preview URL");
  invariant(artifact.public_self_serve_launch_allowed === false, "Public self-serve launch must stay blocked.");
  invariant(artifact.live_provider_enablement_allowed === false, "Live-provider enablement must stay blocked.");
  invariant(artifact.proof_freshness?.state === "fresh", "Proof freshness must be fresh before next-action export is actionable.");
  invariant(artifact.proof_freshness?.fresh > 0, "Proof freshness must include at least one fresh proof item.");
  invariant(artifact.proof_freshness?.stale === 0, "Proof freshness stale count must be zero.");
  invariant(artifact.proof_freshness?.missing === 0, "Proof freshness missing count must be zero.");
  invariant(artifact.blocked_gates?.includes("Public self-serve launch"), "Artifact must block public self-serve.");
  invariant(artifact.blocked_gates?.includes("Phone/email providers"), "Artifact must block phone/email providers.");
  invariant(
    artifact.blocked_gates?.includes("POS/access control/member-ledger writes"),
    "Artifact must block POS/access control/member-ledger writes."
  );
  invariant(["blocked", "done", "next", "waiting"].includes(artifact.next_action?.state), "Next action state invalid.");
  invariant(typeof artifact.next_action?.label === "string" && artifact.next_action.label, "Next action label required.");
  invariant(typeof artifact.next_action?.command === "string" && artifact.next_action.command, "Next action command required.");
  invariant(
    artifact.next_action.state === "done" || artifact.next_action.command !== "none",
    "Runnable next-action snapshots must include a command."
  );
  invariant(
    !/\b(?:approve|approval|sendInvite|sendEmail|enableProvider|billing|pos|memberLedger)\b/iu.test(
      artifact.next_action.command
    ),
    "Next action command includes blocked browser/live-provider affordance."
  );
}

function main() {
  const { relativePath, resolvedPath } = normalizeArtifactPath(EXPORT_PATH);
  const raw = readFileSync(resolvedPath, "utf8");
  assertNoSecretShapedValue(raw, "Admin next-action export artifact");
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, "Admin next-action export");
  assertArtifactShape(artifact);
  const sha256 = createHash("sha256").update(raw).digest("hex");

  console.log("Admin operator next actions export is actionable");
  console.log(`Artifact: ${relativePath}`);
  console.log(`SHA256: ${sha256}`);
  console.log(`Next action: ${artifact.next_action.label}`);
  console.log(`Proof freshness: ${artifact.proof_freshness.fresh} fresh`);
  console.log("Public self-serve and live-provider gates: blocked");
}

main();
