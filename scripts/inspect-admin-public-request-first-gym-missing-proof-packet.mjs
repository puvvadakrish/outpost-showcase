#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-missing-proof-packet.json";

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
  if (options.mustExist !== false) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
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

function assertFalse(object, key, message) {
  invariant(object?.[key] === false, message);
}

function main() {
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH ??
      DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH",
  );
  const { artifact: packet } = readJsonArtifact(
    packetPath.resolved,
    "public request first-gym missing proof packet",
  );
  invariant(
    packet.artifact_kind === "admin_public_request_first_gym_missing_proof_packet",
    "Missing proof packet kind mismatch.",
  );
  invariant(
    packet.status === "admin_public_request_first_gym_missing_proof_packet_prepared",
    "Missing proof packet status mismatch.",
  );
  invariant(
    packet.evidence_basis === "admin_public_request_first_gym_execution_ledger",
    "Missing proof packet basis mismatch.",
  );

  const ledgerPath = normalizeArtifactPath(
    packet.public_request_first_gym_execution_ledger_path,
    "execution ledger path",
  );
  const { artifact: ledger, sha256: ledgerSha256 } = readJsonArtifact(
    ledgerPath.resolved,
    "public request first-gym execution ledger",
  );
  invariant(
    ledgerSha256 === packet.public_request_first_gym_execution_ledger_sha256,
    "Execution ledger SHA256 does not match parent artifact.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-execution-ledger.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH",
    ledgerPath.relativePath,
    "Public request first-gym execution ledger",
  );

  const missingSteps = (ledger.steps ?? []).filter((step) => step.state === "missing");
  const inspectableSteps = (ledger.steps ?? []).filter(
    (step) => step.state === "inspectable",
  );
  const commandSequence = packet.missing_command_sequence ?? [];
  invariant(
    packet.missing_proof_packet?.mode === "terminal_command_packet_only",
    "Missing proof packet must remain terminal-only.",
  );
  invariant(
    packet.missing_proof_packet.missing_count === missingSteps.length,
    "Missing count mismatch.",
  );
  invariant(
    packet.missing_proof_packet.inspectable_count === inspectableSteps.length,
    "Inspectable count mismatch.",
  );
  invariant(
    packet.missing_proof_packet.all_required_artifacts_inspectable ===
      (missingSteps.length === 0),
    "All-required-artifacts flag mismatch.",
  );
  invariant(commandSequence.length === missingSteps.length, "Command count mismatch.");
  missingSteps.forEach((step, index) => {
    const command = commandSequence[index];
    invariant(command.id === step.id, `Missing command ${index + 1} id mismatch.`);
    invariant(
      command.artifact_path === step.artifact_path,
      `${step.id} artifact path mismatch.`,
    );
    invariant(command.command === step.command, `${step.id} command mismatch.`);
    invariant(command.order === index + 1, `${step.id} order mismatch.`);
  });
  invariant(
    packet.missing_proof_packet.next_required_step_id ===
      (missingSteps[0]?.id ?? null),
    "Next required step mismatch.",
  );
  invariant(
    packet.missing_proof_packet.first_gym_proof_recorded === false,
    "Missing proof packet cannot record first-gym proof.",
  );
  invariant(
    packet.missing_proof_packet.ready_for_limited_beta_operator_review === false,
    "Missing proof packet cannot mark limited beta ready.",
  );

  for (const key of [
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
  ]) {
    assertFalse(packet, key, `${key} blocked.`);
  }

  console.log("Admin public request first-gym missing proof packet inspection passed");
}

main();
