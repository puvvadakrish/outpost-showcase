import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { founderAdminCustomerSessionHostedImportReadiness } from "../src/domain/founder-admin-readiness";

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
  const dir = "artifacts/admin-customer-session-hosted-import-readiness-tests";
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
      "artifacts/admin-customer-session-hosted-import-readiness-tests/continuous.json",
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

function validSchedulingBatch(walkthroughPath, overrides = {}) {
  return {
    artifact_kind: "admin_customer_handoff_scheduling_batch",
    status: "admin_customer_handoff_scheduling_batch_prepared",
    generated_at: "2026-06-29T12:05:00.000Z",
    evidence_basis: "admin_protected_preview_walkthrough",
    protected_preview_walkthrough_path: walkthroughPath,
    protected_preview_walkthrough_sha256: sha256File(walkthroughPath),
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

function writeGatePreflightChain(label = "proof", overrides = {}) {
  const walkthroughPath = artifactPath(`${label}-walkthrough.json`);
  const schedulingPath = artifactPath(`${label}-scheduling.json`);
  const gatePreflightPath = artifactPath(`${label}-gate-preflight.json`);
  const importReadinessPath = artifactPath(`${label}-hosted-import-readiness.json`);
  for (const path of [walkthroughPath, schedulingPath, gatePreflightPath, importReadinessPath]) {
    removeIfExists(path);
  }
  writeJsonArtifact(walkthroughPath, validProtectedPreviewWalkthrough());
  writeJsonArtifact(schedulingPath, validSchedulingBatch(walkthroughPath, overrides.scheduling));
  const gate = run("scripts/prepare-admin-customer-handoff-gate-preflight.mjs", {
    OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: gatePreflightPath,
    OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
  });
  expect(gate.status, gate.stderr).toBe(0);
  return { gatePreflightPath, importReadinessPath, schedulingPath, walkthroughPath };
}

describe("admin customer session hosted import readiness", () => {
  it("prepares and inspects hosted import readiness from customer handoff gate preflight", () => {
    const { gatePreflightPath, importReadinessPath } = writeGatePreflightChain("happy");

    const prepare = run("scripts/prepare-admin-customer-session-hosted-import-readiness.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: gatePreflightPath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: importReadinessPath,
    });
    expect(prepare.status, prepare.stderr).toBe(0);
    expect(prepare.stdout).toContain("Hosted customer-session import: blocked until record exists");

    const inspect = run("scripts/inspect-admin-customer-session-hosted-import-readiness.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: importReadinessPath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain("Admin customer session hosted import readiness OK");

    const artifact = JSON.parse(readFileSync(importReadinessPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_customer_session_hosted_import_readiness",
      customer_session_hosted_import_readiness_ready: true,
      customer_session_record_required: true,
      hosted_customer_session_import_allowed_without_record: false,
      hosted_customer_session_proof_allowed_without_record: false,
      customer_observed_completion_recorded: false,
      customer_observed_handoff_claimed: false,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      product_auth_admin_api_allowed: false,
      automatic_owner_staff_grants_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(artifact.required_record_steps).toEqual([
      "admin:customer-session:record",
      "admin:customer-session:inspect",
      "admin:customer-session:record-hosted",
      "hosted:customer-session-record:proof",
    ]);
    expect(artifact.next_batches).toHaveLength(5);
  });

  it("fails closed on unsafe parent, existing output, secret notes, and tampered parent SHA", () => {
    const unsafe = writeGatePreflightChain("unsafe", {
      scheduling: { hosted_neon_branch: "outpost-beta-access-scoped-proof" },
    });
    const unsafePreflight = JSON.parse(readFileSync(unsafe.gatePreflightPath, "utf8"));
    writeJsonArtifact(unsafe.gatePreflightPath, {
      ...unsafePreflight,
      live_provider_enablement_allowed: true,
    });
    const unsafePrepare = run("scripts/prepare-admin-customer-session-hosted-import-readiness.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: unsafe.gatePreflightPath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: unsafe.importReadinessPath,
    });
    expect(unsafePrepare.status).not.toBe(0);
    expect(unsafePrepare.stderr).toContain("preflight inspection failed");

    const { gatePreflightPath, importReadinessPath } = writeGatePreflightChain("tamper");
    const secret = run("scripts/prepare-admin-customer-session-hosted-import-readiness.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: gatePreflightPath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_NOTES: "password: nope",
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: importReadinessPath,
    });
    expect(secret.status).not.toBe(0);
    expect(secret.stderr).toContain(
      "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_NOTES contains secret-shaped value",
    );

    const prepare = run("scripts/prepare-admin-customer-session-hosted-import-readiness.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: gatePreflightPath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: importReadinessPath,
    });
    expect(prepare.status, prepare.stderr).toBe(0);
    const existing = run("scripts/prepare-admin-customer-session-hosted-import-readiness.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: gatePreflightPath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: importReadinessPath,
    });
    expect(existing.status).not.toBe(0);
    expect(existing.stderr).toContain("already exists");

    const preflight = JSON.parse(readFileSync(gatePreflightPath, "utf8"));
    writeJsonArtifact(gatePreflightPath, {
      ...preflight,
      owner_email: "changed@proof.example",
    });
    const tamper = run("scripts/inspect-admin-customer-session-hosted-import-readiness.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: importReadinessPath,
    });
    expect(tamper.status).not.toBe(0);
    expect(tamper.stderr).toContain("preflight inspection failed");
  });

  it("surfaces hosted import readiness in Admin copy", () => {
    expect(packageJson).toContain("admin:customer-session:hosted-import-readiness");
    expect(packageJson).toContain("admin:customer-session:hosted-import-readiness:inspect");
    expect(founderAdminComponent).toContain("founderAdminCustomerSessionHostedImportReadiness");
    expect(founderAdminComponent).toContain("Hosted customer-session import readiness");

    const packet = founderAdminCustomerSessionHostedImportReadiness({
      branchName: "outpost-beta-access-scoped-proof",
      previewUrl: "https://outpost-preview.example.vercel.app",
    });
    expect(packet.title).toBe("Hosted customer-session import readiness");
    expect(packet.commands[0]?.command).toContain(
      "admin:customer-session:hosted-import-readiness",
    );
    expect(packet.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Customer session record",
          state: "blocked",
        }),
      ]),
    );
    expect(packet.nextReadinessBatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "hosted_customer_session_proof",
          state: "blocked",
        }),
      ]),
    );
  });
});
