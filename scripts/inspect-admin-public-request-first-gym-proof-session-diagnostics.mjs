#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_DIAGNOSTICS_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-session-diagnostics.json";

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

const EXPECTED_CHAIN = [
  {
    artifact_kind: "admin_public_request_first_gym_proof_session_runbook",
    inspector:
      "npm run admin:public-request-first-gym:proof-session-runbook:inspect",
    order: 1,
  },
  {
    artifact_kind: "admin_public_request_first_gym_proof_session_execution_pack",
    inspector:
      "npm run admin:public-request-first-gym:proof-session-execution-pack:inspect",
    order: 2,
  },
  {
    artifact_kind: "admin_public_request_first_gym_proof_session_progress_batch",
    inspector:
      "npm run admin:public-request-first-gym:proof-session-progress:inspect",
    order: 3,
  },
  {
    artifact_kind: "admin_public_request_first_gym_proof_session_resume_packet",
    inspector:
      "npm run admin:public-request-first-gym:proof-session-resume:inspect",
    order: 4,
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

function assertObjectKeys(object, keys, label) {
  invariant(object && typeof object === "object" && !Array.isArray(object), `${label} required.`);
  invariant(
    JSON.stringify(Object.keys(object).sort()) === JSON.stringify([...keys].sort()),
    `${label} keys mismatch.`,
  );
}

function expectedOperatorNextActions(resumeSummary) {
  return [
    {
      command:
        "npm run admin:public-request-first-gym:proof-session-diagnostics:inspect",
      id: "inspect_current_diagnostics",
      order: 1,
      title: "Inspect proof-session diagnostics",
    },
    ...(resumeSummary.next_required_command
      ? [
          {
            command: resumeSummary.next_required_command,
            id: "run_next_missing_dedicated_proof_command",
            order: 2,
            title: "Run next missing dedicated proof command",
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
            id: "regenerate_resume_after_progress",
            order: 4,
            title: "Regenerate proof-session resume",
          },
          {
            command:
              "npm run admin:public-request-first-gym:proof-session-diagnostics",
            id: "regenerate_diagnostics_after_resume",
            order: 5,
            title: "Regenerate diagnostics",
          },
        ]
      : [
          {
            command:
              "Run dedicated first-gym go/no-go, operator-run, and limited-beta review commands; diagnostics do not record those claims.",
            id: "move_to_dedicated_followup_commands",
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
    assertObjectKeys(actualEntry, Object.keys(expectedEntry), `${label} ${index + 1}`);
    for (const [key, value] of Object.entries(expectedEntry)) {
      invariant(
        actualEntry[key] === value,
        `${label} ${index + 1} ${key} mismatch.`,
      );
    }
  });
}

function main() {
  const diagnosticsPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH ??
      DEFAULT_DIAGNOSTICS_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH",
  );
  const { artifact: diagnostics } = readJsonArtifact(
    diagnosticsPath.resolved,
    "public request first-gym proof session diagnostics",
  );
  invariant(
    diagnostics.artifact_kind ===
      "admin_public_request_first_gym_proof_session_diagnostics",
    "Proof session diagnostics kind mismatch.",
  );
  invariant(
    diagnostics.status ===
      "admin_public_request_first_gym_proof_session_diagnostics_prepared",
    "Proof session diagnostics status mismatch.",
  );
  invariant(
    diagnostics.evidence_basis ===
      "admin_public_request_first_gym_proof_session_resume_packet",
    "Proof session diagnostics basis mismatch.",
  );

  const resumePath = normalizeArtifactPath(
    diagnostics.public_request_first_gym_proof_session_resume_packet_path,
    "proof session resume path",
  );
  const { artifact: resume, sha256: resumeSha256 } = readJsonArtifact(
    resumePath.resolved,
    "public request first-gym proof session resume",
  );
  invariant(
    resumeSha256 ===
      diagnostics.public_request_first_gym_proof_session_resume_packet_sha256,
    "Proof session resume SHA256 does not match.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-session-resume-packet.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH",
    resumePath.relativePath,
    "Public request first-gym proof session resume",
  );

  const progressPath = normalizeArtifactPath(
    diagnostics.public_request_first_gym_proof_session_progress_batch_path,
    "proof session progress path",
  );
  const { artifact: progress, sha256: progressSha256 } = readJsonArtifact(
    progressPath.resolved,
    "public request first-gym proof session progress",
  );
  invariant(
    progressSha256 ===
      diagnostics.public_request_first_gym_proof_session_progress_batch_sha256,
    "Proof session progress SHA256 does not match.",
  );
  invariant(
    progressPath.relativePath ===
      resume.public_request_first_gym_proof_session_progress_batch_path,
    "Diagnostics progress path must match resume.",
  );

  const packPath = normalizeArtifactPath(
    diagnostics.public_request_first_gym_proof_session_execution_pack_path,
    "proof session execution pack path",
  );
  const { artifact: pack, sha256: packSha256 } = readJsonArtifact(
    packPath.resolved,
    "public request first-gym proof session execution pack",
  );
  invariant(
    packSha256 ===
      diagnostics.public_request_first_gym_proof_session_execution_pack_sha256,
    "Proof session execution pack SHA256 does not match.",
  );
  invariant(
    packPath.relativePath ===
      progress.public_request_first_gym_proof_session_execution_pack_path,
    "Diagnostics execution pack path must match progress.",
  );

  const runbookPath = normalizeArtifactPath(
    diagnostics.public_request_first_gym_proof_session_runbook_path,
    "proof session runbook path",
  );
  const { sha256: runbookSha256 } = readJsonArtifact(
    runbookPath.resolved,
    "public request first-gym proof session runbook",
  );
  invariant(
    runbookSha256 ===
      diagnostics.public_request_first_gym_proof_session_runbook_sha256,
    "Proof session runbook SHA256 does not match.",
  );
  invariant(
    runbookPath.relativePath === pack.public_request_first_gym_proof_session_runbook_path,
    "Diagnostics runbook path must match execution pack.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-session-runbook.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH",
    runbookPath.relativePath,
    "Public request first-gym proof session runbook",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-session-execution-pack.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH",
    packPath.relativePath,
    "Public request first-gym proof session execution pack",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-session-progress-batch.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH",
    progressPath.relativePath,
    "Public request first-gym proof session progress",
  );

  const resumeSummary = resume.proof_session_resume_packet;
  invariant(
    diagnostics.proof_session_diagnostics?.mode ===
      "resume_chain_diagnostics_only",
    "Proof session diagnostics must remain diagnostics-only.",
  );
  invariant(
    diagnostics.proof_session_diagnostics.customer_observed_completion_recorded ===
      false,
    "Diagnostics cannot record customer-observed completion.",
  );
  invariant(
    diagnostics.proof_session_diagnostics.first_gym_operator_run_recorded ===
      false,
    "Diagnostics cannot record first-gym operator run.",
  );
  invariant(
    diagnostics.proof_session_diagnostics.limited_beta_review_recorded === false,
    "Diagnostics cannot record limited beta review.",
  );
  invariant(
    diagnostics.proof_session_diagnostics.public_launch_decision_allowed === false,
    "Diagnostics cannot allow public launch decision.",
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
      diagnostics.proof_session_diagnostics[key] === resumeSummary[key],
      `Diagnostics ${key} mismatch.`,
    );
  }
  invariant(
    diagnostics.proof_session_diagnostics.verified_parent_inspector_count === 4,
    "Diagnostics parent inspector count mismatch.",
  );

  assertObjectArrayEqual(
    diagnostics.verified_chain,
    EXPECTED_CHAIN.map((entry, index) => ({
      ...entry,
      artifact_path: [
        runbookPath.relativePath,
        packPath.relativePath,
        progressPath.relativePath,
        resumePath.relativePath,
      ][index],
      artifact_sha256: [
        runbookSha256,
        packSha256,
        progressSha256,
        resumeSha256,
      ][index],
    })),
    "Verified chain",
  );
  assertObjectArrayEqual(
    diagnostics.operator_next_actions,
    expectedOperatorNextActions(resumeSummary),
    "Operator next actions",
  );
  assertObjectKeys(
    diagnostics.evidence_summary,
    ["inspectable_evidence", "missing_evidence"],
    "Evidence summary",
  );
  assertObjectArrayEqual(
    diagnostics.evidence_summary?.missing_evidence,
    resume.evidence_inventory
      .filter((item) => item.state === "missing")
      .map((item) => ({
        artifact_path: item.artifact_path,
        id: item.id,
        order: item.order,
        title: item.title,
      })),
    "Missing evidence summary",
  );
  assertObjectArrayEqual(
    diagnostics.evidence_summary?.inspectable_evidence,
    resume.evidence_inventory
      .filter((item) => item.state === "inspectable")
      .map((item) => ({
        artifact_path: item.artifact_path,
        artifact_sha256: item.artifact_sha256,
        id: item.id,
        order: item.order,
        title: item.title,
      })),
    "Inspectable evidence summary",
  );
  invariant(
    diagnostics.diagnostic_guard?.state ===
      (resumeSummary.next_required_command
        ? "blocked"
        : "ready_for_dedicated_followup_commands"),
    "Diagnostic guard state mismatch.",
  );
  invariant(
    diagnostics.diagnostic_guard?.allowed_next_action ===
      (resumeSummary.next_required_command
        ? "Run the next missing dedicated proof command with owner/operator context, then regenerate progress, resume, and diagnostics."
        : "Use dedicated follow-up proof commands; diagnostics only confirms the resume chain is complete."),
    "Diagnostic guard action mismatch.",
  );
  assertFalseFlags(diagnostics, "Proof session diagnostics");

  console.log("Admin public request first-gym proof session diagnostics inspection passed");
}

main();
