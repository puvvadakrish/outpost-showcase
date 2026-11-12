#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_GUARD_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-real-evidence-execution-guard.json";

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

const CONTROL_FALSE_FLAGS = [
  "real_evidence_command_executed",
  "hosted_rehearsal_proof_recorded",
  "customer_observed_completion_recorded",
  "hosted_customer_session_digest_proof_claimed",
  "first_gym_go_no_go_approval_recorded",
  "first_gym_operator_run_recorded",
  "limited_beta_review_recorded",
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

function normalizeOutputPath(value, label) {
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

function nextLane(packet) {
  const nextStepId = packet.real_evidence_execution_packet?.next_real_step_id;
  const lanes = packet.execution_run_lanes ?? [];
  if (nextStepId === "record_hosted_rehearsal_evidence") {
    return lanes.find((lane) => lane.id === "hosted_rehearsal_evidence_lane");
  }
  if (nextStepId === "record_customer_observed_session_and_hosted_digest") {
    return lanes.find((lane) => lane.id === "customer_session_and_digest_lane");
  }
  return null;
}

function expectedInputCheckShape(lane, actualChecks) {
  return (lane.required_inputs ?? []).map((requirement) => {
    const yesMatch = requirement.match(/^([A-Z0-9_]+)=yes$/u);
    if (yesMatch) {
      const envName = yesMatch[1];
      const value = String(process.env[envName] ?? "").trim().toLowerCase();
      return {
        env_name: envName,
        expected: "yes",
        requirement,
        state: value === "yes" ? "confirmed_yes" : "missing_or_not_yes",
        value_stored: false,
      };
    }

    const envMatch = requirement.match(/^([A-Z0-9_]+)\b/u);
    if (envMatch) {
      const envName = envMatch[1];
      const value = String(process.env[envName] ?? "").trim();
      assertNoSecretShapedValue(value, envName);
      return {
        env_name: envName,
        expected: "present",
        requirement,
        state: value ? "present_not_stored" : "missing",
        value_stored: false,
      };
    }

    return {
      env_name: null,
      expected: "manual_confirmation",
      requirement,
      state: "manual_instruction",
      value_stored: false,
    };
  });
}

function expectedOutputPolicy(packet, actualPolicy) {
  const nextStepId = packet.real_evidence_execution_packet?.next_real_step_id;
  const config =
    nextStepId === "record_hosted_rehearsal_evidence"
      ? {
          defaultPath:
            "artifacts/admin-launch-readiness/admin-public-request-hosted-rehearsal-evidence.json",
          envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
        }
      : nextStepId === "record_customer_observed_session_and_hosted_digest"
        ? {
            defaultPath:
              "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json",
            envName: "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
          }
        : null;
  invariant(config, "Execution guard next proof output path is unknown.");
  const path = normalizeOutputPath(
    process.env[config.envName] ?? config.defaultPath,
    config.envName,
  );
  return {
    id: "next_command_output_path",
    output_path_env_name: config.envName,
    output_path_state: existsSync(path.resolved)
      ? "blocked_existing_artifact"
      : "create_only_path_available",
    path: path.relativePath,
    path_stored: true,
    proof_writer_must_create_only: true,
  };
}

function expectedBlockers(checks, policy) {
  const rows = [];
  for (const check of checks) {
    if (check.state === "missing_or_not_yes" || check.state === "missing") {
      rows.push({
        id: `missing_input:${check.env_name}`,
        requirement: check.requirement,
        state: "blocked",
      });
    }
  }
  if (policy.output_path_state === "blocked_existing_artifact") {
    rows.push({
      id: "existing_output_artifact",
      requirement:
        `Choose a new ${policy.output_path_env_name} before running the next proof writer.`,
      state: "blocked",
    });
  }
  return rows;
}

function expectedStopConditions() {
  return [
    "Stop if the execution packet inspector fails.",
    "Stop if any required real observation input is missing or not explicitly yes.",
    "Stop if the next proof writer would overwrite an existing evidence artifact.",
    "Stop if the real protected Preview hosted rehearsal has not just been observed.",
    "Stop if the operator cannot run the command manually and immediately inspect the new proof artifact.",
    "Stop if invite delivery, notifications, live providers, billing, POS, access-control, or member-ledger writes are requested.",
  ];
}

function assertInputStates(checks) {
  for (const check of checks) {
    if (check.expected === "yes") {
      invariant(
        check.state === "confirmed_yes" || check.state === "missing_or_not_yes",
        `Input check ${check.env_name} state invalid.`,
      );
    } else if (check.expected === "present") {
      invariant(
        check.state === "present_not_stored" || check.state === "missing",
        `Input check ${check.env_name} state invalid.`,
      );
    } else {
      invariant(
        check.state === "manual_instruction",
        `Input check ${check.requirement} state invalid.`,
      );
    }
    invariant(check.value_stored === false, `Input check ${check.env_name} stores a value.`);
  }
}

function main() {
  const guardPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH ??
      DEFAULT_GUARD_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH",
  );
  const { artifact: guard } = readJsonArtifact(
    guardPath.resolved,
    "public request first-gym real evidence execution guard",
  );

  invariant(
    guard.artifact_kind ===
      "admin_public_request_first_gym_real_evidence_execution_guard",
    "Real evidence execution guard kind mismatch.",
  );
  invariant(
    guard.status ===
      "admin_public_request_first_gym_real_evidence_execution_guard_prepared",
    "Real evidence execution guard status mismatch.",
  );
  invariant(
    guard.evidence_basis ===
      "admin_public_request_first_gym_real_evidence_execution_packet",
    "Real evidence execution guard basis mismatch.",
  );

  const packetPath = normalizeArtifactPath(
    guard.public_request_first_gym_real_evidence_execution_packet_path,
    "real evidence execution packet path",
  );
  const { artifact: packet, sha256: packetSha256 } = readJsonArtifact(
    packetPath.resolved,
    "public request first-gym real evidence execution packet",
  );
  invariant(
    packetSha256 ===
      guard.public_request_first_gym_real_evidence_execution_packet_sha256,
    "Real evidence execution packet SHA256 does not match.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-real-evidence-execution-packet.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH",
    packetPath.relativePath,
    "Public request first-gym real evidence execution packet",
  );

  const packetControl = packet.real_evidence_execution_packet;
  invariant(
    guard.verified_real_evidence_execution_packet?.path === packetPath.relativePath,
    "Verified execution-packet path mismatch.",
  );
  invariant(
    guard.verified_real_evidence_execution_packet?.sha256 === packetSha256,
    "Verified execution-packet SHA mismatch.",
  );
  invariant(
    guard.verified_real_evidence_execution_packet?.readiness_state ===
      packetControl.readiness_state,
    "Verified execution-packet state mismatch.",
  );
  invariant(
    guard.verified_real_evidence_execution_packet?.next_real_command ===
      packetControl.next_real_command,
    "Verified execution-packet command mismatch.",
  );
  invariant(
    guard.verified_real_evidence_execution_packet?.next_real_step_id ===
      packetControl.next_real_step_id,
    "Verified execution-packet step mismatch.",
  );

  const lane = nextLane(packet);
  invariant(lane, "Execution guard next run lane missing.");
  invariant(
    JSON.stringify(guard.next_command_lane) ===
      JSON.stringify({
        command: lane.command,
        id: lane.id,
        source_attempt_step_id: lane.source_attempt_step_id,
        title: lane.title,
      }),
    "Real evidence execution guard lane mismatch.",
  );

  const checks = guard.required_input_checks ?? [];
  invariant(
    JSON.stringify(checks) ===
      JSON.stringify(expectedInputCheckShape(lane, checks)),
    "Real evidence execution guard input checks mismatch.",
  );
  assertInputStates(checks);

  const policy = guard.evidence_output_policy;
  invariant(
    policy.output_path_state === "create_only_path_available" ||
      policy.output_path_state === "blocked_existing_artifact",
    "Real evidence execution guard output policy state invalid.",
  );
  invariant(
    JSON.stringify(policy) === JSON.stringify(expectedOutputPolicy(packet, policy)),
    "Real evidence execution guard output policy mismatch.",
  );

  const expectedBlocked = expectedBlockers(checks, policy);
  invariant(
    JSON.stringify(guard.execution_blockers) === JSON.stringify(expectedBlocked),
    "Real evidence execution guard blockers mismatch.",
  );

  const expectedGuardState =
    expectedBlocked.length === 0
      ? "ready_to_run_next_real_command"
      : "blocked_until_real_inputs_or_output_path_ready";
  const control = guard.real_evidence_execution_guard;
  invariant(
    control?.mode === "operator_pre_run_guard_only",
    "Real evidence execution guard must remain pre-run only.",
  );
  invariant(
    control.guard_state === expectedGuardState,
    "Real evidence execution guard state mismatch.",
  );
  invariant(
    control.readiness_state === packetControl.readiness_state,
    "Real evidence execution guard readiness mismatch.",
  );
  invariant(
    control.next_real_command === packetControl.next_real_command,
    "Real evidence execution guard next command mismatch.",
  );
  invariant(
    control.next_real_step_id === packetControl.next_real_step_id,
    "Real evidence execution guard next step mismatch.",
  );
  for (const key of CONTROL_FALSE_FLAGS) {
    invariant(control[key] === false, `Real evidence execution guard ${key} blocked.`);
  }

  invariant(
    guard.manual_run_instruction?.command === packetControl.next_real_command,
    "Real evidence execution guard manual command mismatch.",
  );
  invariant(
    guard.manual_run_instruction?.requirement ===
      "Run this manually only when guard_state is ready_to_run_next_real_command and the real observations were just confirmed.",
    "Real evidence execution guard manual requirement mismatch.",
  );
  invariant(
    JSON.stringify(guard.post_run_requirements) ===
      JSON.stringify([
        "Run the dedicated proof inspector included in the next real command.",
        "Regenerate the full evidence status/control chain after the new proof artifact inspects.",
        "Rerun this guard before any later real evidence command.",
      ]),
    "Real evidence execution guard post-run requirements mismatch.",
  );
  invariant(
    JSON.stringify(guard.stop_conditions) === JSON.stringify(expectedStopConditions()),
    "Real evidence execution guard stop conditions mismatch.",
  );
  invariant(
    JSON.stringify(guard.blocked_gates) === JSON.stringify(packet.blocked_gates),
    "Real evidence execution guard blocked gates mismatch.",
  );
  assertFalseFlags(packet, "Real evidence execution packet");
  assertFalseFlags(guard, "Real evidence execution guard");

  console.log(
    "Admin public request first-gym real evidence execution guard inspection passed",
  );
}

main();
