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

function assertPreparedManifest(manifest) {
  invariant(manifest.status === "beta_owner_handoff_prepared", "handoff message requires a prepared handoff bundle.");
  invariant(manifest.customer_observed === false, "handoff message cannot start from customer-observed completion.");
  invariant(manifest.live_provider_gate === "blocked", "handoff message requires live-provider gate blocked.");
  invariant(
    Array.isArray(manifest.pending_steps) && manifest.pending_steps.includes("customer_observed_completion"),
    "handoff message requires customer-observed completion to remain pending."
  );
  invariant(typeof manifest.gym === "string" && manifest.gym.trim(), "handoff message requires a gym name.");
  invariant(typeof manifest.beta_owner?.email === "string" && manifest.beta_owner.email.trim(), "handoff message requires an owner email.");
  invariant(typeof manifest.preview_url === "string" && manifest.preview_url.trim(), "handoff message requires a Preview URL.");
  invariant(typeof manifest.neon_proof_branch === "string" && manifest.neon_proof_branch.trim(), "handoff message requires a Neon branch.");
  invariant(typeof manifest.support_window === "string" && manifest.support_window.trim(), "handoff message requires a support window.");
}

function buildMessage(manifest, sourcePath) {
  const ownerName = manifest.beta_owner.name || "there";
  const markdown = `# ${manifest.gym} Beta Owner Handoff Message

Source bundle: ${sourcePath}
Generated: ${new Date().toISOString()}

## Operator Message Draft

Subject: Outpost beta walkthrough for ${manifest.gym}

Hi ${ownerName},

Your Outpost beta walkthrough is ready for an operator-assisted session. We will
walk through the protected Preview workspace together and confirm the owner
setup path before any live phone or email automation is connected.

Protected Preview: ${manifest.preview_url}

What we will cover:

- Owner sign-in using operator-provisioned credentials shared outside this
  message.
- Workspace setup and first location review.
- Manual source facts, answer review, and staff task handoff.
- Reset or rollback expectations if the beta workspace needs to be cleared.

What this message does not do:

- It does not create an account.
- It does not send an invite or notification.
- It does not enable phone or email providers.
- It does not enable billing, POS, access control, or member-ledger writes.
- It does not claim the customer-observed handoff is complete.

An Outpost operator will stay with you during the session and record completion
only after you have observed the protected Preview flow.

## Operator Checklist

- Confirm the owner email: ${manifest.beta_owner.email}
- Confirm support window: ${manifest.support_window}
- Confirm hosted Neon branch: ${manifest.neon_proof_branch}
- Keep customer-observed completion pending until the real session is complete.
- Use \`npm run beta:owner-handoff:complete\` only after the owner observes the flow.
`;

  assertNoSecretShapedValue(markdown, "beta owner handoff message");
  return markdown;
}

const bundlePath = normalizeArtifactPath(process.env.OUTPOST_BETA_HANDOFF_BUNDLE_PATH, "OUTPOST_BETA_HANDOFF_BUNDLE_PATH");
const messagePath = normalizeArtifactPath(
  process.env.OUTPOST_BETA_HANDOFF_MESSAGE_PATH,
  "OUTPOST_BETA_HANDOFF_MESSAGE_PATH"
);
invariant(messagePath !== bundlePath, "handoff message output path must be different from the bundle manifest path.");
invariant(
  resolve(messagePath) !== resolve(bundlePath),
  "handoff message output path must be different from the bundle manifest path."
);

const manifest = readJson(bundlePath, "beta owner handoff bundle manifest");
assertPreparedManifest(manifest);
const message = buildMessage(manifest, bundlePath);

mkdirSync(dirname(messagePath), { recursive: true });
writeFileSync(messagePath, message);

console.log(`Beta owner handoff message wrote ${messagePath}`);
console.log(`Gym: ${manifest.gym}`);
console.log(`Owner email: ${manifest.beta_owner.email}`);
console.log("Invite delivery: blocked");
console.log("Customer-observed completion: pending");
