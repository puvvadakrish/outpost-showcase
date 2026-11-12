#!/usr/bin/env node

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
  invariant(typeof value === "string" && value.trim(), "release note requires a Preview URL.");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("release note Preview URL must be a valid URL.");
  }

  invariant(parsed.protocol === "https:", "release note Preview URL must use https.");
  invariant(!parsed.username && !parsed.password, "release note Preview URL must not include credentials.");
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
  invariant(!localHostname, "release note Preview URL must not be local.");
  assertNoSecretShapedValue(parsed.toString(), "release note Preview URL");
  return parsed.toString().replace(/\/$/u, "");
}

function assertPromotionReadyForReleaseNote(summary, promotionPath) {
  invariant(
    summary.status === "admin_launch_promotion_candidate_checked",
    "release note source must be a checked admin launch promotion candidate."
  );
  invariant(summary.source?.promotion_path === promotionPath, "release note source path must match the promotion artifact path.");
  invariant(summary.promotion_candidate_ready === true, "promotion candidate must be ready before release note generation.");
  invariant(summary.public_self_serve_launch_allowed === false, "release note cannot start from a public-launch-allowed artifact.");
  invariant(Array.isArray(summary.ready_gates) && summary.ready_gates.length > 0, "release note source must include ready gates.");
  invariant(Array.isArray(summary.blocked_gates) && summary.blocked_gates.length > 0, "release note source must include blocked gates.");
  const readyGateSet = new Set(summary.ready_gates);
  const contradictoryGates = summary.blocked_gates.filter((gate) => readyGateSet.has(gate));
  invariant(
    contradictoryGates.length === 0,
    `release note source has contradictory ready and blocked gates: ${contradictoryGates.join(", ")}.`
  );
  invariant(summary.blocked_gates.includes("Public self-serve launch"), "release note source must keep public self-serve blocked.");
  invariant(summary.blocked_gates.includes("Member-ledger writes"), "release note source must keep member-ledger writes blocked.");

  const previewUrl = validatePreviewUrl(summary.preview_url);
  invariant(
    typeof summary.neon_proof_branch === "string" && summary.neon_proof_branch.trim(),
    "release note requires a Neon proof branch."
  );
  assertNoSecretShapedValue(summary.neon_proof_branch, "Neon proof branch");

  return {
    neonProofBranch: summary.neon_proof_branch.trim(),
    previewUrl
  };
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildReleaseNote({ blockedGates, generatedAt, neonProofBranch, previewUrl, promotionPath, readyGates }) {
  const markdown = `# Outpost Admin Launch Promotion Candidate

Generated: ${generatedAt}

## Promotion Status

- Promotion candidate ready: yes
- Public self-serve launch allowed: no
- Protected Preview: ${previewUrl}
- Hosted Neon proof branch: ${neonProofBranch}
- Source promotion artifact: ${promotionPath}

## Ready Gates

${bulletList(readyGates)}

## Still Blocked

${bulletList(blockedGates)}

## Release Boundary

This artifact is safe to attach to a reviewed PR or release note. It does not
enable public self-serve onboarding, invite delivery, notifications, phone/email
providers, billing, POS, access control, or member-ledger writes.
`;

  assertNoSecretShapedValue(markdown, "admin launch promotion release note");
  return markdown;
}

const promotionPath = normalizeArtifactPath(
  process.env.OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH,
  "OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH"
);
const releaseNotePath = normalizeArtifactPath(
  process.env.OUTPOST_ADMIN_LAUNCH_READINESS_RELEASE_NOTE_PATH,
  "OUTPOST_ADMIN_LAUNCH_READINESS_RELEASE_NOTE_PATH"
);
invariant(releaseNotePath !== promotionPath, "release note output path must be different from the promotion artifact path.");

const summary = readJsonArtifact(promotionPath, "admin launch promotion summary");
const releaseInputs = assertPromotionReadyForReleaseNote(summary, promotionPath);
const releaseNote = buildReleaseNote({
  blockedGates: summary.blocked_gates,
  generatedAt: new Date().toISOString(),
  promotionPath,
  readyGates: summary.ready_gates,
  ...releaseInputs
});

mkdirSync(dirname(releaseNotePath), { recursive: true });
writeFileSync(releaseNotePath, releaseNote);

console.log(`Admin launch promotion release note wrote ${releaseNotePath}`);
console.log(`Preview: ${releaseInputs.previewUrl}`);
console.log(`Neon branch: ${releaseInputs.neonProofBranch}`);
console.log("Public self-serve launch: blocked");
