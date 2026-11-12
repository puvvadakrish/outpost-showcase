#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireEnv(envName, label) {
  const value = process.env[envName]?.trim();
  invariant(value, `${envName} is required for ${label}.`);
  assertNoSecretShapedValue(value, label);
  return value;
}

function normalizeArtifactPath(rawPath, label) {
  invariant(rawPath?.trim(), `${label} is required.`);
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);
  assertNoSecretShapedValue(rawPath, label);

  const resolvedPath = resolve(rawPath.trim());
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo =
    repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);

  invariant(
    !isInsideRepo || isIgnoredArtifactPath,
    `${label} must live under gitignored artifacts/ when it is repo-local.`
  );

  return rawPath.trim();
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

function markdownEscape(value) {
  assertNoSecretShapedValue(value, "beta owner handoff packet rendered value");
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 72);
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

function validateEmail(value, label) {
  invariant(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value), `${label} must be an email address.`);
  return value.toLowerCase();
}

function buildPacket({
  branchName,
  generatedAt,
  gymName,
  operatorName,
  ownerEmail,
  ownerName,
  previewUrl,
  supportWindow
}) {
  const ownerDisplay = ownerName ? `${ownerName} <${ownerEmail}>` : ownerEmail;

  return `# ${markdownEscape(gymName)} Beta Owner Handoff Packet

Generated: ${generatedAt}

## Proof Summary

| Field | Value |
| --- | --- |
| Gym | ${markdownEscape(gymName)} |
| Beta owner | ${markdownEscape(ownerDisplay)} |
| Preview URL | ${markdownEscape(previewUrl)} |
| Neon proof branch | ${markdownEscape(branchName)} |
| Operator | ${markdownEscape(operatorName)} |
| Support window | ${markdownEscape(supportWindow)} |
| Beta state | operator-assisted beta |
| Live-provider status | blocked |

## Current Beta Preflight

- Owner access is operator-provisioned on the hosted proof branch.
- The owner creates the workspace, first location, safe handoff defaults, and task queue after sign-in.
- The first workflow is manual source facts to answer review to staff task handoff.
- Public self-signup is not open.
- Invite email and notification delivery are off.
- Phone, email, billing, POS, access control, and member-ledger writes are blocked.

## Customer Session Checklist

1. Confirm the protected Preview URL: ${markdownEscape(previewUrl)}.
2. Confirm the owner signs in at \`${markdownEscape(previewUrl)}/owner/sign-in\`.
3. Explain that Outpost is in operator-assisted beta, not public self-serve onboarding.
4. Have the owner create or inspect their workspace and first location.
5. Walk through manual source facts, answer review, and staff task handoff.
6. Confirm the owner sees only expected tenant data.
7. Confirm no phone/email automation, invite delivery, notifications, billing, POS, access control, or member-ledger writes are enabled.
8. Stop the session if the owner sees unexpected data, live-provider claims, or account access behavior.

## Support Reset And Rotate

- Use a fresh proof branch or explicitly retained hosted branch for each beta handoff.
- Generate a new temporary owner password outside the repo for every owner handoff.
- Share the temporary password out of band; do not paste it into this packet.
- Delete temporary password files and shell history snippets after proof evidence is recorded.
- Remove or rotate spent owner access if the preview branch is retired.
- If workspace bootstrap fails, confirm the beta access grant is active and the owner email matches the Neon Auth JWT email claim.
- If reset or rollback fails, stop and inspect the exact tenant, owner email, and branch before manual SQL.

## Explicit Non-Goals

- No public owner self-signup.
- No invite email delivery.
- No notification sending.
- No phone or email provider activation.
- No Retell, Resend, Gmail, provider webhooks, or automated outbound replies.
- No billing, POS, access-control, Club OS replacement, or member-ledger writes.
- No claim that a customer-observed handoff has completed until the real session is observed and recorded separately.
`;
}

const gymName = requireEnv("OUTPOST_BETA_HANDOFF_GYM_NAME", "beta gym name");
const ownerEmail = validateEmail(requireEnv("OUTPOST_BETA_HANDOFF_OWNER_EMAIL", "beta owner email"), "beta owner email");
const ownerName = process.env.OUTPOST_BETA_HANDOFF_OWNER_NAME?.trim() ?? "";
const previewUrl = validateUrl(requireEnv("OUTPOST_BETA_HANDOFF_PREVIEW_URL", "protected Preview URL"), "protected Preview URL");
const branchName = requireEnv("OUTPOST_NEON_BRANCH_NAME", "Neon proof branch");
const packetPath = normalizeArtifactPath(
  requireEnv("OUTPOST_BETA_HANDOFF_PACKET_PATH", "beta owner handoff packet output path"),
  "OUTPOST_BETA_HANDOFF_PACKET_PATH"
);
const operatorName = process.env.OUTPOST_BETA_HANDOFF_OPERATOR_NAME?.trim() || "Outpost operator";
const supportWindow = process.env.OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW?.trim() || "operator-assisted beta support window";

assertNoSecretShapedValue(ownerName, "beta owner name");
assertNoSecretShapedValue(operatorName, "operator name");
assertNoSecretShapedValue(supportWindow, "support window");

const packet = buildPacket({
  branchName,
  generatedAt: new Date().toISOString(),
  gymName,
  operatorName,
  ownerEmail,
  ownerName,
  previewUrl,
  supportWindow
});

mkdirSync(dirname(packetPath), { recursive: true });
writeFileSync(packetPath, packet);
console.log(`Beta owner handoff packet wrote ${packetPath}`);
