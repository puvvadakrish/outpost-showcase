#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_RUNWAY_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-proof-runway-batch.json";
const DEFAULT_LEDGER_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-first-gym-execution-ledger.json";

const BLOCKED_GATES = [
  "Public owner self-signup",
  "Public request form submission",
  "Browser approval buttons",
  "Automatic approval",
  "Owner provisioning",
  "Invite delivery",
  "Notification sending",
  "Product Auth admin API",
  "Auth user creation",
  "Magic link creation",
  "Automatic owner/staff grants",
  "Phone/email provider activation",
  "Provider ingress/egress",
  "Billing, POS, access control, member-ledger writes",
  "Public launch decision",
];

const STEP_DEFINITIONS = [
  {
    command: "npm run admin:public-request-hosted-rehearsal:evidence",
    defaultSuffix: "public-request-hosted-rehearsal-evidence.json",
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
    id: "hosted_rehearsal_evidence",
    inspectEnvName: "OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH",
    inspectScript: "scripts/inspect-admin-public-request-hosted-rehearsal-evidence.mjs",
    title: "Hosted rehearsal evidence",
  },
  {
    command: "npm run admin:customer-session:record",
    defaultSuffix: "customer-observed-session-record.json",
    envName: "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
    id: "customer_observed_session",
    inspectEnvName: "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
    inspectScript: "scripts/inspect-admin-customer-observed-session.mjs",
    title: "Customer-observed session",
  },
  {
    command: "npm run admin:public-request-first-gym:go-no-go:bundle",
    defaultSuffix: "public-request-first-gym-go-no-go-bundle.json",
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH",
    id: "first_gym_go_no_go_bundle",
    inspectEnvName: "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH",
    inspectScript: "scripts/inspect-admin-public-request-first-gym-go-no-go-bundle.mjs",
    title: "First-gym go/no-go bundle",
  },
  {
    command: "npm run admin:public-request-first-gym:run",
    defaultSuffix: "public-request-first-gym-operator-run-record.json",
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH",
    id: "first_gym_operator_run",
    inspectEnvName: "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH",
    inspectScript: "scripts/inspect-admin-public-request-first-gym-operator-run.mjs",
    title: "First-gym operator run",
  },
  {
    command: "npm run admin:public-request:limited-beta:operator-review",
    defaultSuffix: "public-request-limited-beta-operator-review-packet.json",
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH",
    id: "limited_beta_operator_review",
    inspectEnvName: "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH",
    inspectScript:
      "scripts/inspect-admin-public-request-limited-beta-operator-review-packet.mjs",
    title: "Limited beta operator review",
  },
  {
    command: "npm run admin:public-request:self-serve:launch-preflight",
    defaultSuffix: "public-request-self-serve-launch-preflight.json",
    envName: "OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH",
    id: "public_request_self_serve_preflight",
    inspectEnvName: "OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH",
    inspectScript: "scripts/inspect-admin-public-request-self-serve-launch-preflight.mjs",
    title: "Public-request self-serve preflight",
  },
  {
    command: "npm run admin:public-launch-controls:batch",
    defaultSuffix: "public-launch-controls-batch.json",
    envName: "OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH",
    id: "public_launch_controls",
    inspectEnvName: "OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH",
    inspectScript: "scripts/inspect-admin-public-launch-controls-batch.mjs",
    title: "Public launch controls",
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

function assertFalse(object, key, message) {
  invariant(object?.[key] === false, message);
}

function validateRunway(runway) {
  invariant(
    runway.artifact_kind === "admin_public_request_first_gym_proof_runway_batch",
    "Proof runway kind mismatch.",
  );
  invariant(
    runway.status === "admin_public_request_first_gym_proof_runway_batch_prepared",
    "Proof runway status mismatch.",
  );
  invariant(
    runway.proof_runway?.mode === "terminal_execution_plan_only",
    "Proof runway must remain terminal-only.",
  );
  assertFalse(
    runway.proof_runway,
    "first_gym_operator_run_recorded",
    "Runway cannot record first-gym operator run.",
  );
  assertFalse(
    runway,
    "public_self_serve_launch_allowed",
    "Runway cannot allow public self-serve launch.",
  );
}

function defaultChildArtifactPath(runwayRelativePath, suffix) {
  const runwaySuffix = "public-request-first-gym-proof-runway-batch.json";
  invariant(
    runwayRelativePath.endsWith(runwaySuffix),
    "Proof runway path must use expected suffix.",
  );
  return runwayRelativePath.slice(0, -runwaySuffix.length) + suffix;
}

function buildStep(definition, runwayRelativePath) {
  const path = normalizeArtifactPath(
    process.env[definition.envName] ??
      defaultChildArtifactPath(runwayRelativePath, definition.defaultSuffix),
    definition.envName,
  );
  if (!existsSync(path.resolved)) {
    return {
      artifact_path: path.relativePath,
      command: definition.command,
      id: definition.id,
      state: "missing",
      title: definition.title,
    };
  }

  runInspect(
    definition.inspectScript,
    definition.inspectEnvName,
    path.relativePath,
    definition.title,
  );
  const { sha256 } = readJsonArtifact(path.resolved, definition.title);
  return {
    artifact_path: path.relativePath,
    artifact_sha256: sha256,
    command: definition.command,
    id: definition.id,
    state: "inspectable",
    title: definition.title,
  };
}

function main() {
  const runwayPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH ??
      DEFAULT_RUNWAY_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH",
    { mustExist: true },
  );
  const ledgerPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH ??
      DEFAULT_LEDGER_PATH,
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH",
    { mustNotExist: true },
  );

  runInspect(
    "scripts/inspect-admin-public-request-first-gym-proof-runway-batch.mjs",
    "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH",
    runwayPath.relativePath,
    "Public request first-gym proof runway",
  );
  const { artifact: runway, sha256: runwaySha256 } = readJsonArtifact(
    runwayPath.resolved,
    "public request first-gym proof runway",
  );
  validateRunway(runway);

  const steps = STEP_DEFINITIONS.map((definition) =>
    buildStep(definition, runwayPath.relativePath),
  );
  const inspectableCount = steps.filter((step) => step.state === "inspectable").length;
  const missingCount = steps.filter((step) => step.state === "missing").length;

  const ledger = {
    artifact_kind: "admin_public_request_first_gym_execution_ledger",
    status: "admin_public_request_first_gym_execution_ledger_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_public_request_first_gym_proof_runway_batch",
    public_request_first_gym_proof_runway_batch_path: runwayPath.relativePath,
    public_request_first_gym_proof_runway_batch_sha256: runwaySha256,
    candidate_gym_label: runway.candidate_gym_label,
    execution_ledger: {
      mode: "status_only_reinspect_existing_artifacts",
      inspectable_count: inspectableCount,
      missing_count: missingCount,
      all_required_artifacts_inspectable: missingCount === 0,
      first_gym_operator_run_recorded:
        steps.find((step) => step.id === "first_gym_operator_run")?.state ===
        "inspectable",
      limited_beta_operator_review_ready:
        steps.find((step) => step.id === "limited_beta_operator_review")?.state ===
        "inspectable",
      public_request_self_serve_launch_preflight_ready:
        steps.find((step) => step.id === "public_request_self_serve_preflight")
          ?.state === "inspectable",
      ready_for_public_self_serve_launch: false,
      public_launch_decision_allowed: false,
    },
    steps,
    blocked_gates: BLOCKED_GATES,
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    public_request_form_submission_allowed: false,
    public_submission_accepted: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    owner_provisioning_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_user_created: false,
    magic_link_created: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    phone_email_provider_activation_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    access_control_writes_allowed: false,
    member_ledger_writes_allowed: false,
    provider_ingress_allowed: false,
    provider_egress_allowed: false,
    public_launch_decision_allowed: false,
    next_readiness_batches: [
      {
        command: "Run missing proof commands listed by this ledger.",
        detail:
          "Each present artifact must pass its own inspector before the ledger marks it inspectable.",
        id: "real_first_gym_proof_execution",
        state: missingCount === 0 ? "pending" : "blocked",
        title: "Real first-gym proof execution",
      },
      {
        command: "Review limited beta after first-gym operator run evidence.",
        detail: "Owner access remains operator-managed.",
        id: "limited_operator_assisted_beta_onboarding",
        state:
          steps.find((step) => step.id === "first_gym_operator_run")?.state ===
          "inspectable"
            ? "pending"
            : "blocked",
        title: "Limited beta operator review",
      },
      {
        command:
          "Keep public self-serve, invite, provider, revenue, POS, access-control, and member-ledger gates separate.",
        detail: "This ledger does not authorize public launch.",
        id: "live_provider_revenue_gates",
        state: "blocked",
        title: "Public/live-provider gates",
      },
    ],
  };

  assertNoSecretShapedKeys(ledger, "public request first-gym execution ledger");
  mkdirSync(dirname(ledgerPath.resolved), { recursive: true });
  writeFileSync(ledgerPath.resolved, `${JSON.stringify(ledger, null, 2)}\n`, {
    flag: "wx",
  });

  console.log("Admin public request first-gym execution ledger prepared");
  console.log(`Artifact: ${ledgerPath.relativePath}`);
  console.log(`Inspectable artifacts: ${inspectableCount}`);
  console.log(`Missing artifacts: ${missingCount}`);
  console.log("Public self-serve/live-provider/revenue gates: blocked");
}

main();
