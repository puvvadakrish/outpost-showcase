#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const retainedEvidencePath = requireEvidencePath(
  "OUTPOST_ACME_RETAINED_EVIDENCE_PATH",
  "retained dry-run evidence"
);
const browserEvidencePath = requireEvidencePath(
  "OUTPOST_ACME_BROWSER_EVIDENCE_PATH",
  "browser proof evidence"
);
const rollbackEvidencePath = requireEvidencePath(
  "OUTPOST_ACME_ROLLBACK_EVIDENCE_PATH",
  "rollback evidence"
);

const retainedEvidence = readEvidence(retainedEvidencePath, "retained dry-run evidence");
const browserEvidence = readEvidence(browserEvidencePath, "browser proof evidence");
const rollbackEvidence = readEvidence(rollbackEvidencePath, "rollback evidence");
const packetPath = normalizeOutputPath(
  process.env.OUTPOST_ACME_CUSTOMER_PACKET_PATH ??
    `artifacts/acme-customer-handoff/${retainedEvidence.run_id}-packet.md`
);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireEvidencePath(envName, label) {
  const value = process.env[envName]?.trim();
  invariant(value, `${envName} is required for ${label}.`);
  return normalizeArtifactPath(value, envName);
}

function normalizeOutputPath(rawPath) {
  invariant(rawPath?.trim(), "OUTPOST_ACME_CUSTOMER_PACKET_PATH cannot be empty.");
  return normalizeArtifactPath(rawPath.trim(), "OUTPOST_ACME_CUSTOMER_PACKET_PATH");
}

function normalizeArtifactPath(rawPath, label) {
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);

  const resolvedPath = resolve(rawPath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo =
    repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);

  invariant(
    !isInsideRepo || isIgnoredArtifactPath,
    `${label} must live under gitignored artifacts/ when it is repo-local.`
  );

  return rawPath;
}

function readEvidence(path, label) {
  invariant(existsSync(path), `${label} was not found at ${path}.`);

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  assertNoSecretShapedKeys(parsed, label);
  return parsed;
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

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session");

  invariant(!secretValue, `${label} contains a secret-shaped value.`);
}

function requireString(value, label) {
  invariant(typeof value === "string" && value.trim().length > 0, `${label} is required.`);
  return value.trim();
}

function requireStatus(evidence, expected, label) {
  invariant(evidence.status === expected, `${label} status must be ${expected}; got ${JSON.stringify(evidence.status)}.`);
}

function assertSame(valueA, valueB, labelA, labelB, field) {
  invariant(valueA === valueB, `${field} mismatch between ${labelA} and ${labelB}: ${valueA} !== ${valueB}.`);
}

function validateEvidence() {
  requireStatus(retainedEvidence, "passed_retained_data", "retained dry-run evidence");
  requireStatus(browserEvidence, "browser_handoff_smoke_passed", "browser proof evidence");
  requireStatus(rollbackEvidence, "rollback_only_cleaned", "rollback evidence");

  invariant(
    retainedEvidence.rollback === "retained_for_browser_smoke",
    "retained dry-run evidence must be retained_for_browser_smoke."
  );
  invariant(
    rollbackEvidence.rollback === "rollback_only_cleanup_complete",
    "rollback evidence must prove rollback_only_cleanup_complete."
  );
  invariant(
    retainedEvidence.live_provider_gate === "blocked" &&
      browserEvidence.live_provider_gate === "blocked" &&
      rollbackEvidence.live_provider_gate === "blocked",
    "retained, browser, and rollback evidence must keep live_provider_gate blocked."
  );

  const runId = requireString(retainedEvidence.run_id, "retained run id");
  const ownerEmail = requireString(retainedEvidence.owner_email, "retained owner email");
  const tenantId = requireString(retainedEvidence.tenant?.id, "retained tenant id");
  const tenantName = requireString(retainedEvidence.tenant?.name, "retained tenant name");
  const appOrigin = requireString(retainedEvidence.app_origin, "retained app origin");
  const branchName = requireString(retainedEvidence.neon?.branch_name, "retained Neon branch name");

  invariant(
    ownerEmail.includes("+dry-run") || ownerEmail.endsWith("@owner.outpost.local"),
    "handoff packet requires a dry-run owner email, not a real customer email."
  );
  invariant(tenantName.startsWith("Acme Fitness Dry Run"), "handoff packet requires a dry-run tenant name.");
  invariant(tenantId !== "tenant_acme_fitness", "handoff packet must not target the seeded Acme Fitness tenant.");

  assertSame(browserEvidence.run_id, runId, "browser proof evidence", "retained dry-run evidence", "run id");
  assertSame(rollbackEvidence.run_id, runId, "rollback evidence", "retained dry-run evidence", "run id");
  assertSame(browserEvidence.owner_email, ownerEmail, "browser proof evidence", "retained dry-run evidence", "owner email");
  assertSame(
    rollbackEvidence.owner_email,
    ownerEmail,
    "rollback evidence",
    "retained dry-run evidence",
    "owner email"
  );
  assertSame(browserEvidence.tenant?.id, tenantId, "browser proof evidence", "retained dry-run evidence", "tenant id");
  assertSame(rollbackEvidence.tenant?.id, tenantId, "rollback evidence", "retained dry-run evidence", "tenant id");
  assertSame(
    browserEvidence.tenant?.name,
    tenantName,
    "browser proof evidence",
    "retained dry-run evidence",
    "tenant name"
  );
  assertSame(rollbackEvidence.tenant?.name, tenantName, "rollback evidence", "retained dry-run evidence", "tenant name");

  invariant(browserEvidence.smoke?.hasOwnerWorkspace === true, "browser proof must show the owner workspace.");
  invariant(browserEvidence.smoke?.hasTenantName === true, "browser proof must show the dry-run tenant name.");
  invariant(browserEvidence.smoke?.hasHostedProofCopy === true, "browser proof must show hosted proof copy.");
  invariant(browserEvidence.smoke?.hasLiveProviderBoundary === true, "browser proof must show live-provider boundary.");

  return { appOrigin, branchName, ownerEmail, runId, tenantId, tenantName };
}

function markdownEscape(value) {
  assertNoSecretShapedValue(value, "handoff packet rendered value");
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function formatChecks(checks) {
  invariant(Array.isArray(checks) && checks.length > 0, "retained evidence must include completed checks.");
  return checks.map((check) => `- ${markdownEscape(check)}`).join("\n");
}

function buildPacket(summary) {
  const generatedAt = new Date().toISOString();
  return `# Acme Fitness Customer Handoff Packet

Generated: ${generatedAt}

## Proof Summary

| Field | Value |
| --- | --- |
| Preview origin | ${markdownEscape(summary.appOrigin)} |
| Neon proof branch | ${markdownEscape(summary.branchName)} |
| Dry-run id | ${markdownEscape(summary.runId)} |
| Dry-run owner | ${markdownEscape(summary.ownerEmail)} |
| Dry-run tenant | ${markdownEscape(summary.tenantName)} |
| Dry-run tenant id | ${markdownEscape(summary.tenantId)} |
| Live-provider status | blocked |
| Rollback status | rollback-only cleanup complete |

## Completed Proof Checks

${formatChecks(retainedEvidence.checks)}

## Browser Proof

- Owner sign-in submitted through the protected Preview.
- Owner workspace rendered for the dry-run tenant.
- Hosted Neon proof copy was visible.
- Live-provider boundary copy was visible.
- Browser proof status: ${markdownEscape(browserEvidence.status)}.

## Customer Session Agenda

1. Confirm the Preview URL and explain that this is a protected beta Preview.
2. Confirm Acme Fitness is still in owner-approved, staff-task-only beta mode.
3. Walk through owner sign-in and owner workspace orientation.
4. Show manual source facts, answer review, and the staff task handoff path.
5. Confirm no phone/email automation, notifications, billing, POS, access control, or member-ledger writes are enabled.
6. Record customer feedback and stop if any owner, staff, or data-boundary concern appears.

## Support And Rollback Checklist

- Keep this packet and source evidence under ignored artifacts or another customer-safe support folder.
- Do not paste passwords, Neon API keys, JWTs, cookies, Vercel bypass secrets, or shell history into customer notes.
- If the customer session needs a fresh dry run, rerun the retained dry-run setup with a new dry-run owner and regenerate this packet.
- If any proof tenant remains after the session, rerun rollback-only cleanup with the exact dry-run tenant id and owner email.
- If rollback refuses a tenant id, tenant name, or owner email, stop and inspect the guard failure before manual SQL.

## Explicit Non-Goals

- No invite email delivery.
- No phone or email provider activation.
- No notification sending.
- No billing, POS, access-control, or member-ledger writes.
- No claim that Acme Fitness has completed customer onboarding until the actual customer-observed session is done.
`;
}

const summary = validateEvidence();
const packet = buildPacket(summary);

mkdirSync(dirname(packetPath), { recursive: true });
writeFileSync(packetPath, packet);
console.log(`Acme Fitness customer handoff packet wrote ${packetPath}`);
