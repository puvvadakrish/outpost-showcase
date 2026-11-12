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
import {
  founderAdminOwnerAccessFulfillmentEvidence,
  founderAdminStaffAccessPreflight,
  founderAdminStaffInviteNoSendPreflight,
} from "../src/domain/founder-admin-readiness";

const packageJson = readFileSync("package.json", "utf8");
const prepareOwnerAccessScript = readFileSync(
  "scripts/prepare-admin-owner-access-fulfillment-evidence.mjs",
  "utf8",
);
const inspectOwnerAccessScript = readFileSync(
  "scripts/inspect-admin-owner-access-fulfillment-evidence.mjs",
  "utf8",
);
const prepareStaffInviteScript = readFileSync(
  "scripts/prepare-admin-staff-invite-no-send-preflight.mjs",
  "utf8",
);
const inspectStaffInviteScript = readFileSync(
  "scripts/inspect-admin-staff-invite-no-send-preflight.mjs",
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
  const dir = "artifacts/test-admin-owner-access-staff-invite";
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

function validAuthAdminDryRun(overrides = {}) {
  return {
    artifact_kind: "admin_auth_admin_provisioning_dry_run",
    status: "admin_auth_admin_provisioning_dry_run_prepared",
    generated_at: "2026-06-27T12:00:00.000Z",
    evidence_basis: "admin_invite_delivery_preflight",
    invite_delivery_preflight_path:
      "artifacts/test-admin-owner-access-staff-invite/invite-preflight.json",
    invite_delivery_preflight_sha256: "a".repeat(64),
    provisioning_mode: "operator_review_only_no_user_created",
    reviewed_owner_email: "owner@northloop.example",
    auth_user_created: false,
    product_auth_admin_api_allowed: false,
    auth_admin_product_api_allowed: false,
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

function validOwnerAccessEvidence(overrides = {}) {
  return {
    artifact_kind: "admin_owner_access_fulfillment_evidence",
    status: "admin_owner_access_fulfillment_evidence_prepared",
    generated_at: "2026-06-27T12:00:00.000Z",
    evidence_basis: "admin_auth_admin_provisioning_dry_run",
    auth_admin_provisioning_dry_run_path:
      "artifacts/test-admin-owner-access-staff-invite/auth-admin-dry-run.json",
    auth_admin_provisioning_dry_run_sha256: "b".repeat(64),
    fulfillment_mode: "operator_managed_review_only",
    reviewed_owner_email: "owner@northloop.example",
    operator_access_method: "operator-runbook-reviewed-neon-auth-and-owner-grant",
    owner_access_verified_by_artifact: false,
    owner_access_created_by_product: false,
    product_auth_admin_api_allowed: false,
    auth_admin_product_api_allowed: false,
    automatic_owner_grant_allowed: false,
    browser_approval_buttons_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: [
      "Product Auth admin API",
      "Automatic owner grant",
      "Browser approval buttons",
      "Invite delivery send",
      "Notification sending",
      "Phone/email provider activation",
      "Billing, POS, access control, member-ledger writes",
    ],
    next_recommended_slice:
      "Prepare staff invite no-send preflight after owner access evidence is reviewed.",
    ...overrides,
  };
}

function validStaffInvitePreflight(overrides = {}) {
  return {
    artifact_kind: "admin_staff_invite_no_send_preflight",
    status: "admin_staff_invite_no_send_preflight_prepared",
    generated_at: "2026-06-27T12:00:00.000Z",
    evidence_basis: "admin_owner_access_fulfillment_evidence",
    owner_access_fulfillment_evidence_path:
      "artifacts/test-admin-owner-access-staff-invite/owner-access.json",
    owner_access_fulfillment_evidence_sha256: "c".repeat(64),
    staff_invite_mode: "review_only_no_send",
    reviewed_owner_email: "owner@northloop.example",
    staff_invite_audience: "coach@northloop.example",
    staff_role: "staff",
    location_label: "North Loop Strength",
    staff_invite_subject: "Outpost staff access for North Loop Strength",
    staff_invite_body_preview:
      "Operator-reviewed staff invite copy placeholder. Sending remains blocked.",
    browser_send_button_allowed: false,
    staff_invite_delivery_allowed: false,
    invite_delivery_allowed: false,
    notification_sending_allowed: false,
    outbound_email_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    product_auth_admin_api_allowed: false,
    staff_auth_user_created: false,
    staff_grant_automatic: false,
    billing_pos_member_writes_allowed: false,
    blocked_gates: [
      "Staff invite delivery send",
      "Notification sending",
      "Gmail, Resend, SMTP, provider webhooks",
      "Phone/email provider activation",
      "Product Auth admin API",
      "Automatic staff grant",
      "Billing, POS, access control, member-ledger writes",
    ],
    next_recommended_slice:
      "Create customer-visible owner access completion proof before enabling staff invite delivery.",
    ...overrides,
  };
}

describe("admin owner access and staff invite evidence", () => {
  it("wires package scripts, domain builders, and Admin portal panels", () => {
    expect(packageJson).toContain('"admin:owner-access:fulfillment"');
    expect(packageJson).toContain('"admin:staff-invite:no-send"');
    expect(prepareOwnerAccessScript).toContain(
      "admin_owner_access_fulfillment_evidence",
    );
    expect(inspectOwnerAccessScript).toContain(
      "Owner access fulfillment evidence OK",
    );
    expect(prepareStaffInviteScript).toContain(
      "admin_staff_invite_no_send_preflight",
    );
    expect(inspectStaffInviteScript).toContain(
      "Staff invite no-send preflight OK",
    );
    expect(founderAdminDomain).toContain(
      "founderAdminOwnerAccessFulfillmentEvidence",
    );
    expect(founderAdminDomain).toContain(
      "founderAdminStaffInviteNoSendPreflight",
    );
    expect(founderAdminDomain).toContain("founderAdminStaffAccessPreflight");
  expect(founderAdminComponent).toContain(
    'ariaLabel: "Owner access fulfillment evidence"',
  );
  expect(founderAdminComponent).toContain('ariaLabel: "Staff access preflight"');

  const proofLedger = {
    branchName: "outpost-admin-proof",
  };
  const ownerAccessPacket =
    founderAdminOwnerAccessFulfillmentEvidence(proofLedger);
  const staffAccessPacket = founderAdminStaffInviteNoSendPreflight(proofLedger);

  expect(founderAdminStaffAccessPreflight).toBe(
    founderAdminStaffInviteNoSendPreflight,
  );
  expect(ownerAccessPacket.artifactPath).toBe(
    "artifacts/admin-launch-readiness/outpost-admin-proof-owner-access-fulfillment-evidence.json",
  );
  expect(ownerAccessPacket.commands.map((step) => step.command).join("\n"))
    .toContain(
      "OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH='artifacts/admin-launch-readiness/outpost-admin-proof-auth-admin-provisioning-dry-run.json'",
    );
  expect(ownerAccessPacket.gates.every((gate) => gate.state === "blocked")).toBe(
    true,
  );
  expect(ownerAccessPacket.nextTwoSlices.map((slice) => slice.id)).toEqual([
    "staff_invite_no_send_preflight",
    "owner_access_completion_proof",
  ]);
  expect(staffAccessPacket.artifactPath).toBe(
    "artifacts/admin-launch-readiness/outpost-admin-proof-staff-invite-no-send-preflight.json",
  );
  expect(staffAccessPacket.commands.map((step) => step.command).join("\n"))
    .toContain(
      "OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH='artifacts/admin-launch-readiness/outpost-admin-proof-owner-access-fulfillment-evidence.json'",
    );
  expect(staffAccessPacket.gates.every((gate) => gate.state === "blocked")).toBe(
    true,
  );
  expect(staffAccessPacket.nextTwoSlices.map((slice) => slice.id)).toEqual([
    "owner_access_completion_proof",
    "staff_roster_claim_handoff_evidence",
  ]);
});

  it("prepares and inspects owner access evidence then staff invite no-send preflight", () => {
    const authPath = artifactPath("auth-admin-dry-run.json");
    const ownerPath = artifactPath("owner-access-evidence.json");
    const staffPath = artifactPath("staff-invite-no-send.json");
    for (const path of [authPath, ownerPath, staffPath]) {
      removeIfExists(path);
    }
    writeJsonArtifact(authPath, validAuthAdminDryRun());

    const ownerResult = run(
      "scripts/prepare-admin-owner-access-fulfillment-evidence.mjs",
      {
        OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH: authPath,
        OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerPath,
        OUTPOST_ADMIN_OWNER_ACCESS_EMAIL: "owner@northloop.example",
      },
    );
    expect(ownerResult.status, ownerResult.stderr).toBe(0);
    expect(ownerResult.stdout).toContain("Product Auth admin API: blocked");

    const ownerInspectResult = run(
      "scripts/inspect-admin-owner-access-fulfillment-evidence.mjs",
      {
        OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerPath,
      },
    );
    expect(ownerInspectResult.status, ownerInspectResult.stderr).toBe(0);

    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    expect(owner).toMatchObject({
      artifact_kind: "admin_owner_access_fulfillment_evidence",
      fulfillment_mode: "operator_managed_review_only",
      owner_access_created_by_product: false,
      product_auth_admin_api_allowed: false,
      automatic_owner_grant_allowed: false,
      invite_delivery_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(owner.auth_admin_provisioning_dry_run_sha256).toBe(
      artifactSha256(validAuthAdminDryRun()),
    );

    const staffResult = run(
      "scripts/prepare-admin-staff-invite-no-send-preflight.mjs",
      {
        OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerPath,
        OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH: staffPath,
        OUTPOST_ADMIN_STAFF_INVITE_AUDIENCE: "coach@northloop.example",
        OUTPOST_ADMIN_STAFF_INVITE_LOCATION_LABEL: "North Loop Strength",
      },
    );
    expect(staffResult.status, staffResult.stderr).toBe(0);
    expect(staffResult.stdout).toContain("Staff invite delivery: blocked");

    const staffInspectResult = run(
      "scripts/inspect-admin-staff-invite-no-send-preflight.mjs",
      {
        OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH: staffPath,
      },
    );
    expect(staffInspectResult.status, staffInspectResult.stderr).toBe(0);

    const staff = JSON.parse(readFileSync(staffPath, "utf8"));
    expect(staff).toMatchObject({
      artifact_kind: "admin_staff_invite_no_send_preflight",
      staff_invite_mode: "review_only_no_send",
      staff_invite_delivery_allowed: false,
      notification_sending_allowed: false,
      product_auth_admin_api_allowed: false,
      staff_auth_user_created: false,
      staff_grant_automatic: false,
    });
    expect(staff.owner_access_fulfillment_evidence_sha256).toBe(
      artifactSha256(owner),
    );
  });

  it("refuses unsafe parent artifacts", () => {
    const authPath = artifactPath("unsafe-auth-admin-dry-run.json");
    const ownerPath = artifactPath("unsafe-owner-access-evidence.json");
    const staffPath = artifactPath("unsafe-staff-invite-no-send.json");
    for (const path of [authPath, ownerPath, staffPath]) {
      removeIfExists(path);
    }

    writeJsonArtifact(
      authPath,
      validAuthAdminDryRun({ product_auth_admin_api_allowed: true }),
    );
    const ownerResult = run(
      "scripts/prepare-admin-owner-access-fulfillment-evidence.mjs",
      {
        OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH: authPath,
        OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerPath,
      },
    );
    expect(ownerResult.status).not.toBe(0);
    expect(ownerResult.stderr).toContain("Product Auth admin API blocked");

    writeJsonArtifact(
      ownerPath,
      validOwnerAccessEvidence({ invite_delivery_allowed: true }),
    );
    const staffResult = run(
      "scripts/prepare-admin-staff-invite-no-send-preflight.mjs",
      {
        OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerPath,
        OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH: staffPath,
      },
    );
    expect(staffResult.status).not.toBe(0);
    expect(staffResult.stderr).toContain("Invite delivery blocked");
  });

  it("refuses tampered inspect artifacts and secret-shaped artifacts", () => {
    const ownerPath = artifactPath("tampered-owner-access-evidence.json");
    const staffPath = artifactPath("tampered-staff-invite-no-send.json");
    removeIfExists(ownerPath);
    removeIfExists(staffPath);

    writeJsonArtifact(
      ownerPath,
      validOwnerAccessEvidence({ automatic_owner_grant_allowed: true }),
    );
    const ownerInspectResult = run(
      "scripts/inspect-admin-owner-access-fulfillment-evidence.mjs",
      {
        OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerPath,
      },
    );
    expect(ownerInspectResult.status).not.toBe(0);
    expect(ownerInspectResult.stderr).toContain("Automatic owner grant blocked");

    writeJsonArtifact(
      staffPath,
      validStaffInvitePreflight({ staff_invite_delivery_allowed: true }),
    );
    const staffInspectResult = run(
      "scripts/inspect-admin-staff-invite-no-send-preflight.mjs",
      {
        OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH: staffPath,
      },
    );
    expect(staffInspectResult.status).not.toBe(0);
    expect(staffInspectResult.stderr).toContain("Staff invite delivery blocked");

    writeJsonArtifact(ownerPath, {
      ...validOwnerAccessEvidence(),
      operator_secret_note: "do not commit",
    });
    const secretKeyResult = run(
      "scripts/inspect-admin-owner-access-fulfillment-evidence.mjs",
      {
        OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerPath,
      },
    );
    expect(secretKeyResult.status).not.toBe(0);
    expect(secretKeyResult.stderr).toContain("secret-shaped key");

    writeJsonArtifact(
      staffPath,
      validStaffInvitePreflight({ staff_invite_body_preview: "bearer leaked-token" }),
    );
    const secretValueResult = run(
      "scripts/inspect-admin-staff-invite-no-send-preflight.mjs",
      {
        OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH: staffPath,
      },
    );
    expect(secretValueResult.status).not.toBe(0);
    expect(secretValueResult.stderr).toContain("secret-shaped value");
  });

  it("refuses artifact overwrite and path traversal", () => {
    const authPath = artifactPath("overwrite-auth-admin-dry-run.json");
    const ownerPath = artifactPath("overwrite-owner-access-evidence.json");
    removeIfExists(authPath);
    removeIfExists(ownerPath);
    writeJsonArtifact(authPath, validAuthAdminDryRun());
    writeJsonArtifact(ownerPath, {});

    const overwriteResult = run(
      "scripts/prepare-admin-owner-access-fulfillment-evidence.mjs",
      {
        OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH: authPath,
        OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerPath,
      },
    );
    expect(overwriteResult.status).not.toBe(0);
    expect(overwriteResult.stderr).toContain("already exists");

    const traversalResult = run(
      "scripts/prepare-admin-staff-invite-no-send-preflight.mjs",
      {
        OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: "../unsafe.json",
        OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH: artifactPath(
          "traversal-staff-invite-no-send.json",
        ),
      },
    );
    expect(traversalResult.status).not.toBe(0);
    expect(traversalResult.stderr).toContain("must stay inside repository");
  });
});
