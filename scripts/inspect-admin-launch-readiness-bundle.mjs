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

function readBundle(path) {
  invariant(existsSync(path), `Admin launch readiness bundle was not found at ${path}.`);
  const content = readFileSync(path, "utf8");
  assertNoSecretShapedValue(content, "admin launch readiness bundle");

  try {
    const parsed = JSON.parse(content);
    assertNoSecretShapedKeys(parsed, "admin launch readiness bundle");
    assertNoSecretShapedValue(JSON.stringify(parsed), "admin launch readiness bundle");
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Admin launch readiness bundle must be valid JSON.");
    }
    throw error;
  }
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} must include ${expected}.`);
}

function assertHttpsNonLocal(value, label) {
  invariant(typeof value === "string" && value.trim(), `${label} is required.`);
  invariant(value.startsWith("https://"), `${label} must use https.`);
  invariant(!/^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?/iu.test(value), `${label} must not be local.`);
}

function assertBundleShape(bundle, path) {
  invariant(bundle.status === "admin_launch_readiness_bundle_prepared", "bundle status is not admin_launch_readiness_bundle_prepared.");
  invariant(bundle.public_self_serve_launch_allowed === false, "public self-serve must not be launch-allowed.");
  invariant(bundle.customer_observed_completion_claimed === true, "customer-observed completion must be claimed before bundle inspection.");
  assertHttpsNonLocal(bundle.preview_url, "bundle preview URL");
  invariant(typeof bundle.neon_proof_branch === "string" && bundle.neon_proof_branch.trim(), "bundle Neon proof branch is required.");
  invariant(bundle.artifacts?.bundle_path === path, "bundle artifact path must match the inspected path.");
  invariant(typeof bundle.artifacts?.export_path === "string" && bundle.artifacts.export_path.trim(), "bundle export path is required.");
  invariant(typeof bundle.artifacts?.promotion_path === "string" && bundle.artifacts.promotion_path.trim(), "bundle promotion path is required.");
  invariant(typeof bundle.artifacts?.release_note_path === "string" && bundle.artifacts.release_note_path.trim(), "bundle release note path is required.");
  assertIncludes(bundle.ready_gates, "Protected Preview proof", "bundle ready gates");
  assertIncludes(bundle.ready_gates, "Operator fulfillment path", "bundle ready gates");
  assertIncludes(bundle.ready_gates, "Reset and rollback readiness", "bundle ready gates");
  assertIncludes(bundle.ready_gates, "Customer-observed handoff", "bundle ready gates");
  assertIncludes(bundle.blocked_gates, "Live-provider and billing gates", "bundle blocked gates");
  assertIncludes(bundle.blocked_gates, "Public self-serve launch", "bundle blocked gates");
  assertIncludes(bundle.blocked_gates, "Invite delivery", "bundle blocked gates");
  assertIncludes(bundle.blocked_gates, "Member-ledger writes", "bundle blocked gates");
  assertIncludes(bundle.command_sequence, "npm run admin:launch-readiness:inspect", "bundle command sequence");
  assertIncludes(bundle.non_goals, "public_self_signup", "bundle non-goals");
  assertIncludes(bundle.non_goals, "invite_delivery", "bundle non-goals");
  assertIncludes(bundle.non_goals, "phone_provider_activation", "bundle non-goals");
  assertIncludes(bundle.non_goals, "email_provider_activation", "bundle non-goals");
  assertIncludes(bundle.non_goals, "billing", "bundle non-goals");
  assertIncludes(bundle.non_goals, "pos", "bundle non-goals");
  assertIncludes(bundle.non_goals, "access_control", "bundle non-goals");
  assertIncludes(bundle.non_goals, "member_ledger_writes", "bundle non-goals");
  invariant(
    typeof bundle.review_boundary === "string" && bundle.review_boundary.includes("does not mutate hosted data"),
    "bundle review boundary must keep this artifact review-only."
  );
}

const bundlePath = normalizeArtifactPath(
  process.env.OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH,
  "OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH"
);
const bundle = readBundle(bundlePath);
assertBundleShape(bundle, bundlePath);

console.log("Admin launch readiness bundle inspection");
console.log(`Status: ${bundle.status}`);
console.log(`Preview: ${bundle.preview_url}`);
console.log(`Neon branch: ${bundle.neon_proof_branch}`);
console.log(`Customer-observed completion claimed: ${bundle.customer_observed_completion_claimed}`);
console.log("Live-provider and billing gates: blocked");
console.log("Public self-serve launch: blocked");
