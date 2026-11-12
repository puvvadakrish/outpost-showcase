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
const prepareInviteScript = readFileSync(
  "scripts/prepare-admin-invite-delivery-preflight.mjs",
  "utf8",
);
const inspectInviteScript = readFileSync(
  "scripts/inspect-admin-invite-delivery-preflight.mjs",
  "utf8",
);
const prepareAuthScript = readFileSync(
  "scripts/prepare-admin-auth-admin-provisioning-dry-run.mjs",
  "utf8",
);
const inspectAuthScript = readFileSync(
  "scripts/inspect-admin-auth-admin-provisioning-dry-run.mjs",
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

function artifactPath(name) {
  const dir = "artifacts/test-admin-invite-auth-admin";
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

function artifactSha256(value) {
  return createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`)
    .digest("hex");
}

function run(script, env = {}) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function validPublicRequestDryRun(overrides = {}) {
  return {
    artifact_kind: "admin_public_request_intake_dry_run",
    status: "admin_public_request_intake_dry_run_prepared",
    generated_at: "2026-06-27T12:00:00.000Z",
    evidence_basis: "admin_approved_gym_request_followthrough_packet",
    approved_gym_followthrough_packet_path:
      "artifacts/test-admin-invite-auth-admin/approved-followthrough.json",
    approved_gym_followthrough_packet_sha256: "a".repeat(64),
    dry_run_request: {
      gym_label: "North Loop Strength",
      owner_email: "owner@northloop.example",
      source: "operator-entered public request dry-run",
      persisted_request_allowed: false,
    },
    intake_mode: "request_only_review_only",
    public_request_form_allowed: false,
    public_self_serve_launch_allowed: false,
    automatic_approval_allowed: false,
    owner_provisioning_allowed: false,
    owner_grant_automatic: false,
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
    blocked_gates: [
      "Public owner self-signup",
      "Browser approval buttons",
      "Automatic approval",
      "Owner provisioning",
      "Invite delivery",
      "Website scraping Google API import",
      "Automatic answer approval",
      "Automatic task generation",
      "Gmail, Resend, SMTP, provider webhooks",
      "Inbound email outbound email",
      "Notification sending",
      "Phone/email provider activation",
      "Billing, POS, access control, member-ledger writes",
    ],
    next_recommended_slice:
      "Create invite delivery preflight before sending any email or notification.",
    ...overrides,
  };
}

function validInvitePreflight(overrides = {}) {
  return {
    artifact_kind: "admin_invite_delivery_preflight",
    status: "admin_invite_delivery_preflight_prepared",
    generated_at: "2026-06-27T12:00:00.000Z",
    evidence_basis: "admin_public_request_intake_dry_run",
    public_request_intake_dry_run_path:
      "artifacts/test-admin-invite-auth-admin/public-request-dry-run.json",
    public_request_intake_dry_run_sha256: "b".repeat(64),
    invite_mode: "review_only_no_send",
    invite_audience: "owner@northloop.example",
    invite_subject: "Outpost beta access for North Loop Strength",
    invite_body_preview:
      "Operator-reviewed invite copy placeholder. Sending remains blocked.",
    browser_send_button_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    outbound_email_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    auth_admin_product_api_allowed: false,
    owner_provisioning_allowed: false,
    owner_grant_automatic: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: [
      "Public owner self-signup",
      "Browser approval buttons",
      "Invite delivery send",
      "Notification sending",
      "Gmail, Resend, SMTP, provider webhooks",
      "Phone/email provider activation",
      "Auth admin product API",
      "Automatic owner grant",
      "Billing, POS, access control, member-ledger writes",
    ],
    next_recommended_slice:
      "Run Auth admin provisioning dry-run without creating users from product code.",
    ...overrides,
  };
}

function validAuthAdminDryRun(overrides = {}) {
  return {
    artifact_kind: "admin_auth_admin_provisioning_dry_run",
    status: "admin_auth_admin_provisioning_dry_run_prepared",
    generated_at: "2026-06-27T12:00:00.000Z",
    evidence_basis: "admin_invite_delivery_preflight",
    invite_delivery_preflight_path:
      "artifacts/test-admin-invite-auth-admin/invite-preflight.json",
    invite_delivery_preflight_sha256: "c".repeat(64),
    provisioning_mode: "operator_review_only_no_user_created",
    reviewed_owner_email: "owner@northloop.example",
    reviewed_gym_label: "North Loop Strength",
    reviewed_invite_subject: "Outpost beta access for North Loop Strength",
    auth_user_created: false,
    product_auth_admin_api_allowed: false,
    owner_grant_automatic: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    browser_approval_buttons_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: [
      "Product Auth admin API",
      "Automatic owner grant",
      "Invite delivery send",
      "Notification sending",
      "Browser approval buttons",
      "Phone/email provider activation",
      "Billing, POS, access control, member-ledger writes",
    ],
    next_recommended_slice:
      "Link reviewed invite metadata to operator-created owner access evidence.",
    ...overrides,
  };
}

describe("admin invite delivery and Auth admin dry-run", () => {
  it("wires package scripts, domain builders, and Admin portal panels", () => {
    expect(packageJson).toContain('"admin:invite-delivery:preflight"');
    expect(packageJson).toContain('"admin:auth-admin:dry-run"');
    expect(prepareInviteScript).toContain("admin_invite_delivery_preflight");
    expect(inspectInviteScript).toContain("Invite delivery preflight OK");
    expect(prepareAuthScript).toContain(
      "admin_auth_admin_provisioning_dry_run",
    );
    expect(inspectAuthScript).toContain(
      "Auth admin provisioning dry-run OK",
    );
    expect(founderAdminDomain).toContain(
      "founderAdminInviteDeliveryPreflight",
    );
    expect(founderAdminDomain).toContain(
      "founderAdminAuthAdminProvisioningDryRun",
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Invite delivery preflight"',
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Auth admin provisioning dry-run"',
    );
  });

  it("prepares and inspects invite preflight then Auth admin dry-run", () => {
    const dryRunPath = artifactPath("public-request-dry-run.json");
    const invitePath = artifactPath("invite-preflight.json");
    const authPath = artifactPath("auth-admin-dry-run.json");
    for (const path of [dryRunPath, invitePath, authPath]) {
      removeIfExists(path);
    }
    writeJsonArtifact(dryRunPath, validPublicRequestDryRun());

    const inviteResult = run("scripts/prepare-admin-invite-delivery-preflight.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH: dryRunPath,
      OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH: invitePath,
      OUTPOST_ADMIN_INVITE_PREFLIGHT_SUBJECT:
        "Reviewed Outpost beta access",
    });
    expect(inviteResult.status, inviteResult.stderr).toBe(0);
    expect(inviteResult.stdout).toContain("Invite delivery: blocked");

    const inviteInspectResult = run(
      "scripts/inspect-admin-invite-delivery-preflight.mjs",
      {
        OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH: invitePath,
      },
    );
    expect(inviteInspectResult.status, inviteInspectResult.stderr).toBe(0);

    const invite = JSON.parse(readFileSync(invitePath, "utf8"));
    expect(invite).toMatchObject({
      artifact_kind: "admin_invite_delivery_preflight",
      invite_mode: "review_only_no_send",
      browser_send_button_allowed: false,
      invite_delivery_allowed: false,
      notification_sending_allowed: false,
      auth_admin_product_api_allowed: false,
      owner_grant_automatic: false,
    });

    const authResult = run(
      "scripts/prepare-admin-auth-admin-provisioning-dry-run.mjs",
      {
        OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH: invitePath,
        OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH: authPath,
      },
    );
    expect(authResult.status, authResult.stderr).toBe(0);
    expect(authResult.stdout).toContain("Auth user created: false");

    const authInspectResult = run(
      "scripts/inspect-admin-auth-admin-provisioning-dry-run.mjs",
      {
        OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH: authPath,
      },
    );
    expect(authInspectResult.status, authInspectResult.stderr).toBe(0);

    const auth = JSON.parse(readFileSync(authPath, "utf8"));
    expect(auth).toMatchObject({
      artifact_kind: "admin_auth_admin_provisioning_dry_run",
      provisioning_mode: "operator_review_only_no_user_created",
      auth_user_created: false,
      product_auth_admin_api_allowed: false,
      owner_grant_automatic: false,
      invite_delivery_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(auth.invite_delivery_preflight_sha256).toBe(artifactSha256(invite));
  });

  it("refuses invite preflight when public request dry-run enables invite delivery", () => {
    const dryRunPath = artifactPath("unsafe-public-request-dry-run.json");
    const invitePath = artifactPath("unsafe-invite-preflight.json");
    removeIfExists(dryRunPath);
    removeIfExists(invitePath);
    writeJsonArtifact(
      dryRunPath,
      validPublicRequestDryRun({ invite_delivery_allowed: true }),
    );

    const result = run("scripts/prepare-admin-invite-delivery-preflight.mjs", {
      OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH: dryRunPath,
      OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH: invitePath,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Invite delivery blocked");
  });

  it("refuses Auth admin dry-run when invite preflight enables product API", () => {
    const invitePath = artifactPath("unsafe-auth-invite-preflight.json");
    const authPath = artifactPath("unsafe-auth-admin-dry-run.json");
    removeIfExists(invitePath);
    removeIfExists(authPath);
    writeJsonArtifact(
      invitePath,
      validInvitePreflight({ auth_admin_product_api_allowed: true }),
    );

    const result = run(
      "scripts/prepare-admin-auth-admin-provisioning-dry-run.mjs",
      {
        OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH: invitePath,
        OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH: authPath,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Auth admin product API blocked");
  });

  it("refuses tampered inspect artifacts that enable blocked gates", () => {
    const invitePath = artifactPath("tampered-invite-preflight.json");
    const authPath = artifactPath("tampered-auth-admin-dry-run.json");
    removeIfExists(invitePath);
    removeIfExists(authPath);

    writeJsonArtifact(
      invitePath,
      validInvitePreflight({ invite_delivery_allowed: true }),
    );
    const inviteInspectResult = run(
      "scripts/inspect-admin-invite-delivery-preflight.mjs",
      {
        OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH: invitePath,
      },
    );
    expect(inviteInspectResult.status).not.toBe(0);
    expect(inviteInspectResult.stderr).toContain("Invite delivery blocked");

    writeJsonArtifact(
      authPath,
      validAuthAdminDryRun({ product_auth_admin_api_allowed: true }),
    );
    const authInspectResult = run(
      "scripts/inspect-admin-auth-admin-provisioning-dry-run.mjs",
      {
        OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH: authPath,
      },
    );
    expect(authInspectResult.status).not.toBe(0);
    expect(authInspectResult.stderr).toContain("Product Auth admin API blocked");
  });

  it("refuses secret-shaped values and keys during inspect", () => {
    const invitePath = artifactPath("secret-value-invite-preflight.json");
    const authPath = artifactPath("secret-key-auth-admin-dry-run.json");
    removeIfExists(invitePath);
    removeIfExists(authPath);

    writeJsonArtifact(
      invitePath,
      validInvitePreflight({ invite_body_preview: "bearer leaked-token" }),
    );
    const inviteInspectResult = run(
      "scripts/inspect-admin-invite-delivery-preflight.mjs",
      {
        OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH: invitePath,
      },
    );
    expect(inviteInspectResult.status).not.toBe(0);
    expect(inviteInspectResult.stderr).toContain("secret-shaped value");

    writeJsonArtifact(authPath, {
      ...validAuthAdminDryRun(),
      operator_secret_note: "do not commit",
    });
    const authInspectResult = run(
      "scripts/inspect-admin-auth-admin-provisioning-dry-run.mjs",
      {
        OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH: authPath,
      },
    );
    expect(authInspectResult.status).not.toBe(0);
    expect(authInspectResult.stderr).toContain("secret-shaped key");
  });

  it("refuses artifact overwrite and path traversal", () => {
    const dryRunPath = artifactPath("overwrite-public-request-dry-run.json");
    const invitePath = artifactPath("overwrite-invite-preflight.json");
    removeIfExists(dryRunPath);
    removeIfExists(invitePath);
    writeJsonArtifact(dryRunPath, validPublicRequestDryRun());
    writeJsonArtifact(invitePath, {});

    const overwriteResult = run(
      "scripts/prepare-admin-invite-delivery-preflight.mjs",
      {
        OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH: dryRunPath,
        OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH: invitePath,
      },
    );
    expect(overwriteResult.status).not.toBe(0);
    expect(overwriteResult.stderr).toContain("already exists");

    const traversalResult = run(
      "scripts/prepare-admin-auth-admin-provisioning-dry-run.mjs",
      {
        OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH: "../unsafe.json",
        OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH: artifactPath(
          "traversal-auth-admin-dry-run.json",
        ),
      },
    );
    expect(traversalResult.status).not.toBe(0);
    expect(traversalResult.stderr).toContain("must stay inside repository");
  });
});
