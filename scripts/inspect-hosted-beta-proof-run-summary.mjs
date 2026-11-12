#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const SUMMARY_PATH =
  process.env.OUTPOST_BETA_PROOF_RUN_SUMMARY_PATH ??
  "artifacts/admin-launch-readiness/beta-proof-run-summary.json";

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
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("jwt") ||
      normalizedKey.includes("signature");
    invariant(!secretKey, `${label} contains secret-shaped key ${[...trail, key].join(".")}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function assertArtifactPath(path, label) {
  invariant(path?.trim(), `${label} is required.`);
  const resolved = resolve(path.trim());
  const repoRoot = process.cwd();
  const relativePath = relative(repoRoot, resolved);
  const isInsideRepo = !relativePath.startsWith("..") && !isAbsolute(relativePath);
  const isIgnoredArtifactPath = relativePath === "artifacts" || relativePath.startsWith(`artifacts${sep}`);
  invariant(!isInsideRepo || isIgnoredArtifactPath, `${label} must live under gitignored artifacts/ when repo-local.`);
  return resolved;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function verifySourceArtifact(entry, label) {
  invariant(typeof entry?.artifact_path === "string" && entry.artifact_path.trim(), `${label} artifact path is required.`);
  invariant(typeof entry?.artifact_sha256 === "string" && /^[a-f0-9]{64}$/u.test(entry.artifact_sha256), `${label} artifact sha256 is required.`);
  const artifactPath = assertArtifactPath(entry.artifact_path, `${label} artifact path`);
  invariant(existsSync(artifactPath), `${label} source artifact does not exist: ${entry.artifact_path}`);
  const raw = readFileSync(artifactPath, "utf8");
  assertNoSecretShapedValue(raw, `${label} source artifact`);
  invariant(sha256(raw) === entry.artifact_sha256, `${label} source artifact sha256 mismatch.`);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values) && values.includes(expected), `${label} must include ${expected}.`);
}

function main() {
  const summaryPath = assertArtifactPath(SUMMARY_PATH, "summary path");
  invariant(existsSync(summaryPath), `summary artifact does not exist: ${SUMMARY_PATH}`);
  const raw = readFileSync(summaryPath, "utf8");
  assertNoSecretShapedValue(raw, "hosted beta proof run summary");
  const summary = JSON.parse(raw);
  assertNoSecretShapedKeys(summary, "hosted beta proof run summary");
  invariant(summary.summary_kind === "hosted_beta_request_proof_run_summary", "summary kind mismatch.");
  invariant(summary.ready_for_next_slice === true, "summary must be ready for next slice.");
  invariant(typeof summary.app_origin === "string" && summary.app_origin.startsWith("https://"), "summary Preview origin must be HTTPS.");
  invariant(typeof summary.neon_branch_name === "string" && summary.neon_branch_name.trim(), "summary Neon branch is required.");
  invariant(summary.proofs?.browser_request?.status === "passed", "browser request proof must pass.");
  invariant(summary.proofs?.request_chain?.status === "passed", "request-chain proof must pass.");
  invariant(
    summary.cleanup?.browser_request === "cleanup_requested" || summary.cleanup?.browser_request === "retained",
    "browser request cleanup status is required."
  );
  invariant(
    summary.cleanup?.request_chain === "cleanup_requested" || summary.cleanup?.request_chain === "retained",
    "request-chain cleanup status is required."
  );
  verifySourceArtifact(summary.proofs.browser_request, "browser request proof");
  verifySourceArtifact(summary.proofs.request_chain, "request-chain proof");
  assertIncludes(summary.blocked_gates, "Public self-serve launch", "blocked gates");
  assertIncludes(summary.blocked_gates, "Browser approval buttons", "blocked gates");
  assertIncludes(summary.blocked_gates, "Invite delivery", "blocked gates");
  assertIncludes(summary.blocked_gates, "Phone/email providers", "blocked gates");
  assertIncludes(summary.blocked_gates, "POS/access control/member-ledger writes", "blocked gates");
  console.log("Hosted beta proof run summary inspected.");
  console.log(`Preview: ${summary.app_origin}`);
  console.log(`Branch: ${summary.neon_branch_name}`);
  console.log("Public self-serve and live-provider gates: blocked");
}

main();
