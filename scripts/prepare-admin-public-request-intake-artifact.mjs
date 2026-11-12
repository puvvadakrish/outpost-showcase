#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_NEXT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-public-launch-next-readiness-batch.json";
const DEFAULT_INTAKE_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-intake-artifact.json";

const BLOCKED_GATES = [
  "Public owner self-signup",
  "Public request form submission",
  "Browser approval buttons",
  "Automatic approval",
  "Owner provisioning",
  "Invite delivery",
  "Notification sending",
  "Product Auth admin API",
  "Auth user creation",
  "Magic link creation",
  "Automatic owner/staff grants",
  "Phone/email provider activation",
  "Provider ingress/egress",
  "Billing, POS, access control, member-ledger writes",
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
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(value) ||
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
    `${label} must be under artifacts/.`,
  );
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  } else {
    invariant(!existsSync(resolved), `${label} already exists: ${relativePath}`);
  }
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
  return {
    artifact,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

function assertFalse(object, key, message) {
  invariant(object?.[key] === false, message);
}

function runNextBatchInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-launch-next-readiness-batch.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Public launch next readiness inspection failed.\n${result.stderr || result.stdout}`,
    );
  }
}

function validateNextBatch(batch) {
  invariant(
    batch.artifact_kind === "admin_public_launch_next_readiness_batch",
    "Public launch next readiness kind mismatch.",
  );
  invariant(
    batch.status === "admin_public_launch_next_readiness_batch_prepared",
    "Public launch next readiness status mismatch.",
  );
  invariant(
    batch.public_launch_next_readiness_batch_ready === true,
    "Public launch next readiness batch must be ready.",
  );
  invariant(
    batch.public_request_intake_dry_run?.mode ===
      "request_only_human_reviewed_no_persistence",
    "Public request intake must remain request-only/no-persistence.",
  );
  invariant(
    batch.public_request_intake_dry_run?.operator_review_required === true,
    "Operator review must remain required.",
  );
  for (const key of [
    "public_self_serve_launch_allowed",
    "public_request_form_allowed",
    "public_request_form_submission_allowed",
    "browser_approval_buttons_allowed",
    "automatic_approval_allowed",
    "product_auth_admin_api_allowed",
    "auth_user_created",
    "magic_link_created",
    "automatic_owner_staff_grants_allowed",
    "invite_delivery_allowed",
    "staff_invite_delivery_allowed",
    "outbound_email_allowed",
    "notification_sending_allowed",
    "phone_email_provider_activation_allowed",
    "live_provider_enablement_allowed",
    "billing_pos_member_writes_allowed",
    "access_control_writes_allowed",
    "member_ledger_writes_allowed",
    "provider_ingress_allowed",
    "provider_egress_allowed",
    "public_launch_decision_allowed",
  ]) {
    assertFalse(batch, key, `${key} must remain blocked.`);
  }
}

function optionalText(envName, fallback, maxLength) {
  const value = process.env[envName]?.trim() || fallback;
  invariant(value && value.length <= maxLength, `${envName} is invalid.`);
  assertNoSecretShapedValue(value, envName);
  return value;
}

function main() {
  const nextBatchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH ??
      DEFAULT_NEXT_BATCH_PATH,
    "OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH",
    { mustExist: true },
  );
  const intakePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH ??
      DEFAULT_INTAKE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH",
  );

  runNextBatchInspect(nextBatchPath.relativePath);
  const { artifact: nextBatch, sha256: nextBatchSha256 } = readJsonArtifact(
    nextBatchPath.resolved,
    "public launch next readiness batch",
  );
  validateNextBatch(nextBatch);

  const requestLabel = optionalText(
    "OUTPOST_ADMIN_PUBLIC_REQUEST_LABEL",
    nextBatch.candidate_gym_label ?? "reviewed gym request",
    160,
  );
  const requestContact = optionalText(
    "OUTPOST_ADMIN_PUBLIC_REQUEST_CONTACT",
    "operator-reviewed-contact@example.invalid",
    180,
  );
  const requestSource = optionalText(
    "OUTPOST_ADMIN_PUBLIC_REQUEST_SOURCE",
    "operator-entered-request-preview",
    120,
  );

  const artifact = {
    artifact_kind: "admin_public_request_intake_artifact",
    status: "admin_public_request_intake_artifact_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_launch_next_readiness_batch",
    public_launch_next_readiness_batch_path: nextBatchPath.relativePath,
    public_launch_next_readiness_batch_sha256: nextBatchSha256,
    candidate_gym_label: nextBatch.candidate_gym_label,
    request_only_intake_artifact_ready: true,
    request_preview: {
      label: requestLabel,
      contact: requestContact,
      source: requestSource,
      operator_review_required: true,
      persisted_public_request_allowed: false,
      public_submission_accepted: false,
    },
    admin_preview: {
      mode: "read_only_operator_preview",
      browser_approval_buttons_allowed: false,
      public_submit_button_allowed: false,
      owner_provisioning_button_allowed: false,
      invite_send_button_allowed: false,
    },
    intake_mode: "request_only_human_reviewed_no_persistence",
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    public_request_form_submission_allowed: false,
    public_submission_accepted: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    owner_provisioning_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_user_created: false,
    magic_link_created: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    phone_email_provider_activation_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    access_control_writes_allowed: false,
    member_ledger_writes_allowed: false,
    provider_ingress_allowed: false,
    provider_egress_allowed: false,
    public_launch_decision_allowed: false,
    blocked_gates: BLOCKED_GATES,
    next_readiness_batches: [
      {
        command:
          "Prepare invite/Auth no-send and no-create records from this reviewed request metadata.",
        detail:
          "No email, notifications, magic links, product Auth admin API, Auth users, or automatic grants.",
        id: "invite_auth_no_send_no_create_records",
        state: "blocked",
        title: "Invite/Auth no-send/no-create records",
      },
      {
        command:
          "Prepare live-provider, revenue, POS, access-control, and member-ledger proof tracks as blocked runbooks.",
        detail:
          "No provider ingress/egress, billing, POS, access-control, or member-ledger writes.",
        id: "live_provider_revenue_member_system_runbooks",
        state: "blocked",
        title: "Live-provider/revenue/member-system runbooks",
      },
      {
        command:
          "Run another real limited beta operator-assisted onboarding review before public launch.",
        detail:
          "Public launch decision remains blocked until a non-House-of-Fitness real gym review is recorded.",
        id: "limited_beta_operator_onboarding_review",
        state: "blocked",
        title: "Limited beta onboarding review",
      },
    ],
  };

  assertNoSecretShapedKeys(artifact, "public request intake artifact");
  mkdirSync(dirname(intakePath.resolved), { recursive: true });
  writeFileSync(intakePath.resolved, `${JSON.stringify(artifact, null, 2)}\n`, {
    flag: "wx",
  });

  console.log("Admin public request intake artifact prepared");
  console.log(`Artifact: ${intakePath.relativePath}`);
  console.log("Request intake: request-only/read-only");
  console.log("Public submission: blocked");
  console.log("Browser approval/provisioning: blocked");
  console.log("Invite/Auth/live-provider/revenue gates: blocked");
}

main();
