import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { founderAdminPublicLaunchNextReadinessBatch } from "../src/domain/founder-admin-readiness";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminComponent = readFileSync(
  "src/components/founder-admin/FounderAdminReadinessConsole.tsx",
  "utf8",
);

vi.setConfig({ testTimeout: 120000 });

function run(script, env = {}) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function artifactPath(name) {
  const dir = "artifacts/admin-public-launch-next-tests";
  mkdirSync(dir, { recursive: true });
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

function writePublicLaunchPreflightFixture(prefix) {
  const reviewPath = artifactPath(`${prefix}-limited-beta-review.json`);
  const preflightPath = artifactPath(`${prefix}-public-launch-preflight.json`);
  removeIfExists(reviewPath);
  removeIfExists(preflightPath);

  writeJsonArtifact(reviewPath, {
    artifact_kind: "admin_limited_beta_operator_review_packet",
    status: "admin_limited_beta_operator_review_packet_prepared",
    candidate_gym_label: "Second Gym",
  });
  writeJsonArtifact(preflightPath, {
    artifact_kind: "admin_public_self_serve_launch_preflight",
    status: "admin_public_self_serve_launch_preflight_prepared",
    generated_at: "2026-06-30T13:30:00.000Z",
    evidence_basis: "admin_limited_beta_operator_review_packet",
    limited_beta_operator_review_packet_path: reviewPath,
    limited_beta_operator_review_packet_sha256: sha256File(reviewPath),
    candidate_gym_label: "Second Gym",
    owner_access_mode: "operator_managed_until_public_launch_gate_green",
    public_self_serve_launch_preflight_ready: true,
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_user_created: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: [
      "Public owner self-signup",
      "Invite delivery",
      "Phone/email provider activation",
      "Billing, POS, access control, member-ledger writes",
    ],
    required_green_before_public_launch: [
      "At least one limited operator-assisted beta onboarding completed and reviewed.",
      "Owner access fulfillment remains operator-managed until launch gate approval.",
      "Public request intake is request-only and human-reviewed, not browser-approved.",
      "Invite delivery has no-send preflight plus separate send-provider proof.",
      "Phone/email providers, billing, POS, access control, and member-ledger writes have separate proof tracks.",
    ],
    allowed_next_work: [
      "Design public request intake as pending review only.",
      "Prepare invite-delivery no-send preflight.",
      "Prepare Auth admin dry-run without creating users.",
      "Prepare live-provider/revenue gate documents without enabling providers.",
    ],
  });

  return preflightPath;
}

function writePublicLaunchControls(prefix) {
  const preflightPath = writePublicLaunchPreflightFixture(prefix);
  const controlsPath = artifactPath(`${prefix}-public-launch-controls.json`);
  removeIfExists(controlsPath);
  const result = run("scripts/prepare-admin-public-launch-controls-batch.mjs", {
    OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH: preflightPath,
    OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
  });
  expect(result.status, result.stderr).toBe(0);
  return controlsPath;
}

describe("admin public launch next readiness batch", () => {
  it("packages request intake invite/Auth live-provider tracks and limited beta review from launch controls", () => {
    const controlsPath = writePublicLaunchControls("next-happy");
    const nextPath = artifactPath("next-happy-public-launch-next.json");
    removeIfExists(nextPath);

    let result = run("scripts/prepare-admin-public-launch-next-readiness-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
      OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public launch next readiness batch prepared",
    );

    result = run("scripts/inspect-admin-public-launch-next-readiness-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public launch next readiness batch inspection passed",
    );

    const artifact = JSON.parse(readFileSync(nextPath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_public_launch_next_readiness_batch",
      evidence_basis: "admin_public_launch_controls_batch",
      public_launch_next_readiness_batch_ready: true,
      public_request_intake_dry_run: {
        mode: "request_only_human_reviewed_no_persistence",
        public_request_form_submission_allowed: false,
        browser_approval_buttons_allowed: false,
        automatic_approval_allowed: false,
        owner_provisioning_allowed: false,
      },
      invite_auth_no_send_no_create: {
        mode: "review_only_no_send_no_create",
        owner_invite_delivery_allowed: false,
        staff_invite_delivery_allowed: false,
        outbound_email_allowed: false,
        notification_sending_allowed: false,
        product_auth_admin_api_allowed: false,
        auth_user_created: false,
        magic_link_created: false,
      },
      live_provider_revenue_member_system_tracks: {
        mode: "separate_blocked_proof_tracks",
        live_provider_enablement_allowed: false,
        billing_pos_member_writes_allowed: false,
        access_control_writes_allowed: false,
        member_ledger_writes_allowed: false,
        provider_ingress_allowed: false,
        provider_egress_allowed: false,
      },
      limited_beta_operator_review: {
        mode: "required_before_public_launch",
        real_limited_beta_onboarding_review_recorded: false,
        public_launch_decision_allowed: false,
      },
      public_self_serve_launch_allowed: false,
      public_request_form_submission_allowed: false,
      invite_delivery_allowed: false,
      auth_user_created: false,
      magic_link_created: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      provider_ingress_allowed: false,
      provider_egress_allowed: false,
      public_launch_decision_allowed: false,
    });
    expect(artifact.next_readiness_batches.map((slice) => slice.id)).toEqual([
      "public_request_intake_artifact",
      "invite_auth_no_send_no_create_records",
      "live_provider_revenue_member_system_runbooks",
      "limited_beta_operator_onboarding_review",
    ]);

    writeJsonArtifact(nextPath, {
      ...artifact,
      provider_ingress_allowed: true,
    });
    result = run("scripts/inspect-admin-public-launch-next-readiness-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("provider_ingress_allowed blocked");

    writeJsonArtifact(nextPath, {
      ...artifact,
      public_request_intake_dry_run: {
        ...artifact.public_request_intake_dry_run,
        operator_review_required: false,
      },
    });
    result = run("scripts/inspect-admin-public-launch-next-readiness-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Operator review must remain required");

    writeJsonArtifact(nextPath, {
      ...artifact,
      public_request_intake_dry_run: {
        ...artifact.public_request_intake_dry_run,
        automatic_owner_staff_grants_allowed: true,
      },
    });
    result = run("scripts/inspect-admin-public-launch-next-readiness-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Automatic owner/staff grants blocked");

    writeJsonArtifact(nextPath, {
      ...artifact,
      public_launch_controls_batch_sha256: "0".repeat(64),
    });
    result = run("scripts/inspect-admin-public-launch-next-readiness-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "public launch controls batch SHA256 does not match",
    );
  }, 120000);

  it("fails closed on unsafe launch controls and exposes Admin portal guidance", () => {
    const controlsPath = writePublicLaunchControls("next-fail");
    const nextPath = artifactPath("next-fail-public-launch-next.json");
    const controls = JSON.parse(readFileSync(controlsPath, "utf8"));
    writeJsonArtifact(controlsPath, {
      ...controls,
      live_provider_enablement_allowed: true,
    });
    removeIfExists(nextPath);

    const result = run("scripts/prepare-admin-public-launch-next-readiness-batch.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
      OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Public launch controls inspection failed");

    expect(packageJson).toContain("admin:public-launch-next:batch");
    expect(packageJson).toContain("admin:public-launch-next:inspect");
    expect(founderAdminComponent).toContain(
      "founderAdminPublicLaunchNextReadinessBatch",
    );
    expect(founderAdminComponent).toContain("Public launch next readiness batch");

    const packet = founderAdminPublicLaunchNextReadinessBatch({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-30T13:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(packet.title).toBe("Public launch next readiness batch");
    expect(packet.commands[0].command).toContain(
      "admin:public-launch-next:batch",
    );
    expect(packet.commands[1].command).toContain(
      "admin:public-launch-next:inspect",
    );
    expect(packet.nextReadinessBatches.map((slice) => slice.id)).toEqual([
      "public_request_intake_artifact",
      "invite_auth_no_send_no_create_records",
      "live_provider_revenue_member_system_runbooks",
      "limited_beta_operator_onboarding_review",
    ]);
  }, 120000);
});
