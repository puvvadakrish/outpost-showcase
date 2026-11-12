#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_RESUME_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-session-resume-packet.json";

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

const EXPECTED_SUPPORT_RECOVERY_CHECKLIST = [
  "If expected evidence appears after this packet, regenerate progress and resume before relying on this snapshot.",
  "If an artifact appears unexpectedly, inspect it with its dedicated command before treating it as evidence.",
  "If any inspector fails, stop the proof session and preserve the artifact path plus terminal output for support review.",
  "Do not delete, rotate, or replace customer-observed proof artifacts without copying the failing artifact and reason into operator notes.",
  "Do not claim public launch, invite delivery, live-provider activation, billing, POS, access-control, or member-ledger readiness from this packet.",
];

function allowedCompletionAction(allExpectedEvidenceInspectable) {
  return allExpectedEvidenceInspectable
    ? "Use the dedicated first-gym go/no-go, operator-run, and limited-beta review commands; this packet only confirms the progress snapshot is complete."
    : "Run the next missing dedicated proof command, then regenerate progress and resume.";
}

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
      const path = [...trail, String(index)].join(".");
      assertNoSecretShapedValue(entry, `${label}.${path}`);
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

function expectedCommandSequence(nextMissing) {
  return [
    {
      command:
        "npm run admin:public-request-first-gym:proof-session-progress:inspect",
      id: "inspect_current_progress_snapshot",
      order: 1,
      title: "Inspect the current progress snapshot",
    },
    ...(nextMissing
      ? [
          {
            command: nextMissing.terminal_command,
            id: "run_next_missing_dedicated_proof_command",
            order: 2,
            title: nextMissing.title,
          },
          {
            command:
              "npm run admin:public-request-first-gym:proof-session-progress",
            id: "regenerate_progress_after_proof_command",
            order: 3,
            title: "Regenerate proof-session progress",
          },
          {
            command:
              "npm run admin:public-request-first-gym:proof-session-resume",
            id: "regenerate_resume_packet_after_progress",
            order: 4,
            title: "Regenerate this resume packet",
          },
        ]
      : [
          {
            command:
              "Run dedicated first-gym follow-up commands; this packet does not record them.",
            id: "ready_for_dedicated_followup_commands",
            order: 2,
            title: "Move to dedicated follow-up commands",
          },
        ]),
  ];
}

function assertObjectArrayEqual(actual, expected, label) {
  invariant(Array.isArray(actual), `${label} required.`);
  invariant(actual.length === expected.length, `${label} count mismatch.`);
  expected.forEach((expectedEntry, index) => {
    const actualEntry = actual[index];
    invariant(actualEntry && typeof actualEntry === "object", `${label} ${index + 1} required.`);
    const actualKeys = Object.keys(actualEntry).sort();
    const expectedKeys = Object.keys(expectedEntry).sort();
    invariant(
      JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
      `${label} ${index + 1} keys mismatch.`,
    );
    for (const [key, value] of Object.entries(expectedEntry)) {
      invariant(
        actualEntry[key] === value,
        `${label} ${index + 1} ${key} mismatch.`,
      );
    }
  });
}

function main() {
  const resumePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH ??
      DEFAULT_RESUME_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH",
  );
  const { artifact: resume } = readJsonArtifact(
    resumePath.resolved,
    "public request first-gym proof session resume packet",
  );
  invariant(
    resume.artifact_kind ===
      "admin_public_request_first_gym_proof_session_resume_packet",
    "Proof session resume packet kind mismatch.",
  );
  invariant(
    resume.status ===
      "admin_public_request_first_gym_proof_session_resume_packet_prepared",
    "Proof session resume packet status mismatch.",
  );
  invariant(
    resume.evidence_basis ===
      "admin_public_request_first_gym_proof_session_progress_batch",
    "Proof session resume packet basis mismatch.",
  );
  const progressPath = normalizeArtifactPath(
    resume.public_request_first_gym_proof_session_progress_batch_path,
    "proof session progress path",
  );
  const { artifact: progress, sha256: progressSha256 } = readJsonArtifact(
    progressPath.resolved,
    "public request first-gym proof session progress",
  );
  invariant(
    progressSha256 === resume.public_request_first_gym_proof_session_progress_batch_sha256,
    "Proof session progress SHA256 does not match.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-session-progress-batch.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH",
    progressPath.relativePath,
    "Public request first-gym proof session progress",
  );
  invariant(
    resume.public_request_first_gym_proof_session_execution_pack_sha256 ===
      progress.public_request_first_gym_proof_session_execution_pack_sha256,
    "Resume packet execution pack SHA256 mismatch.",
  );
  invariant(
    resume.proof_session_resume_packet?.mode ===
      "operator_resume_and_recovery_only",
    "Resume packet must remain operator-only.",
  );
  invariant(
    resume.proof_session_resume_packet.customer_observed_completion_recorded === false,
    "Resume packet cannot record customer-observed completion.",
  );
  invariant(
    resume.proof_session_resume_packet.first_gym_operator_run_recorded === false,
    "Resume packet cannot record first-gym operator run.",
  );
  invariant(
    resume.proof_session_resume_packet.limited_beta_review_recorded === false,
    "Resume packet cannot record limited beta review.",
  );
  invariant(
    resume.proof_session_resume_packet.public_launch_decision_allowed === false,
    "Resume packet cannot allow public launch decision.",
  );

  const ledger = progress.progress_ledger ?? [];
  const inventory = resume.evidence_inventory ?? [];
  invariant(inventory.length === ledger.length, "Evidence inventory count mismatch.");
  ledger.forEach((step, index) => {
    const item = inventory[index];
    invariant(item.id === step.id, `Evidence inventory step ${index + 1} id mismatch.`);
    invariant(item.order === step.order, `${step.id} inventory order mismatch.`);
    invariant(item.state === step.state, `${step.id} inventory state mismatch.`);
    invariant(item.title === step.title, `${step.id} inventory title mismatch.`);
    invariant(item.artifact_path === step.artifact_path, `${step.id} inventory path mismatch.`);
    invariant(
      (item.artifact_sha256 ?? null) === (step.artifact_sha256 ?? null),
      `${step.id} inventory SHA256 mismatch.`,
    );
  });
  const inspectableCount = ledger.filter((step) => step.state === "inspectable").length;
  const missingSteps = ledger.filter((step) => step.state === "missing");
  const missingCount = missingSteps.length;
  invariant(
    resume.proof_session_resume_packet.inspectable_count === inspectableCount,
    "Resume inspectable count mismatch.",
  );
  invariant(
    resume.proof_session_resume_packet.missing_count === missingCount,
    "Resume missing count mismatch.",
  );
  invariant(
    resume.proof_session_resume_packet.total_expected_evidence_count === ledger.length,
    "Resume total evidence count mismatch.",
  );
  invariant(
    resume.proof_session_resume_packet.all_expected_evidence_inspectable ===
      (missingCount === 0),
    "Resume all-evidence flag mismatch.",
  );
  invariant(
    resume.proof_session_resume_packet.next_required_step_id ===
      (missingSteps[0]?.id ?? null),
    "Resume next required step mismatch.",
  );
  invariant(
    resume.proof_session_resume_packet.next_required_command ===
      (missingSteps[0]?.terminal_command ?? null),
    "Resume next required command mismatch.",
  );
  assertObjectArrayEqual(
    resume.resume_command_sequence,
    expectedCommandSequence(missingSteps[0] ?? null),
    "Resume command sequence",
  );
  invariant(
    JSON.stringify(resume.support_recovery_checklist) ===
      JSON.stringify(EXPECTED_SUPPORT_RECOVERY_CHECKLIST),
    "Support recovery checklist mismatch.",
  );
  invariant(
    resume.completion_handoff_guard?.state ===
      (missingCount === 0 ? "ready_for_dedicated_followup_commands" : "blocked"),
    "Resume completion handoff state mismatch.",
  );
  invariant(
    resume.completion_handoff_guard?.allowed_next_action ===
      allowedCompletionAction(missingCount === 0),
    "Resume completion handoff action mismatch.",
  );
  assertFalseFlags(resume, "Proof session resume packet");

  console.log("Admin public request first-gym proof session resume packet inspection passed");
}

main();
