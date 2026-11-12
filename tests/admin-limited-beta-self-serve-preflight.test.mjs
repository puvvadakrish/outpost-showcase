import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const prepareLimitedBetaScript = readFileSync(
  "scripts/prepare-admin-limited-beta-onboarding-packet.mjs",
  "utf8",
);
const inspectLimitedBetaScript = readFileSync(
  "scripts/inspect-admin-limited-beta-onboarding-packet.mjs",
  "utf8",
);
const preparePublicSelfServeScript = readFileSync(
  "scripts/prepare-admin-public-self-serve-preflight.mjs",
  "utf8",
);
const inspectPublicSelfServeScript = readFileSync(
  "scripts/inspect-admin-public-self-serve-preflight.mjs",
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

const blockedGates = [
  "Public owner self-signup",
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
  const dir = "artifacts/test-admin-limited-beta-self-serve";
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return `${dir}/${name}`;
}

function removeIfExists(path) {
  rmSync(path, { force: true, recursive: true });
}

function writeJsonArtifact(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function run(script, env) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function validCustomerDemoGateArtifact(overrides = {}) {
  return {
    artifact_kind: "admin_customer_demo_gate_packet",
    status: "admin_customer_demo_gate_packet_prepared",
    generated_at: "2026-06-27T12:00:00.000Z",
    evidence_basis: "admin_demo_onboarding_completion",
    demo_onboarding_completion_path:
      "artifacts/admin-launch-readiness/test-demo-onboarding-completion.json",
    demo_onboarding_completion_sha256:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    gym_name: "Proof Gym",
    owner_email: "owner@example.com",
    owner_label: "Proof Owner",
    operator_label: "Proof Operator",
    session_window: "next owner support session",
    agenda: [
      "Open protected Preview confirm expected gym tenant only.",
      "Review owner workspace source, answer review, staff-task proof path.",
      "Review staff handoff path without sending invites or notifications.",
      "Review reset/rollback checklist support escalation path.",
      "Confirm no unexpected data, live-provider claims, billing, POS, access-control, or member-ledger writes.",
    ],
    required_customer_observed_confirmations: [
      "owner_present",
      "protected_preview_observed",
      "owner_workspace_observed",
      "staff_handoff_path_observed",
      "reset_rollback_reviewed",
      "unexpected_data_not_observed",
      "live_provider_claims_not_observed",
    ],
    customer_observed_completion_recorded: false,
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
    blocked_gates: blockedGates,
    ...overrides,
  };
}

describe("admin limited beta onboarding and self-serve preflight", () => {
  it("wires scripts and admin surfaces without live-provider actions", () => {
    expect(packageJson).toContain("admin:limited-beta-onboarding:packet");
    expect(packageJson).toContain("admin:limited-beta-onboarding:inspect");
    expect(packageJson).toContain("admin:public-self-serve:preflight");
    expect(packageJson).toContain("admin:public-self-serve:inspect");
    expect(prepareLimitedBetaScript).toContain(
      "admin_limited_beta_onboarding_packet_prepared",
    );
    expect(inspectLimitedBetaScript).toContain("Owner access must remain");
    expect(preparePublicSelfServeScript).toContain(
      "admin_public_self_serve_preflight_prepared",
    );
    expect(inspectPublicSelfServeScript).toContain(
      "Public self-serve launch must remain blocked",
    );
    expect(founderAdminDomain).toContain(
      "founderAdminLimitedBetaOnboardingPacket",
    );
    expect(founderAdminDomain).toContain(
      "founderAdminPublicSelfServePreflight",
    );
    expect(founderAdminComponent).toContain(
      'aria-label="Limited beta onboarding packet"',
    );
    expect(founderAdminComponent).toContain(
      'aria-label="Public self-serve preflight"',
    );
    expect(founderAdminComponent).not.toContain("enable provider");
  });

  it("prepares and inspects limited beta onboarding then public self-serve preflight", () => {
    const customerGatePath = artifactPath("customer-demo-gate.json");
    const limitedPacketPath = artifactPath("limited-beta-onboarding.json");
    const selfServePreflightPath = artifactPath("public-self-serve-preflight.json");

    removeIfExists(customerGatePath);
    removeIfExists(limitedPacketPath);
    removeIfExists(selfServePreflightPath);

    writeJsonArtifact(customerGatePath, validCustomerDemoGateArtifact());

    const limitedPacket = run(
      "scripts/prepare-admin-limited-beta-onboarding-packet.mjs",
      {
        OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH: customerGatePath,
        OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH: limitedPacketPath,
        OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_OPERATOR: "Beta Operator",
        OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_CANDIDATE_GYM: "North Loop Gym",
      },
    );
    expect(limitedPacket.status, limitedPacket.stderr).toBe(0);
    expect(limitedPacket.stdout).toContain("Owner access: operator-managed");

    const limitedInspect = run(
      "scripts/inspect-admin-limited-beta-onboarding-packet.mjs",
      { OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH: limitedPacketPath },
    );
    expect(limitedInspect.status, limitedInspect.stderr).toBe(0);

    const limitedArtifact = JSON.parse(readFileSync(limitedPacketPath, "utf8"));
    expect(limitedArtifact).toMatchObject({
      artifact_kind: "admin_limited_beta_onboarding_packet",
      owner_access_mode: "operator_managed",
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });

    const selfServePreflight = run(
      "scripts/prepare-admin-public-self-serve-preflight.mjs",
      {
        OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH: limitedPacketPath,
        OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH: selfServePreflightPath,
      },
    );
    expect(selfServePreflight.status, selfServePreflight.stderr).toBe(0);
    expect(selfServePreflight.stdout).toContain(
      "Public self-serve launch: blocked",
    );

    const selfServeInspect = run(
      "scripts/inspect-admin-public-self-serve-preflight.mjs",
      { OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH: selfServePreflightPath },
    );
    expect(selfServeInspect.status, selfServeInspect.stderr).toBe(0);

    const preflight = JSON.parse(readFileSync(selfServePreflightPath, "utf8"));
    expect(preflight).toMatchObject({
      artifact_kind: "admin_public_self_serve_preflight",
      owner_access_mode: "operator_managed_until_launch_gate_green",
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      auth_admin_product_api_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
  });

  it("refuses limited beta onboarding when parent invite delivery is allowed", () => {
    const customerGatePath = artifactPath("unsafe-customer-demo-gate.json");
    const limitedPacketPath = artifactPath("unsafe-limited-beta-onboarding.json");

    removeIfExists(customerGatePath);
    removeIfExists(limitedPacketPath);
    writeJsonArtifact(
      customerGatePath,
      validCustomerDemoGateArtifact({ invite_delivery_allowed: true }),
    );

    const result = run("scripts/prepare-admin-limited-beta-onboarding-packet.mjs", {
      OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH: customerGatePath,
      OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH: limitedPacketPath,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Invite delivery must remain blocked");
  });

  it("refuses public self-serve preflight when limited packet allows launch", () => {
    const limitedPacketPath = artifactPath("unsafe-limited-packet.json");
    const selfServePreflightPath = artifactPath("unsafe-public-preflight.json");

    removeIfExists(limitedPacketPath);
    removeIfExists(selfServePreflightPath);
    writeJsonArtifact(limitedPacketPath, {
      artifact_kind: "admin_limited_beta_onboarding_packet",
      status: "admin_limited_beta_onboarding_packet_prepared",
      evidence_basis: "admin_customer_demo_gate_packet",
      source_gym_name: "Proof Gym",
      source_owner_email: "owner@example.com",
      candidate_gym_label: "North Loop Gym",
      owner_access_mode: "operator_managed",
      request_triage_required: true,
      followthrough_required: true,
      customer_observed_completion_recorded: false,
      public_self_serve_launch_allowed: true,
      invite_delivery_allowed: false,
      browser_approval_buttons_allowed: false,
      source_import_automation_allowed: false,
      automatic_answer_approval_allowed: false,
      automatic_task_generation_allowed: false,
      email_ingress_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      blocked_gates: blockedGates,
      operator_checklist: [
        "Review request.",
        "Provision owner access.",
        "Open protected Preview.",
        "Review rollback.",
        "Record follow-through.",
      ],
    });

    const result = run("scripts/prepare-admin-public-self-serve-preflight.mjs", {
      OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH: limitedPacketPath,
      OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH: selfServePreflightPath,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Public self-serve must remain blocked");
  });

  it("refuses limited beta onboarding overwrite and path traversal", () => {
    const customerGatePath = artifactPath("guard-customer-demo-gate.json");
    const existingPacketPath = artifactPath("guard-limited-beta-onboarding.json");

    removeIfExists(customerGatePath);
    removeIfExists(existingPacketPath);
    writeJsonArtifact(customerGatePath, validCustomerDemoGateArtifact());
    writeJsonArtifact(existingPacketPath, { already: "present" });

    const overwrite = run("scripts/prepare-admin-limited-beta-onboarding-packet.mjs", {
      OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH: customerGatePath,
      OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH: existingPacketPath,
    });

    expect(overwrite.status).not.toBe(0);
    expect(overwrite.stderr).toContain(
      "OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH already exists",
    );

    const traversal = run("scripts/prepare-admin-limited-beta-onboarding-packet.mjs", {
      OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH: "../customer-demo-gate.json",
      OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH: existingPacketPath,
    });

    expect(traversal.status).not.toBe(0);
    expect(traversal.stderr).toContain(
      "OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH must stay inside repository",
    );
  });

  it("refuses secret-shaped parent values", () => {
    const customerGatePath = artifactPath("secret-customer-demo-gate.json");
    const limitedPacketPath = artifactPath("secret-limited-beta-onboarding.json");

    removeIfExists(customerGatePath);
    removeIfExists(limitedPacketPath);
    writeJsonArtifact(
      customerGatePath,
      validCustomerDemoGateArtifact({
        operator_label: "token: abcdefghijklmnopqrstuvwxyz",
      }),
    );

    const result = run("scripts/prepare-admin-limited-beta-onboarding-packet.mjs", {
      OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH: customerGatePath,
      OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH: limitedPacketPath,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("contains secret-shaped value");
  });

  it("refuses public self-serve preflight when limited packet has wrong evidence basis", () => {
    const limitedPacketPath = artifactPath("wrong-basis-limited-packet.json");
    const selfServePreflightPath = artifactPath("wrong-basis-public-preflight.json");

    removeIfExists(limitedPacketPath);
    removeIfExists(selfServePreflightPath);
    writeJsonArtifact(limitedPacketPath, {
      artifact_kind: "admin_limited_beta_onboarding_packet",
      status: "admin_limited_beta_onboarding_packet_prepared",
      evidence_basis: "manual_override",
      source_gym_name: "Proof Gym",
      source_owner_email: "owner@example.com",
      candidate_gym_label: "North Loop Gym",
      owner_access_mode: "operator_managed",
      request_triage_required: true,
      followthrough_required: true,
      customer_observed_completion_recorded: false,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      browser_approval_buttons_allowed: false,
      source_import_automation_allowed: false,
      automatic_answer_approval_allowed: false,
      automatic_task_generation_allowed: false,
      email_ingress_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      blocked_gates: blockedGates,
      operator_checklist: [
        "Review request.",
        "Provision owner access.",
        "Open protected Preview.",
        "Review rollback.",
        "Record follow-through.",
      ],
    });

    const result = run("scripts/prepare-admin-public-self-serve-preflight.mjs", {
      OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH: limitedPacketPath,
      OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH: selfServePreflightPath,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Limited beta onboarding packet evidence basis mismatch",
    );
  });
});
