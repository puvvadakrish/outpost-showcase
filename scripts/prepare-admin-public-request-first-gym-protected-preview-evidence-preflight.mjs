#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_COORDINATOR_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-evidence-run-coordinator.json";
const DEFAULT_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-protected-preview-evidence-preflight.json";

const REFRESH_AFTER_EVIDENCE_COMMAND =
  "npm run admin:public-request-first-gym:proof-evidence-session-ledger && npm run admin:public-request-first-gym:proof-evidence-session-ledger:inspect && npm run admin:public-request-first-gym:evidence-execution-readiness && npm run admin:public-request-first-gym:evidence-execution-readiness:inspect && npm run admin:public-request-first-gym:evidence-run-coordinator && npm run admin:public-request-first-gym:evidence-run-coordinator:inspect && npm run admin:public-request-first-gym:protected-preview-evidence-preflight && npm run admin:public-request-first-gym:protected-preview-evidence-preflight:inspect";

const BLOCKED_FLAGS = [
  "public_self_serve_launch_allowed",
  "public_request_form_allowed",
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
  "gmail_resend_smtp_provider_allowed",
  "phone_email_provider_activation_allowed",
  "live_provider_enablement_allowed",
  "billing_pos_member_writes_allowed",
  "access_control_writes_allowed",
  "member_ledger_writes_allowed",
  "provider_ingress_allowed",
  "provider_egress_allowed",
  "public_launch_decision_allowed",
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
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(value);
  invariant(!secretLike, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertNoSecretShapedValue(entry, `${label}.${[...trail, String(index)].join(".")}`);
      assertNoSecretShapedKeys(entry, label, [...trail, String(index)]);
    });
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
  } else if (options.mustNotExist) {
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

function runInspect(script, envName, path, label) {
  const result = spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, [envName]: path },
  });
  if (result.status !== 0) {
    throw new Error(`${label} inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function assertFalseFlags(object, label) {
  for (const key of BLOCKED_FLAGS) {
    invariant(object?.[key] === false, `${label} ${key} blocked.`);
  }
}

function expectedEvidenceCaptureSequence(coordinator) {
  const hostedState =
    coordinator.evidence_run_coordinator.hosted_rehearsal_evidence_state;
  const customerState =
    coordinator.evidence_run_coordinator.customer_observed_session_state;
  const evidenceReady =
    coordinator.evidence_run_coordinator.go_no_go_allowed_by_evidence === true;
  return [
    {
      command:
        "npm run admin:public-request-first-gym:evidence-run-coordinator:inspect",
      id: "confirm_protected_preview_context",
      required_before_next_step: "Protected Preview URL, hosted Neon branch, and coordinator inspector must be current.",
      state: "required_before_real_evidence",
      title: "Confirm protected Preview context",
    },
    {
      command:
        "npm run admin:public-request-hosted-rehearsal:evidence && npm run admin:public-request-hosted-rehearsal:evidence:inspect",
      id: "record_hosted_rehearsal_evidence",
      required_before_next_step: "Real protected Preview observations from the hosted rehearsal evidence command.",
      state:
        hostedState === "inspectable"
          ? "already_inspectable_refresh_before_customer_session"
          : "ready_when_real_hosted_observations_exist",
      title: "Record hosted rehearsal evidence",
    },
    {
      command: REFRESH_AFTER_EVIDENCE_COMMAND,
      id: "refresh_after_hosted_evidence",
      required_before_next_step: "Session ledger, execution readiness, coordinator, and this preflight must be regenerated after hosted evidence changes.",
      state: "required_after_hosted_evidence_change",
      title: "Refresh after hosted evidence",
    },
    {
      command:
        "npm run admin:customer-session:record && npm run admin:customer-session:inspect && npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
      id: "record_customer_observed_session_and_hosted_digest",
      required_before_next_step: "Customer-observed session completion and hosted digest proof from the dedicated commands.",
      state:
        customerState === "inspectable"
          ? "already_inspectable_confirm_hosted_digest"
          : "blocked_until_customer_observed_session_happens",
      title: "Record customer session and hosted digest",
    },
    {
      command: REFRESH_AFTER_EVIDENCE_COMMAND,
      id: "refresh_after_customer_evidence",
      required_before_next_step: "Regenerate the full evidence status chain after customer session or digest proof changes.",
      state: "required_after_customer_evidence_change",
      title: "Refresh after customer evidence",
    },
    {
      command:
        "npm run admin:public-request-first-gym:go-no-go:bundle && npm run admin:public-request-first-gym:go-no-go:bundle:inspect",
      id: "hold_first_gym_go_no_go",
      required_before_next_step: "Hosted rehearsal, customer-observed session, and hosted digest proof must be inspectable.",
      state: evidenceReady
        ? "held_until_hosted_digest_is_confirmed"
        : "blocked_until_hosted_and_customer_evidence_inspectable",
      title: "Hold first-gym go/no-go",
    },
    {
      command:
        "npm run admin:public-request-first-gym:run && npm run admin:public-request-first-gym:run:inspect && npm run admin:public-request:limited-beta:operator-review && npm run admin:public-request:limited-beta:operator-review:inspect",
      id: "hold_operator_run_and_limited_beta_review",
      required_before_next_step: "First-gym go/no-go bundle and first-gym run proof must be inspectable before limited beta review.",
      state: "blocked_until_go_no_go_and_first_gym_run_are_inspectable",
      title: "Hold operator run and limited beta review",
    },
    {
      command:
        "npm run admin:public-request:self-serve:launch-preflight && npm run admin:public-request:self-serve:launch-preflight:inspect",
      id: "hold_public_self_serve_preflight",
      required_before_next_step: "Limited beta review must be inspectable and public/live/revenue gates need separate proof tracks.",
      state: "blocked_until_limited_beta_and_separate_public_live_revenue_proof",
      title: "Hold public self-serve preflight",
    },
  ];
}

function expectedArtifactReplacementPolicy() {
  return [
    {
      id: "derived_control_artifact_regeneration",
      requirement:
        "Derived readiness artifacts use create-only writes; remove the prior derived artifact or choose a new artifact path before regenerating the same control layer.",
    },
    {
      id: "real_proof_artifact_preservation",
      requirement:
        "Do not overwrite inspected real proof artifacts; preserve prior evidence and record replacements through a new dedicated proof artifact path.",
    },
    {
      id: "post_change_refresh",
      requirement:
        "After any hosted or customer evidence artifact changes, rerun ledger, execution readiness, coordinator, and protected Preview evidence preflight inspectors.",
    },
  ];
}

function expectedStopConditions() {
  return [
    "Stop if no real protected Preview hosted rehearsal observations are available.",
    "Stop if the customer-observed session did not happen with customer visibility.",
    "Stop if hosted customer-session digest proof is missing before first-gym go/no-go.",
    "Stop if unexpected tenant data appears in any artifact or screenshot.",
    "Stop if invite delivery, notifications, live providers, billing, POS, access-control, or member-ledger writes are claimed.",
    "Stop if replacing an artifact would overwrite inspected proof evidence instead of creating a new proof artifact.",
    "Stop if any parent, ledger, readiness, coordinator, or preflight inspector fails.",
  ];
}

function main() {
  const coordinatorPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH ??
      DEFAULT_COORDINATOR_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH",
    { mustExist: true },
  );
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH ??
      DEFAULT_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH",
    { mustNotExist: true },
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-evidence-run-coordinator.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH",
    coordinatorPath.relativePath,
    "Public request first-gym evidence run coordinator",
  );
  const { artifact: coordinator, sha256: coordinatorSha256 } = readJsonArtifact(
    coordinatorPath.resolved,
    "public request first-gym evidence run coordinator",
  );
  assertFalseFlags(coordinator, "Evidence run coordinator");

  const evidenceReady =
    coordinator.evidence_run_coordinator.go_no_go_allowed_by_evidence === true;
  const preflight = {
    artifact_kind:
      "admin_public_request_first_gym_protected_preview_evidence_preflight",
    status:
      "admin_public_request_first_gym_protected_preview_evidence_preflight_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_first_gym_evidence_run_coordinator",
    public_request_first_gym_evidence_run_coordinator_path:
      coordinatorPath.relativePath,
    public_request_first_gym_evidence_run_coordinator_sha256:
      coordinatorSha256,
    verified_evidence_run_coordinator: {
      coordinator_state:
        coordinator.evidence_run_coordinator.coordinator_state,
      customer_observed_session_state:
        coordinator.evidence_run_coordinator.customer_observed_session_state,
      go_no_go_allowed_by_evidence:
        coordinator.evidence_run_coordinator.go_no_go_allowed_by_evidence,
      hosted_rehearsal_evidence_state:
        coordinator.evidence_run_coordinator.hosted_rehearsal_evidence_state,
      next_missing_step_id:
        coordinator.evidence_run_coordinator.next_missing_step_id,
      path: coordinatorPath.relativePath,
      sha256: coordinatorSha256,
    },
    protected_preview_evidence_preflight: {
      customer_observed_completion_recorded: false,
      first_gym_go_no_go_approval_recorded: false,
      first_gym_operator_run_recorded: false,
      hosted_customer_session_digest_proof_claimed: false,
      hosted_rehearsal_proof_recorded: false,
      limited_beta_review_recorded: false,
      mode: "operator_evidence_preflight_only",
      preflight_state: evidenceReady
        ? "ready_to_confirm_hosted_digest_before_go_no_go"
        : "ready_to_record_real_hosted_rehearsal_then_customer_session",
      public_launch_decision_allowed: false,
    },
    operator_input_requirements: [
      "Protected Preview URL for the hosted rehearsal.",
      "Hosted Neon branch label that matches the coordinator lineage.",
      "Operator initials or support-window label for traceability.",
      "Real hosted rehearsal observations captured from protected Preview.",
      "Customer-observed session completion notes from the actual customer session.",
      "Hosted customer-session digest proof generated by the dedicated hosted proof command.",
    ],
    evidence_capture_sequence: expectedEvidenceCaptureSequence(coordinator),
    artifact_replacement_policy: expectedArtifactReplacementPolicy(),
    stop_conditions: expectedStopConditions(),
    blocked_gates: [
      "Public owner self-signup",
      "Public request form submission",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone/email provider activation",
      "Live provider enablement",
      "Billing, POS, access control, member-ledger writes",
      "Public launch decision",
    ],
  };

  for (const key of BLOCKED_FLAGS) preflight[key] = false;
  assertNoSecretShapedKeys(
    preflight,
    "public request first-gym protected Preview evidence preflight",
  );
  mkdirSync(dirname(preflightPath.resolved), { recursive: true });
  writeFileSync(preflightPath.resolved, `${JSON.stringify(preflight, null, 2)}\n`, {
    flag: "wx",
  });

  console.log(
    "Admin public request first-gym protected Preview evidence preflight prepared",
  );
  console.log(`Artifact: ${preflightPath.relativePath}`);
  console.log(
    `Preflight state: ${preflight.protected_preview_evidence_preflight.preflight_state}`,
  );
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
