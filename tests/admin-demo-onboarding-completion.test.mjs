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
const recordCompletionScript = readFileSync(
  "scripts/record-admin-demo-onboarding-completion.mjs",
  "utf8",
);
const inspectCompletionScript = readFileSync(
  "scripts/inspect-admin-demo-onboarding-completion.mjs",
  "utf8",
);
const prepareCustomerDemoGateScript = readFileSync(
  "scripts/prepare-admin-customer-demo-gate-packet.mjs",
  "utf8",
);
const inspectCustomerDemoGateScript = readFileSync(
  "scripts/inspect-admin-customer-demo-gate-packet.mjs",
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

const sourceGates = [
  "public_owner_self_signup",
  "website_scraping",
  "google_profile_api_import",
  "automatic_answer_approval",
  "task_generation",
  "notification_sending",
  "phone_email_provider_activation",
  "provider_webhooks",
  "billing",
  "pos_access_control_member_ledger_writes",
  "email_ingress",
  "outbound_email_delivery",
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

function run(script, env) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function artifactPath(name) {
  mkdirSync("artifacts/admin-demo-onboarding-completion-tests", {
    recursive: true,
  });
  return `artifacts/admin-demo-onboarding-completion-tests/${name}`;
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
    mailbox_label: "frontdesk@proof.example",
    triage_category: "membership_question",
    email_task_rehearsal_path: emailParentPath,
    email_task_rehearsal_sha256: sha(emailParentPath),
    operator_label: "Email Operator",
    observed: {
      email_ingress_not_observed: true,
      live_provider_copy_blocked: true,
      manual_task_decision_observed: true,
      notification_not_observed: true,
      outbound_delivery_not_observed: true,
      owner_review_observed: true,
    },
    artifact_runtime_write_allowed: false,
    existing_manual_task_entry_allowed: true,
    automatic_task_creation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    public_self_serve_launch_allowed: false,
    billing_pos_member_writes_allowed: false,
    customer_observed_handoff_claimed: false,
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

function writeRunway(prefix) {
  const { bundlePath } = writeLaunchEvidenceChain(prefix);
  const packetPath = artifactPath(`${prefix}-handoff-scheduling-packet.json`);
  const recordPath = artifactPath(`${prefix}-customer-session-record.json`);
  const runwayPath = artifactPath(`${prefix}-runway.json`);
  removeIfExists(packetPath);
  removeIfExists(recordPath);
  removeIfExists(runwayPath);

  const packet = run("scripts/prepare-admin-handoff-scheduling-packet.mjs", {
    OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath,
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath,
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR: "Scheduling Operator",
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW: "next owner support session",
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_OWNER_LABEL: "Proof Owner",
  });
  expect(packet.status, packet.stderr).toBe(0);

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

  const runway = run("scripts/prepare-admin-demo-onboarding-runway.mjs", {
    OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
    OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH: runwayPath,
  });
  expect(runway.status, runway.stderr).toBe(0);
  return { runwayPath };
}

function recordCompletion(runwayPath, completionPath, overrides = {}) {
  return run("scripts/record-admin-demo-onboarding-completion.mjs", {
    OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH: runwayPath,
    OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH: completionPath,
    OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_OPERATOR: "Completion Operator",
    OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PREVIEW_REVIEWED: "yes",
    OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_OWNER_WORKSPACE_REVIEWED: "yes",
    OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_STAFF_HANDOFF_REVIEWED: "yes",
    OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_RESET_ROLLBACK_REVIEWED: "yes",
    OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_HOSTED_PROOF_REVIEWED: "yes",
    OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_NO_UNEXPECTED_DATA: "yes",
    OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_NO_LIVE_PROVIDER_CLAIMS: "yes",
    ...overrides,
  });
}

describe("admin demo onboarding completion proof", () => {
  it("wires completion scripts and Admin next-two-slice copy without live-provider actions", () => {
    expect(packageJson).toContain("admin:demo-onboarding:record");
    expect(packageJson).toContain("admin:demo-onboarding:inspect");
    expect(packageJson).toContain("admin:customer-demo-gate:packet");
    expect(packageJson).toContain("admin:customer-demo-gate:inspect");
    expect(recordCompletionScript).toContain(
      "admin_demo_onboarding_completion",
    );
    expect(recordCompletionScript).toContain("customer_observed_gym_demo_gate");
    expect(recordCompletionScript).toContain(
      "limited_operator_assisted_beta_onboarding",
    );
    expect(inspectCompletionScript).toContain("Runway SHA256 does not match");
    expect(prepareCustomerDemoGateScript).toContain(
      "admin_customer_demo_gate_packet",
    );
    expect(prepareCustomerDemoGateScript).toContain(
      "customer_observed_completion_recorded: false",
    );
    expect(inspectCustomerDemoGateScript).toContain(
      "Completion SHA256 does not match",
    );
    expect(founderAdminDomain).toContain("Demo/onboarding completion proof");
    expect(founderAdminDomain).toContain("Customer demo gate packet");
    expect(founderAdminComponent).toContain(
      "Demo onboarding completion proof",
    );
    expect(founderAdminComponent).toContain("Customer demo gate packet");
    expect(`${recordCompletionScript}\n${inspectCompletionScript}`).not.toMatch(
      /sendEmail|sendInvite|connect.*gmail|resend\.emails|stripe|provider.*activate/iu,
    );
    expect(
      `${prepareCustomerDemoGateScript}\n${inspectCustomerDemoGateScript}`,
    ).not.toMatch(
      /sendEmail|sendInvite|connect.*gmail|resend\.emails|stripe|provider.*activate/iu,
    );
  });

  it("records and inspects operator demo onboarding completion from runway", () => {
    const { runwayPath } = writeRunway("completion-happy");
    const completionPath = artifactPath("completion-happy.json");
    removeIfExists(completionPath);

    const record = recordCompletion(runwayPath, completionPath);
    expect(record.status, record.stderr).toBe(0);
    expect(record.stdout).toContain(
      "Admin demo onboarding completion recorded.",
    );

    const completion = JSON.parse(readFileSync(completionPath, "utf8"));
    expect(completion).toMatchObject({
      artifact_kind: "admin_demo_onboarding_completion",
      status: "admin_demo_onboarding_completion_recorded",
      evidence_basis: "admin_demo_onboarding_runway",
      demo_onboarding_runway_path: runwayPath,
      demo_onboarding_runway_sha256: sha(runwayPath),
      gym_name: "Proof Gym",
      operator_led_demo_completed: true,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(completion.next_two_slices.map((slice) => slice.id)).toEqual([
      "customer_observed_gym_demo_gate",
      "limited_operator_assisted_beta_onboarding",
    ]);

    const inspect = run("scripts/inspect-admin-demo-onboarding-completion.mjs", {
      OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH: completionPath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin demo onboarding completion inspection passed.",
    );
  });

  it("refuses demo onboarding completion without every observation", () => {
    const { runwayPath } = writeRunway("completion-missing-observed");
    const completionPath = artifactPath("completion-missing-observed.json");
    removeIfExists(completionPath);

    const record = recordCompletion(runwayPath, completionPath, {
      OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_NO_LIVE_PROVIDER_CLAIMS: "",
    });
    expect(record.status).not.toBe(0);
    expect(record.stderr).toContain(
      "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_NO_LIVE_PROVIDER_CLAIMS=yes is required",
    );
    expect(existsSync(completionPath)).toBe(false);
  }, 30000);

  it("fails completion inspection when the runway digest does not match", () => {
    const { runwayPath } = writeRunway("completion-sha-mismatch");
    const completionPath = artifactPath("completion-sha-mismatch.json");
    removeIfExists(completionPath);

    const record = recordCompletion(runwayPath, completionPath);
    expect(record.status, record.stderr).toBe(0);

    const runway = JSON.parse(readFileSync(runwayPath, "utf8"));
    writeJsonArtifact(runwayPath, {
      ...runway,
      operator_label: "Tampered Operator",
    });
    const inspect = run("scripts/inspect-admin-demo-onboarding-completion.mjs", {
      OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH: completionPath,
    });
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Runway SHA256 does not match");
  });

  it("fails completion inspection when a required blocked gate is missing", () => {
    const { runwayPath } = writeRunway("completion-missing-gate");
    const completionPath = artifactPath("completion-missing-gate.json");
    removeIfExists(completionPath);
    const record = recordCompletion(runwayPath, completionPath);
    expect(record.status, record.stderr).toBe(0);

    const completion = JSON.parse(readFileSync(completionPath, "utf8"));
    writeJsonArtifact(completionPath, {
      ...completion,
      blocked_gates: completion.blocked_gates.filter(
        (gate) => gate !== "Billing, POS, access control, member-ledger writes",
      ),
    });
    const inspect = run("scripts/inspect-admin-demo-onboarding-completion.mjs", {
      OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH: completionPath,
    });
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "completion blocked gates missing Billing, POS, access control, member-ledger writes",
    );
  });

  it("prepares and inspects customer demo gate packet from completion", () => {
    const { runwayPath } = writeRunway("customer-demo-gate-happy");
    const completionPath = artifactPath("customer-demo-gate-completion.json");
    const packetPath = artifactPath("customer-demo-gate-packet.json");
    removeIfExists(completionPath);
    removeIfExists(packetPath);
    const record = recordCompletion(runwayPath, completionPath);
    expect(record.status, record.stderr).toBe(0);

    const packet = run("scripts/prepare-admin-customer-demo-gate-packet.mjs", {
      OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH: completionPath,
      OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_OPERATOR: "Gate Operator",
      OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_WINDOW: "owner demo next week",
    });
    expect(packet.status, packet.stderr).toBe(0);
    expect(packet.stdout).toContain("Admin customer demo gate packet prepared.");

    const artifact = JSON.parse(readFileSync(packetPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_customer_demo_gate_packet",
      status: "admin_customer_demo_gate_packet_prepared",
      demo_onboarding_completion_path: completionPath,
      demo_onboarding_completion_sha256: sha(completionPath),
      customer_observed_completion_recorded: false,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(artifact.next_two_slices.map((slice) => slice.id)).toEqual([
      "limited_operator_assisted_beta_onboarding",
      "public_self_serve_preflight",
    ]);

    const inspect = run("scripts/inspect-admin-customer-demo-gate-packet.mjs", {
      OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH: packetPath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain(
      "Admin customer demo gate packet inspection passed.",
    );
  });

  it("fails customer demo gate packet inspection when completion digest changes", () => {
    const { runwayPath } = writeRunway("customer-demo-gate-sha");
    const completionPath = artifactPath("customer-demo-gate-sha-completion.json");
    const packetPath = artifactPath("customer-demo-gate-sha-packet.json");
    removeIfExists(completionPath);
    removeIfExists(packetPath);
    const record = recordCompletion(runwayPath, completionPath);
    expect(record.status, record.stderr).toBe(0);

    const packet = run("scripts/prepare-admin-customer-demo-gate-packet.mjs", {
      OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH: completionPath,
      OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH: packetPath,
    });
    expect(packet.status, packet.stderr).toBe(0);

    const completion = JSON.parse(readFileSync(completionPath, "utf8"));
    writeJsonArtifact(completionPath, {
      ...completion,
      completion_operator_label: "Tampered Completion Operator",
    });
    const inspect = run("scripts/inspect-admin-customer-demo-gate-packet.mjs", {
      OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH: packetPath,
    });
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Completion SHA256 does not match");
  });

  it("fails customer demo gate packet inspection when a required blocked gate is missing", () => {
    const { runwayPath } = writeRunway("customer-demo-gate-missing-gate");
    const completionPath = artifactPath(
      "customer-demo-gate-missing-gate-completion.json",
    );
    const packetPath = artifactPath("customer-demo-gate-missing-gate-packet.json");
    removeIfExists(completionPath);
    removeIfExists(packetPath);
    const record = recordCompletion(runwayPath, completionPath);
    expect(record.status, record.stderr).toBe(0);

    const packet = run("scripts/prepare-admin-customer-demo-gate-packet.mjs", {
      OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH: completionPath,
      OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH: packetPath,
    });
    expect(packet.status, packet.stderr).toBe(0);

    const artifact = JSON.parse(readFileSync(packetPath, "utf8"));
    writeJsonArtifact(packetPath, {
      ...artifact,
      blocked_gates: artifact.blocked_gates.filter(
        (gate) => gate !== "Phone/email provider activation",
      ),
    });
    const inspect = run("scripts/inspect-admin-customer-demo-gate-packet.mjs", {
      OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH: packetPath,
    });
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain(
      "packet blocked gates missing Phone/email provider activation",
    );
  });
});
