#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_ENVELOPE_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-command-execution-envelope.json";
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

function evidenceIntakeRows(envelope) {
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

function manifestCommandSequence(envelope) {
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
  const envelopePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH ??
      DEFAULT_ENVELOPE_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH",
    { mustExist: true },
  );
  const manifestPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH ??
      DEFAULT_MANIFEST_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH",
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-command-execution-envelope.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH",
    envelopePath.relativePath,
    "Public request first-gym proof-command execution envelope",
  );
  const { artifact: envelope, sha256: envelopeSha256 } = readJsonArtifact(
    envelopePath.resolved,
    "public request first-gym proof-command execution envelope",
  );
  assertFalseFlags(envelope, "Proof-command execution envelope");

  const ready =
    envelope.proof_command_execution_envelope.ready_for_real_proof_command_run ===
    true;
  const missing =
    envelope.proof_command_execution_envelope.still_missing_evidence_count;
  const manifest = {
    artifact_kind:
      "admin_public_request_first_gym_proof_evidence_intake_manifest",
    status:
      "admin_public_request_first_gym_proof_evidence_intake_manifest_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis:
      "admin_public_request_first_gym_proof_command_execution_envelope",
    public_request_first_gym_proof_command_execution_envelope_path:
      envelopePath.relativePath,
    public_request_first_gym_proof_command_execution_envelope_sha256:
      envelopeSha256,
    verified_execution_envelope: {
      execution_envelope_guard_state: envelope.execution_envelope_guard.state,
      missing_evidence_count: missing,
      path: envelopePath.relativePath,
      ready_for_real_proof_command_run: ready,
      sha256: envelopeSha256,
      template_count: envelope.operator_command_templates.length,
    },
    proof_evidence_intake_manifest: {
      customer_observed_completion_recorded: false,
      evidence_recorded: false,
      first_gym_operator_run_recorded: false,
      limited_beta_review_recorded: false,
      missing_evidence_count: missing,
      mode: "operator_evidence_intake_manifest_only",
      public_launch_decision_allowed: false,
      ready_for_real_proof_command_run: ready,
    },
    evidence_intake_rows: evidenceIntakeRows(envelope),
    operator_input_requirements: envelope.operator_input_requirements,
    operator_command_templates: envelope.operator_command_templates,
    operator_command_sequence: manifestCommandSequence(envelope),
    evidence_intake_guard: {
      allowed_next_action: ready
        ? "Use the execution-envelope command templates with real hosted/customer evidence; this manifest still records no proof."
        : "Collect the next missing evidence item, regenerate progress, resume, diagnostics, follow-up preflight, launch checkpoint, execution envelope, and this intake manifest.",
      state: ready ? "ready_for_real_proof_command_run" : "blocked",
    },
  };

  for (const key of BLOCKED_FLAGS) manifest[key] = false;
  assertNoSecretShapedKeys(
    manifest,
    "public request first-gym proof evidence intake manifest",
  );
  mkdirSync(dirname(manifestPath.resolved), { recursive: true });
  writeFileSync(manifestPath.resolved, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("Admin public request first-gym proof evidence intake manifest prepared");
  console.log(`Artifact: ${manifestPath.relativePath}`);
  console.log(`State: ${manifest.evidence_intake_guard.state}`);
  console.log(`Missing evidence: ${missing}`);
}

main();
