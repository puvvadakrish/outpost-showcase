#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_HANDOFF_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-evidence-session-handoff.json";
const DEFAULT_LEDGER_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-evidence-session-ledger.json";

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

const STEP_INSPECTORS = {
  customer_observed_session: {
    envName: "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
    script: "scripts/inspect-admin-customer-observed-session.mjs",
  },
  first_gym_go_no_go_bundle: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH",
    script: "scripts/inspect-admin-public-request-first-gym-go-no-go-bundle.mjs",
  },
  first_gym_operator_run: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH",
    script: "scripts/inspect-admin-public-request-first-gym-operator-run.mjs",
  },
  hosted_rehearsal_evidence: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
    script: "scripts/inspect-admin-public-request-hosted-rehearsal-evidence.mjs",
  },
  limited_beta_operator_review: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH",
    script:
      "scripts/inspect-admin-public-request-limited-beta-operator-review-packet.mjs",
  },
  public_launch_controls: {
    envName: "OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH",
    script: "scripts/inspect-admin-public-launch-controls-batch.mjs",
  },
  public_request_self_serve_preflight: {
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH",
    script: "scripts/inspect-admin-public-request-self-serve-launch-preflight.mjs",
  },
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

function buildLedgerRow(row) {
  invariant(STEP_INSPECTORS[row.id], `Unknown session handoff row ${row.id}.`);
  const inspector = STEP_INSPECTORS[row.id];
  const artifactPath = normalizeArtifactPath(
    row.expected_artifact_path,
    `${row.id} expected artifact path`,
  );
  const base = {
    artifact_path: artifactPath.relativePath,
    expected_source_requirement: row.source_requirement,
    id: row.id,
    inspector_env: inspector.envName,
    inspector_script: inspector.script,
    order: row.order,
    proof_recorded_by_ledger: false,
    title: row.title,
  };

  if (!existsSync(artifactPath.resolved)) {
    return {
      ...base,
      artifact_sha256: null,
      state: "missing",
    };
  }

  runInspect(inspector.script, inspector.envName, artifactPath.relativePath, row.title);
  const { sha256 } = readJsonArtifact(artifactPath.resolved, row.title);
  return {
    ...base,
    artifact_sha256: sha256,
    state: "inspectable",
  };
}

function main() {
  const handoffPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH ??
      DEFAULT_HANDOFF_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH",
    { mustExist: true },
  );
  const ledgerPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH ??
      DEFAULT_LEDGER_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH",
    { mustNotExist: true },
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-handoff.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH",
    handoffPath.relativePath,
    "Public request first-gym proof evidence session handoff",
  );
  const { artifact: handoff, sha256: handoffSha256 } = readJsonArtifact(
    handoffPath.resolved,
    "public request first-gym proof evidence session handoff",
  );
  assertFalseFlags(handoff, "Proof evidence session handoff");

  const rows = handoff.session_handoff_rows.map(buildLedgerRow);
  const inspectableCount = rows.filter((row) => row.state === "inspectable").length;
  const missingCount = rows.filter((row) => row.state === "missing").length;
  const nextMissing = rows.find((row) => row.state === "missing") ?? null;
  const allSessionEvidenceInspectable = missingCount === 0;

  const ledger = {
    artifact_kind:
      "admin_public_request_first_gym_proof_evidence_session_ledger",
    status:
      "admin_public_request_first_gym_proof_evidence_session_ledger_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis:
      "admin_public_request_first_gym_proof_evidence_session_handoff",
    public_request_first_gym_proof_evidence_session_handoff_path:
      handoffPath.relativePath,
    public_request_first_gym_proof_evidence_session_handoff_sha256:
      handoffSha256,
    verified_evidence_session_handoff: {
      handoff_row_count: handoff.session_handoff_rows.length,
      missing_evidence_count:
        handoff.proof_evidence_session_handoff.missing_evidence_count,
      path: handoffPath.relativePath,
      ready_for_real_proof_command_run:
        handoff.proof_evidence_session_handoff.ready_for_real_proof_command_run,
      session_handoff_guard_state: handoff.session_handoff_guard.state,
      sha256: handoffSha256,
    },
    proof_evidence_session_ledger: {
      all_session_evidence_inspectable: allSessionEvidenceInspectable,
      customer_observed_completion_recorded: false,
      evidence_recorded: false,
      first_gym_operator_run_recorded: false,
      inspectable_count: inspectableCount,
      limited_beta_review_recorded: false,
      missing_count: missingCount,
      mode: "status_only_reinspect_session_handoff_artifacts",
      next_missing_step_id: nextMissing?.id ?? null,
      public_launch_decision_allowed: false,
    },
    session_evidence_ledger: rows,
    session_evidence_completion: {
      ready_for_first_gym_go_no_go:
        rows.find((row) => row.id === "hosted_rehearsal_evidence")?.state ===
          "inspectable" &&
        rows.find((row) => row.id === "customer_observed_session")?.state ===
          "inspectable",
      ready_for_limited_beta_review:
        rows.find((row) => row.id === "first_gym_operator_run")?.state ===
        "inspectable",
      ready_for_public_launch_controls: false,
    },
    session_evidence_guard: {
      allowed_next_action: allSessionEvidenceInspectable
        ? "Run first-gym go/no-go, first-gym operator run, and limited beta review only through dedicated proof commands; public/live-provider/revenue gates remain separate."
        : "Record the next missing evidence item with its dedicated proof command, then regenerate the session ledger.",
      state: allSessionEvidenceInspectable ? "ready_for_review" : "blocked",
    },
  };

  for (const key of BLOCKED_FLAGS) ledger[key] = false;
  assertNoSecretShapedKeys(
    ledger,
    "public request first-gym proof evidence session ledger",
  );
  mkdirSync(dirname(ledgerPath.resolved), { recursive: true });
  writeFileSync(ledgerPath.resolved, `${JSON.stringify(ledger, null, 2)}\n`, {
    flag: "wx",
  });

  console.log("Admin public request first-gym proof evidence session ledger prepared");
  console.log(`Artifact: ${ledgerPath.relativePath}`);
  console.log(`Inspectable evidence: ${inspectableCount}`);
  console.log(`Missing evidence: ${missingCount}`);
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
