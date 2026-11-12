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

function readExport(path) {
  invariant(existsSync(path), `Admin launch readiness export was not found at ${path}.`);
  const content = readFileSync(path, "utf8");
  assertNoSecretShapedValue(content, "admin launch readiness export");

  try {
    const parsed = JSON.parse(content);
    assertNoSecretShapedKeys(parsed, "admin launch readiness export");
    assertNoSecretShapedValue(JSON.stringify(parsed), "admin launch readiness export");
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Admin launch readiness export must be valid JSON.");
    }
    throw error;
  }
}

function assertExportShape(artifact, path) {
  invariant(artifact.status === "admin_launch_readiness_exported", "export status is not admin_launch_readiness_exported.");
  invariant(artifact.public_self_serve_launch_allowed === false, "public self-serve must not be launch-allowed.");
  invariant(Array.isArray(artifact.gates), "export gates must be an array.");
  invariant(Array.isArray(artifact.command_sequence), "export command_sequence must be an array.");
  invariant(artifact.command_sequence.includes("npm run vercel:preview:verify"), "export must include protected Preview verification.");
  invariant(artifact.command_sequence.includes("npm run admin:launch-readiness:inspect"), "export must include its inspect command.");
  invariant(artifact.source?.export_path === path, "export source path must match the inspected path.");

  const liveGate = artifact.gates.find((gate) => gate.label === "Live-provider and billing gates");
  const selfServeGate = artifact.gates.find((gate) => gate.label === "Public self-serve launch");
  invariant(liveGate?.state === "blocked", "live-provider and billing gates must be blocked.");
  invariant(selfServeGate?.state === "blocked", "public self-serve launch must be blocked.");
  invariant(
    artifact.non_goals?.includes("invite_delivery") && artifact.non_goals?.includes("member_ledger_writes"),
    "export must include blocked invite and member-ledger non-goals."
  );
}

const exportPath = normalizeArtifactPath(
  process.env.OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH,
  "OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH"
);
const artifact = readExport(exportPath);
assertExportShape(artifact, exportPath);

console.log("Admin launch readiness export inspection");
console.log(`Status: ${artifact.status}`);
console.log(`Preview: ${artifact.preview_url}`);
console.log(`Neon branch: ${artifact.neon_proof_branch}`);
console.log(`Customer-observed completion claimed: ${artifact.customer_observed_completion_claimed}`);
console.log("Live-provider and billing gates: blocked");
console.log("Public self-serve launch: blocked");

