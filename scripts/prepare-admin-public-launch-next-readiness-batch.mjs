#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_CONTROLS_PATH =
  "artifacts/admin-launch-readiness/admin-public-launch-controls-batch.json";
const DEFAULT_NEXT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-public-launch-next-readiness-batch.json";

const BLOCKED_GATES = [
  "Public owner self-signup",
  "Public request form submission",
  "Browser approval buttons",
  "Automatic approval",
  "Invite delivery",
  "Notification sending",
  "Phone/email provider activation",
  "Product Auth admin API",
  "Auth user creation",
  "Automatic owner/staff grants",
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

function runControlsInspect(path) {
  const result = spawnSync(
    "node",
    ["scripts/inspect-admin-public-launch-controls-batch.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: path,
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Public launch controls inspection failed.\n${result.stderr || result.stdout}`,
    );
  }
}

function validateControlsBatch(batch) {
  invariant(
    batch.artifact_kind === "admin_public_launch_controls_batch",
    "Public launch controls kind mismatch.",
  );
  invariant(
    batch.status === "admin_public_launch_controls_batch_prepared",
    "Public launch controls status mismatch.",
  );
  invariant(
    batch.public_launch_controls_batch_ready === true,
    "Public launch controls batch must be ready.",
  );
  invariant(
    batch.public_request_intake?.mode === "request_only_human_reviewed",
    "Public request intake must remain request-only/human-reviewed.",
  );
  invariant(
    batch.invite_auth_no_send?.mode === "no_send_no_create_dry_run",
    "Invite/Auth must remain no-send/no-create.",
  );
  invariant(
    batch.live_provider_revenue_member_systems?.mode ===
      "separate_blocked_proof_tracks",
    "Live-provider/revenue/member systems must remain separate proof tracks.",
  );
  for (const key of [
    "public_self_serve_launch_allowed",
    "public_request_form_allowed",
    "browser_approval_buttons_allowed",
    "automatic_approval_allowed",
    "product_auth_admin_api_allowed",
    "auth_user_created",
    "automatic_owner_staff_grants_allowed",
    "invite_delivery_allowed",
    "staff_invite_delivery_allowed",
    "outbound_email_allowed",
    "notification_sending_allowed",
    "gmail_resend_smtp_provider_allowed",
    "live_provider_enablement_allowed",
    "billing_pos_member_writes_allowed",
    "access_control_writes_allowed",
    "member_ledger_writes_allowed",
  ]) {
    assertFalse(batch, key, `${key} must remain blocked.`);
  }
}

function main() {
  const controlsPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH ??
      DEFAULT_CONTROLS_PATH,
    "OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH",
    { mustExist: true },
  );
  const nextBatchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH ??
      DEFAULT_NEXT_BATCH_PATH,
    "OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH",
  );

  runControlsInspect(controlsPath.relativePath);
  const { artifact: controls, sha256: controlsSha256 } = readJsonArtifact(
    controlsPath.resolved,
    "public launch controls batch",
  );
  validateControlsBatch(controls);

  const batch = {
    artifact_kind: "admin_public_launch_next_readiness_batch",
    status: "admin_public_launch_next_readiness_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_launch_controls_batch",
    public_launch_controls_batch_path: controlsPath.relativePath,
    public_launch_controls_batch_sha256: controlsSha256,
    candidate_gym_label: controls.candidate_gym_label,
    public_launch_next_readiness_batch_ready: true,
    public_request_intake_dry_run: {
      mode: "request_only_human_reviewed_no_persistence",
      operator_review_required: true,
      public_request_form_submission_allowed: false,
      browser_approval_buttons_allowed: false,
      automatic_approval_allowed: false,
      owner_provisioning_allowed: false,
      automatic_owner_staff_grants_allowed: false,
    },
    invite_auth_no_send_no_create: {
      mode: "review_only_no_send_no_create",
      owner_invite_delivery_allowed: false,
      staff_invite_delivery_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      product_auth_admin_api_allowed: false,
      auth_user_created: false,
      magic_link_created: false,
      automatic_owner_staff_grants_allowed: false,
    },
    live_provider_revenue_member_system_tracks: {
      mode: "separate_blocked_proof_tracks",
      gmail_resend_smtp_provider_allowed: false,
      phone_email_provider_activation_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      access_control_writes_allowed: false,
      member_ledger_writes_allowed: false,
      provider_ingress_allowed: false,
      provider_egress_allowed: false,
    },
    limited_beta_operator_review: {
      mode: "required_before_public_launch",
      real_limited_beta_onboarding_review_recorded: false,
      public_launch_decision_allowed: false,
    },
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    public_request_form_submission_allowed: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
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
    current_batch_set: [
      "Public request intake dry-run remains request-only, human-reviewed, and non-persistent.",
      "Invite/Auth dry-runs remain no-send and no-create with no magic links or product Auth admin APIs.",
      "Live-provider, revenue, POS, access-control, and member-ledger work remains separate blocked proof tracks.",
      "A real limited beta operator-assisted onboarding review is still required before any public launch decision.",
    ],
    next_readiness_batches: [
      {
        command:
          "Build the request-only public intake artifact and optional read-only Admin preview without accepting public submissions.",
        detail:
          "Human review remains required; no browser approval, owner provisioning, invite delivery, or Auth user creation.",
        id: "public_request_intake_artifact",
        state: "pending",
        title: "Request-only public intake artifact",
      },
      {
        command:
          "Prepare invite/Auth no-send and no-create proof records from reviewed request metadata.",
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

  assertNoSecretShapedKeys(batch, "public launch next readiness batch");
  mkdirSync(dirname(nextBatchPath.resolved), { recursive: true });
  writeFileSync(nextBatchPath.resolved, `${JSON.stringify(batch, null, 2)}\n`, {
    flag: "wx",
  });

  console.log("Admin public launch next readiness batch prepared");
  console.log(`Artifact: ${nextBatchPath.relativePath}`);
  console.log("Public request intake: request-only/no persistence");
  console.log("Invite/Auth: no-send/no-create");
  console.log("Live-provider/revenue/member-system tracks: blocked");
  console.log("Limited beta review: still required");
}

main();
