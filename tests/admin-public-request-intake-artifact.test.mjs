import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { founderAdminPublicRequestIntakeArtifact } from "../src/domain/founder-admin-readiness";

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
  const dir = "artifacts/admin-public-request-intake-tests";
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
    generated_at: "2026-06-30T14:00:00.000Z",
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
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone/email provider activation",
      "Product Auth admin API",
      "Auth user creation",
      "Automatic owner/staff grants",
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

function writePublicLaunchNext(prefix) {
  const preflightPath = writePublicLaunchPreflightFixture(prefix);
  const controlsPath = artifactPath(`${prefix}-controls.json`);
  const nextPath = artifactPath(`${prefix}-next.json`);
  removeIfExists(controlsPath);
  removeIfExists(nextPath);
  let result = run("scripts/prepare-admin-public-launch-controls-batch.mjs", {
    OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH: preflightPath,
    OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
  });
  expect(result.status, result.stderr).toBe(0);
  result = run("scripts/prepare-admin-public-launch-next-readiness-batch.mjs", {
    OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH: controlsPath,
    OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
  });
  expect(result.status, result.stderr).toBe(0);
  return nextPath;
}

describe("admin public request intake artifact", () => {
  it("prepares and inspects request-only read-only public intake from next readiness", () => {
    const nextPath = writePublicLaunchNext("intake-happy");
    const intakePath = artifactPath("intake-happy-artifact.json");
    removeIfExists(intakePath);

    let result = run("scripts/prepare-admin-public-request-intake-artifact.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_LABEL: "Second Gym public request",
      OUTPOST_ADMIN_PUBLIC_REQUEST_CONTACT: "owner@second.example",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request intake artifact prepared",
    );

    result = run("scripts/inspect-admin-public-request-intake-artifact.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "Admin public request intake artifact inspection passed",
    );

    const artifact = JSON.parse(readFileSync(intakePath, "utf8"));
    expect(artifact).toMatchObject({
      artifact_kind: "admin_public_request_intake_artifact",
      evidence_basis: "admin_public_launch_next_readiness_batch",
      request_only_intake_artifact_ready: true,
      request_preview: {
        label: "Second Gym public request",
        contact: "owner@second.example",
        operator_review_required: true,
        persisted_public_request_allowed: false,
        public_submission_accepted: false,
      },
      admin_preview: {
        mode: "read_only_operator_preview",
        browser_approval_buttons_allowed: false,
        public_submit_button_allowed: false,
        owner_provisioning_button_allowed: false,
        invite_send_button_allowed: false,
      },
      intake_mode: "request_only_human_reviewed_no_persistence",
      public_request_form_submission_allowed: false,
      browser_approval_buttons_allowed: false,
      owner_provisioning_allowed: false,
      invite_delivery_allowed: false,
      auth_user_created: false,
      magic_link_created: false,
      provider_ingress_allowed: false,
      provider_egress_allowed: false,
    });
    expect(artifact.next_readiness_batches.map((slice) => slice.id)).toEqual([
      "invite_auth_no_send_no_create_records",
      "live_provider_revenue_member_system_runbooks",
      "limited_beta_operator_onboarding_review",
    ]);

    writeJsonArtifact(intakePath, {
      ...artifact,
      admin_preview: {
        ...artifact.admin_preview,
        public_submit_button_allowed: true,
      },
    });
    result = run("scripts/inspect-admin-public-request-intake-artifact.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("public_submit_button_allowed blocked");

    writeJsonArtifact(intakePath, {
      ...artifact,
      request_preview: {
        ...artifact.request_preview,
        public_submission_accepted: true,
      },
    });
    result = run("scripts/inspect-admin-public-request-intake-artifact.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Public submission accepted blocked");

    writeJsonArtifact(intakePath, {
      ...artifact,
      public_launch_next_readiness_batch_sha256: "0".repeat(64),
    });
    result = run("scripts/inspect-admin-public-request-intake-artifact.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "public launch next readiness batch SHA256 does not match",
    );
  }, 120000);

  it("fails closed on unsafe parent and exposes Admin portal guidance", () => {
    const nextPath = writePublicLaunchNext("intake-fail");
    const intakePath = artifactPath("intake-fail-artifact.json");
    const next = JSON.parse(readFileSync(nextPath, "utf8"));
    writeJsonArtifact(nextPath, {
      ...next,
      public_request_form_submission_allowed: true,
    });
    removeIfExists(intakePath);

    const result = run("scripts/prepare-admin-public-request-intake-artifact.mjs", {
      OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH: nextPath,
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH: intakePath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Public launch next readiness inspection failed",
    );

    expect(packageJson).toContain("admin:public-request-intake:artifact");
    expect(packageJson).toContain(
      "admin:public-request-intake:artifact:inspect",
    );
    expect(founderAdminComponent).toContain(
      "founderAdminPublicRequestIntakeArtifact",
    );
    expect(founderAdminComponent).toContain("Public request intake artifact");

    const packet = founderAdminPublicRequestIntakeArtifact({
      branchName: "outpost-proof-branch",
      previewUrl: "https://outpost-preview.example.vercel.app",
      generatedAt: "2026-06-30T14:00:00.000Z",
      gates: [],
      proofRuns: [],
      state: "pending",
      summary: "proof",
    });
    expect(packet.title).toBe("Public request intake artifact");
    expect(packet.commands[0].command).toContain(
      "admin:public-request-intake:artifact",
    );
    expect(packet.commands[1].command).toContain(
      "admin:public-request-intake:artifact:inspect",
    );
  }, 120000);
});
