#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_RECORD_PATH = "artifacts/real-evidence/real-evidence-record.json";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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
      text,
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretShapedKeys(entry, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    invariant(
      !/(password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)/iu.test(
        key,
      ),
      `${label} contains secret-shaped key ${key}.`,
    );
    assertNoSecretShapedKeys(entry, `${label}.${key}`);
  }
}

export function normalizeArtifactPath(rawPath, label = "OUTPOST_REAL_EVIDENCE_RECORD_PATH") {
  const value = String(rawPath ?? "").trim();
  invariant(value, `${label} required.`);
  assertNoSecretShapedValue(value, label);
  invariant(!isAbsolute(value), `${label} must be repository-relative.`);
  invariant(!value.includes("\0"), `${label} cannot contain NUL.`);
  invariant(value.endsWith(".json"), `${label} must point to JSON.`);
  const resolved = resolve(value);
  const cwd = resolve(process.cwd());
  const relativePath = relative(cwd, resolved);
  invariant(
    !isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`),
    `${label} must stay under the repository.`,
  );
  invariant(relativePath.startsWith(`artifacts${sep}`), `${label} must be under artifacts/.`);
  invariant(value === relativePath, `${label} must be normalized.`);
  invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  return { relativePath, resolved };
}

export function readEvidenceArtifact(path) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, "real evidence artifact");
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, "real evidence artifact");
  return {
    artifact,
    raw,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

function assertFalse(record, key) {
  invariant(record[key] === false, `${key} must remain false.`);
}

export function inspectRealEvidenceRecord(rawPath = process.env.OUTPOST_REAL_EVIDENCE_RECORD_PATH ?? DEFAULT_RECORD_PATH) {
  const recordPath = normalizeArtifactPath(rawPath);
  const { artifact, sha256 } = readEvidenceArtifact(recordPath.resolved);
  const kind = String(artifact.artifact_kind ?? artifact.kind ?? "").trim();
  const status = String(artifact.status ?? "").trim();

  invariant(/^[a-z][a-z0-9_.:-]{1,120}$/u.test(kind), "Evidence kind shape mismatch.");
  invariant(/^[a-z][a-z0-9_.:-]{1,120}$/u.test(status), "Evidence status shape mismatch.");
  if (artifact.parent_sha256 !== undefined && artifact.parent_sha256 !== null) {
    invariant(/^[a-f0-9]{64}$/u.test(String(artifact.parent_sha256)), "Parent SHA256 shape mismatch.");
  }
  assertFalse(artifact, "public_self_serve_launch_allowed");
  assertFalse(artifact, "invite_delivery_allowed");
  assertFalse(artifact, "live_provider_enablement_allowed");
  assertFalse(artifact, "billing_pos_member_writes_allowed");

  return {
    artifact,
    kind,
    path: recordPath.relativePath,
    parentSha256: artifact.parent_sha256 ? String(artifact.parent_sha256) : null,
    sha256,
    status,
  };
}

function main() {
  const record = inspectRealEvidenceRecord();
  console.log("Real evidence record inspection passed");
  console.log(`Artifact: ${record.path}`);
  console.log(`Kind: ${record.kind}`);
  console.log(`SHA256: ${record.sha256}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
