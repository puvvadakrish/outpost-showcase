#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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

function assertFalseFlags(object, label) {
  for (const key of BLOCKED_FLAGS) {
    invariant(object?.[key] === false, `${label} ${key} blocked.`);
  }
}

function inspectLedgerRow(row, handoffRow) {
  invariant(row.id === handoffRow.id, `${handoffRow.id} ledger id mismatch.`);
  invariant(row.order === handoffRow.order, `${row.id} order mismatch.`);
  invariant(row.title === handoffRow.title, `${row.id} title mismatch.`);
  invariant(
    row.expected_source_requirement === handoffRow.source_requirement,
    `${row.id} source requirement mismatch.`,
  );
  invariant(row.proof_recorded_by_ledger === false, `${row.id} cannot be recorded by ledger.`);
  invariant(["missing", "inspectable"].includes(row.state), `${row.id} state mismatch.`);
  const inspector = STEP_INSPECTORS[row.id];
  invariant(inspector, `${row.id} inspector missing.`);
  invariant(row.inspector_env === inspector.envName, `${row.id} inspector env mismatch.`);
  invariant(row.inspector_script === inspector.script, `${row.id} inspector script mismatch.`);
  const artifactPath = normalizeArtifactPath(row.artifact_path, `${row.id} artifact path`, {
    mustExist: row.state === "inspectable",
  });
  invariant(
    artifactPath.relativePath === handoffRow.expected_artifact_path,
    `${row.id} artifact path mismatch.`,
  );

  if (row.state === "missing") {
    invariant(!existsSync(artifactPath.resolved), `${row.id} marked missing but artifact exists.`);
    invariant(row.artifact_sha256 === null, `${row.id} missing row cannot pin artifact SHA.`);
    return;
  }

  runInspect(inspector.script, inspector.envName, artifactPath.relativePath, row.title);
  const { sha256 } = readJsonArtifact(artifactPath.resolved, row.id);
  invariant(sha256 === row.artifact_sha256, `${row.id} SHA256 does not match artifact.`);
}

function main() {
  const ledgerPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH ??
      DEFAULT_LEDGER_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH",
  );
  const { artifact: ledger } = readJsonArtifact(
    ledgerPath.resolved,
    "public request first-gym proof evidence session ledger",
  );

  invariant(
    ledger.artifact_kind ===
      "admin_public_request_first_gym_proof_evidence_session_ledger",
    "Proof evidence session ledger kind mismatch.",
  );
  invariant(
    ledger.status ===
      "admin_public_request_first_gym_proof_evidence_session_ledger_prepared",
    "Proof evidence session ledger status mismatch.",
  );
  invariant(
    ledger.evidence_basis ===
      "admin_public_request_first_gym_proof_evidence_session_handoff",
    "Proof evidence session ledger basis mismatch.",
  );

  const handoffPath = normalizeArtifactPath(
    ledger.public_request_first_gym_proof_evidence_session_handoff_path,
    "proof evidence session handoff path",
  );
  const { artifact: handoff, sha256: handoffSha256 } = readJsonArtifact(
    handoffPath.resolved,
    "public request first-gym proof evidence session handoff",
  );
  invariant(
    handoffSha256 ===
      ledger.public_request_first_gym_proof_evidence_session_handoff_sha256,
    "Proof evidence session handoff SHA256 does not match.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-handoff.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH",
    handoffPath.relativePath,
    "Public request first-gym proof evidence session handoff",
  );

  invariant(
    ledger.verified_evidence_session_handoff?.path === handoffPath.relativePath,
    "Verified evidence session handoff path mismatch.",
  );
  invariant(
    ledger.verified_evidence_session_handoff?.sha256 === handoffSha256,
    "Verified evidence session handoff SHA mismatch.",
  );
  invariant(
    ledger.verified_evidence_session_handoff?.handoff_row_count ===
      handoff.session_handoff_rows.length,
    "Verified evidence session handoff row count mismatch.",
  );
  invariant(
    ledger.verified_evidence_session_handoff?.missing_evidence_count ===
      handoff.proof_evidence_session_handoff.missing_evidence_count,
    "Verified evidence session handoff missing evidence count mismatch.",
  );
  invariant(
    ledger.verified_evidence_session_handoff
      ?.ready_for_real_proof_command_run ===
      handoff.proof_evidence_session_handoff.ready_for_real_proof_command_run,
    "Verified evidence session handoff proof command readiness mismatch.",
  );
  invariant(
    ledger.verified_evidence_session_handoff?.session_handoff_guard_state ===
      handoff.session_handoff_guard.state,
    "Verified evidence session handoff guard mismatch.",
  );

  invariant(
    ledger.proof_evidence_session_ledger?.mode ===
      "status_only_reinspect_session_handoff_artifacts",
    "Proof evidence session ledger must remain status-only.",
  );
  invariant(
    ledger.proof_evidence_session_ledger.evidence_recorded === false,
    "Proof evidence session ledger cannot record evidence.",
  );
  invariant(
    ledger.proof_evidence_session_ledger.customer_observed_completion_recorded ===
      false,
    "Proof evidence session ledger cannot record customer-observed completion.",
  );
  invariant(
    ledger.proof_evidence_session_ledger.first_gym_operator_run_recorded === false,
    "Proof evidence session ledger cannot record first-gym operator run.",
  );
  invariant(
    ledger.proof_evidence_session_ledger.limited_beta_review_recorded === false,
    "Proof evidence session ledger cannot record limited beta review.",
  );
  invariant(
    ledger.proof_evidence_session_ledger.public_launch_decision_allowed === false,
    "Proof evidence session ledger cannot allow public launch decision.",
  );

  const rows = ledger.session_evidence_ledger ?? [];
  invariant(rows.length === handoff.session_handoff_rows.length, "Session evidence ledger row count mismatch.");
  rows.forEach((row, index) => inspectLedgerRow(row, handoff.session_handoff_rows[index]));
  const inspectableCount = rows.filter((row) => row.state === "inspectable").length;
  const missingCount = rows.filter((row) => row.state === "missing").length;
  const nextMissing = rows.find((row) => row.state === "missing") ?? null;
  invariant(
    ledger.proof_evidence_session_ledger.inspectable_count === inspectableCount,
    "Session evidence inspectable count mismatch.",
  );
  invariant(
    ledger.proof_evidence_session_ledger.missing_count === missingCount,
    "Session evidence missing count mismatch.",
  );
  invariant(
    ledger.proof_evidence_session_ledger.all_session_evidence_inspectable ===
      (missingCount === 0),
    "Session evidence completion flag mismatch.",
  );
  invariant(
    ledger.proof_evidence_session_ledger.next_missing_step_id ===
      (nextMissing?.id ?? null),
    "Session evidence next missing step mismatch.",
  );
  invariant(
    ledger.session_evidence_completion?.ready_for_first_gym_go_no_go ===
      (rows.find((row) => row.id === "hosted_rehearsal_evidence")?.state ===
        "inspectable" &&
        rows.find((row) => row.id === "customer_observed_session")?.state ===
          "inspectable"),
    "Session evidence go/no-go readiness mismatch.",
  );
  invariant(
    ledger.session_evidence_completion?.ready_for_limited_beta_review ===
      (rows.find((row) => row.id === "first_gym_operator_run")?.state ===
        "inspectable"),
    "Session evidence limited beta readiness mismatch.",
  );
  invariant(
    ledger.session_evidence_completion?.ready_for_public_launch_controls === false,
    "Session evidence ledger cannot ready public launch controls.",
  );
  invariant(
    ledger.session_evidence_guard?.state ===
      (missingCount === 0 ? "ready_for_review" : "blocked"),
    "Session evidence guard state mismatch.",
  );
  invariant(
    ledger.session_evidence_guard?.allowed_next_action ===
      (missingCount === 0
        ? "Run first-gym go/no-go, first-gym operator run, and limited beta review only through dedicated proof commands; public/live-provider/revenue gates remain separate."
        : "Record the next missing evidence item with its dedicated proof command, then regenerate the session ledger."),
    "Session evidence guard action mismatch.",
  );
  assertFalseFlags(ledger, "Proof evidence session ledger");

  console.log(
    "Admin public request first-gym proof evidence session ledger inspection passed",
  );
}

main();
