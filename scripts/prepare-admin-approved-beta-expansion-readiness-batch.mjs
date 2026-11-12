#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_POST_PROOF_PATH =
  "artifacts/admin-launch-readiness/admin-post-customer-proof-readiness-batch.json";
const DEFAULT_FOLLOWTHROUGH_PATH =
  "artifacts/admin-launch-readiness/owner-beta-request-followthrough.json";
const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-approved-beta-expansion-readiness-batch.json";

const BLOCKED_GATES = [
  "Public owner self-signup",
  "Browser approval buttons",
  "Invite delivery",
  "Notification sending",
  "Phone/email provider activation",
  "Product Auth admin API",
  "Automatic owner/staff grants",
  "Billing, POS, access control, member-ledger writes",
];

const NEXT_BATCHES = [
  {
    command: "npm run beta:operator:request-fulfillment && npm run hosted:request-fulfillment-proof",
    detail:
      "Fulfill one approved gym through operator-managed owner access, then prove hosted visibility.",
    id: "approved_gym_operator_fulfillment",
    state: "pending",
    title: "Approved gym operator fulfillment",
  },
  {
    command:
      "npm run admin:public-request-intake:dry-run && npm run admin:public-request-intake:inspect",
    detail:
      "Package public request intake as request-only and review-only; no automatic approval or provisioning.",
    id: "public_request_intake_dry_run",
    state: "blocked",
    title: "Public request intake dry-run",
  },
  {
    command:
      "npm run admin:invite-delivery:preflight && npm run admin:auth-admin:dry-run",
    detail:
      "Prepare invite/Auth operations as no-send, operator-review-only dry-runs.",
    id: "invite_auth_dry_run_gates",
    state: "blocked",
    title: "Invite and Auth dry-run gates",
  },
  {
    command:
      "Keep phone/email providers, notifications, billing, POS, access control, member-ledger writes blocked until separately proven.",
    detail:
      "Live provider and revenue/member-system work remains outside approved beta expansion.",
    id: "live_provider_revenue_gates",
    state: "blocked",
    title: "Live-provider and revenue gates",
  },
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecretShapedValue(value, label) {
  if (typeof value !== "string") return;
  const secretLike =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(value) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(value) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(value) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(
      value,
    ) ||
    value.includes("__Secure-neon-auth") ||
    value.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      value,
    );
  invariant(!secretLike, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoSecretShapedKeys(entry, label, [...trail, String(index)]),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    invariant(
      !/(password|token|cookie|apikey|authorization|credential|privatekey|secret|bypass|signature|jwt)/u.test(
        normalizedKey,
      ),
      `${label} contains secret-shaped key ${path}.`,
    );
    assertNoSecretShapedValue(entry, `${label}.${path}`);
    assertNoSecretShapedKeys(entry, label, [...trail, key]);
  }
}

function normalizeArtifactPath(value, label, options = {}) {
  invariant(value && typeof value === "string", `${label} required.`);
  assertNoSecretShapedValue(value, label);
  invariant(!value.includes("\0"), `${label} cannot contain NUL.`);
  const resolved = resolve(value);
  const cwd = resolve(process.cwd());
  const relativePath = relative(cwd, resolved);
  invariant(
    !isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`),
    `${label} must stay inside repository.`,
  );
  invariant(
    relativePath.startsWith(`artifacts${sep}`) || relativePath === "artifacts",
    `${label} must stay under artifacts/.`,
  );
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  }
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const source = readFileSync(path, "utf8");
  assertNoSecretShapedValue(source, label);
  const artifact = JSON.parse(source);
  assertNoSecretShapedKeys(artifact, label);
  return {
    artifact,
    sha256: createHash("sha256").update(source).digest("hex"),
  };
}

function runInspector(script, label, env) {
  const result = spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, `${label} output`);
  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} missing ${expected}.`);
}

function isUnsafeCustomerLabel(value) {
  return /\b(house\s*of\s*fitness|acme|dry[-\s]?run|internal|sample|fixture|fake)\b/iu.test(
    String(value ?? ""),
  );
}

function assertPostCustomerProofBatch(batch) {
  invariant(
    batch.artifact_kind === "admin_post_customer_proof_readiness_batch",
    "Post-customer-proof readiness batch kind mismatch.",
  );
  invariant(
    batch.status === "admin_post_customer_proof_readiness_batch_prepared",
    "Post-customer-proof readiness batch status mismatch.",
  );
  invariant(batch.hosted_customer_session_proof_observed === true, "Hosted proof must be observed.");
  invariant(
    batch.limited_operator_assisted_beta_onboarding_ready === true,
    "Limited operator-assisted beta onboarding must be ready.",
  );
  assertFalse(batch, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(batch, "browser_approval_buttons_allowed", "Browser approval buttons must remain blocked.");
  assertFalse(batch, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(batch, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(batch, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(batch, "product_auth_admin_api_allowed", "Product Auth admin API must remain blocked.");
  assertFalse(batch, "automatic_owner_staff_grants_allowed", "Automatic grants must remain blocked.");
  assertFalse(
    batch,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );
}

function assertOwnerBetaFollowthrough(packet) {
  invariant(
    packet.packet_kind === "owner_beta_request_followthrough",
    "Owner beta request follow-through packet kind mismatch.",
  );
  invariant(
    packet.status === "owner_beta_request_followthrough_prepared",
    "Owner beta request follow-through status mismatch.",
  );
  invariant(packet.requires_human_review === true, "Human review must be required.");
  assertFalse(
    packet,
    "public_self_serve_launch_allowed",
    "Owner beta follow-through must keep public self-serve blocked.",
  );
  assertFalse(
    packet,
    "launch_enablement_allowed",
    "Owner beta follow-through must keep launch enablement blocked.",
  );
  invariant(
    packet.triage_receipt?.decision === "ready_for_operator_fulfillment",
    "Owner beta follow-through must be ready for operator fulfillment.",
  );
  invariant(packet.request?.id, "Owner beta request id required.");
  invariant(packet.request?.gym_name, "Owner beta request gym name required.");
  invariant(packet.request?.email, "Owner beta request email required.");
  invariant(
    !isUnsafeCustomerLabel(packet.request.gym_name),
    "Approved beta expansion must target a non-House-of-Fitness real gym.",
  );
}

function optionalText(envName, fallback, maxLength) {
  const value = process.env[envName]?.trim();
  if (!value) return fallback;
  assertNoSecretShapedValue(value, envName);
  invariant(value.length <= maxLength, `${envName} too long.`);
  return value;
}

function main() {
  const postProofPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH ??
      DEFAULT_POST_PROOF_PATH,
    "OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const followthroughPath = normalizeArtifactPath(
    process.env.OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH ??
      DEFAULT_FOLLOWTHROUGH_PATH,
    "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH",
    { mustExist: true },
  );
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH",
  );
  invariant(
    !existsSync(batchPath.resolved),
    "OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH already exists.",
  );

  runInspector(
    "scripts/inspect-admin-post-customer-proof-readiness-batch.mjs",
    "Post-customer-proof readiness batch inspection",
    {
      OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH:
        postProofPath.relativePath,
    },
  );

  const { artifact: postProofBatch, sha256: postProofBatchSha256 } =
    readJsonArtifact(postProofPath.resolved, "post-customer-proof readiness batch");
  const { artifact: followthrough, sha256: followthroughSha256 } =
    readJsonArtifact(followthroughPath.resolved, "owner beta request follow-through");

  assertPostCustomerProofBatch(postProofBatch);
  assertOwnerBetaFollowthrough(followthrough);

  const approvedGymLabel = optionalText(
    "OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_GYM_LABEL",
    followthrough.request.gym_name,
    160,
  );
  invariant(
    !isUnsafeCustomerLabel(approvedGymLabel),
    "Approved beta expansion gym label must be a non-House-of-Fitness real gym.",
  );

  const batch = {
    artifact_kind: "admin_approved_beta_expansion_readiness_batch",
    status: "admin_approved_beta_expansion_readiness_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_post_customer_proof_and_owner_beta_followthrough",
    post_customer_proof_readiness_batch_path: postProofPath.relativePath,
    post_customer_proof_readiness_batch_sha256: postProofBatchSha256,
    owner_beta_request_followthrough_path: followthroughPath.relativePath,
    owner_beta_request_followthrough_sha256: followthroughSha256,
    protected_preview_url: postProofBatch.protected_preview_url,
    hosted_neon_branch: postProofBatch.hosted_neon_branch,
    approved_gym_label: approvedGymLabel,
    approved_gym_non_acme_fitness: true,
    request: {
      id: followthrough.request.id,
      gym_name: followthrough.request.gym_name,
      owner_email: followthrough.request.email,
      status: followthrough.request.status,
    },
    triage_receipt: {
      id: followthrough.triage_receipt.id,
      decision: followthrough.triage_receipt.decision,
      packet_sha256: followthrough.triage_receipt.packet_sha256,
    },
    owner_access_mode: "operator_managed",
    approved_gym_operator_fulfillment_ready: true,
    public_request_intake_dry_run_ready: true,
    invite_auth_dry_run_ready: false,
    public_self_serve_launch_allowed: false,
    browser_approval_buttons_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: BLOCKED_GATES,
    next_batches: NEXT_BATCHES,
    operator_checklist: [
      "Fulfill approved gym owner access through the operator CLI path only.",
      "Run hosted request-fulfillment proof before treating onboarding evidence as current.",
      "Package public request intake as dry-run only; do not approve or provision public requests.",
      "Keep invite delivery, product Auth admin APIs, providers, notifications, and billing/POS/member writes blocked.",
    ],
  };

  assertNoSecretShapedKeys(batch, "approved beta expansion readiness batch");
  mkdirSync(dirname(batchPath.resolved), { recursive: true });
  writeFileSync(batchPath.resolved, `${JSON.stringify(batch, null, 2)}\n`);
  console.log(`Admin approved beta expansion readiness batch: ${batchPath.relativePath}`);
  console.log("Approved gym operator fulfillment: ready for operator review");
  console.log("Public request intake, invite/Auth, live-provider/revenue gates: blocked");
}

main();
