#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

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

function requireEnv(envName, label) {
  const value = process.env[envName]?.trim();
  invariant(value, `${envName} is required for ${label}.`);
  assertNoSecretShapedValue(value, label);
  return value;
}

function optionalEnv(envName, fallback, label) {
  const value = process.env[envName]?.trim() || fallback;
  assertNoSecretShapedValue(value, label);
  return value;
}

function validateEmail(value, label) {
  invariant(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value), `${label} must be an email address.`);
  return value.toLowerCase();
}

function validateUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  invariant(parsed.protocol === "https:", `${label} must use https.`);
  invariant(!parsed.username && !parsed.password, `${label} must not include embedded credentials.`);
  return parsed.toString().replace(/\/$/u, "");
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

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 72);
}

function runNodeScript(script, env, label) {
  const result = spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env
    }
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${label} failed.`);
  }

  return result.stdout.trim();
}

function readGeneratedArtifact(path, label) {
  invariant(existsSync(path), `${label} was not written at ${path}.`);
  const content = readFileSync(path, "utf8");
  assertNoSecretShapedValue(content, label);
  return content;
}

function buildManifest({
  branchName,
  checklistPath,
  completionPath,
  gatePath,
  gymName,
  manifestPath,
  operatorName,
  ownerEmail,
  ownerName,
  packetPath,
  previewUrl,
  supportWindow
}) {
  const manifest = {
    status: "beta_owner_handoff_prepared",
    evidence_basis: "operator_generated_checklist_and_packet",
    customer_observed: false,
    generated_at: new Date().toISOString(),
    gym: gymName,
    beta_owner: {
      email: ownerEmail,
      name: ownerName || null
    },
    preview_url: previewUrl,
    neon_proof_branch: branchName,
    operator: operatorName,
    support_window: supportWindow,
    artifacts: {
      manifest_path: manifestPath,
      checklist_path: checklistPath,
      packet_path: packetPath,
      completion_path: completionPath,
      gate_path: gatePath
    },
    prepared_steps: [
      "checklist",
      "packet"
    ],
    pending_steps: [
      "customer_observed_completion",
      "final_gate_validation",
      "hosted_record_import"
    ],
    live_provider_gate: "blocked",
    verification_boundary:
      "This manifest records artifact preparation only; it does not record customer-observed completion or mutate hosted data.",
    non_goals: [
      "public_self_signup",
      "invite_delivery",
      "notification_sending",
      "phone_provider_activation",
      "email_provider_activation",
      "billing",
      "pos",
      "access_control",
      "member_ledger_writes"
    ],
    next_command: "npm run beta:owner-handoff:complete"
  };

  assertNoSecretShapedValue(JSON.stringify(manifest), "beta owner handoff bundle manifest");
  return manifest;
}

const gymName = requireEnv("OUTPOST_BETA_HANDOFF_GYM_NAME", "beta gym name");
const ownerEmail = validateEmail(requireEnv("OUTPOST_BETA_HANDOFF_OWNER_EMAIL", "beta owner email"), "beta owner email");
const ownerName = optionalEnv("OUTPOST_BETA_HANDOFF_OWNER_NAME", "", "beta owner name");
const previewUrl = validateUrl(requireEnv("OUTPOST_BETA_HANDOFF_PREVIEW_URL", "protected Preview URL"), "protected Preview URL");
const branchName = requireEnv("OUTPOST_NEON_BRANCH_NAME", "Neon proof branch");
const operatorName = optionalEnv("OUTPOST_BETA_HANDOFF_OPERATOR_NAME", "Outpost operator", "operator name");
const supportWindow = optionalEnv(
  "OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW",
  "operator-assisted beta support window",
  "support window"
);
const artifactSlug = slugify(gymName);
const manifestPath = normalizeArtifactPath(
  requireEnv("OUTPOST_BETA_HANDOFF_BUNDLE_PATH", "beta owner handoff bundle manifest output path"),
  "OUTPOST_BETA_HANDOFF_BUNDLE_PATH"
);
const checklistPath = normalizeArtifactPath(
  optionalEnv(
    "OUTPOST_BETA_HANDOFF_CHECKLIST_PATH",
    `artifacts/beta-owner-handoff/${artifactSlug}-checklist.md`,
    "beta owner handoff checklist path"
  ),
  "OUTPOST_BETA_HANDOFF_CHECKLIST_PATH"
);
const packetPath = normalizeArtifactPath(
  optionalEnv(
    "OUTPOST_BETA_HANDOFF_PACKET_PATH",
    `artifacts/beta-owner-handoff/${artifactSlug}-packet.md`,
    "beta owner handoff packet path"
  ),
  "OUTPOST_BETA_HANDOFF_PACKET_PATH"
);
const completionPath = normalizeArtifactPath(
  optionalEnv(
    "OUTPOST_BETA_HANDOFF_COMPLETION_PATH",
    `artifacts/beta-owner-handoff/${artifactSlug}-completion.json`,
    "beta owner handoff completion path"
  ),
  "OUTPOST_BETA_HANDOFF_COMPLETION_PATH"
);
const gatePath = normalizeArtifactPath(
  optionalEnv(
    "OUTPOST_BETA_HANDOFF_GATE_PATH",
    `artifacts/beta-owner-handoff/${artifactSlug}-customer-observed-gate.json`,
    "beta owner handoff gate path"
  ),
  "OUTPOST_BETA_HANDOFF_GATE_PATH"
);

const sharedEnv = {
  OUTPOST_BETA_HANDOFF_CHECKLIST_PATH: checklistPath,
  OUTPOST_BETA_HANDOFF_COMPLETION_PATH: completionPath,
  OUTPOST_BETA_HANDOFF_GATE_PATH: gatePath,
  OUTPOST_BETA_HANDOFF_GYM_NAME: gymName,
  OUTPOST_BETA_HANDOFF_OPERATOR_NAME: operatorName,
  OUTPOST_BETA_HANDOFF_OWNER_EMAIL: ownerEmail,
  OUTPOST_BETA_HANDOFF_OWNER_NAME: ownerName,
  OUTPOST_BETA_HANDOFF_PACKET_PATH: packetPath,
  OUTPOST_BETA_HANDOFF_PREVIEW_URL: previewUrl,
  OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW: supportWindow,
  OUTPOST_NEON_BRANCH_NAME: branchName
};

const checklistOutput = runNodeScript(
  "scripts/prepare-beta-owner-handoff-checklist.mjs",
  sharedEnv,
  "Beta owner handoff checklist"
);
const packetOutput = runNodeScript(
  "scripts/prepare-beta-owner-handoff-packet.mjs",
  sharedEnv,
  "Beta owner handoff packet"
);

readGeneratedArtifact(checklistPath, "beta owner handoff checklist");
readGeneratedArtifact(packetPath, "beta owner handoff packet");

const manifest = buildManifest({
  branchName,
  checklistPath,
  completionPath,
  gatePath,
  gymName,
  manifestPath,
  operatorName,
  ownerEmail,
  ownerName,
  packetPath,
  previewUrl,
  supportWindow
});

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(checklistOutput);
console.log(packetOutput);
console.log(`Beta owner handoff bundle wrote ${manifestPath}`);
