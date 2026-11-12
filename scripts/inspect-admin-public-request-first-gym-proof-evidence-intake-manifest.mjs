#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_MANIFEST_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-evidence-intake-manifest.json";

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

const INTAKE_INSTRUCTIONS = {
  customer_observed_session:
    "Record only after the customer-observed session actually happens with the gym owner or approved staff present.",
  first_gym_go_no_go_bundle:
    "Run only after hosted rehearsal evidence and customer-observed session records inspect clean.",
  first_gym_operator_run:
    "Run only after the first-gym go/no-go bundle inspects clean.",
  hosted_rehearsal_evidence:
    "Record only from the protected Preview on the hosted Neon proof branch; do not use local or spike evidence.",
  limited_beta_operator_review:
    "Run only after the first-gym operator run record inspects clean.",
  public_launch_controls:
    "Keep blocked until limited beta proof has been reviewed and public launch controls are separately approved.",
  public_request_self_serve_preflight:
    "Keep blocked until first-gym run and limited beta review records inspect clean.",
};

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
      invariant(
        JSON.stringify(actualEntry[key]) === JSON.stringify(value),
        `${label} ${index + 1} ${key} mismatch.`,
      );
    }
  });
}

function expectedEvidenceIntakeRows(envelope) {
  return [
    ...(envelope.evidence_summary.missing_evidence ?? []).map((entry) => ({
      ...entry,
      collection_status: "not_recorded",
    })),
    ...(envelope.evidence_summary.inspectable_evidence ?? []).map((entry) => ({
      ...entry,
      collection_status: "inspectable_from_dedicated_command",
    })),
  ].sort((left, right) => left.order - right.order).map((entry) => ({
    collection_status: entry.collection_status,
    expected_artifact_path: entry.artifact_path,
    id: entry.id,
    operator_instruction:
      INTAKE_INSTRUCTIONS[entry.id] ??
      "Collect only from the current protected Preview and hosted Neon proof branch.",
    order: entry.order,
    proof_recorded: false,
    title: entry.title,
  }));
}

function expectedCommandSequence(envelope) {
  const ready =
    envelope.proof_command_execution_envelope.ready_for_real_proof_command_run ===
    true;
  if (!ready) {
    return [
      ...envelope.operator_command_sequence,
      {
        command:
          "npm run admin:public-request-first-gym:proof-evidence-intake-manifest",
        id: "regenerate_evidence_intake_manifest_after_envelope",
        order: envelope.operator_command_sequence.length + 1,
        title: "Regenerate proof evidence intake manifest",
      },
    ];
  }
  return envelope.operator_command_sequence;
}

function main() {
  const manifestPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH ??
      DEFAULT_MANIFEST_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH",
  );
  const { artifact: manifest } = readJsonArtifact(
    manifestPath.resolved,
    "public request first-gym proof evidence intake manifest",
  );
  invariant(
    manifest.artifact_kind ===
      "admin_public_request_first_gym_proof_evidence_intake_manifest",
    "Proof evidence intake manifest kind mismatch.",
  );
  invariant(
    manifest.status ===
      "admin_public_request_first_gym_proof_evidence_intake_manifest_prepared",
    "Proof evidence intake manifest status mismatch.",
  );
  invariant(
    manifest.evidence_basis ===
      "admin_public_request_first_gym_proof_command_execution_envelope",
    "Proof evidence intake manifest basis mismatch.",
  );

  const envelopePath = normalizeArtifactPath(
    manifest.public_request_first_gym_proof_command_execution_envelope_path,
    "proof-command execution envelope path",
  );
  const { artifact: envelope, sha256: envelopeSha256 } = readJsonArtifact(
    envelopePath.resolved,
    "public request first-gym proof-command execution envelope",
  );
  invariant(
    envelopeSha256 ===
      manifest.public_request_first_gym_proof_command_execution_envelope_sha256,
    "Proof-command execution envelope SHA256 does not match.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-command-execution-envelope.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH",
    envelopePath.relativePath,
    "Public request first-gym proof-command execution envelope",
  );

  const ready =
    envelope.proof_command_execution_envelope.ready_for_real_proof_command_run ===
    true;
  const missing =
    envelope.proof_command_execution_envelope.still_missing_evidence_count;
  assertObjectKeys(
    manifest.verified_execution_envelope,
    [
      "execution_envelope_guard_state",
      "missing_evidence_count",
      "path",
      "ready_for_real_proof_command_run",
      "sha256",
      "template_count",
    ],
    "Verified execution envelope",
  );
  invariant(
    manifest.verified_execution_envelope.path === envelopePath.relativePath,
    "Verified execution envelope path mismatch.",
  );
  invariant(
    manifest.verified_execution_envelope.sha256 === envelopeSha256,
    "Verified execution envelope SHA256 mismatch.",
  );
  invariant(
    manifest.verified_execution_envelope.execution_envelope_guard_state ===
      envelope.execution_envelope_guard.state,
    "Verified execution envelope guard state mismatch.",
  );
  invariant(
    manifest.verified_execution_envelope.ready_for_real_proof_command_run ===
      ready,
    "Verified execution envelope readiness mismatch.",
  );
  invariant(
    manifest.verified_execution_envelope.missing_evidence_count === missing,
    "Verified execution envelope missing evidence mismatch.",
  );
  invariant(
    manifest.verified_execution_envelope.template_count ===
      envelope.operator_command_templates.length,
    "Verified execution envelope template count mismatch.",
  );

  invariant(
    manifest.proof_evidence_intake_manifest?.mode ===
      "operator_evidence_intake_manifest_only",
    "Proof evidence intake manifest must remain manifest-only.",
  );
  invariant(
    manifest.proof_evidence_intake_manifest.evidence_recorded === false,
    "Proof evidence intake manifest cannot record evidence.",
  );
  invariant(
    manifest.proof_evidence_intake_manifest.customer_observed_completion_recorded ===
      false,
    "Proof evidence intake manifest cannot record customer-observed completion.",
  );
  invariant(
    manifest.proof_evidence_intake_manifest.first_gym_operator_run_recorded ===
      false,
    "Proof evidence intake manifest cannot record first-gym operator run.",
  );
  invariant(
    manifest.proof_evidence_intake_manifest.limited_beta_review_recorded === false,
    "Proof evidence intake manifest cannot record limited beta review.",
  );
  invariant(
    manifest.proof_evidence_intake_manifest.public_launch_decision_allowed ===
      false,
    "Proof evidence intake manifest cannot allow public launch decision.",
  );
  invariant(
    manifest.proof_evidence_intake_manifest.ready_for_real_proof_command_run ===
      ready,
    "Proof evidence intake manifest readiness mismatch.",
  );
  invariant(
    manifest.proof_evidence_intake_manifest.missing_evidence_count === missing,
    "Proof evidence intake manifest missing evidence mismatch.",
  );
  assertObjectArrayEqual(
    manifest.evidence_intake_rows,
    expectedEvidenceIntakeRows(envelope),
    "Evidence intake rows",
  );
  assertObjectArrayEqual(
    manifest.operator_input_requirements,
    envelope.operator_input_requirements,
    "Operator input requirements",
  );
  assertObjectArrayEqual(
    manifest.operator_command_templates,
    envelope.operator_command_templates,
    "Operator command templates",
  );
  assertObjectArrayEqual(
    manifest.operator_command_sequence,
    expectedCommandSequence(envelope),
    "Operator command sequence",
  );
  invariant(
    manifest.evidence_intake_guard?.state ===
      (ready ? "ready_for_real_proof_command_run" : "blocked"),
    "Evidence intake guard state mismatch.",
  );
  invariant(
    manifest.evidence_intake_guard?.allowed_next_action ===
      (ready
        ? "Use the execution-envelope command templates with real hosted/customer evidence; this manifest still records no proof."
        : "Collect the next missing evidence item, regenerate progress, resume, diagnostics, follow-up preflight, launch checkpoint, execution envelope, and this intake manifest."),
    "Evidence intake guard action mismatch.",
  );
  assertFalseFlags(manifest, "Proof evidence intake manifest");

  console.log(
    "Admin public request first-gym proof evidence intake manifest inspection passed",
  );
}

main();
