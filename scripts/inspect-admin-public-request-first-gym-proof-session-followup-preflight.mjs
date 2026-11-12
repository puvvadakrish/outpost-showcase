#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-session-followup-preflight.json";

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

function normalizeArtifactPath(value, label) {
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
  invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
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

function assertObjectKeys(object, keys, label) {
  invariant(object && typeof object === "object" && !Array.isArray(object), `${label} required.`);
  invariant(
    JSON.stringify(Object.keys(object).sort()) === JSON.stringify([...keys].sort()),
    `${label} keys mismatch.`,
  );
}

function assertObjectArrayEqual(actual, expected, label) {
  invariant(Array.isArray(actual), `${label} required.`);
  invariant(actual.length === expected.length, `${label} count mismatch.`);
  expected.forEach((expectedEntry, index) => {
    const actualEntry = actual[index];
    assertObjectKeys(actualEntry, Object.keys(expectedEntry), `${label} ${index + 1}`);
    for (const [key, value] of Object.entries(expectedEntry)) {
      invariant(actualEntry[key] === value, `${label} ${index + 1} ${key} mismatch.`);
    }
  });
}

function expectedCommandSequence(diagnostics) {
  const summary = diagnostics.proof_session_diagnostics;
  return [
    {
      command:
        "npm run admin:public-request-first-gym:proof-session-diagnostics:inspect",
      id: "inspect_current_diagnostics",
      order: 1,
      title: "Inspect current diagnostics",
    },
    ...(summary.next_required_command
      ? [
          {
            command: summary.next_required_command,
            id: "run_next_missing_dedicated_proof_command",
            order: 2,
            title: "Run next missing dedicated proof command",
          },
          {
            command:
              "npm run admin:public-request-first-gym:proof-session-progress",
            id: "regenerate_progress_after_proof_command",
            order: 3,
            title: "Regenerate progress after evidence changes",
          },
          {
            command:
              "npm run admin:public-request-first-gym:proof-session-resume",
            id: "regenerate_resume_after_progress",
            order: 4,
            title: "Regenerate resume after progress",
          },
          {
            command:
              "npm run admin:public-request-first-gym:proof-session-diagnostics",
            id: "regenerate_diagnostics_after_resume",
            order: 5,
            title: "Regenerate diagnostics after resume",
          },
          {
            command:
              "npm run admin:public-request-first-gym:proof-session-followup-preflight",
            id: "regenerate_followup_preflight_after_diagnostics",
            order: 6,
            title: "Regenerate follow-up preflight",
          },
        ]
      : [
          {
            command:
              "npm run admin:public-request-first-gym:go-no-go:bundle && npm run admin:public-request-first-gym:go-no-go:bundle:inspect",
            id: "run_first_gym_go_no_go_bundle",
            order: 2,
            title: "Run and inspect first-gym go/no-go bundle",
          },
          {
            command:
              "npm run admin:public-request-first-gym:run && npm run admin:public-request-first-gym:run:inspect",
            id: "run_first_gym_operator_run",
            order: 3,
            title: "Run and inspect first-gym operator run",
          },
          {
            command:
              "npm run admin:public-request:limited-beta:operator-review && npm run admin:public-request:limited-beta:operator-review:inspect",
            id: "run_limited_beta_operator_review",
            order: 4,
            title: "Run and inspect limited beta operator review",
          },
        ]),
  ];
}

function main() {
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH ??
      DEFAULT_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH",
  );
  const { artifact: preflight } = readJsonArtifact(
    preflightPath.resolved,
    "public request first-gym proof session follow-up preflight",
  );
  invariant(
    preflight.artifact_kind ===
      "admin_public_request_first_gym_proof_session_followup_preflight",
    "Proof session follow-up preflight kind mismatch.",
  );
  invariant(
    preflight.status ===
      "admin_public_request_first_gym_proof_session_followup_preflight_prepared",
    "Proof session follow-up preflight status mismatch.",
  );
  invariant(
    preflight.evidence_basis ===
      "admin_public_request_first_gym_proof_session_diagnostics",
    "Proof session follow-up preflight basis mismatch.",
  );

  const diagnosticsPath = normalizeArtifactPath(
    preflight.public_request_first_gym_proof_session_diagnostics_path,
    "proof session diagnostics path",
  );
  const { artifact: diagnostics, sha256: diagnosticsSha256 } = readJsonArtifact(
    diagnosticsPath.resolved,
    "public request first-gym proof session diagnostics",
  );
  invariant(
    diagnosticsSha256 ===
      preflight.public_request_first_gym_proof_session_diagnostics_sha256,
    "Proof session diagnostics SHA256 does not match.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-session-diagnostics.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH",
    diagnosticsPath.relativePath,
    "Public request first-gym proof session diagnostics",
  );

  const summary = diagnostics.proof_session_diagnostics;
  const allInspectable = summary.all_expected_evidence_inspectable === true;
  assertObjectKeys(
    preflight.verified_diagnostics,
    [
      "diagnostic_guard_state",
      "inspectable_count",
      "missing_count",
      "next_required_command",
      "next_required_step_id",
      "path",
      "sha256",
      "total_expected_evidence_count",
    ],
    "Verified diagnostics",
  );
  invariant(
    preflight.verified_diagnostics.path === diagnosticsPath.relativePath,
    "Verified diagnostics path mismatch.",
  );
  invariant(
    preflight.verified_diagnostics.sha256 === diagnosticsSha256,
    "Verified diagnostics SHA256 mismatch.",
  );
  for (const key of [
    "inspectable_count",
    "missing_count",
    "next_required_command",
    "next_required_step_id",
    "total_expected_evidence_count",
  ]) {
    invariant(
      preflight.verified_diagnostics[key] === summary[key],
      `Verified diagnostics ${key} mismatch.`,
    );
  }
  invariant(
    preflight.verified_diagnostics.diagnostic_guard_state ===
      diagnostics.diagnostic_guard.state,
    "Verified diagnostics guard state mismatch.",
  );

  invariant(
    preflight.proof_session_followup_preflight?.mode ===
      "dedicated_followup_preflight_only",
    "Follow-up preflight must remain preflight-only.",
  );
  invariant(
    preflight.proof_session_followup_preflight.customer_observed_completion_recorded ===
      false,
    "Follow-up preflight cannot record customer-observed completion.",
  );
  invariant(
    preflight.proof_session_followup_preflight.first_gym_operator_run_recorded ===
      false,
    "Follow-up preflight cannot record first-gym operator run.",
  );
  invariant(
    preflight.proof_session_followup_preflight.limited_beta_review_recorded ===
      false,
    "Follow-up preflight cannot record limited beta review.",
  );
  invariant(
    preflight.proof_session_followup_preflight.public_launch_decision_allowed ===
      false,
    "Follow-up preflight cannot allow public launch decision.",
  );
  invariant(
    preflight.proof_session_followup_preflight.ready_for_dedicated_followup_commands ===
      allInspectable,
    "Follow-up preflight readiness mismatch.",
  );
  for (const key of [
    "all_expected_evidence_inspectable",
    "inspectable_count",
    "missing_count",
    "next_required_command",
    "next_required_step_id",
    "total_expected_evidence_count",
  ]) {
    invariant(
      preflight.proof_session_followup_preflight[key] === summary[key],
      `Follow-up preflight ${key} mismatch.`,
    );
  }
  assertObjectKeys(
    preflight.evidence_summary,
    ["inspectable_evidence", "missing_evidence"],
    "Evidence summary",
  );
  assertObjectArrayEqual(
    preflight.evidence_summary.missing_evidence,
    diagnostics.evidence_summary.missing_evidence,
    "Missing evidence summary",
  );
  assertObjectArrayEqual(
    preflight.evidence_summary.inspectable_evidence,
    diagnostics.evidence_summary.inspectable_evidence,
    "Inspectable evidence summary",
  );
  assertObjectArrayEqual(
    preflight.operator_command_sequence,
    expectedCommandSequence(diagnostics),
    "Operator command sequence",
  );
  invariant(
    preflight.followup_guard?.state ===
      (allInspectable ? "ready_for_dedicated_followup_commands" : "blocked"),
    "Follow-up guard state mismatch.",
  );
  invariant(
    preflight.followup_guard?.allowed_next_action ===
      (allInspectable
        ? "Run the dedicated first-gym go/no-go, first-gym operator-run, and limited-beta operator-review commands; this preflight still records no proof."
        : "Run the next missing dedicated proof command, then regenerate progress, resume, diagnostics, and this follow-up preflight."),
    "Follow-up guard action mismatch.",
  );
  assertFalseFlags(preflight, "Proof session follow-up preflight");

  console.log(
    "Admin public request first-gym proof session follow-up preflight inspection passed",
  );
}

main();
