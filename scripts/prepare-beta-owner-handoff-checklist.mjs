#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
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

function markdownEscape(value) {
  assertNoSecretShapedValue(value, "beta owner handoff checklist rendered value");
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function shellSingleQuote(value) {
  assertNoSecretShapedValue(value, "beta owner handoff checklist shell value");
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 72);
}

function buildChecklist({
  branchName,
  checklistPath,
  completionPath,
  gatePath,
  generatedAt,
  gymName,
  operatorName,
  ownerEmail,
  ownerName,
  packetPath,
  previewUrl,
  supportWindow
}) {
  const ownerDisplay = ownerName ? `${ownerName} <${ownerEmail}>` : ownerEmail;

  return `# ${markdownEscape(gymName)} Beta Handoff Execution Checklist

Generated: ${generatedAt}

## Scope

This run sheet prepares an operator-assisted beta owner handoff. It does not
create accounts, fulfill queued requests, record customer-observed completion,
import hosted proof, or enable live providers. The generator only writes this
run sheet; the commands below remain separate operator steps.

| Field | Value |
| --- | --- |
| Gym | ${markdownEscape(gymName)} |
| Beta owner | ${markdownEscape(ownerDisplay)} |
| Preview URL | ${markdownEscape(previewUrl)} |
| Neon proof branch | ${markdownEscape(branchName)} |
| Operator | ${markdownEscape(operatorName)} |
| Support window | ${markdownEscape(supportWindow)} |
| Checklist artifact | ${markdownEscape(checklistPath)} |
| Packet artifact | ${markdownEscape(packetPath)} |
| Completion artifact | ${markdownEscape(completionPath)} |
| Gate artifact | ${markdownEscape(gatePath)} |
| Beta state | operator-assisted beta |
| Live-provider status | blocked |

## 1. Prepare The Customer-Safe Packet

\`\`\`bash
export OUTPOST_BETA_HANDOFF_GYM_NAME=${shellSingleQuote(gymName)}
export OUTPOST_BETA_HANDOFF_OWNER_EMAIL=${shellSingleQuote(ownerEmail)}
export OUTPOST_BETA_HANDOFF_OWNER_NAME=${shellSingleQuote(ownerName)}
export OUTPOST_BETA_HANDOFF_OPERATOR_NAME=${shellSingleQuote(operatorName)}
export OUTPOST_BETA_HANDOFF_PREVIEW_URL=${shellSingleQuote(previewUrl)}
export OUTPOST_NEON_BRANCH_NAME=${shellSingleQuote(branchName)}
export OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW=${shellSingleQuote(supportWindow)}
export OUTPOST_BETA_HANDOFF_PACKET_PATH=${shellSingleQuote(packetPath)}
npm run beta:owner-handoff:packet
\`\`\`

## 2. Run The Observed Customer Session

- Share the protected Preview URL with the beta owner.
- Share the temporary password out of band. Do not paste it into this checklist,
  the packet, PRs, issue comments, shell history snippets, or chat.
- Confirm owner sign-in, owner workspace, first manual source to answer review
  to staff task workflow, reset/rollback review, blocked live-provider gates,
  and no unexpected tenant data.
- Stop the session if the owner sees unexpected data, live-provider claims, or
  account access behavior.

## 3. Record Completion Only After A Real Owner Observes The Flow

\`\`\`bash
export OUTPOST_BETA_HANDOFF_PACKET_PATH=${shellSingleQuote(packetPath)}
export OUTPOST_BETA_HANDOFF_COMPLETION_PATH=${shellSingleQuote(completionPath)}
export OUTPOST_BETA_HANDOFF_SESSION_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export OUTPOST_BETA_HANDOFF_OBSERVER=${shellSingleQuote(operatorName)}
export OUTPOST_BETA_HANDOFF_PARTICIPANT='<external beta owner name>'
export OUTPOST_BETA_HANDOFF_CONFIRMED_PREVIEW=1
export OUTPOST_BETA_HANDOFF_OWNER_SIGNIN=1
export OUTPOST_BETA_HANDOFF_OWNER_WORKSPACE=1
export OUTPOST_BETA_HANDOFF_FIRST_WORKFLOW=1
export OUTPOST_BETA_HANDOFF_RESET_REVIEWED=1
export OUTPOST_BETA_HANDOFF_LIVE_GATES_BLOCKED=1
export OUTPOST_BETA_HANDOFF_NO_UNEXPECTED_DATA=1
export OUTPOST_BETA_HANDOFF_STOP_CONCERNS=none
export OUTPOST_BETA_HANDOFF_CUSTOMER_OBSERVED=1
npm run beta:owner-handoff:complete
\`\`\`

## 4. Validate The Final Customer-Observed Gate

\`\`\`bash
export OUTPOST_BETA_HANDOFF_PACKET_PATH=${shellSingleQuote(packetPath)}
export OUTPOST_BETA_HANDOFF_COMPLETION_PATH=${shellSingleQuote(completionPath)}
export OUTPOST_BETA_HANDOFF_GATE_PATH=${shellSingleQuote(gatePath)}
npm run beta:owner-handoff:gate
\`\`\`

## 5. Import The Reviewed Hosted Record

Only run this after reviewing the gate artifact and confirming it came from a
real external owner-observed handoff.

\`\`\`bash
export OUTPOST_BETA_HANDOFF_GATE_PATH=${shellSingleQuote(gatePath)}
export NEXT_PUBLIC_OUTPOST_APP_URL=${shellSingleQuote(previewUrl)}
export OUTPOST_NEON_BRANCH_NAME=${shellSingleQuote(branchName)}
npm run beta:owner-handoff:record
\`\`\`

## Blocked Product Gates

- Public self-signup remains blocked.
- Invite delivery remains blocked.
- Notification sending remains blocked.
- Phone/email providers remain blocked.
- Billing, POS, access control, and member-ledger writes remain blocked.
- Internal dry-runs, browser smoke, hosted proof, packet generation, and this
  checklist do not count as customer-observed completion.
`;
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
const checklistPath = normalizeArtifactPath(
  requireEnv("OUTPOST_BETA_HANDOFF_CHECKLIST_PATH", "beta owner handoff checklist output path"),
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

const checklist = buildChecklist({
  branchName,
  checklistPath,
  completionPath,
  gatePath,
  generatedAt: new Date().toISOString(),
  gymName,
  operatorName,
  ownerEmail,
  ownerName,
  packetPath,
  previewUrl,
  supportWindow
});

assertNoSecretShapedValue(checklist, "beta owner handoff checklist");
mkdirSync(dirname(checklistPath), { recursive: true });
writeFileSync(checklistPath, checklist);
console.log(`Beta owner handoff checklist wrote ${checklistPath}`);
