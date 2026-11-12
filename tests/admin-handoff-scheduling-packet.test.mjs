import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminDomain = readFileSync("src/domain/founder-admin-readiness.ts", "utf8");
const prepareScript = readFileSync("scripts/prepare-admin-handoff-scheduling-packet.mjs", "utf8");
const inspectScript = readFileSync("scripts/inspect-admin-handoff-scheduling-packet.mjs", "utf8");

function run(script, env) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
}

function artifactPath(name) {
  mkdirSync("artifacts/admin-launch-readiness", { recursive: true });
  return `artifacts/admin-launch-readiness/${name}`;
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
  "provider_webhooks"
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
  "pos_access_control_member_ledger_writes"
];

function writeLaunchEvidenceChain(prefix, bundleOverrides = {}) {
  const sourceParentPath = artifactPath(`${prefix}-source-parent.json`);
  const emailParentPath = artifactPath(`${prefix}-email-parent.json`);
  const sourceCompletionPath = artifactPath(`${prefix}-source-completion.json`);
  const emailCompletionPath = artifactPath(`${prefix}-email-completion.json`);
  const bundlePath = artifactPath(`${prefix}-launch-evidence-bundle.json`);
  writeJsonArtifact(sourceParentPath, {
    artifact_kind: "admin_source_apply_rehearsal",
    status: "source_apply_rehearsal_prepared",
    blocked_gates: sourceGates
  });
  writeJsonArtifact(emailParentPath, {
    artifact_kind: "admin_email_task_rehearsal",
    status: "email_task_rehearsal_prepared",
    blocked_gates: emailGates
  });
  writeJsonArtifact(sourceCompletionPath, {
    artifact_kind: "admin_source_apply_completion",
    status: "source_apply_completion_recorded",
    gym_name: "Proof Gym",
    owner_email: "owner@example.com",
    source_label: "Reviewed source",
    location_label: "Front desk",
    source_apply_rehearsal_path: sourceParentPath,
    source_apply_rehearsal_sha256: sha(sourceParentPath),
    observed: {
      owner_workspace_observed: true,
      manual_source_saved: true,
      answer_review_staged: true,
      automatic_approval_not_observed: true,
      live_provider_copy_blocked: true
    },
    existing_owner_manual_intake_allowed: true,
    artifact_runtime_write_allowed: false,
    source_import_automation_allowed: false,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    email_or_notification_allowed: false,
    live_provider_enablement_allowed: false,
    public_self_serve_launch_allowed: false,
    customer_observed_handoff_claimed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: sourceGates
  });
  writeJsonArtifact(emailCompletionPath, {
    artifact_kind: "admin_email_task_completion",
    status: "email_task_completion_recorded",
    gym_name: "Proof Gym",
    owner_email: "owner@example.com",
    mailbox_label: "front-desk",
    triage_category: "membership-freeze",
    email_task_rehearsal_path: emailParentPath,
    email_task_rehearsal_sha256: sha(emailParentPath),
    observed: {
      owner_review_observed: true,
      manual_task_decision_observed: true,
      email_ingress_not_observed: true,
      outbound_delivery_not_observed: true,
      notification_not_observed: true,
      live_provider_copy_blocked: true
    },
    existing_manual_task_entry_allowed: true,
    artifact_runtime_write_allowed: false,
    automatic_task_creation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    public_self_serve_launch_allowed: false,
    customer_observed_handoff_claimed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: emailGates
  });
  writeJsonArtifact(bundlePath, {
    artifact_kind: "admin_launch_evidence_bundle",
    status: "admin_launch_evidence_bundle_prepared",
    evidence_basis: "operator_observed_source_apply_and_email_task_completion_records",
    source_apply_completion_path: sourceCompletionPath,
    source_apply_completion_sha256: sha(sourceCompletionPath),
    email_task_completion_path: emailCompletionPath,
    email_task_completion_sha256: sha(emailCompletionPath),
    gym_name: "Proof Gym",
    owner_email: "owner@example.com",
    source_evidence: {
      source_label: "Reviewed source",
      location_label: "Front desk",
      observed: { manual_source_saved: true }
    },
    email_evidence: {
      mailbox_label: "front-desk",
      triage_category: "membership-freeze",
      observed: { manual_task_decision_observed: true }
    },
    operator_evidence_ready: true,
    public_self_serve_launch_allowed: false,
    customer_observed_handoff_claimed: false,
    source_import_automation_allowed: false,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    ready_gates: [
      "Operator-observed source apply completion",
      "Operator-observed email task completion",
      "Parent artifact SHA chain"
    ],
    blocked_gates: [
      "Public self-serve launch",
      "Customer-observed handoff claim",
      "Inbound email, outbound delivery, and notifications",
      "Billing, POS, access control, and member-ledger writes"
    ],
    command_sequence: ["npm run admin:launch-evidence:inspect"],
    ...bundleOverrides
  });
  return { bundlePath };
}

describe("admin handoff scheduling packet", () => {
  it("wires handoff scheduling packet scripts and admin command copy", () => {
    expect(packageJson).toContain("admin:handoff-scheduling:packet");
    expect(packageJson).toContain("admin:handoff-scheduling:inspect");
    expect(founderAdminDomain).toContain("Prepare handoff scheduling packet");
    expect(founderAdminDomain).toContain("Inspect handoff scheduling packet");
    expect(prepareScript).toContain("admin_handoff_scheduling_packet");
    expect(inspectScript).toContain("Customer-observed handoff must remain pending");
    expect(prepareScript).not.toMatch(/sendEmail|sendInvite|bootstrap_owner_tenant|record.*completion/iu);
  });

  it("prepares and inspects a customer-safe scheduling packet from launch evidence", () => {
    const { bundlePath } = writeLaunchEvidenceChain("handoff-scheduling-happy");
    const packetPath = artifactPath("handoff-scheduling-happy-packet.json");
    removeIfExists(packetPath);
    const prepare = run("scripts/prepare-admin-handoff-scheduling-packet.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR: "Operator",
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW: "next available owner session",
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_OWNER_LABEL: "Proof Owner"
    });
    expect(prepare.status).toBe(0);
    const inspect = run("scripts/inspect-admin-handoff-scheduling-packet.mjs", {
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath
    });
    expect(inspect.status).toBe(0);
    const packet = JSON.parse(readFileSync(packetPath, "utf8"));
    expect(packet.artifact_kind).toBe("admin_handoff_scheduling_packet");
    expect(packet.launch_evidence_bundle_sha256).toBe(sha(bundlePath));
    expect(packet.handoff_scheduling_ready).toBe(true);
    expect(packet.customer_observed_handoff_claimed).toBe(false);
    expect(packet.invite_delivery_allowed).toBe(false);
  });

  it("fails closed for unsafe launch evidence, path escape, secret-shaped notes, and overwrite", () => {
    const { bundlePath } = writeLaunchEvidenceChain("handoff-scheduling-fail", {
      customer_observed_handoff_claimed: true
    });
    const packetPath = artifactPath("handoff-scheduling-fail-packet.json");
    removeIfExists(packetPath);
    const unsafeBundle = run("scripts/prepare-admin-handoff-scheduling-packet.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR: "Operator",
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW: "window"
    });
    expect(unsafeBundle.status).not.toBe(0);

    const valid = writeLaunchEvidenceChain("handoff-scheduling-overwrite").bundlePath;
    const pathEscape = run("scripts/prepare-admin-handoff-scheduling-packet.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: "../bundle.json",
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR: "Operator",
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW: "window"
    });
    expect(pathEscape.status).not.toBe(0);

    const secret = run("scripts/prepare-admin-handoff-scheduling-packet.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: valid,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR: "Operator",
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW: "window",
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_NOTES: "token: abcdefghijklmnop"
    });
    expect(secret.status).not.toBe(0);

    const created = run("scripts/prepare-admin-handoff-scheduling-packet.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: valid,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR: "Operator",
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW: "window"
    });
    expect(created.status).toBe(0);

    const overwrite = run("scripts/prepare-admin-handoff-scheduling-packet.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: valid,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR: "Operator",
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW: "window"
    });
    expect(overwrite.status).not.toBe(0);
  });

  it("inspect rejects forged packets that claim completion, invite delivery, or stale bundle hash", () => {
    const { bundlePath } = writeLaunchEvidenceChain("handoff-scheduling-forged");
    const packetPath = artifactPath("handoff-scheduling-forged-packet.json");
    writeJsonArtifact(packetPath, {
      artifact_kind: "admin_handoff_scheduling_packet",
      status: "admin_handoff_scheduling_packet_prepared",
      evidence_basis: "admin_launch_evidence_bundle",
      launch_evidence_bundle_path: bundlePath,
      launch_evidence_bundle_sha256: "a".repeat(64),
      gym_name: "Proof Gym",
      owner_email: "owner@example.com",
      operator_label: "Operator",
      support_window: "window",
      customer_session_agenda: [
        "Confirm protected Preview workspace is the expected gym tenant.",
        "Walk owner through manual source facts saved from operator-reviewed source evidence.",
        "Walk owner through answer review and staff task handoff evidence.",
        "Confirm owner sees no unexpected tenant data, provider activation, or live-delivery claims.",
        "Decide whether to schedule a real customer-observed completion gate or stop for reset/rollback."
      ],
      support_checklist: [
        "Use operator-managed credentials shared outside this artifact.",
        "Keep customer-observed completion pending until the owner observes the protected Preview flow.",
        "Stop if customer reports unexpected data, provider claims, billing/POS/member-ledger claims, or account-access confusion.",
        "Use reset/rollback runbook before any new proof branch reuse."
      ],
      operator_evidence_ready: true,
      handoff_scheduling_ready: true,
      customer_observed_handoff_claimed: true,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: true,
      source_import_automation_allowed: false,
      automatic_answer_approval_allowed: false,
      automatic_task_generation_allowed: false,
      email_ingress_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      blocked_gates: [
        "Customer-observed handoff claim",
        "Invite delivery",
        "Inbound email, outbound delivery, and notifications"
      ],
      command_sequence: ["npm run admin:handoff-scheduling:inspect"]
    });

    const inspect = run("scripts/inspect-admin-handoff-scheduling-packet.mjs", {
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath
    });
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Customer-observed handoff must remain pending");
  });

  it("inspect rejects forged packets that allow invite delivery", () => {
    const { bundlePath } = writeLaunchEvidenceChain("handoff-scheduling-invite-forged");
    const packetPath = artifactPath("handoff-scheduling-invite-forged-packet.json");
    writeJsonArtifact(packetPath, {
      artifact_kind: "admin_handoff_scheduling_packet",
      status: "admin_handoff_scheduling_packet_prepared",
      evidence_basis: "admin_launch_evidence_bundle",
      launch_evidence_bundle_path: bundlePath,
      launch_evidence_bundle_sha256: sha(bundlePath),
      gym_name: "Proof Gym",
      owner_email: "owner@example.com",
      operator_label: "Operator",
      support_window: "window",
      customer_session_agenda: [
        "Confirm protected Preview workspace is the expected gym tenant.",
        "Walk owner through manual source facts saved from operator-reviewed source evidence.",
        "Walk owner through answer review and staff task handoff evidence.",
        "Confirm owner sees no unexpected tenant data, provider activation, or live-delivery claims.",
        "Decide whether to schedule a real customer-observed completion gate or stop for reset/rollback."
      ],
      support_checklist: [
        "Use operator-managed credentials shared outside this artifact.",
        "Keep customer-observed completion pending until the owner observes the protected Preview flow.",
        "Stop if customer reports unexpected data, provider claims, billing/POS/member-ledger claims, or account-access confusion.",
        "Use reset/rollback runbook before any new proof branch reuse."
      ],
      operator_evidence_ready: true,
      handoff_scheduling_ready: true,
      customer_observed_handoff_claimed: false,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: true,
      source_import_automation_allowed: false,
      automatic_answer_approval_allowed: false,
      automatic_task_generation_allowed: false,
      email_ingress_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      blocked_gates: [
        "Customer-observed handoff claim",
        "Invite delivery",
        "Inbound email, outbound delivery, and notifications"
      ],
      command_sequence: ["npm run admin:handoff-scheduling:inspect"]
    });

    const inspect = run("scripts/inspect-admin-handoff-scheduling-packet.mjs", {
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath
    });
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Invite delivery must remain blocked");
  });

  it("inspect rejects a stale launch evidence hash even when scheduling gates remain blocked", () => {
    const { bundlePath } = writeLaunchEvidenceChain("handoff-scheduling-stale-hash");
    const packetPath = artifactPath("handoff-scheduling-stale-hash-packet.json");
    writeJsonArtifact(packetPath, {
      artifact_kind: "admin_handoff_scheduling_packet",
      status: "admin_handoff_scheduling_packet_prepared",
      evidence_basis: "admin_launch_evidence_bundle",
      launch_evidence_bundle_path: bundlePath,
      launch_evidence_bundle_sha256: "b".repeat(64),
      gym_name: "Proof Gym",
      owner_email: "owner@example.com",
      operator_label: "Operator",
      support_window: "window",
      customer_session_agenda: [
        "Confirm protected Preview workspace is the expected gym tenant.",
        "Walk owner through manual source facts saved from operator-reviewed source evidence.",
        "Walk owner through answer review and staff task handoff evidence.",
        "Confirm owner sees no unexpected tenant data, provider activation, or live-delivery claims.",
        "Decide whether to schedule a real customer-observed completion gate or stop for reset/rollback."
      ],
      support_checklist: [
        "Use operator-managed credentials shared outside this artifact.",
        "Keep customer-observed completion pending until the owner observes the protected Preview flow.",
        "Stop if customer reports unexpected data, provider claims, billing/POS/member-ledger claims, or account-access confusion.",
        "Use reset/rollback runbook before any new proof branch reuse."
      ],
      operator_evidence_ready: true,
      handoff_scheduling_ready: true,
      customer_observed_handoff_claimed: false,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      source_import_automation_allowed: false,
      automatic_answer_approval_allowed: false,
      automatic_task_generation_allowed: false,
      email_ingress_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      blocked_gates: [
        "Customer-observed handoff claim",
        "Invite delivery",
        "Inbound email, outbound delivery, and notifications"
      ],
      command_sequence: ["npm run admin:handoff-scheduling:inspect"]
    });

    const inspect = run("scripts/inspect-admin-handoff-scheduling-packet.mjs", {
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath
    });
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("Launch evidence bundle SHA256 does not match");
  });

  it("prepare rejects launch evidence missing customer subject fields", () => {
    const { bundlePath } = writeLaunchEvidenceChain("handoff-scheduling-missing-subject", {
      gym_name: undefined
    });
    const packetPath = artifactPath("handoff-scheduling-missing-subject-packet.json");
    removeIfExists(packetPath);
    const prepare = run("scripts/prepare-admin-handoff-scheduling-packet.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR: "Operator",
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW: "window"
    });
    expect(prepare.status).not.toBe(0);
    expect(prepare.stderr).toContain("Launch evidence bundle gym name is required");

    const missingOwner = writeLaunchEvidenceChain("handoff-scheduling-missing-owner", {
      owner_email: undefined
    }).bundlePath;
    const missingOwnerPacketPath = artifactPath("handoff-scheduling-missing-owner-packet.json");
    removeIfExists(missingOwnerPacketPath);
    const ownerPrepare = run("scripts/prepare-admin-handoff-scheduling-packet.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: missingOwner,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: missingOwnerPacketPath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR: "Operator",
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW: "window"
    });
    expect(ownerPrepare.status).not.toBe(0);
    expect(ownerPrepare.stderr).toContain("Launch evidence bundle owner email is required");
  });
});
