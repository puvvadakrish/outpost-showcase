import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { founderAdminLimitedBetaReadinessGate } from "../src/domain/founder-admin-readiness";

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
  const dir = "artifacts/admin-limited-beta-readiness-gate-tests";
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
      "artifacts/admin-limited-beta-readiness-gate-tests/continuous.json",
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

function writeImportReadinessChain(label = "proof") {
  const walkthroughPath = artifactPath(`${label}-walkthrough.json`);
  const schedulingPath = artifactPath(`${label}-scheduling.json`);
  const gatePreflightPath = artifactPath(`${label}-gate-preflight.json`);
  const importReadinessPath = artifactPath(`${label}-import-readiness.json`);
  const limitedBetaGatePath = artifactPath(`${label}-limited-beta-readiness.json`);
  for (const path of [
    walkthroughPath,
    schedulingPath,
    gatePreflightPath,
    importReadinessPath,
    limitedBetaGatePath,
  ]) {
    removeIfExists(path);
  }
  writeJsonArtifact(walkthroughPath, validProtectedPreviewWalkthrough());
  writeJsonArtifact(schedulingPath, validSchedulingBatch(walkthroughPath));
  const gatePreflight = run("scripts/prepare-admin-customer-handoff-gate-preflight.mjs", {
    OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: gatePreflightPath,
    OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
  });
  expect(gatePreflight.status, gatePreflight.stderr).toBe(0);
  const importReadiness = run(
    "scripts/prepare-admin-customer-session-hosted-import-readiness.mjs",
    {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH: gatePreflightPath,
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: importReadinessPath,
    },
  );
  expect(importReadiness.status, importReadiness.stderr).toBe(0);
  return { importReadinessPath, limitedBetaGatePath };
}

describe("admin limited beta readiness gate", () => {
  it("prepares and inspects a blocked limited beta readiness gate from hosted import readiness", () => {
    const { importReadinessPath, limitedBetaGatePath } = writeImportReadinessChain("happy");

    const prepare = run("scripts/prepare-admin-limited-beta-readiness-gate.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: importReadinessPath,
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: limitedBetaGatePath,
    });
    expect(prepare.status, prepare.stderr).toBe(0);
    expect(prepare.stdout).toContain("Limited beta onboarding: blocked until hosted customer-session proof exists");

    const inspect = run("scripts/inspect-admin-limited-beta-readiness-gate.mjs", {
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: limitedBetaGatePath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain("Admin limited beta readiness gate OK");

    const artifact = JSON.parse(readFileSync(limitedBetaGatePath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_limited_beta_readiness_gate",
      customer_session_proof_required: true,
      limited_beta_onboarding_allowed_without_customer_proof: false,
      public_self_serve_launch_allowed: false,
      browser_approval_buttons_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      product_auth_admin_api_allowed: false,
      automatic_owner_staff_grants_allowed: false,
      billing_pos_member_writes_allowed: false,
      operator_managed_access_only: true,
    });
    expect(artifact.beta_expansion_checklist).toHaveLength(5);
    expect(artifact.next_batches).toHaveLength(5);
  });

  it("fails closed on unsafe parent, secret notes, existing output, and tampered parent SHA", () => {
    const { importReadinessPath, limitedBetaGatePath } = writeImportReadinessChain("tamper");
    const unsafeParent = JSON.parse(readFileSync(importReadinessPath, "utf8"));
    writeJsonArtifact(importReadinessPath, {
      ...unsafeParent,
      live_provider_enablement_allowed: true,
    });
    const unsafe = run("scripts/prepare-admin-limited-beta-readiness-gate.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: importReadinessPath,
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: limitedBetaGatePath,
    });
    expect(unsafe.status).not.toBe(0);
    expect(unsafe.stderr).toContain("hosted import readiness inspection failed");

    const clean = writeImportReadinessChain("clean");
    const secret = run("scripts/prepare-admin-limited-beta-readiness-gate.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: clean.importReadinessPath,
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: clean.limitedBetaGatePath,
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_NOTES: "api_key=not-ok",
    });
    expect(secret.status).not.toBe(0);
    expect(secret.stderr).toContain("OUTPOST_ADMIN_LIMITED_BETA_READINESS_NOTES contains secret-shaped value");

    const prepare = run("scripts/prepare-admin-limited-beta-readiness-gate.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: clean.importReadinessPath,
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: clean.limitedBetaGatePath,
    });
    expect(prepare.status, prepare.stderr).toBe(0);
    const existing = run("scripts/prepare-admin-limited-beta-readiness-gate.mjs", {
      OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH: clean.importReadinessPath,
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: clean.limitedBetaGatePath,
    });
    expect(existing.status).not.toBe(0);
    expect(existing.stderr).toContain("already exists");

    const parent = JSON.parse(readFileSync(clean.importReadinessPath, "utf8"));
    writeJsonArtifact(clean.importReadinessPath, {
      ...parent,
      owner_email: "changed@proof.example",
    });
    const tamper = run("scripts/inspect-admin-limited-beta-readiness-gate.mjs", {
      OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH: clean.limitedBetaGatePath,
    });
    expect(tamper.status).not.toBe(0);
    expect(tamper.stderr).toContain("hosted import readiness inspection failed");
  }, 120000);

  it("surfaces limited beta readiness gate in Admin copy", () => {
    expect(packageJson).toContain("admin:limited-beta:readiness-gate");
    expect(packageJson).toContain("admin:limited-beta:readiness-gate:inspect");
    expect(founderAdminComponent).toContain("founderAdminLimitedBetaReadinessGate");
    expect(founderAdminComponent).toContain("Limited beta readiness gate");

    const packet = founderAdminLimitedBetaReadinessGate({
      branchName: "outpost-beta-access-scoped-proof",
      previewUrl: "https://outpost-preview.example.vercel.app",
    });
    expect(packet.title).toBe("Limited beta readiness gate");
    expect(packet.commands[0]?.command).toContain("admin:limited-beta:readiness-gate");
    expect(packet.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Customer proof prerequisite",
          state: "blocked",
        }),
      ]),
    );
    expect(packet.nextReadinessBatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "limited_operator_assisted_beta_onboarding",
          state: "blocked",
        }),
      ]),
    );
  });
});
