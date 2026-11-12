import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { founderAdminCustomerHandoffSchedulingBatch } from "../src/domain/founder-admin-readiness";

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
  const dir = "artifacts/admin-customer-handoff-scheduling-batch-tests";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return `${dir}/${name}`;
}

function removeIfExists(path) {
  rmSync(path, { force: true, recursive: true });
}

function writeJsonArtifact(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function validProtectedPreviewWalkthrough(overrides = {}) {
  return {
    artifact_kind: "admin_protected_preview_walkthrough",
    status: "admin_protected_preview_walkthrough_recorded",
    generated_at: "2026-06-28T12:00:00.000Z",
    evidence_basis: "admin_continuous_readiness_batch",
    continuous_readiness_batch_path:
      "artifacts/admin-customer-handoff-scheduling-batch-tests/continuous.json",
    continuous_readiness_batch_sha256: "a".repeat(64),
    protected_preview_url: "https://outpost-preview.example.vercel.app",
    hosted_neon_branch: "outpost-beta-access-scoped-proof",
    reviewed_owner_email: "owner@proof.example",
    staff_email: "coach@proof.example",
    operator_label: "operator-proof",
    walkthrough_window: "2026-06-28 10:00 CT",
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
      owner_workspace_observed: true,
      staff_workboard_observed: true,
      reset_rollback_reviewed: true,
      unexpected_data_not_observed: true,
      live_provider_claims_blocked: true,
      public_self_serve_blocked: true,
      invite_delivery_blocked: true,
      billing_pos_member_writes_blocked: true,
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
    replay_commands: [
      "npm run admin:readiness-batch:inspect",
      "npm run admin:preview-walkthrough:inspect",
    ],
    ...overrides,
  };
}

function schedulingEnv() {
  return {
    OUTPOST_ADMIN_CUSTOMER_HANDOFF_GYM_NAME: "Proof Gym",
    OUTPOST_ADMIN_CUSTOMER_HANDOFF_OPERATOR: "operator-proof",
    OUTPOST_ADMIN_CUSTOMER_HANDOFF_SUPPORT_WINDOW: "2026-07-01 10:00 CT",
    OUTPOST_ADMIN_CUSTOMER_HANDOFF_OWNER_LABEL: "Proof Owner",
  };
}

describe("admin customer handoff scheduling batch", () => {
  it("wires package scripts, domain packet, and Admin portal panel", () => {
    expect(packageJson).toContain("admin:customer-handoff:schedule");
    expect(packageJson).toContain("admin:customer-handoff:schedule:inspect");
    expect(founderAdminComponent).toContain(
      "founderAdminCustomerHandoffSchedulingBatch",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Customer handoff scheduling batch"',
    );

    const packet = founderAdminCustomerHandoffSchedulingBatch({
      branchName: "outpost-beta-access-scoped-proof",
      previewUrl: "https://outpost-preview.example.vercel.app",
    });
    expect(packet.title).toBe("Customer handoff scheduling batch");
    expect(packet.commands.map((step) => step.command).join("\n")).toContain(
      "npm run admin:customer-handoff:schedule",
    );
    expect(packet.commands.map((step) => step.command).join("\n")).toContain(
      "npm run admin:customer-handoff:schedule:inspect",
    );
    expect(packet.nextReadinessBatches).toHaveLength(4);
    expect(packet.nextReadinessBatches.map((slice) => slice.id)).toEqual([
      "customer_observed_handoff_gate",
      "limited_operator_assisted_beta_onboarding",
      "public_self_serve_preflight",
      "live_provider_revenue_gates",
    ]);
  });

  it("prepares and inspects customer handoff scheduling batch", () => {
    const walkthroughPath = artifactPath("protected-preview-walkthrough.json");
    const schedulingPath = artifactPath("customer-handoff-scheduling.json");
    for (const path of [walkthroughPath, schedulingPath]) removeIfExists(path);

    writeJsonArtifact(walkthroughPath, validProtectedPreviewWalkthrough());
    const prepare = run("scripts/prepare-admin-customer-handoff-scheduling-batch.mjs", {
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
      ...schedulingEnv(),
    });
    expect(prepare.status, prepare.stderr).toBe(0);
    expect(prepare.stdout).toContain("Customer handoff scheduling: ready");
    expect(prepare.stdout).toContain("Customer-observed completion: not recorded");

    const inspect = run("scripts/inspect-admin-customer-handoff-scheduling-batch.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
    });
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain("Admin customer handoff scheduling batch OK");

    const artifact = JSON.parse(readFileSync(schedulingPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_customer_handoff_scheduling_batch",
      customer_handoff_scheduling_ready: true,
      customer_observed_completion_recorded: false,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      product_auth_admin_api_allowed: false,
      automatic_owner_staff_grants_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(artifact.next_batches).toHaveLength(4);
  });

  it("prepares with only the required Admin-surfaced scheduling inputs", () => {
    const walkthroughPath = artifactPath("minimal-protected-preview-walkthrough.json");
    const schedulingPath = artifactPath("minimal-customer-handoff-scheduling.json");
    for (const path of [walkthroughPath, schedulingPath]) removeIfExists(path);

    writeJsonArtifact(walkthroughPath, validProtectedPreviewWalkthrough());
    const prepare = run("scripts/prepare-admin-customer-handoff-scheduling-batch.mjs", {
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GYM_NAME: "Proof Gym",
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_OPERATOR: "operator-proof",
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SUPPORT_WINDOW: "2026-07-01 10:00 CT",
    });

    expect(prepare.status, prepare.stderr).toBe(0);
    const artifact = JSON.parse(readFileSync(schedulingPath, "utf8"));
    expect(artifact.owner_label).toBe("");
    expect(artifact.customer_observed_completion_recorded).toBe(false);
  });

  it("fails closed on missing input, unsafe branch, local Preview, and existing output", () => {
    const walkthroughPath = artifactPath("unsafe-protected-preview.json");
    const schedulingPath = artifactPath("unsafe-scheduling.json");
    for (const path of [walkthroughPath, schedulingPath]) removeIfExists(path);

    writeJsonArtifact(walkthroughPath, validProtectedPreviewWalkthrough());
    const missingGym = run("scripts/prepare-admin-customer-handoff-scheduling-batch.mjs", {
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
      ...schedulingEnv(),
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_GYM_NAME: "",
    });
    expect(missingGym.status).not.toBe(0);
    expect(missingGym.stderr).toContain("OUTPOST_ADMIN_CUSTOMER_HANDOFF_GYM_NAME required");

    writeJsonArtifact(
      walkthroughPath,
      validProtectedPreviewWalkthrough({ hosted_neon_branch: "outpost-neon-spike" }),
    );
    const spike = run("scripts/prepare-admin-customer-handoff-scheduling-batch.mjs", {
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
      ...schedulingEnv(),
    });
    expect(spike.status).not.toBe(0);
    expect(spike.stderr).toContain("migration spike branch");

    writeJsonArtifact(
      walkthroughPath,
      validProtectedPreviewWalkthrough({ protected_preview_url: "http://localhost:3000" }),
    );
    const localPreview = run("scripts/prepare-admin-customer-handoff-scheduling-batch.mjs", {
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
      ...schedulingEnv(),
    });
    expect(localPreview.status).not.toBe(0);
    expect(localPreview.stderr).toContain("Preview URL must use https");

    writeJsonArtifact(walkthroughPath, validProtectedPreviewWalkthrough());
    writeJsonArtifact(schedulingPath, { existing: true });
    const existing = run("scripts/prepare-admin-customer-handoff-scheduling-batch.mjs", {
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
      ...schedulingEnv(),
    });
    expect(existing.status).not.toBe(0);
    expect(existing.stderr).toContain("already exists");
  });

  it("inspector fails closed on parent tampering and secret-shaped values", () => {
    const walkthroughPath = artifactPath("tamper-protected-preview.json");
    const schedulingPath = artifactPath("tamper-scheduling.json");
    for (const path of [walkthroughPath, schedulingPath]) removeIfExists(path);

    writeJsonArtifact(walkthroughPath, validProtectedPreviewWalkthrough());
    const prepare = run("scripts/prepare-admin-customer-handoff-scheduling-batch.mjs", {
      OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH: walkthroughPath,
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
      ...schedulingEnv(),
    });
    expect(prepare.status, prepare.stderr).toBe(0);

    writeJsonArtifact(
      walkthroughPath,
      validProtectedPreviewWalkthrough({ reviewed_owner_email: "changed@proof.example" }),
    );
    const tamper = run("scripts/inspect-admin-customer-handoff-scheduling-batch.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
    });
    expect(tamper.status).not.toBe(0);
    expect(tamper.stderr).toContain("Protected Preview walkthrough parent SHA mismatch");

    const artifact = JSON.parse(readFileSync(schedulingPath, "utf8"));
    writeJsonArtifact(schedulingPath, {
      ...artifact,
      notes:
        "napi_test_fake_key_0000000000000000000000000000000000000000000000000000",
    });
    const secret = run("scripts/inspect-admin-customer-handoff-scheduling-batch.mjs", {
      OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH: schedulingPath,
    });
    expect(secret.status).not.toBe(0);
    expect(secret.stderr).toContain("secret-shaped value");
  });
});
