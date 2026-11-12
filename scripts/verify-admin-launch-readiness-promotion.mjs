#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const REQUIRED_READY_GATES = new Set([
  "Protected Preview proof",
  "Operator fulfillment path",
  "Reset and rollback readiness",
  "Customer-observed handoff"
]);

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

function readJsonArtifact(path, label) {
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

function validatePreviewUrl(value) {
  invariant(typeof value === "string" && value.trim(), "promotion requires a Preview URL.");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("promotion Preview URL must be a valid URL.");
  }

  invariant(parsed.protocol === "https:", "promotion Preview URL must use https.");
  invariant(!parsed.username && !parsed.password, "promotion Preview URL must not include credentials.");
  const hostname = parsed.hostname.toLowerCase();
  const localHostname =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    /^127\./u.test(hostname) ||
    /^10\./u.test(hostname) ||
    /^192\.168\./u.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./u.test(hostname);
  invariant(!localHostname, "promotion Preview URL must not be local.");
  assertNoSecretShapedValue(parsed.toString(), "promotion Preview URL");
  return parsed.toString().replace(/\/$/u, "");
}

function gateByLabel(artifact, label) {
  return artifact.gates?.find((gate) => gate.label === label);
}

function assertExportReadyForPromotion(artifact, exportPath) {
  invariant(artifact.status === "admin_launch_readiness_exported", "promotion source must be an admin launch readiness export.");
  invariant(artifact.source?.export_path === exportPath, "promotion source path must match the inspected export path.");
  invariant(artifact.public_self_serve_launch_allowed === false, "promotion cannot start from a public-launch-allowed artifact.");
  invariant(artifact.customer_observed_completion_claimed === true, "customer-observed completion must be claimed before promotion review.");
  invariant(Array.isArray(artifact.gates), "promotion source must include gates.");

  const previewUrl = validatePreviewUrl(artifact.preview_url);
  invariant(
    typeof artifact.neon_proof_branch === "string" && artifact.neon_proof_branch.trim(),
    "promotion requires a Neon proof branch."
  );
  assertNoSecretShapedValue(artifact.neon_proof_branch, "Neon proof branch");

  for (const label of REQUIRED_READY_GATES) {
    const gate = gateByLabel(artifact, label);
    invariant(gate?.state === "ready", `${label} must be ready before launch promotion review.`);
  }

  invariant(gateByLabel(artifact, "Live-provider and billing gates")?.state === "blocked", "live-provider gates must stay blocked.");
  invariant(gateByLabel(artifact, "Public self-serve launch")?.state === "blocked", "public self-serve launch must stay blocked.");
  invariant(
    artifact.non_goals?.includes("invite_delivery") && artifact.non_goals?.includes("member_ledger_writes"),
    "promotion source must include blocked invite and member-ledger non-goals."
  );

  return {
    neonProofBranch: artifact.neon_proof_branch.trim(),
    previewUrl
  };
}

function buildPromotionSummary({ artifact, exportPath, neonProofBranch, previewUrl, promotionPath }) {
  const summary = {
    status: "admin_launch_promotion_candidate_checked",
    generated_at: new Date().toISOString(),
    promotion_candidate_ready: true,
    public_self_serve_launch_allowed: false,
    preview_url: previewUrl,
    neon_proof_branch: neonProofBranch,
    source: {
      export_path: exportPath,
      promotion_path: promotionPath
    },
    ready_gates: [...REQUIRED_READY_GATES],
    blocked_gates: [
      "Live-provider and billing gates",
      "Public self-serve launch",
      "Invite delivery",
      "Notification sending",
      "Phone provider activation",
      "Email provider activation",
      "Billing",
      "POS",
      "Access control",
      "Member-ledger writes"
    ],
    next_step:
      "Attach this summary to a reviewed launch-enabling PR. Do not enable public self-serve or live providers from this command."
  };

  assertNoSecretShapedKeys(summary, "admin launch promotion summary");
  assertNoSecretShapedValue(JSON.stringify(summary), "admin launch promotion summary");
  return summary;
}

const exportPath = normalizeArtifactPath(
  process.env.OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH,
  "OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH"
);
const promotionPath = normalizeArtifactPath(
  process.env.OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH,
  "OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH"
);
invariant(promotionPath !== exportPath, "promotion output path must be different from the launch-readiness export path.");
const artifact = readJsonArtifact(exportPath, "admin launch readiness export");
const promotionInputs = assertExportReadyForPromotion(artifact, exportPath);
const summary = buildPromotionSummary({
  artifact,
  exportPath,
  promotionPath,
  ...promotionInputs
});

mkdirSync(dirname(promotionPath), { recursive: true });
writeFileSync(promotionPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log(`Admin launch promotion gate wrote ${promotionPath}`);
console.log(`Preview: ${summary.preview_url}`);
console.log(`Neon branch: ${summary.neon_proof_branch}`);
console.log("Promotion candidate: checked");
console.log("Public self-serve launch: blocked");
