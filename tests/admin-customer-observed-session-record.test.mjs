import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminDomain = readFileSync("src/domain/founder-admin-readiness.ts", "utf8");
const recordScript = readFileSync("scripts/record-admin-customer-observed-session.mjs", "utf8");
const inspectScript = readFileSync("scripts/inspect-admin-customer-observed-session.mjs", "utf8");

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
    public_self_serve_launch_allowed: false,
    customer_observed_handoff_claimed: false,
    source_import_automation_allowed: false,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    email_or_notification_allowed: false,
    live_provider_enablement_allowed: false,
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
      observed: { answer_review_staged: true }
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

function writeSchedulingPacket(prefix, packetOverrides = {}) {
  const { bundlePath } = writeLaunchEvidenceChain(prefix);
  const packetPath = artifactPath(`${prefix}-handoff-scheduling-packet.json`);
  removeIfExists(packetPath);
  const prepare = run("scripts/prepare-admin-handoff-scheduling-packet.mjs", {
    OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath,
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: packetPath,
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR: "Scheduling Operator",
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW: "next owner support session",
    OUTPOST_ADMIN_HANDOFF_SCHEDULING_OWNER_LABEL: "Proof Owner"
  });
  expect(prepare.status).toBe(0);

  if (Object.keys(packetOverrides).length > 0) {
    const packet = JSON.parse(readFileSync(packetPath, "utf8"));
    writeJsonArtifact(packetPath, { ...packet, ...packetOverrides });
  }

  return { packetPath };
}

function customerSessionEnv(packetPath, recordPath, overrides = {}) {
  return {
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
    OUTPOST_ADMIN_CUSTOMER_SESSION_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED: "yes",
    ...overrides
  };
}

describe("admin customer-observed session record", () => {
  it("wires customer session scripts and admin command copy without live-provider actions", () => {
    expect(packageJson).toContain("admin:customer-session:record");
    expect(packageJson).toContain("admin:customer-session:inspect");
    expect(founderAdminDomain).toContain("Record customer-observed session");
    expect(founderAdminDomain).toContain("Inspect customer-observed session");
    expect(recordScript).toContain("admin_customer_observed_session_record");
    expect(inspectScript).toContain("Customer-observed session must be recorded");
    expect(recordScript).not.toMatch(/sendEmail|sendInvite|bootstrap_owner_tenant|connect.*gmail/iu);
    expect(founderAdminDomain).not.toMatch(/sendEmail|sendInvite|bootstrap_owner_tenant|connect.*gmail/iu);
  });

  it("records and inspects an explicit customer-observed session from a scheduling packet", () => {
    const { packetPath } = writeSchedulingPacket("customer-session-happy");
    const recordPath = artifactPath("customer-session-happy-record.json");
    removeIfExists(recordPath);

    const record = run(
      "scripts/record-admin-customer-observed-session.mjs",
      customerSessionEnv(packetPath, recordPath)
    );
    expect(record.status).toBe(0);

    const inspect = run("scripts/inspect-admin-customer-observed-session.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath
    });
    expect(inspect.status).toBe(0);

    const artifact = JSON.parse(readFileSync(recordPath, "utf8"));
    expect(artifact.artifact_kind).toBe("admin_customer_observed_session_record");
    expect(artifact.handoff_scheduling_packet_sha256).toBe(sha(packetPath));
    expect(artifact.customer_observed_session_recorded).toBe(true);
    expect(artifact.customer_observed_handoff_claimed).toBe(true);
    expect(artifact.observed.protected_preview_observed).toBe(true);
    expect(artifact.public_self_serve_launch_allowed).toBe(false);
    expect(artifact.invite_delivery_allowed).toBe(false);
    expect(artifact.live_provider_enablement_allowed).toBe(false);
    expect(artifact.billing_pos_member_writes_allowed).toBe(false);
  });

  it("fails closed when a required observed confirmation is missing, path escapes, notes contain secrets, or output exists", () => {
    const { packetPath } = writeSchedulingPacket("customer-session-fail");
    const recordPath = artifactPath("customer-session-fail-record.json");
    removeIfExists(recordPath);

    const missingConfirmation = run(
      "scripts/record-admin-customer-observed-session.mjs",
      customerSessionEnv(packetPath, recordPath, {
        OUTPOST_ADMIN_CUSTOMER_SESSION_PREVIEW_OBSERVED: "no"
      })
    );
    expect(missingConfirmation.status).not.toBe(0);
    expect(missingConfirmation.stderr).toContain("OUTPOST_ADMIN_CUSTOMER_SESSION_PREVIEW_OBSERVED must be yes");

    const pathEscape = run(
      "scripts/record-admin-customer-observed-session.mjs",
      customerSessionEnv(packetPath, "../customer-session.json")
    );
    expect(pathEscape.status).not.toBe(0);
    expect(pathEscape.stderr).toContain("OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH must stay under artifacts/");

    const denormalizedPath = run(
      "scripts/record-admin-customer-observed-session.mjs",
      customerSessionEnv(packetPath, "artifacts/admin-launch-readiness/sub/../customer-session-denormalized-record.json")
    );
    expect(denormalizedPath.status).not.toBe(0);
    expect(denormalizedPath.stderr).toContain("OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH must be normalized");

    const secretNotes = run(
      "scripts/record-admin-customer-observed-session.mjs",
      customerSessionEnv(packetPath, recordPath, {
        OUTPOST_ADMIN_CUSTOMER_SESSION_NOTES: "token: abcdefghijklmnopqrstuvwxyz"
      })
    );
    expect(secretNotes.status).not.toBe(0);
    expect(secretNotes.stderr).toContain("OUTPOST_ADMIN_CUSTOMER_SESSION_NOTES contains secret-shaped value");

    const create = run("scripts/record-admin-customer-observed-session.mjs", customerSessionEnv(packetPath, recordPath));
    expect(create.status).toBe(0);
    const overwrite = run("scripts/record-admin-customer-observed-session.mjs", customerSessionEnv(packetPath, recordPath));
    expect(overwrite.status).not.toBe(0);
    expect(overwrite.stderr).toContain("OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH already exists");
  }, 15000);

  it("refuses unsafe scheduling packets before writing a customer session record", () => {
    const { packetPath } = writeSchedulingPacket("customer-session-unsafe-parent", {
      invite_delivery_allowed: true
    });
    const recordPath = artifactPath("customer-session-unsafe-parent-record.json");
    removeIfExists(recordPath);

    const record = run(
      "scripts/record-admin-customer-observed-session.mjs",
      customerSessionEnv(packetPath, recordPath)
    );
    expect(record.status).not.toBe(0);
    expect(record.stderr).toContain("Invite delivery must remain blocked");
    expect(existsSync(recordPath)).toBe(false);
  });

  it("inspect rejects forged records with stale parent hashes, unsafe gates, or missing observed checks", () => {
    const { packetPath } = writeSchedulingPacket("customer-session-forged");
    const goodRecordPath = artifactPath("customer-session-forged-good-record.json");
    removeIfExists(goodRecordPath);
    const record = run(
      "scripts/record-admin-customer-observed-session.mjs",
      customerSessionEnv(packetPath, goodRecordPath)
    );
    expect(record.status).toBe(0);
    const goodRecord = JSON.parse(readFileSync(goodRecordPath, "utf8"));

    const stalePath = artifactPath("customer-session-forged-stale-record.json");
    writeJsonArtifact(stalePath, {
      ...goodRecord,
      handoff_scheduling_packet_sha256: "a".repeat(64)
    });
    const staleInspect = run("scripts/inspect-admin-customer-observed-session.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: stalePath
    });
    expect(staleInspect.status).not.toBe(0);
    expect(staleInspect.stderr).toContain("Handoff scheduling packet SHA256 does not match");

    const denormalizedInspect = run("scripts/inspect-admin-customer-observed-session.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: `artifacts/admin-launch-readiness/sub/../${goodRecordPath.split("/").at(-1)}`
    });
    expect(denormalizedInspect.status).not.toBe(0);
    expect(denormalizedInspect.stderr).toContain("OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH must be normalized");

    const unsafePath = artifactPath("customer-session-forged-unsafe-record.json");
    writeJsonArtifact(unsafePath, {
      ...goodRecord,
      live_provider_enablement_allowed: true
    });
    const unsafeInspect = run("scripts/inspect-admin-customer-observed-session.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: unsafePath
    });
    expect(unsafeInspect.status).not.toBe(0);
    expect(unsafeInspect.stderr).toContain("Live providers must remain blocked");

    const missingObservedPath = artifactPath("customer-session-forged-missing-observed-record.json");
    writeJsonArtifact(missingObservedPath, {
      ...goodRecord,
      observed: {
        ...goodRecord.observed,
        owner_workspace_observed: false
      }
    });
    const missingObservedInspect = run("scripts/inspect-admin-customer-observed-session.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: missingObservedPath
    });
    expect(missingObservedInspect.status).not.toBe(0);
    expect(missingObservedInspect.stderr).toContain("Observed check owner_workspace_observed must be true");
  });
});
