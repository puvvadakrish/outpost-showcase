#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const EXPORT_PATH =
  process.env.OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH ??
  "artifacts/admin-launch-readiness/admin-proof-freshness.json";

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

    invariant(
      !/(password|token|cookie|apikey|authorization|credential|privatekey|secret|bypass|signature|jwt)/u.test(
        normalizedKey
      ),
      `${label} contains secret-shaped key ${path}.`
    );
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function normalizeArtifactPath(rawPath) {
  const artifactPath = rawPath.trim();
  invariant(artifactPath, "OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH required.");
  const resolvedPath = resolve(artifactPath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo =
    repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);

  invariant(!isInsideRepo || isIgnoredArtifactPath, "Proof freshness artifact must live under gitignored artifacts/.");
  invariant(existsSync(resolvedPath), `Proof freshness artifact not found at ${artifactPath}.`);

  return {
    relativePath: isInsideRepo ? repoRelativePath : resolvedPath,
    resolvedPath
  };
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
  invariant(artifact.status === "admin_proof_freshness_exported", "Artifact status is invalid.");
  invariant(artifact.overall_state === "fresh", "Proof freshness must be fresh before launch handoff review.");
  assertHttpsNonLocal(artifact.preview_url, "Proof freshness Preview URL");
  invariant(typeof artifact.neon_branch_name === "string" && artifact.neon_branch_name.trim(), "Neon branch required.");
  invariant(!/^production$/iu.test(artifact.neon_branch_name), "Proof freshness must not target Neon production.");
  invariant(!/outpost-neon-spike/iu.test(artifact.neon_branch_name), "Proof freshness must not target migration spike.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Public self-serve launch must remain blocked.");
  invariant(artifact.live_provider_enablement_allowed === false, "Live-provider enablement must remain blocked.");
  invariant(artifact.counts?.fresh > 0, "At least one fresh proof item is required.");
  invariant(artifact.counts?.stale === 0, "Stale proof count must be zero.");
  invariant(artifact.counts?.missing === 0, "Missing proof count must be zero.");
  invariant(artifact.counts?.blocked === 0, "Blocked proof count must be zero.");
  invariant(
    artifact.blocked_gates?.includes("Browser approval buttons") &&
      artifact.blocked_gates?.includes("POS/access control/member-ledger writes"),
    "Artifact must include blocked browser and member-ledger gates."
  );

  const serializedCommand = JSON.stringify(artifact.next_command ?? "");
  invariant(
    !/\b(approve|approval|sendInvite|sendEmail|enableProvider|billing|pos|memberLedger)\b/u.test(serializedCommand),
    "Proof freshness next command includes blocked affordance."
  );
}

function main() {
  const { relativePath, resolvedPath } = normalizeArtifactPath(EXPORT_PATH);
  const raw = readFileSync(resolvedPath, "utf8");

  assertNoSecretShapedValue(raw, "Admin proof freshness export");
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, "Admin proof freshness export");
  assertArtifactShape(artifact);

  const sha256 = createHash("sha256").update(raw).digest("hex");
  console.log("Admin proof freshness inspection");
  console.log(`Artifact: ${relativePath}`);
  console.log(`SHA256: ${sha256}`);
  console.log(`Overall: ${artifact.overall_state}`);
  console.log("Public self-serve and live-provider gates: blocked");
}

main();
