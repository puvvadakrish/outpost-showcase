#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_INTAKE_MANIFEST_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-evidence-intake-manifest.json";
const DEFAULT_HANDOFF_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-evidence-session-handoff.json";

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

const SOURCE_REQUIREMENTS = {
  customer_observed_session:
    "customer_observed_session_only",
  first_gym_go_no_go_bundle:
    "after_hosted_and_customer_records_inspect",
  first_gym_operator_run:
    "after_go_no_go_bundle_inspects",
  hosted_rehearsal_evidence:
    "protected_preview_hosted_neon_branch_only",
  limited_beta_operator_review:
    "after_first_gym_run_inspects",
  public_launch_controls:
    "separate_public_launch_controls_track",
  public_request_self_serve_preflight:
    "after_limited_beta_review_only",
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

function sessionHandoffRows(intakeManifest) {
  return intakeManifest.evidence_intake_rows.map((entry) => ({
    expected_artifact_path: entry.expected_artifact_path,
    handoff_status: "pending_real_session",
    id: entry.id,
    operator_instruction: entry.operator_instruction,
    order: entry.order,
    proof_recorded: false,
    source_requirement: SOURCE_REQUIREMENTS[entry.id] ?? "current_manifest_row_only",
    title: entry.title,
  }));
}

function handoffCommandSequence(intakeManifest) {
  const ready =
    intakeManifest.proof_evidence_intake_manifest.ready_for_real_proof_command_run ===
    true;
  if (!ready) {
    return [
      ...intakeManifest.operator_command_sequence,
      {
        command:
          "npm run admin:public-request-first-gym:proof-evidence-session-handoff",
        id: "regenerate_evidence_session_handoff_after_manifest",
        order: intakeManifest.operator_command_sequence.length + 1,
        title: "Regenerate proof evidence session handoff",
      },
    ];
  }
  return intakeManifest.operator_command_sequence;
}

function main() {
  const intakeManifestPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH ??
      DEFAULT_INTAKE_MANIFEST_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH",
    { mustExist: true },
  );
  const handoffPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH ??
      DEFAULT_HANDOFF_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH",
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-evidence-intake-manifest.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH",
    intakeManifestPath.relativePath,
    "Public request first-gym proof evidence intake manifest",
  );
  const { artifact: intakeManifest, sha256: intakeManifestSha256 } = readJsonArtifact(
    intakeManifestPath.resolved,
    "public request first-gym proof evidence intake manifest",
  );
  assertFalseFlags(intakeManifest, "Proof evidence intake manifest");

  const ready =
    intakeManifest.proof_evidence_intake_manifest.ready_for_real_proof_command_run ===
    true;
  const missing =
    intakeManifest.proof_evidence_intake_manifest.missing_evidence_count;
  const handoff = {
    artifact_kind:
      "admin_public_request_first_gym_proof_evidence_session_handoff",
    status:
      "admin_public_request_first_gym_proof_evidence_session_handoff_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis:
      "admin_public_request_first_gym_proof_evidence_intake_manifest",
    public_request_first_gym_proof_evidence_intake_manifest_path:
      intakeManifestPath.relativePath,
    public_request_first_gym_proof_evidence_intake_manifest_sha256:
      intakeManifestSha256,
    verified_evidence_intake_manifest: {
      evidence_intake_guard_state: intakeManifest.evidence_intake_guard.state,
      intake_row_count: intakeManifest.evidence_intake_rows.length,
      missing_evidence_count: missing,
      path: intakeManifestPath.relativePath,
      ready_for_real_proof_command_run: ready,
      sha256: intakeManifestSha256,
    },
    proof_evidence_session_handoff: {
      customer_observed_completion_recorded: false,
      evidence_recorded: false,
      first_gym_operator_run_recorded: false,
      limited_beta_review_recorded: false,
      missing_evidence_count: missing,
      mode: "operator_evidence_session_handoff_only",
      public_launch_decision_allowed: false,
      ready_for_real_proof_command_run: ready,
    },
    session_handoff_rows: sessionHandoffRows(intakeManifest),
    operator_input_requirements: intakeManifest.operator_input_requirements,
    operator_command_templates: intakeManifest.operator_command_templates,
    operator_command_sequence: handoffCommandSequence(intakeManifest),
    session_handoff_guard: {
      allowed_next_action: ready
        ? "Use the execution-envelope command templates with real hosted/customer evidence; this handoff still records no proof."
        : "Run the protected Preview/customer-observed evidence session, record the next missing evidence artifact, regenerate progress, resume, diagnostics, follow-up preflight, launch checkpoint, execution envelope, intake manifest, and this session handoff.",
      state: ready ? "ready_for_real_proof_command_run" : "blocked",
    },
  };

  for (const key of BLOCKED_FLAGS) handoff[key] = false;
  assertNoSecretShapedKeys(
    handoff,
    "public request first-gym proof evidence session handoff",
  );
  mkdirSync(dirname(handoffPath.resolved), { recursive: true });
  writeFileSync(handoffPath.resolved, `${JSON.stringify(handoff, null, 2)}\n`);
  console.log("Admin public request first-gym proof evidence session handoff prepared");
  console.log(`Artifact: ${handoffPath.relativePath}`);
  console.log(`State: ${handoff.session_handoff_guard.state}`);
  console.log(`Missing evidence: ${missing}`);
}

main();
