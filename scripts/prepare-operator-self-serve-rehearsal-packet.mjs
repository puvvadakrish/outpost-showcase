#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

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

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

function normalizeArtifactPath(rawPath, label, { mustExist }) {
  invariant(rawPath?.trim(), `${label} is required.`);
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);
  assertNoSecretShapedValue(rawPath, label);
  const artifactPath = rawPath.trim();
  const resolvedPath = resolve(artifactPath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo = repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);
  invariant(!isInsideRepo || isIgnoredArtifactPath, `${label} must live under gitignored artifacts/ when repo-local.`);
  invariant(mustExist ? existsSync(artifactPath) : !existsSync(artifactPath), `${label} ${mustExist ? "was not found" : "already exists"} at ${artifactPath}.`);
  return artifactPath;
}

function readFollowThroughArtifact(path) {
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, "admin launch follow-through artifact");
  const parsed = JSON.parse(source);
  assertNoSecretShapedKeys(parsed, "admin launch follow-through artifact");
  return { artifact: parsed, artifactSha256: sha256(source) };
}

function validateFollowThroughArtifact(artifact) {
  invariant(artifact.status === "admin_launch_followthrough_prepared", "follow-through artifact status is not prepared.");
  invariant(artifact.public_self_serve_launch_allowed === false, "follow-through artifact must keep public self-serve blocked.");
  invariant(artifact.launch_enablement_allowed === false, "follow-through artifact must keep launch enablement blocked.");
  invariant(artifact.requires_human_review === true, "follow-through artifact must require human review.");
  invariant(
    artifact.recommended_next_slice?.id === "operator_assisted_self_serve_rehearsal",
    "follow-through artifact must target operator-assisted self-serve rehearsal."
  );
  invariant(typeof artifact.preview_url === "string" && artifact.preview_url.startsWith("https://") && artifact.preview_url.includes(".vercel.app"), "follow-through artifact must reference a protected Vercel Preview URL.");
  invariant(typeof artifact.neon_proof_branch === "string" && artifact.neon_proof_branch.length > 0, "follow-through artifact must include Neon proof branch.");
  invariant(artifact.neon_proof_branch !== "production", "Refusing rehearsal packet against Neon production branch.");
  invariant(artifact.neon_proof_branch !== "outpost-neon-spike", "Refusing rehearsal packet against migration spike branch.");
  invariant(artifact.launch_decision_record?.id, "follow-through artifact must include launch decision record id.");
  invariant(artifact.launch_decision_record?.decision_packet_sha256?.match(/^[a-f0-9]{64}$/u), "follow-through artifact must include decision packet digest.");
}

function buildPacket({ artifact, artifactPath, artifactSha256 }) {
  return {
    status: "operator_self_serve_rehearsal_packet_prepared",
    packet_kind: "operator_assisted_self_serve_rehearsal",
    generated_at: new Date().toISOString(),
    preview_url: artifact.preview_url,
    neon_proof_branch: artifact.neon_proof_branch,
    followthrough_artifact_path: artifactPath,
    followthrough_artifact_sha256: artifactSha256,
    launch_decision_record: artifact.launch_decision_record,
    public_self_serve_launch_allowed: false,
    launch_enablement_allowed: false,
    requires_human_review: true,
    completion_record_command: "npm run admin:self-serve-rehearsal:record",
    operator_rehearsal_checklist: [
      "Open protected Preview as operator and verify the admin proof ledger references the reviewed follow-through artifact.",
      "Create or identify the operator-managed beta owner access path without public signup or browser approval.",
      "Walk the owner through sign-in, owner workspace, source-to-answer review, staff task handoff, and rollback checklist.",
      "Confirm no invite delivery, notification dispatch, phone/email provider activation, billing, POS, access control, or member-ledger write occurs.",
      "Record completion only with customer-safe labels and no temporary passwords, tokens, cookies, or bypass secrets."
    ],
    still_blocked: [
      "public owner self-signup",
      "browser approval buttons",
      "invite delivery or notification sending",
      "phone or email provider activation",
      "billing, POS, access control, member-ledger writes"
    ]
  };
}

function main() {
  const followThroughPath = normalizeArtifactPath(
    process.env.OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_FOLLOWTHROUGH_PATH,
    "OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_FOLLOWTHROUGH_PATH",
    { mustExist: true }
  );
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_PACKET_PATH,
    "OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_PACKET_PATH",
    { mustExist: false }
  );
  const { artifact, artifactSha256 } = readFollowThroughArtifact(followThroughPath);
  validateFollowThroughArtifact(artifact);
  const packet = buildPacket({ artifact, artifactPath: followThroughPath, artifactSha256 });
  assertNoSecretShapedKeys(packet, "operator self-serve rehearsal packet");
  assertNoSecretShapedValue(JSON.stringify(packet), "operator self-serve rehearsal packet");
  mkdirSync(dirname(packetPath), { recursive: true });
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`);
  console.log(`Operator-assisted self-serve rehearsal packet wrote ${packetPath}`);
  console.log(`Preview: ${packet.preview_url}`);
  console.log(`Neon branch: ${packet.neon_proof_branch}`);
  console.log("Public self-serve launch: blocked");
  console.log("Live providers: blocked");
}

main();
