import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const prepareScript = readFileSync(
  "scripts/prepare-admin-demo-onboarding-runway.mjs",
  "utf8",
);
const inspectScript = readFileSync(
  "scripts/inspect-admin-demo-onboarding-runway.mjs",
  "utf8",
);
const founderAdminDomain = readFileSync(
  "src/domain/founder-admin-readiness.ts",
  "utf8",
);
const founderAdminComponent = readFileSync(
  "src/components/founder-admin/FounderAdminReadinessConsole.tsx",
  "utf8",
);

function run(script, env) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function artifactPath(name) {
  mkdirSync("artifacts/admin-demo-onboarding-runway-tests", {
    recursive: true,
  });
  return `artifacts/admin-demo-onboarding-runway-tests/${name}`;
}

function removeIfExists(path) {
  if (existsSync(path)) rmSync(path);
}

function writeJsonArtifact(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function sha(path) {
  return createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
}

const sourceGates = [
  "public_owner_self_signup",
  "website_scraping",
  "google_profile_api_import",
  "automatic_answer_approval",
  "task_generation",
  "notification_sending",
  "phone_email_provider_activation",
  "billing",
  "pos_access_control_member_ledger_writes",
  "email_ingress",
  "outbound_email_delivery",
  "provider_webhooks",
];

const emailGates = [
  "public_owner_self_signup",
  "gmail_connection",
  "resend_connection",
  "smtp_connection",
  "provider_webhooks",
  "email_ingress",
  "outbound_email_delivery",
  "notification_sending",
  "task_generation",
  "billing",
  "pos_access_control_member_ledger_writes",
];

function writeLaunchEvidenceChain(prefix) {
  const sourceParentPath = artifactPath(`${prefix}-source-parent.json`);
  const emailParentPath = artifactPath(`${prefix}-email-parent.json`);
  const sourceCompletionPath = artifactPath(`${prefix}-source-completion.json`);
  const emailCompletionPath = artifactPath(`${prefix}-email-completion.json`);
  const bundlePath = artifactPath(`${prefix}-launch-evidence-bundle.json`);

  removeIfExists(bundlePath);
  writeJsonArtifact(sourceParentPath, {
    artifact_kind: "admin_source_apply_rehearsal",
    status: "source_apply_rehearsal_prepared",
    blocked_gates: sourceGates,
  });
  writeJsonArtifact(emailParentPath, {
    artifact_kind: "admin_email_task_rehearsal",
    status: "email_task_rehearsal_prepared",
    blocked_gates: emailGates,
  });
  writeJsonArtifact(sourceCompletionPath, {
    artifact_kind: "admin_source_apply_completion",
    status: "source_apply_completion_recorded",
    gym_name: "Proof Gym",
    owner_email: "owner@proof.example",
    owner_label: "Proof Owner",
    preview_url: "https://outpost-preview.example.vercel.app",
    neon_branch_name: "outpost-beta-access-scoped-proof",
    source_apply_rehearsal_path: sourceParentPath,
    source_apply_rehearsal_sha256: sha(sourceParentPath),
    operator_label: "Source Operator",
    observed: {
      answer_review_staged: true,
      automatic_approval_not_observed: true,
      live_provider_copy_blocked: true,
      manual_source_saved: true,
      owner_workspace_observed: true,
    },
    artifact_runtime_write_allowed: false,
    customer_observed_handoff_claimed: false,
    email_or_notification_allowed: false,
    existing_owner_manual_intake_allowed: true,
    public_self_serve_launch_allowed: false,
    source_import_automation_allowed: false,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: sourceGates,
  });
  writeJsonArtifact(emailCompletionPath, {
    artifact_kind: "admin_email_task_completion",
    status: "email_task_completion_recorded",
    gym_name: "Proof Gym",
    owner_email: "owner@proof.example",
    owner_label: "Proof Owner",
    preview_url: "https://outpost-preview.example.vercel.app",
    neon_branch_name: "outpost-beta-access-scoped-proof",
    email_task_rehearsal_path: emailParentPath,
    email_task_rehearsal_sha256: sha(emailParentPath),
    operator_label: "Email Operator",
    triage_category: "membership-freeze",
    observed: {
      email_ingress_not_observed: true,
      live_provider_copy_blocked: true,
      manual_task_decision_observed: true,
      notification_not_observed: true,
      outbound_delivery_not_observed: true,
      owner_review_observed: true,
    },
    artifact_runtime_write_allowed: false,
    automatic_task_creation_allowed: false,
    customer_observed_handoff_claimed: false,
    existing_manual_task_entry_allowed: true,
    public_self_serve_launch_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    automatic_task_generation_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: emailGates,
  });

  const bundle = run("scripts/prepare-admin-launch-evidence-bundle.mjs", {
    OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: sourceCompletionPath,
    OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH: emailCompletionPath,
    OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath,
  });
  expect(bundle.status, bundle.stderr).toBe(0);
  return { bundlePath };
}

function writeCustomerSession(prefix, packetOverrides = {}) {
  const { bundlePath } = writeLaunchEvidenceChain(prefix);
  const packetPath = artifactPath(`${prefix}-handoff-scheduling-packet.json`);
  const recordPath = artifactPath(`${prefix}-customer-session-record.json`);
  removeIfExists(packetPath);
  const packet = run("scripts/prepare-admin-handoff-scheduling-packet.mjs", {
    OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath,
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath,
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR: "Scheduling Operator",
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW: "next owner support session",
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_OWNER_LABEL: "Proof Owner",
  });
  expect(packet.status, packet.stderr).toBe(0);
  if (Object.keys(packetOverrides).length > 0) {
    const current = JSON.parse(readFileSync(packetPath, "utf8"));
    writeJsonArtifact(packetPath, { ...current, ...packetOverrides });
  }
  removeIfExists(recordPath);
  const record = run("scripts/record-admin-customer-observed-session.mjs", {
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath,
    OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
    OUTPOST_ADMIN_CUSTOMER_SESSION_OPERATOR: "Session Operator",
    OUTPOST_ADMIN_CUSTOMER_SESSION_WINDOW: "owner observed session",
    OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_PREVIEW_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_WORKSPACE_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_STAFF_HANDOFF_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_RESET_ROLLBACK_REVIEWED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_INVITE_DELIVERY_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED:
      "yes",
  });
  expect(record.status, record.stderr).toBe(0);
  return { recordPath };
}

describe("admin demo onboarding runway", () => {
  it("wires runway scripts and Admin next-two-slice copy without live-provider actions", () => {
    expect(packageJson).toContain("admin:demo-onboarding-runway");
    expect(packageJson).toContain("admin:demo-onboarding-runway:inspect");
    expect(prepareScript).toContain("admin_demo_onboarding_runway");
    expect(prepareScript).toContain("hosted_customer_session_proof");
    expect(prepareScript).toContain("operator_demo_onboarding_rehearsal");
    expect(inspectScript).toContain("next_two_slices.length === 2");
    expect(founderAdminDomain).toContain("Demo/onboarding runway");
    expect(founderAdminComponent).toContain("Demo onboarding runway");
    expect(`${prepareScript}\n${inspectScript}`).not.toMatch(
      /sendEmail|sendInvite|connect.*gmail|resend\.emails|stripe|provider.*activate/iu,
    );
  });

  it("prepares and inspects a customer-safe runway from a customer session record", () => {
    const { recordPath } = writeCustomerSession("runway-happy");
    const runwayPath = artifactPath("runway-happy.json");
    removeIfExists(runwayPath);

    const prepare = run("scripts/prepare-admin-demo-onboarding-runway.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
      OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH: runwayPath,
    });
    expect(prepare.status, prepare.stderr).toBe(0);
    expect(prepare.stdout).toContain("Admin demo onboarding runway prepared.");

    const runway = JSON.parse(readFileSync(runwayPath, "utf8"));
    expect(runway).toMatchObject({
      artifact_kind: "admin_demo_onboarding_runway",
      status: "admin_demo_onboarding_runway_prepared",
      evidence_basis: "admin_customer_observed_session_record",
      customer_session_record_path: recordPath,
      customer_session_record_sha256: sha(recordPath),
      gym_name: "Proof Gym",
      operator_led_demo_ready: true,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(runway.next_two_slices.map((slice) => slice.id)).toEqual([
      "hosted_customer_session_proof",
      "operator_demo_onboarding_rehearsal",
    ]);
    expect(runway.blocked_gates).toEqual(
      expect.arrayContaining([
        "Invite delivery",
        "Phone/email provider activation",
        "Billing, POS, access control, member-ledger writes",
      ]),
    );

    const inspect = run("scripts/inspect-admin-demo-onboarding-runway.mjs", {
      OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH: runwayPath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin demo onboarding runway inspection passed.",
    );
  });

  it("fails closed for unsafe paths, secret-shaped values, and tampered gates", () => {
    const { recordPath } = writeCustomerSession("runway-fail");
    let result = run("scripts/prepare-admin-demo-onboarding-runway.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
      OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH: "docs/runway.json",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must stay inside artifacts/");

    result = run("scripts/prepare-admin-demo-onboarding-runway.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
      OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH:
        "artifacts/admin-demo-onboarding-runway-tests/token: abcdefghijklmnop.json",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");

    const runwayPath = artifactPath("runway-tampered.json");
    removeIfExists(runwayPath);
    result = run("scripts/prepare-admin-demo-onboarding-runway.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
      OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH: runwayPath,
    });
    expect(result.status).toBe(0);
    const runway = JSON.parse(readFileSync(runwayPath, "utf8"));
    writeJsonArtifact(runwayPath, {
      ...runway,
      public_self_serve_launch_allowed: true,
    });
    const inspect = run("scripts/inspect-admin-demo-onboarding-runway.mjs", {
      OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH: runwayPath,
    });
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Public self-serve must remain blocked");

    writeJsonArtifact(runwayPath, {
      ...runway,
      blocked_gates: runway.blocked_gates.filter(
        (gate) => gate !== "Phone/email provider activation",
      ),
    });
    const missingGate = run(
      "scripts/inspect-admin-demo-onboarding-runway.mjs",
      {
        OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH: runwayPath,
      },
    );
    expect(missingGate.status).not.toBe(0);
    expect(missingGate.stderr).toContain(
      "blocked gates missing Phone/email provider activation",
    );

    writeJsonArtifact(runwayPath, {
      ...runway,
      customer_session_record_sha256: "0".repeat(64),
    });
    const shaMismatch = run(
      "scripts/inspect-admin-demo-onboarding-runway.mjs",
      {
        OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH: runwayPath,
      },
    );
    expect(shaMismatch.status).not.toBe(0);
    expect(shaMismatch.stderr).toContain(
      "Customer session record SHA256 does not match",
    );
  }, 30000);
});
