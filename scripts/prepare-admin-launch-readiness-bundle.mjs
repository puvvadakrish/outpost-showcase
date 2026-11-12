#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

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

function optionalArtifactPath(envName, fallback, label) {
  return normalizeArtifactPath(process.env[envName]?.trim() || fallback, label);
}

function defaultSiblingPath(bundlePath, suffix) {
  const extension = extname(bundlePath);
  const base = basename(bundlePath, extension || ".json").replace(/-bundle$/u, "");
  return join(dirname(bundlePath), `${base}${suffix}`);
}

function runScript(script, env, label) {
  const result = spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, label);

  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }

  return output.trim();
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

function readText(path, label) {
  invariant(existsSync(path), `${label} was not found at ${path}.`);
  const content = readFileSync(path, "utf8");
  assertNoSecretShapedValue(content, label);
  return content;
}

function buildManifest({ bundlePath, exportArtifact, exportPath, promotionPath, promotionSummary, releaseNotePath }) {
  invariant(
    promotionSummary.status === "admin_launch_promotion_candidate_checked",
    "launch bundle requires a checked promotion candidate."
  );
  invariant(promotionSummary.promotion_candidate_ready === true, "launch bundle requires a ready promotion candidate.");
  invariant(
    promotionSummary.public_self_serve_launch_allowed === false,
    "launch bundle cannot start from a public-launch-allowed promotion candidate."
  );
  invariant(exportArtifact.status === "admin_launch_readiness_exported", "launch bundle requires a launch-readiness export.");
  invariant(
    exportArtifact.public_self_serve_launch_allowed === false,
    "launch bundle cannot start from a public-launch-allowed export."
  );
  invariant(readText(releaseNotePath, "admin launch promotion release note").includes("Public self-serve launch allowed: no"));

  const manifest = {
    status: "admin_launch_readiness_bundle_prepared",
    generated_at: new Date().toISOString(),
    public_self_serve_launch_allowed: false,
    customer_observed_completion_claimed: exportArtifact.customer_observed_completion_claimed === true,
    preview_url: promotionSummary.preview_url,
    neon_proof_branch: promotionSummary.neon_proof_branch,
    evidence_basis: "admin_launch_readiness_export_promotion_and_release_note",
    artifacts: {
      bundle_path: bundlePath,
      export_path: exportPath,
      promotion_path: promotionPath,
      release_note_path: releaseNotePath
    },
    ready_gates: promotionSummary.ready_gates,
    blocked_gates: promotionSummary.blocked_gates,
    command_sequence: [
      "npm run admin:launch-readiness:export",
      "npm run admin:launch-readiness:inspect",
      "npm run admin:launch-readiness:promote",
      "npm run admin:launch-readiness:release-note"
    ],
    review_boundary:
      "This bundle is an operator review artifact only. It does not mutate hosted data, approve launch, send invites, enable providers, or unlock public self-serve.",
    non_goals: [
      "public_self_signup",
      "browser_approval_buttons",
      "invite_delivery",
      "notification_sending",
      "phone_provider_activation",
      "email_provider_activation",
      "billing",
      "pos",
      "access_control",
      "member_ledger_writes"
    ],
    next_step:
      "Attach the release note and manifest to a reviewed launch-readiness PR. Do not enable public self-serve from this bundle."
  };

  assertNoSecretShapedKeys(manifest, "admin launch readiness bundle");
  assertNoSecretShapedValue(JSON.stringify(manifest), "admin launch readiness bundle");
  return manifest;
}

const bundlePath = normalizeArtifactPath(
  process.env.OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH,
  "OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH"
);
const exportPath = optionalArtifactPath(
  "OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH",
  defaultSiblingPath(bundlePath, "-launch-readiness.json"),
  "OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH"
);
const promotionPath = optionalArtifactPath(
  "OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH",
  defaultSiblingPath(bundlePath, "-promotion-candidate.json"),
  "OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH"
);
const releaseNotePath = optionalArtifactPath(
  "OUTPOST_ADMIN_LAUNCH_READINESS_RELEASE_NOTE_PATH",
  defaultSiblingPath(bundlePath, "-promotion-release-note.md"),
  "OUTPOST_ADMIN_LAUNCH_READINESS_RELEASE_NOTE_PATH"
);

runScript(
  "scripts/prepare-admin-launch-readiness-export.mjs",
  {
    OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH: exportPath
  },
  "admin launch readiness export"
);
runScript(
  "scripts/inspect-admin-launch-readiness-export.mjs",
  {
    OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH: exportPath
  },
  "admin launch readiness export inspection"
);
runScript(
  "scripts/verify-admin-launch-readiness-promotion.mjs",
  {
    OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH: exportPath,
    OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH: promotionPath
  },
  "admin launch promotion check"
);
runScript(
  "scripts/prepare-admin-launch-promotion-release-note.mjs",
  {
    OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH: promotionPath,
    OUTPOST_ADMIN_LAUNCH_READINESS_RELEASE_NOTE_PATH: releaseNotePath
  },
  "admin launch promotion release note"
);

const exportArtifact = readJson(exportPath, "admin launch readiness export");
const promotionSummary = readJson(promotionPath, "admin launch promotion summary");
const manifest = buildManifest({
  bundlePath,
  exportArtifact,
  exportPath,
  promotionPath,
  promotionSummary,
  releaseNotePath
});

mkdirSync(dirname(bundlePath), { recursive: true });
writeFileSync(bundlePath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Admin launch readiness bundle wrote ${bundlePath}`);
console.log(`Export: ${exportPath}`);
console.log(`Promotion: ${promotionPath}`);
console.log(`Release note: ${releaseNotePath}`);
console.log(`Preview: ${manifest.preview_url}`);
console.log(`Neon branch: ${manifest.neon_proof_branch}`);
console.log("Public self-serve launch: blocked");
