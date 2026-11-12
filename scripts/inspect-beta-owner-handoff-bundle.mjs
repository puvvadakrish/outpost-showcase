#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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
  return artifactPath;
}

function readJson(path, label) {
  invariant(existsSync(path), `${label} was not found at ${path}.`);
  const content = readFileSync(path, "utf8");
  assertNoSecretShapedValue(content, label);

  try {
    const parsed = JSON.parse(content);
    assertNoSecretShapedKeys(parsed, label);
    assertNoSecretShapedValue(JSON.stringify(parsed), label);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${label} must be valid JSON.`);
    }
    throw error;
  }
}

function readTextArtifact(path, label) {
  invariant(existsSync(path), `${label} was not found at ${path}.`);
  const content = readFileSync(path, "utf8");
  assertNoSecretShapedValue(content, label);
  return content;
}

function assertPreparedBundle(manifest, manifestPath) {
  invariant(manifest.status === "beta_owner_handoff_prepared", "bundle manifest status is not prepared.");
  invariant(manifest.evidence_basis === "operator_generated_checklist_and_packet", "bundle manifest evidence basis is invalid.");
  invariant(manifest.customer_observed === false, "bundle manifest must not be customer-observed.");
  invariant(manifest.live_provider_gate === "blocked", "bundle manifest must keep the live-provider gate blocked.");
  invariant(Array.isArray(manifest.prepared_steps), "bundle manifest prepared_steps must be an array.");
  invariant(manifest.prepared_steps.includes("checklist"), "bundle manifest must include checklist preparation.");
  invariant(manifest.prepared_steps.includes("packet"), "bundle manifest must include packet preparation.");
  invariant(Array.isArray(manifest.pending_steps), "bundle manifest pending_steps must be an array.");
  invariant(
    manifest.pending_steps.includes("customer_observed_completion"),
    "bundle manifest must keep customer-observed completion pending."
  );
  const manifestArtifactPath = normalizeArtifactPath(manifest.artifacts?.manifest_path, "bundle manifest artifact path");
  invariant(resolve(manifestArtifactPath) === resolve(manifestPath), "bundle manifest path does not match the inspected path.");

  const checklistPath = normalizeArtifactPath(manifest.artifacts?.checklist_path, "bundle checklist artifact path");
  const packetPath = normalizeArtifactPath(manifest.artifacts?.packet_path, "bundle packet artifact path");
  const completionPath = normalizeArtifactPath(manifest.artifacts?.completion_path, "bundle completion artifact path");
  const gatePath = normalizeArtifactPath(manifest.artifacts?.gate_path, "bundle gate artifact path");
  const checklist = readTextArtifact(checklistPath, "beta owner handoff checklist");
  const packet = readTextArtifact(packetPath, "beta owner handoff packet");

  invariant(checklist.includes("Beta Handoff Execution Checklist"), "checklist artifact does not look like a handoff checklist.");
  invariant(packet.includes("Beta Owner Handoff Packet"), "packet artifact does not look like a handoff packet.");
  invariant(packet.includes("No claim that a customer-observed handoff has completed"), "packet must preserve completion boundary.");

  return {
    checklistPath,
    completionPath,
    gatePath,
    packetPath
  };
}

const manifestPath = normalizeArtifactPath(
  process.env.OUTPOST_BETA_HANDOFF_BUNDLE_PATH,
  "OUTPOST_BETA_HANDOFF_BUNDLE_PATH"
);
const manifest = readJson(manifestPath, "beta owner handoff bundle manifest");
const artifacts = assertPreparedBundle(manifest, manifestPath);

console.log("Beta owner handoff bundle inspection");
console.log(`Status: ${manifest.status}`);
console.log(`Customer observed: ${manifest.customer_observed}`);
console.log(`Live-provider gate: ${manifest.live_provider_gate}`);
console.log(`Gym: ${manifest.gym}`);
console.log(`Owner email: ${manifest.beta_owner?.email}`);
console.log(`Preview URL: ${manifest.preview_url}`);
console.log(`Checklist: ${artifacts.checklistPath}`);
console.log(`Packet: ${artifacts.packetPath}`);
console.log(`Completion placeholder: ${artifacts.completionPath}`);
console.log(`Gate placeholder: ${artifacts.gatePath}`);
console.log("Next: run beta:owner-handoff:complete only after a real external owner observes the protected Preview flow.");
