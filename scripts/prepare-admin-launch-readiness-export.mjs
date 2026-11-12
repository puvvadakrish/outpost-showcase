#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const GATE_STATES = new Set(["blocked", "pending", "ready"]);

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

function validatePreviewUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL must be a valid URL.");
  }

  invariant(parsed.protocol === "https:", "OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL must use https.");
  invariant(!parsed.username && !parsed.password, "OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL must not include credentials.");
  invariant(
    !/^(localhost|127\.0\.0\.1)$/iu.test(parsed.hostname),
    "OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL must not be local."
  );
  assertNoSecretShapedValue(parsed.toString(), "OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL");
  return parsed.toString().replace(/\/$/u, "");
}

function gateState(envName, fallback = "pending") {
  const state = optionalEnv(envName, fallback, envName).toLowerCase();
  invariant(GATE_STATES.has(state), `${envName} must be one of blocked, pending, or ready.`);
  return state;
}

function gate(label, state, detail) {
  return { detail, label, state };
}

function buildExport({
  branchName,
  customerHandoffState,
  exportPath,
  fulfillmentState,
  gymName,
  operatorName,
  ownerEmail,
  previewState,
  previewUrl,
  rollbackState
}) {
  const liveGateDetail =
    "Invite delivery, notifications, phone/email providers, billing, POS, access control, and member-ledger writes remain blocked.";
  const artifact = {
    status: "admin_launch_readiness_exported",
    generated_at: new Date().toISOString(),
    customer_observed_completion_claimed: customerHandoffState === "ready",
    public_self_serve_launch_allowed: false,
    preview_url: previewUrl,
    neon_proof_branch: branchName,
    operator: operatorName,
    gym: gymName || null,
    beta_owner_email: ownerEmail || null,
    source: {
      admin_portal: "/admin",
      export_path: exportPath,
      evidence_basis:
        "sanitized_admin_readiness_projection_and_operator_supplied_gate_states"
    },
    gates: [
      gate(
        "Protected Preview proof",
        previewState,
        previewState === "ready"
          ? "Protected Preview proof is marked ready by the operator's current hosted evidence."
          : "Protected Preview proof must be green before this packet can support a launch review."
      ),
      gate(
        "Operator fulfillment path",
        fulfillmentState,
        fulfillmentState === "ready"
          ? "At least one owner beta request has a fulfilled receipt path."
          : "Owner beta request fulfillment still needs operator review or proof."
      ),
      gate(
        "Reset and rollback readiness",
        rollbackState,
        rollbackState === "ready"
          ? "Rollback readiness has been reviewed for the current beta workspace."
          : "Reset and rollback readiness still needs proof before customer handoff."
      ),
      gate(
        "Customer-observed handoff",
        customerHandoffState,
        customerHandoffState === "ready"
          ? "A customer-observed handoff gate has been recorded for the current Preview and Neon branch."
          : "Customer-observed completion remains pending until a real external owner observes the handoff."
      ),
      gate("Live-provider and billing gates", "blocked", liveGateDetail),
      gate(
        "Public self-serve launch",
        "blocked",
        "Public owner signup, browser approval, automatic onboarding, and invite delivery remain blocked until a reviewed launch slice replaces this gate."
      )
    ],
    command_sequence: [
      "npm run vercel:preview:verify",
      "npm run beta:operator:request-preflight",
      "npm run beta:operator:request-fulfillment",
      "npm run hosted:owner-handoff:prepare",
      "npm run beta:owner-handoff:complete",
      "npm run beta:owner-handoff:gate",
      "npm run beta:owner-handoff:record",
      "npm run admin:launch-readiness:inspect"
    ],
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
    review_boundary:
      "This export is a review artifact only. It does not mutate hosted data, approve owners, send invites, enable live providers, or promote public self-serve."
  };

  assertNoSecretShapedKeys(artifact, "admin launch readiness export");
  assertNoSecretShapedValue(JSON.stringify(artifact), "admin launch readiness export");
  return artifact;
}

const exportPath = normalizeArtifactPath(
  requireEnv("OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH", "admin launch readiness export path"),
  "OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH"
);
const previewUrl = validatePreviewUrl(
  requireEnv("OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL", "protected Preview URL")
);
const branchName = requireEnv("OUTPOST_NEON_BRANCH_NAME", "Neon proof branch");
const operatorName = optionalEnv("OUTPOST_ADMIN_LAUNCH_READINESS_OPERATOR", "Outpost operator", "operator label");
const gymName = optionalEnv("OUTPOST_ADMIN_LAUNCH_READINESS_GYM_NAME", "", "gym name");
const ownerEmail = optionalEnv("OUTPOST_ADMIN_LAUNCH_READINESS_OWNER_EMAIL", "", "beta owner email");
const previewState = gateState("OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_PROOF", "pending");
const fulfillmentState = gateState("OUTPOST_ADMIN_LAUNCH_READINESS_FULFILLMENT", "pending");
const rollbackState = gateState("OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK", "pending");
const customerHandoffState = gateState("OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF", "blocked");

const artifact = buildExport({
  branchName,
  customerHandoffState,
  exportPath,
  fulfillmentState,
  gymName,
  operatorName,
  ownerEmail,
  previewState,
  previewUrl,
  rollbackState
});

mkdirSync(dirname(exportPath), { recursive: true });
writeFileSync(exportPath, `${JSON.stringify(artifact, null, 2)}\n`);

console.log(`Admin launch readiness export wrote ${exportPath}`);
console.log(`Preview: ${artifact.preview_url}`);
console.log(`Neon branch: ${artifact.neon_proof_branch}`);
console.log("Public self-serve launch: blocked");
console.log("Next: npm run admin:launch-readiness:inspect");

