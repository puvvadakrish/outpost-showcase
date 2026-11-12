#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_READINESS_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-evidence-execution-readiness.json";

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

function rowById(rows, id) {
  const row = rows.find((entry) => entry.id === id);
  invariant(row, `Session ledger row missing: ${id}.`);
  return row;
}

function stepById(steps, id) {
  const step = steps.find((entry) => entry.id === id);
  invariant(step, `Evidence execution step missing: ${id}.`);
  return step;
}

function commandForMissing(row) {
  const commands = {
    customer_observed_session: {
      command:
        "npm run admin:customer-session:record && npm run admin:customer-session:inspect && npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
      detail:
        "Record the real customer-observed session, inspect it, import the hosted digest, and prove the digest before go/no-go.",
      title: "Record customer-observed session and hosted digest proof",
    },
    first_gym_go_no_go_bundle: {
      command: "npm run admin:public-request-first-gym:go-no-go:bundle",
      detail:
        "Prepare go/no-go only after hosted rehearsal, customer session, and hosted digest proof are real.",
      title: "Prepare first-gym go/no-go bundle",
    },
    first_gym_operator_run: {
      command: "npm run admin:public-request-first-gym:run",
      detail:
        "Record first-gym operator run only after the real assisted run completes.",
      title: "Record first-gym operator run",
    },
    hosted_rehearsal_evidence: {
      command: "npm run admin:public-request-hosted-rehearsal:evidence",
      detail:
        "Record protected Preview hosted rehearsal observations with the dedicated proof command.",
      title: "Record hosted rehearsal evidence",
    },
    limited_beta_operator_review: {
      command: "npm run admin:public-request:limited-beta:operator-review",
      detail:
        "Prepare limited beta review only after first-gym operator-run proof is inspectable.",
      title: "Prepare limited beta operator review",
    },
  };
  return commands[row.id];
}

function main() {
  const readinessPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH ??
      DEFAULT_READINESS_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH",
  );
  const { artifact: readiness } = readJsonArtifact(
    readinessPath.resolved,
    "public request first-gym evidence execution readiness",
  );

  invariant(
    readiness.artifact_kind ===
      "admin_public_request_first_gym_evidence_execution_readiness",
    "Evidence execution readiness kind mismatch.",
  );
  invariant(
    readiness.status ===
      "admin_public_request_first_gym_evidence_execution_readiness_prepared",
    "Evidence execution readiness status mismatch.",
  );
  invariant(
    readiness.evidence_basis ===
      "admin_public_request_first_gym_proof_evidence_session_ledger",
    "Evidence execution readiness basis mismatch.",
  );

  const ledgerPath = normalizeArtifactPath(
    readiness.public_request_first_gym_proof_evidence_session_ledger_path,
    "proof evidence session ledger path",
  );
  const { artifact: ledger, sha256: ledgerSha256 } = readJsonArtifact(
    ledgerPath.resolved,
    "public request first-gym proof evidence session ledger",
  );
  invariant(
    ledgerSha256 ===
      readiness.public_request_first_gym_proof_evidence_session_ledger_sha256,
    "Proof evidence session ledger SHA256 does not match.",
  );
  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-evidence-session-ledger.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH",
    ledgerPath.relativePath,
    "Public request first-gym proof evidence session ledger",
  );

  invariant(
    readiness.verified_session_ledger?.path === ledgerPath.relativePath,
    "Verified session ledger path mismatch.",
  );
  invariant(
    readiness.verified_session_ledger?.sha256 === ledgerSha256,
    "Verified session ledger SHA mismatch.",
  );
  invariant(
    readiness.verified_session_ledger?.inspectable_count ===
      ledger.proof_evidence_session_ledger.inspectable_count,
    "Verified session ledger inspectable count mismatch.",
  );
  invariant(
    readiness.verified_session_ledger?.missing_count ===
      ledger.proof_evidence_session_ledger.missing_count,
    "Verified session ledger missing count mismatch.",
  );
  invariant(
    readiness.verified_session_ledger?.all_session_evidence_inspectable ===
      ledger.proof_evidence_session_ledger.all_session_evidence_inspectable,
    "Verified session ledger completion mismatch.",
  );

  const rows = ledger.session_evidence_ledger ?? [];
  const hostedRow = rowById(rows, "hosted_rehearsal_evidence");
  const customerRow = rowById(rows, "customer_observed_session");
  const bundleRow = rowById(rows, "first_gym_go_no_go_bundle");
  const runRow = rowById(rows, "first_gym_operator_run");
  const betaRow = rowById(rows, "limited_beta_operator_review");
  const hostedAndCustomerInspectable =
    hostedRow.state === "inspectable" && customerRow.state === "inspectable";
  const firstMissing = rows.find((row) => row.state === "missing") ?? null;

  invariant(
    readiness.evidence_execution_readiness?.mode ===
      "ledger_derived_execution_readiness_only",
    "Evidence execution readiness must remain control-only.",
  );
  invariant(
    readiness.evidence_execution_readiness.hosted_rehearsal_evidence_state ===
      hostedRow.state,
    "Hosted rehearsal evidence state mismatch.",
  );
  invariant(
    readiness.evidence_execution_readiness.customer_observed_session_state ===
      customerRow.state,
    "Customer-observed session state mismatch.",
  );
  invariant(
    readiness.evidence_execution_readiness.first_gym_go_no_go_bundle_state ===
      bundleRow.state,
    "First-gym go/no-go bundle state mismatch.",
  );
  invariant(
    readiness.evidence_execution_readiness.first_gym_operator_run_state ===
      runRow.state,
    "First-gym operator run state mismatch.",
  );
  invariant(
    readiness.evidence_execution_readiness.limited_beta_operator_review_state ===
      betaRow.state,
    "Limited beta operator review state mismatch.",
  );
  invariant(
    readiness.evidence_execution_readiness.go_no_go_allowed_by_evidence ===
      hostedAndCustomerInspectable,
    "Go/no-go evidence readiness mismatch.",
  );
  invariant(
    readiness.evidence_execution_readiness.hosted_customer_session_digest_proof_claimed ===
      false,
    "Evidence execution readiness cannot claim hosted digest proof.",
  );
  invariant(
    readiness.evidence_execution_readiness.next_missing_step_id ===
      (firstMissing?.id ?? null),
    "Next missing evidence step mismatch.",
  );
  invariant(
    readiness.evidence_execution_readiness.public_launch_decision_allowed ===
      false,
    "Evidence execution readiness cannot allow public launch decision.",
  );

  const steps = readiness.evidence_execution_steps ?? [];
  invariant(
    steps.length === 6,
    "Evidence execution steps length mismatch.",
  );
  invariant(
    stepById(steps, "hosted_rehearsal_evidence").state === hostedRow.state,
    "Hosted rehearsal execution step state mismatch.",
  );
  invariant(
    stepById(steps, "hosted_rehearsal_evidence").command ===
      "npm run admin:public-request-hosted-rehearsal:evidence",
    "Hosted rehearsal execution command mismatch.",
  );
  invariant(
    stepById(steps, "customer_observed_session_and_hosted_digest").state ===
      (customerRow.state === "inspectable"
        ? "inspectable_requires_hosted_digest_confirmation"
        : "missing"),
    "Customer session execution step state mismatch.",
  );
  invariant(
    stepById(steps, "customer_observed_session_and_hosted_digest").command ===
      "npm run admin:customer-session:record && npm run admin:customer-session:inspect && npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
    "Customer session execution command mismatch.",
  );
  invariant(
    stepById(steps, "regenerate_session_ledger_after_evidence_change").state ===
      "required_after_each_evidence_change",
    "Session ledger regeneration step mismatch.",
  );
  invariant(
    stepById(steps, "regenerate_session_ledger_after_evidence_change")
      .command ===
      "npm run admin:public-request-first-gym:proof-evidence-session-ledger",
    "Session ledger regeneration command mismatch.",
  );
  invariant(
    stepById(steps, "first_gym_go_no_go_bundle").state ===
      (hostedAndCustomerInspectable ? "ready" : "blocked"),
    "First-gym go/no-go execution step state mismatch.",
  );
  invariant(
    stepById(steps, "first_gym_go_no_go_bundle").command ===
      "npm run admin:public-request-first-gym:go-no-go:bundle",
    "First-gym go/no-go execution command mismatch.",
  );
  invariant(
    stepById(steps, "first_gym_operator_run").state ===
      (runRow.state === "inspectable" ? "inspectable" : "blocked"),
    "First-gym operator-run execution step state mismatch.",
  );
  invariant(
    stepById(steps, "first_gym_operator_run").command ===
      "npm run admin:public-request-first-gym:run",
    "First-gym operator-run execution command mismatch.",
  );
  invariant(
    stepById(steps, "limited_beta_operator_review").state ===
      (betaRow.state === "inspectable" ? "inspectable" : "blocked"),
    "Limited beta review execution step state mismatch.",
  );
  invariant(
    stepById(steps, "limited_beta_operator_review").command ===
      "npm run admin:public-request:limited-beta:operator-review",
    "Limited beta review execution command mismatch.",
  );

  const regenerateAfterCommand =
    "npm run admin:public-request-first-gym:proof-evidence-session-ledger && npm run admin:public-request-first-gym:proof-evidence-session-ledger:inspect";
  const nextCommand = firstMissing ? commandForMissing(firstMissing) : null;
  invariant(
    !firstMissing || nextCommand,
    `Next missing evidence step ${firstMissing?.id} has no command template.`,
  );
  const expectedNextAction = firstMissing
    ? {
        ...nextCommand,
        id: firstMissing.id,
        regenerate_after_command: regenerateAfterCommand,
        state: "blocked_on_real_evidence",
      }
    : {
        command:
          "npm run admin:public-request-first-gym:go-no-go:bundle && npm run admin:public-request-first-gym:go-no-go:bundle:inspect",
        detail:
          "Run only after hosted customer-session digest proof has been confirmed through the dedicated hosted proof command.",
        id: "first_gym_go_no_go_bundle",
        regenerate_after_command: regenerateAfterCommand,
        state: "ready_after_hosted_digest_confirmation",
        title: "Prepare first-gym go/no-go bundle",
      };
  for (const key of [
    "command",
    "detail",
    "id",
    "regenerate_after_command",
    "state",
    "title",
  ]) {
    invariant(
      readiness.next_operator_action?.[key] === expectedNextAction[key],
      `Next operator action ${key} mismatch.`,
    );
  }
  invariant(
    readiness.next_operator_action?.regenerate_after_command ===
      regenerateAfterCommand,
    "Next operator action regeneration command mismatch.",
  );
  invariant(
    readiness.blocked_gates.includes("Live provider enablement"),
    "Blocked gates must include live provider enablement.",
  );
  invariant(
    readiness.blocked_gates.includes(
      "Billing, POS, access control, member-ledger writes",
    ),
    "Blocked gates must include revenue/member-system writes.",
  );
  assertFalseFlags(readiness, "Evidence execution readiness");

  console.log(
    "Admin public request first-gym evidence execution readiness inspection passed",
  );
}

main();
