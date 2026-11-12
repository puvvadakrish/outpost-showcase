import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { founderAdminCustomerHandoffGatePreflight } from "../src/domain/founder-admin-readiness";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminComponent = readFileSync(
  "src/components/founder-admin/FounderAdminReadinessConsole.tsx",
  "utf8",
);

function run(script, env = {}) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function artifactPath(name) {
  const dir = "artifacts/admin-customer-handoff-gate-preflight-tests";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return `${dir}/${name}`;
}

function removeIfExists(path) {
  rmSync(path, { force: true, recursive: true });
}

function writeJsonArtifact(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
}

function validProtectedPreviewWalkthrough(overrides = {}) {
  return {
    artifact_kind: "admin_protected_preview_walkthrough",
    status: "admin_protected_preview_walkthrough_recorded",
    generated_at: "2026-06-29T12:00:00.000Z",
    evidence_basis: "admin_continuous_readiness_batch",
    continuous_readiness_batch_path:
      "artifacts/admin-customer-handoff-gate-preflight-tests/continuous.json",
    continuous_readiness_batch_sha256: "a".repeat(64),
    protected_preview_url: "https://outpost-preview.example.vercel.app",
    hosted_neon_branch: "outpost-beta-access-scoped-proof",
    reviewed_owner_email: "owner@proof.example",
    staff_email: "coach@proof.example",
    operator_label: "Krish",
    internal_protected_preview_walkthrough_recorded: true,
    ready_to_schedule_customer_observed_handoff: true,
    customer_observed_completion_recorded: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    observations: {
      admin_portal_observed: true,
      billing_pos_member_writes_blocked: true,
      invite_delivery_blocked: true,
      live_provider_claims_blocked: true,
      owner_workspace_observed: true,
      public_self_serve_blocked: true,
      reset_rollback_reviewed: true,
      staff_workboard_observed: true,
      unexpected_data_not_observed: true,
    },
    blocked_gates: [
      "Customer-observed completion claim",
      "Public owner self-signup",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone/email provider activation",
      "Product Auth admin API",
      "Automatic owner/staff grants",
      "Billing, POS, access control, member-ledger writes",
    ],
    ...overrides,
  };
}

function validSchedulingBatch(overrides = {}) {
  return {
    artifact_kind: "admin_customer_handoff_scheduling_batch",
    status: "admin_customer_handoff_scheduling_batch_prepared",
    generated_at: "2026-06-29T12:00:00.000Z",
    evidence_basis: "admin_protected_preview_walkthrough",
    protected_preview_walkthrough_path:
      "artifacts/admin-customer-handoff-gate-preflight-tests/walkthrough.json",
    protected_preview_walkthrough_sha256: "a".repeat(64),
    protected_preview_url: "https://outpost-preview.example.vercel.app",
    hosted_neon_branch: "outpost-beta-access-scoped-proof",
    gym_name: "Example Gym",
    owner_email: "owner@proof.example",
    owner_label: "Owner",
    staff_email: "coach@proof.example",
    operator_label: "Krish",
    support_window: "Saturday 10 AM",
    customer_handoff_scheduling_ready: true,
    customer_observed_completion_recorded: false,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    automatic_owner_staff_grants_allowed: false,
    billing_pos_member_writes_allowed: false,
    customer_session_agenda: [
      "Confirm protected Preview URL expected gym tenant with owner.",
      "Walk through the owner workspace and current beta readiness state.",
      "Walk through staff workboard owner-to-staff handoff path.",
      "Review reset/rollback checklist before after session.",
      "Confirm no unexpected data, live-provider claims, invite delivery, billing, POS, access control, or member-ledger writes are present.",
    ],
    support_checklist: [
      "Use operator-managed access details shared outside artifact.",
      "Stop handoff if owner sees unexpected tenant data or live-provider claims.",
      "Do not record customer-observed completion until the owner completes the session.",
      "Retain reset/rollback path before reusing hosted proof branch.",
    ],
    blocked_gates: [
      "Customer-observed completion claim",
      "Public owner self-signup",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone/email provider activation",
      "Product Auth admin API",
      "Automatic owner/staff grants",
      "Billing, POS, access control, member-ledger writes",
    ],
    replay_commands: [
      "npm run admin:preview-walkthrough:inspect",
      "npm run admin:customer-handoff:schedule:inspect",
    ],
    ...overrides,
  };
}

function writeSchedulingWithParent(schedulingPath) {
  const walkthroughPath = artifactPath(`walkthrough-${schedulingPath.split("/").pop()}`);
  removeIfExists(walkthroughPath);
  writeJsonArtifact(walkthroughPath, validProtectedPreviewWalkthrough());
  writeJsonArtifact(
    schedulingPath,
    validSchedulingBatch({
      protected_preview_walkthrough_path: walkthroughPath,
      protected_preview_walkthrough_sha256: sha256File(walkthroughPath),
    }),
  );
}

function customerObservationEnv() {
  return {
    OUTPOST_ADMIN_CUSTOMER_SESSION_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_INVITE_DELIVERY_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_OPERATOR: "Krish",
    OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_WORKSPACE_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_PREVIEW_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_RESET_ROLLBACK_REVIEWED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_STAFF_HANDOFF_OBSERVED: "yes",
    OUTPOST_ADMIN_CUSTOMER_SESSION_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
  };
}

describe("admin customer handoff gate preflight", () => {
  it("prepares and inspects a non-secret gate preflight from customer scheduling batch", () => {
    const schedulingPath = artifactPath("customer-handoff-scheduling.json");
    const preflightPath = artifactPath("customer-handoff-gate-preflight.json");
    for (const path of [schedulingPath, preflightPath]) removeIfExists(path);
    writeJsonArtifact(schedulingPath, validSchedulingBatch());

    const prepare = run("scripts/prepare-admin-customer-handoff-gate-preflight.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: preflightPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
    });
    expect(prepare.status, prepare.stderr).toBe(0);
    expect(prepare.stdout).toContain("Customer gate preflight: ready");
    expect(prepare.stdout).toContain("Customer-observed completion: not recorded");

    const inspect = run("scripts/inspect-admin-customer-handoff-gate-preflight.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: preflightPath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain("Admin customer handoff gate preflight OK");

    const artifact = JSON.parse(readFileSync(preflightPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_customer_handoff_gate_preflight",
      customer_handoff_gate_preflight_ready: true,
      customer_observed_completion_recorded: false,
      customer_observed_handoff_claimed: false,
      customer_session_recording_allowed_without_owner: false,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      product_auth_admin_api_allowed: false,
      automatic_owner_staff_grants_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(artifact.required_customer_observations).toContain("owner_present");
    expect(artifact.record_command_template).toContain("npm run admin:customer-session:record");
    expect(artifact.next_batches).toHaveLength(5);
  });

  it("fails closed on unsafe scheduling parent, existing output, and tampered parent SHA", () => {
    const unsafeSchedulingPath = artifactPath("unsafe-scheduling.json");
    const unsafePreflightPath = artifactPath("unsafe-preflight.json");
    for (const path of [unsafeSchedulingPath, unsafePreflightPath]) removeIfExists(path);
    writeJsonArtifact(
      unsafeSchedulingPath,
      validSchedulingBatch({ hosted_neon_branch: "production" }),
    );

    const unsafe = run("scripts/prepare-admin-customer-handoff-gate-preflight.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: unsafePreflightPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: unsafeSchedulingPath,
    });
    expect(unsafe.status).not.toBe(0);
    expect(unsafe.stderr).toContain("must not target production branch");

    const schedulingPath = artifactPath("tamper-scheduling.json");
    const preflightPath = artifactPath("tamper-preflight.json");
    for (const path of [schedulingPath, preflightPath]) removeIfExists(path);
    writeJsonArtifact(schedulingPath, validSchedulingBatch());
    const prepare = run("scripts/prepare-admin-customer-handoff-gate-preflight.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: preflightPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
    });
    expect(prepare.status, prepare.stderr).toBe(0);

    const existing = run("scripts/prepare-admin-customer-handoff-gate-preflight.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: preflightPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
    });
    expect(existing.status).not.toBe(0);
    expect(existing.stderr).toContain("already exists");

    writeJsonArtifact(schedulingPath, validSchedulingBatch({ owner_email: "changed@proof.example" }));
    const tamper = run("scripts/inspect-admin-customer-handoff-gate-preflight.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: preflightPath,
    });
    expect(tamper.status).not.toBe(0);
    expect(tamper.stderr).toContain("parent SHA mismatch");
  });

  it("lets the customer-session recorder consume the new scheduling batch only with owner confirmations", () => {
    const schedulingPath = artifactPath("session-scheduling.json");
    const recordPath = artifactPath("customer-session-record.json");
    for (const path of [schedulingPath, recordPath]) removeIfExists(path);
    writeSchedulingWithParent(schedulingPath);

    const missingOwner = run("scripts/record-admin-customer-observed-session.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: schedulingPath,
      ...customerObservationEnv(),
      OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT: "",
    });
    expect(missingOwner.status).not.toBe(0);
    expect(missingOwner.stderr).toContain("OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT must be yes");

    const record = run("scripts/record-admin-customer-observed-session.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
      OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH: schedulingPath,
      ...customerObservationEnv(),
    });
    expect(record.status, record.stderr).toBe(0);
    expect(record.stdout).toContain("Customer-observed handoff: recorded");

    const inspect = run("scripts/inspect-admin-customer-observed-session.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain("Admin customer-observed session inspection passed");

    const artifact = JSON.parse(readFileSync(recordPath, "utf8"));
    expect(artifact.evidence_basis).toBe("admin_customer_handoff_scheduling_batch");
    expect(artifact.customer_observed_session_recorded).toBe(true);
    expect(artifact.public_self_serve_launch_allowed).toBe(false);
  });

  it("surfaces the preflight batch in Admin readiness copy", () => {
    expect(packageJson).toContain("admin:customer-handoff:gate-preflight");
    expect(packageJson).toContain("admin:customer-handoff:gate-preflight:inspect");
    expect(founderAdminComponent).toContain("founderAdminCustomerHandoffGatePreflight");
    expect(founderAdminComponent).toContain("Customer handoff gate preflight");

    const packet = founderAdminCustomerHandoffGatePreflight({
      branchName: "outpost-beta-access-scoped-proof",
      previewUrl: "https://outpost-preview.example.vercel.app",
    });
    expect(packet.title).toBe("Customer handoff gate preflight");
    expect(packet.commands[0]?.command).toContain("admin:customer-handoff:gate-preflight");
    expect(packet.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Customer observed completion",
          state: "blocked",
        }),
      ]),
    );
    expect(packet.nextReadinessBatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "customer_observed_handoff_gate",
          state: "pending",
        }),
      ]),
    );
  });
});
