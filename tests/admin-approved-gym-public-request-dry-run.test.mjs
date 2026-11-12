import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const prepareApprovedGymScript = readFileSync(
  "scripts/prepare-admin-approved-gym-followthrough-packet.mjs",
  "utf8",
);
const inspectApprovedGymScript = readFileSync(
  "scripts/inspect-admin-approved-gym-followthrough-packet.mjs",
  "utf8",
);
const preparePublicRequestScript = readFileSync(
  "scripts/prepare-admin-public-request-intake-dry-run.mjs",
  "utf8",
);
const inspectPublicRequestScript = readFileSync(
  "scripts/inspect-admin-public-request-intake-dry-run.mjs",
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

const publicPreflightBlockedGates = [
  "Public owner self-signup",
  "Browser approval buttons",
  "Invite delivery",
  "Website scraping Google API import",
  "Automatic answer approval",
  "Automatic task generation",
  "Gmail, Resend, SMTP, provider webhooks",
  "Inbound email outbound email",
  "Notification sending",
  "Phone/email provider activation",
  "Billing, POS, access control, member-ledger writes",
];

function artifactPath(name) {
  const dir = "artifacts/test-admin-approved-gym-public-request";
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return `${dir}/${name}`;
}

function removeIfExists(path) {
  rmSync(path, { force: true, recursive: true });
}

function artifactSha256(value) {
  return createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`)
    .digest("hex");
}

function writeJsonArtifact(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function run(script, env = {}) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function validPublicSelfServePreflight(overrides = {}) {
  return {
    artifact_kind: "admin_public_self_serve_preflight",
    status: "admin_public_self_serve_preflight_prepared",
    generated_at: "2026-06-27T12:00:00.000Z",
    evidence_basis: "admin_limited_beta_onboarding_packet",
    limited_beta_onboarding_packet_path:
      "artifacts/test-admin-approved-gym-public-request/limited.json",
    limited_beta_onboarding_packet_sha256:
      "a".repeat(64),
    candidate_gym_label: "North Loop Strength",
    owner_access_mode: "operator_managed_until_launch_gate_green",
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    browser_approval_buttons_allowed: false,
    auth_admin_product_api_allowed: false,
    source_import_automation_allowed: false,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: publicPreflightBlockedGates,
    required_green_before_launch: [
      "Real customer-observed demo gate recorded imported into hosted Neon.",
      "At least one limited operator-assisted beta onboarding completed for a non-House-of-Fitness gym.",
    ],
    next_recommended_slices: [
      "Approved gym request follow-through.",
      "Public request intake dry-run.",
    ],
    ...overrides,
  };
}

function validOwnerBetaFollowthrough(overrides = {}) {
  return {
    status: "owner_beta_request_followthrough_prepared",
    packet_kind: "owner_beta_request_followthrough",
    generated_at: "2026-06-27T12:00:00.000Z",
    preview_url: "https://outpost-preview.example.vercel.app",
    neon_proof_branch: "outpost-proof-branch",
    request: {
      id: "req_north_loop",
      owner_email: "owner@northloop.example",
      owner_name: "Maya Ellison",
      gym_name: "North Loop Strength",
      location_hint: "Minneapolis",
      status: "needs_review",
      request_count: 1,
      created_at: "2026-06-27T12:00:00.000Z",
      last_requested_at: "2026-06-27T12:00:00.000Z",
      grant_present: false,
    },
    triage_receipt: {
      id: "triage_north_loop",
      decision: "ready_for_operator_fulfillment",
      packet_sha256: "b".repeat(64),
    },
    public_self_serve_launch_allowed: false,
    launch_enablement_allowed: false,
    requires_human_review: true,
    next_operator_commands: [
      "npm run beta:operator:request-preflight",
      "npm run beta:operator:request-fulfillment",
    ],
    blocked_until_reviewed: [
      "public owner self-signup",
      "browser approval fulfillment buttons",
      "invite delivery notification sending",
      "phone or email provider activation",
      "billing, POS, access control, member-ledger writes",
    ],
    ...overrides,
  };
}

describe("admin approved gym follow-through and public request dry-run", () => {
  it("wires package scripts, domain builders, and Admin portal panels", () => {
    expect(packageJson).toContain(
      '"admin:approved-gym-followthrough:packet"',
    );
    expect(packageJson).toContain(
      '"admin:public-request-intake:dry-run"',
    );
    expect(prepareApprovedGymScript).toContain(
      "admin_approved_gym_request_followthrough_packet",
    );
    expect(inspectApprovedGymScript).toContain(
      "Approved gym follow-through packet OK",
    );
    expect(preparePublicRequestScript).toContain(
      "admin_public_request_intake_dry_run",
    );
    expect(inspectPublicRequestScript).toContain(
      "Public request intake dry-run OK",
    );
    expect(founderAdminDomain).toContain(
      "founderAdminApprovedGymFollowthroughPacket",
    );
    expect(founderAdminDomain).toContain(
      "founderAdminPublicRequestIntakeDryRun",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Approved gym request follow-through"',
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Public request intake dry-run"',
    );
    expect(founderAdminComponent).not.toContain("enable provider");
  });

  it("prepares and inspects approved gym follow-through then public request intake dry-run", () => {
    const preflightPath = artifactPath("public-preflight.json");
    const followthroughPath = artifactPath("owner-followthrough.json");
    const approvedPacketPath = artifactPath("approved-followthrough.json");
    const dryRunPath = artifactPath("public-request-dry-run.json");

    for (const path of [
      preflightPath,
      followthroughPath,
      approvedPacketPath,
      dryRunPath,
    ]) {
      removeIfExists(path);
    }

    const preflight = validPublicSelfServePreflight();
    writeJsonArtifact(preflightPath, preflight);
    writeJsonArtifact(
      followthroughPath,
      validOwnerBetaFollowthrough({
        triage_receipt: {
          ...validOwnerBetaFollowthrough().triage_receipt,
          packet_sha256: artifactSha256(preflight),
        },
      }),
    );

    const approvedPacketResult = run(
      "scripts/prepare-admin-approved-gym-followthrough-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH: preflightPath,
        OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: followthroughPath,
        OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH:
          approvedPacketPath,
        OUTPOST_ADMIN_APPROVED_GYM_LABEL: "North Loop Strength",
      },
    );
    expect(approvedPacketResult.status, approvedPacketResult.stderr).toBe(0);
    expect(approvedPacketResult.stdout).toContain(
      "Owner access: operator-managed",
    );

    const approvedInspectResult = run(
      "scripts/inspect-admin-approved-gym-followthrough-packet.mjs",
      {
        OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH:
          approvedPacketPath,
      },
    );
    expect(approvedInspectResult.status, approvedInspectResult.stderr).toBe(0);

    const approvedPacket = JSON.parse(readFileSync(approvedPacketPath, "utf8"));
    expect(approvedPacket).toMatchObject({
      artifact_kind: "admin_approved_gym_request_followthrough_packet",
      owner_access_mode: "operator_managed",
      approved_gym_non_acme_fitness: true,
      owner_grant_automatic: false,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });

    const dryRunResult = run(
      "scripts/prepare-admin-public-request-intake-dry-run.mjs",
      {
        OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH:
          approvedPacketPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH: dryRunPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_DRY_RUN_GYM: "North Loop Strength",
        OUTPOST_ADMIN_PUBLIC_REQUEST_DRY_RUN_OWNER_EMAIL:
          "owner@northloop.example",
      },
    );
    expect(dryRunResult.status, dryRunResult.stderr).toBe(0);
    expect(dryRunResult.stdout).toContain(
      "Intake mode: request-only/review-only",
    );

    const dryRunInspectResult = run(
      "scripts/inspect-admin-public-request-intake-dry-run.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH: dryRunPath,
      },
    );
    expect(dryRunInspectResult.status, dryRunInspectResult.stderr).toBe(0);

    const dryRun = JSON.parse(readFileSync(dryRunPath, "utf8"));
    expect(dryRun).toMatchObject({
      artifact_kind: "admin_public_request_intake_dry_run",
      intake_mode: "request_only_review_only",
      public_request_form_allowed: false,
      public_self_serve_launch_allowed: false,
      automatic_approval_allowed: false,
      owner_provisioning_allowed: false,
      owner_grant_automatic: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
  });

  it("refuses approved gym follow-through for Acme Fitness", () => {
    const preflightPath = artifactPath("acme-public-preflight.json");
    const followthroughPath = artifactPath("acme-owner-followthrough.json");
    const approvedPacketPath = artifactPath("acme-approved-followthrough.json");
    removeIfExists(preflightPath);
    removeIfExists(followthroughPath);
    removeIfExists(approvedPacketPath);
    const preflight = validPublicSelfServePreflight();
    writeJsonArtifact(preflightPath, preflight);
    writeJsonArtifact(
      followthroughPath,
      validOwnerBetaFollowthrough({
        request: {
          ...validOwnerBetaFollowthrough().request,
          gym_name: "House-of-Fitness",
        },
        triage_receipt: {
          ...validOwnerBetaFollowthrough().triage_receipt,
          packet_sha256: artifactSha256(preflight),
        },
      }),
    );

    const result = run(
      "scripts/prepare-admin-approved-gym-followthrough-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH: preflightPath,
        OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: followthroughPath,
        OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH:
          approvedPacketPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("non-House-of-Fitness");
  });

  it("refuses approved gym follow-through if launch enablement is allowed", () => {
    const preflightPath = artifactPath("launch-public-preflight.json");
    const followthroughPath = artifactPath("launch-owner-followthrough.json");
    const approvedPacketPath = artifactPath("launch-approved-followthrough.json");
    removeIfExists(preflightPath);
    removeIfExists(followthroughPath);
    removeIfExists(approvedPacketPath);
    const preflight = validPublicSelfServePreflight();
    writeJsonArtifact(preflightPath, preflight);
    writeJsonArtifact(
      followthroughPath,
      validOwnerBetaFollowthrough({
        launch_enablement_allowed: true,
        triage_receipt: {
          ...validOwnerBetaFollowthrough().triage_receipt,
          packet_sha256: artifactSha256(preflight),
        },
      }),
    );

    const result = run(
      "scripts/prepare-admin-approved-gym-followthrough-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH: preflightPath,
        OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: followthroughPath,
        OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH:
          approvedPacketPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("launch enablement blocked");
  });

  it("refuses public request intake dry-run if owner grants are automatic", () => {
    const approvedPacketPath = artifactPath("unsafe-approved-followthrough.json");
    const dryRunPath = artifactPath("unsafe-public-request-dry-run.json");
    removeIfExists(approvedPacketPath);
    removeIfExists(dryRunPath);
    writeJsonArtifact(approvedPacketPath, {
      artifact_kind: "admin_approved_gym_request_followthrough_packet",
      status: "admin_approved_gym_request_followthrough_prepared",
      evidence_basis:
        "admin_public_self_serve_preflight_and_owner_beta_request_followthrough",
      approved_gym_label: "North Loop Strength",
      approved_gym_non_acme_fitness: true,
      owner_access_mode: "operator_managed",
      owner_grant_automatic: true,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      browser_approval_buttons_allowed: false,
      auth_admin_product_api_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      request: {
        owner_email: "owner@northloop.example",
      },
    });

    const result = run(
      "scripts/prepare-admin-public-request-intake-dry-run.mjs",
      {
        OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH:
          approvedPacketPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH: dryRunPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Owner grant must not be automatic");
  });

  it("refuses malformed approved gym packet with a clean request error", () => {
    const approvedPacketPath = artifactPath("malformed-approved-followthrough.json");
    const dryRunPath = artifactPath("malformed-public-request-dry-run.json");
    removeIfExists(approvedPacketPath);
    removeIfExists(dryRunPath);
    writeJsonArtifact(approvedPacketPath, {
      artifact_kind: "admin_approved_gym_request_followthrough_packet",
      status: "admin_approved_gym_request_followthrough_prepared",
      approved_gym_non_acme_fitness: true,
      owner_access_mode: "operator_managed",
      owner_grant_automatic: false,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      browser_approval_buttons_allowed: false,
      auth_admin_product_api_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });

    const result = run(
      "scripts/prepare-admin-public-request-intake-dry-run.mjs",
      {
        OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH:
          approvedPacketPath,
        OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH: dryRunPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Approved packet request id required");
    expect(result.stderr).not.toContain("TypeError");
  });

  it("refuses artifact overwrite and path traversal", () => {
    const preflightPath = artifactPath("overwrite-public-preflight.json");
    const followthroughPath = artifactPath("overwrite-owner-followthrough.json");
    const approvedPacketPath = artifactPath("overwrite-approved.json");
    removeIfExists(preflightPath);
    removeIfExists(followthroughPath);
    removeIfExists(approvedPacketPath);
    const preflight = validPublicSelfServePreflight();
    writeJsonArtifact(preflightPath, preflight);
    writeJsonArtifact(
      followthroughPath,
      validOwnerBetaFollowthrough({
        triage_receipt: {
          ...validOwnerBetaFollowthrough().triage_receipt,
          packet_sha256: artifactSha256(preflight),
        },
      }),
    );
    writeJsonArtifact(approvedPacketPath, {});

    const overwriteResult = run(
      "scripts/prepare-admin-approved-gym-followthrough-packet.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH: preflightPath,
        OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: followthroughPath,
        OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH:
          approvedPacketPath,
      },
    );
    expect(overwriteResult.status).not.toBe(0);
    expect(overwriteResult.stderr).toContain("already exists");

    const traversalResult = run(
      "scripts/prepare-admin-public-request-intake-dry-run.mjs",
      {
        OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH: "../unsafe.json",
        OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH: artifactPath(
          "traversal-dry-run.json",
        ),
      },
    );
    expect(traversalResult.status).not.toBe(0);
    expect(traversalResult.stderr).toContain("must stay inside repository");
  });
});
