#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_INTAKE_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-intake-artifact.json";
const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-followup-readiness-batch.json";

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
  "Public launch decision",
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

function runIntakeInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-request-intake-artifact.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Public request intake artifact inspection failed.\n${result.stderr || result.stdout}`,
    );
  }
}

function validateIntakeArtifact(artifact) {
  invariant(
    artifact.artifact_kind === "admin_public_request_intake_artifact",
    "Public request intake artifact kind mismatch.",
  );
  invariant(
    artifact.status === "admin_public_request_intake_artifact_prepared",
    "Public request intake artifact status mismatch.",
  );
  invariant(
    artifact.request_only_intake_artifact_ready === true,
    "Request-only intake artifact must be ready.",
  );
  invariant(
    artifact.intake_mode === "request_only_human_reviewed_no_persistence",
    "Intake artifact must remain request-only/no-persistence.",
  );
  invariant(
    artifact.request_preview?.operator_review_required === true,
    "Operator review must remain required.",
  );
  assertFalse(
    artifact.request_preview,
    "persisted_public_request_allowed",
    "Persisted public request blocked.",
  );
  for (const key of [
    "public_request_form_submission_allowed",
    "public_submission_accepted",
    "browser_approval_buttons_allowed",
    "automatic_approval_allowed",
    "owner_provisioning_allowed",
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
    assertFalse(artifact, key, `${key} must remain blocked.`);
  }
}

function main() {
  const intakePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH ??
      DEFAULT_INTAKE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH",
    { mustExist: true },
  );
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FOLLOWUP_READINESS_BATCH_PATH ??
      DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FOLLOWUP_READINESS_BATCH_PATH",
  );

  runIntakeInspect(intakePath.relativePath);
  const { artifact: intake, sha256: intakeSha256 } = readJsonArtifact(
    intakePath.resolved,
    "public request intake artifact",
  );
  validateIntakeArtifact(intake);

  const batch = {
    artifact_kind: "admin_public_request_followup_readiness_batch",
    status: "admin_public_request_followup_readiness_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_intake_artifact",
    public_request_intake_artifact_path: intakePath.relativePath,
    public_request_intake_artifact_sha256: intakeSha256,
    candidate_gym_label: intake.candidate_gym_label,
    public_request_followup_readiness_batch_ready: true,
    invite_auth_no_send_no_create_records: {
      mode: "metadata_only_no_send_no_create",
      reviewed_request_label: intake.request_preview.label,
      reviewed_request_contact: intake.request_preview.contact,
      reviewed_request_source: intake.request_preview.source,
      owner_invite_record_prepared: true,
      staff_invite_record_prepared: true,
      owner_invite_delivery_allowed: false,
      staff_invite_delivery_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      product_auth_admin_api_allowed: false,
      auth_user_created: false,
      magic_link_created: false,
      automatic_owner_staff_grants_allowed: false,
    },
    live_provider_revenue_member_system_runbooks: {
      mode: "blocked_runbooks_only",
      runbook_titles: [
        "Phone/email provider proof remains separate and disabled",
        "Revenue, billing, and POS writes remain separate and disabled",
        "Access-control and member-ledger writes remain separate and disabled",
      ],
      gmail_resend_smtp_provider_allowed: false,
      phone_email_provider_activation_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      access_control_writes_allowed: false,
      member_ledger_writes_allowed: false,
      provider_ingress_allowed: false,
      provider_egress_allowed: false,
    },
    limited_beta_operator_onboarding_review: {
      mode: "required_before_public_launch",
      review_status: "pending_real_limited_beta_operator_review",
      real_limited_beta_onboarding_review_recorded: false,
      public_launch_decision_allowed: false,
    },
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
          "Prepare owner/staff handoff evidence only after reviewed request selection.",
        detail:
          "Owner access stays operator-managed and staff invite delivery remains no-send.",
        id: "owner_staff_handoff_readiness_batch",
        state: "blocked",
        title: "Owner/staff handoff readiness",
      },
      {
        command:
          "Run approved-gym hosted rehearsal before any customer walkthrough.",
        detail:
          "No public launch, provider activation, invite send, or revenue/member writes.",
        id: "approved_gym_hosted_rehearsal_readiness_batch",
        state: "blocked",
        title: "Approved-gym hosted rehearsal",
      },
      {
        command:
          "Assemble first-gym go/no-go bundle after real limited beta review.",
        detail:
          "Public self-serve and live systems stay blocked until the go/no-go gate is green.",
        id: "first_gym_go_no_go_bundle",
        state: "blocked",
        title: "First-gym go/no-go bundle",
      },
    ],
  };

  mkdirSync(dirname(batchPath.resolved), { recursive: true });
  writeFileSync(batchPath.resolved, `${JSON.stringify(batch, null, 2)}\n`, {
    flag: "wx",
  });
  console.log(
    `Admin public request follow-up readiness batch prepared: ${batchPath.relativePath}`,
  );
}

main();
