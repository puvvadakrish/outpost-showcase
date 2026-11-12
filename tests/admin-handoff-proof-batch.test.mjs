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
  founderAdminHandoffProofBundle,
  founderAdminOperatorOnboardingRehearsal,
  founderAdminOwnerAccessCompletionProof,
  founderAdminStaffRosterHandoffEvidence,
} from "../src/domain/founder-admin-readiness";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminComponent = readFileSync(
  "src/components/founder-admin/FounderAdminReadinessConsole.tsx",
  "utf8",
);

function artifactPath(name) {
  const dir = "artifacts/test-admin-handoff-proof-batch";
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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

function validOwnerAccessEvidence(overrides = {}) {
  return {
    artifact_kind: "admin_owner_access_fulfillment_evidence",
    status: "admin_owner_access_fulfillment_evidence_prepared",
    generated_at: "2026-06-28T12:00:00.000Z",
    evidence_basis: "admin_auth_admin_provisioning_dry_run",
    auth_admin_provisioning_dry_run_path:
      "artifacts/test-admin-handoff-proof-batch/auth-admin-dry-run.json",
    auth_admin_provisioning_dry_run_sha256: "a".repeat(64),
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

function validStaffInviteNoSend(overrides = {}) {
  return {
    artifact_kind: "admin_staff_invite_no_send_preflight",
    status: "admin_staff_invite_no_send_preflight_prepared",
    generated_at: "2026-06-28T12:00:00.000Z",
    evidence_basis: "admin_owner_access_fulfillment_evidence",
    owner_access_fulfillment_evidence_path:
      "artifacts/test-admin-handoff-proof-batch/owner-access.json",
    owner_access_fulfillment_evidence_sha256: artifactSha256(
      validOwnerAccessEvidence(),
    ),
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

function buildProofChain(prefix) {
  const ownerAccessPath = artifactPath(`${prefix}-owner-access.json`);
  const staffPreflightPath = artifactPath(`${prefix}-staff-preflight.json`);
  const ownerCompletionPath = artifactPath(`${prefix}-owner-completion.json`);
  const staffHandoffPath = artifactPath(`${prefix}-staff-handoff.json`);
  const rehearsalPath = artifactPath(`${prefix}-operator-rehearsal.json`);
  const bundlePath = artifactPath(`${prefix}-handoff-bundle.json`);

  for (const path of [
    ownerAccessPath,
    staffPreflightPath,
    ownerCompletionPath,
    staffHandoffPath,
    rehearsalPath,
    bundlePath,
  ]) {
    removeIfExists(path);
  }

  writeJsonArtifact(ownerAccessPath, validOwnerAccessEvidence());
  writeJsonArtifact(staffPreflightPath, validStaffInviteNoSend());

  const ownerResult = run(
    "scripts/prepare-admin-owner-access-completion-proof.mjs",
    {
      OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerAccessPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PREVIEW_URL:
        "https://preview.example.test",
      OUTPOST_ADMIN_OWNER_ACCESS_PREVIEW_SIGN_IN_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_WORKSPACE_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_HANDOFF_PACKET_REVIEWED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_RESET_ROLLBACK_REVIEWED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
    },
  );
  expect(ownerResult.status, ownerResult.stderr).toBe(0);

  const staffResult = run(
    "scripts/prepare-admin-staff-roster-handoff-evidence.mjs",
    {
      OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH: staffPreflightPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
      OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH: staffHandoffPath,
      OUTPOST_ADMIN_STAFF_ROSTER_CLAIM_PATH_OBSERVED: "yes",
      OUTPOST_ADMIN_STAFF_ROSTER_WORKBOARD_OBSERVED: "yes",
      OUTPOST_ADMIN_STAFF_ROSTER_OWNER_MANAGED_REVIEWED: "yes",
      OUTPOST_ADMIN_STAFF_ROSTER_INVITE_DELIVERY_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_STAFF_ROSTER_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
    },
  );
  expect(staffResult.status, staffResult.stderr).toBe(0);

  const rehearsalResult = run(
    "scripts/record-admin-operator-onboarding-rehearsal.mjs",
    {
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
      OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH: staffHandoffPath,
      OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_OPERATOR_ONBOARDING_OWNER_WORKSPACE_REHEARSED: "yes",
      OUTPOST_ADMIN_OPERATOR_ONBOARDING_STAFF_WORKBOARD_REHEARSED: "yes",
      OUTPOST_ADMIN_OPERATOR_ONBOARDING_MANUAL_SOURCE_FLOW_REHEARSED: "yes",
      OUTPOST_ADMIN_OPERATOR_ONBOARDING_RESET_ROLLBACK_REHEARSED: "yes",
      OUTPOST_ADMIN_OPERATOR_ONBOARDING_SUPPORT_PACKET_REHEARSED: "yes",
      OUTPOST_ADMIN_OPERATOR_ONBOARDING_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED:
        "yes",
    },
  );
  expect(rehearsalResult.status, rehearsalResult.stderr).toBe(0);

  const bundleResult = run("scripts/prepare-admin-handoff-proof-bundle.mjs", {
    OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH: rehearsalPath,
    OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: bundlePath,
  });
  expect(bundleResult.status, bundleResult.stderr).toBe(0);

  return {
    ownerAccessPath,
    staffPreflightPath,
    ownerCompletionPath,
    staffHandoffPath,
    rehearsalPath,
    bundlePath,
  };
}

describe("admin handoff proof batch", () => {
  it("wires package scripts, domain packets, and Admin portal panels", () => {
    expect(packageJson).toContain('"admin:owner-access:completion-proof"');
    expect(packageJson).toContain('"admin:staff-roster:handoff-evidence"');
    expect(packageJson).toContain('"admin:operator-onboarding:rehearsal"');
    expect(packageJson).toContain('"admin:handoff-proof:bundle"');

    const proofLedger = {
      branchName: "outpost-proof-batch",
      previewUrl: "https://preview.example.test",
    };
    const ownerPacket = founderAdminOwnerAccessCompletionProof(proofLedger);
    const staffPacket = founderAdminStaffRosterHandoffEvidence(proofLedger);
    const rehearsalPacket = founderAdminOperatorOnboardingRehearsal(proofLedger);
    const bundlePacket = founderAdminHandoffProofBundle(proofLedger);
    expect(ownerPacket.gates.every((gate) => gate.state === "blocked")).toBe(true);
    expect(staffPacket.gates.every((gate) => gate.state === "blocked")).toBe(true);
    expect(rehearsalPacket.gates.every((gate) => gate.state === "blocked")).toBe(
      true,
    );
    expect(bundlePacket.gates.every((gate) => gate.state === "blocked")).toBe(
      true,
    );
    expect(ownerPacket.commands.map((step) => step.command).join("\n")).toContain(
      "npm run admin:owner-access:completion-proof",
    );
    expect(staffPacket.commands.map((step) => step.command).join("\n")).toContain(
      "npm run admin:staff-roster:handoff-evidence",
    );
    expect(rehearsalPacket.commands.map((step) => step.command).join("\n"))
      .toContain("npm run admin:operator-onboarding:rehearsal");
    expect(bundlePacket.commands.map((step) => step.command).join("\n")).toContain(
      "npm run admin:handoff-proof:bundle",
    );
    expect(bundlePacket.nextTwoSlices.map((slice) => slice.id)).toEqual([
      "handoff_proof_bundle",
      "customer_observed_handoff_gate",
    ]);
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Owner access completion proof"',
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Staff roster handoff evidence"',
    );
    expect(founderAdminComponent).toContain(
      'ariaLabel: "Operator onboarding rehearsal"',
    );
    expect(founderAdminComponent).toContain('ariaLabel: "Handoff proof bundle"');
  });

  it("records and inspects the full owner staff handoff proof chain", () => {
    const ownerAccessPath = artifactPath("owner-access.json");
    const staffPreflightPath = artifactPath("staff-preflight.json");
    const ownerCompletionPath = artifactPath("owner-completion.json");
    const staffHandoffPath = artifactPath("staff-handoff.json");
    const rehearsalPath = artifactPath("operator-rehearsal.json");
    const bundlePath = artifactPath("handoff-bundle.json");
    for (const path of [
      ownerAccessPath,
      staffPreflightPath,
      ownerCompletionPath,
      staffHandoffPath,
      rehearsalPath,
      bundlePath,
    ]) {
      removeIfExists(path);
    }
    writeJsonArtifact(ownerAccessPath, validOwnerAccessEvidence());
    writeJsonArtifact(staffPreflightPath, validStaffInviteNoSend());

    const ownerResult = run(
      "scripts/prepare-admin-owner-access-completion-proof.mjs",
      {
        OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerAccessPath,
        OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
        OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PREVIEW_URL:
          "https://preview.example.test",
        OUTPOST_ADMIN_OWNER_ACCESS_PREVIEW_SIGN_IN_OBSERVED: "yes",
        OUTPOST_ADMIN_OWNER_ACCESS_WORKSPACE_OBSERVED: "yes",
        OUTPOST_ADMIN_OWNER_ACCESS_HANDOFF_PACKET_REVIEWED: "yes",
        OUTPOST_ADMIN_OWNER_ACCESS_RESET_ROLLBACK_REVIEWED: "yes",
        OUTPOST_ADMIN_OWNER_ACCESS_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
        OUTPOST_ADMIN_OWNER_ACCESS_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
      },
    );
    expect(ownerResult.status, ownerResult.stderr).toBe(0);
    expect(ownerResult.stdout).toContain("Customer-observed completion: blocked");
    const ownerInspect = run(
      "scripts/inspect-admin-owner-access-completion-proof.mjs",
      {
        OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
      },
    );
    expect(ownerInspect.status, ownerInspect.stderr).toBe(0);

    const staffResult = run(
      "scripts/prepare-admin-staff-roster-handoff-evidence.mjs",
      {
        OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH: staffPreflightPath,
        OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
        OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH: staffHandoffPath,
        OUTPOST_ADMIN_STAFF_ROSTER_CLAIM_PATH_OBSERVED: "yes",
        OUTPOST_ADMIN_STAFF_ROSTER_WORKBOARD_OBSERVED: "yes",
        OUTPOST_ADMIN_STAFF_ROSTER_OWNER_MANAGED_REVIEWED: "yes",
        OUTPOST_ADMIN_STAFF_ROSTER_INVITE_DELIVERY_NOT_OBSERVED: "yes",
        OUTPOST_ADMIN_STAFF_ROSTER_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
      },
    );
    expect(staffResult.status, staffResult.stderr).toBe(0);
    expect(staffResult.stdout).toContain("Staff roster handoff evidence wrote");
    const staffInspect = run(
      "scripts/inspect-admin-staff-roster-handoff-evidence.mjs",
      {
        OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH: staffHandoffPath,
      },
    );
    expect(staffInspect.status, staffInspect.stderr).toBe(0);

    const rehearsalResult = run(
      "scripts/record-admin-operator-onboarding-rehearsal.mjs",
      {
        OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
        OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH: staffHandoffPath,
        OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH: rehearsalPath,
        OUTPOST_ADMIN_OPERATOR_ONBOARDING_OWNER_WORKSPACE_REHEARSED: "yes",
        OUTPOST_ADMIN_OPERATOR_ONBOARDING_STAFF_WORKBOARD_REHEARSED: "yes",
        OUTPOST_ADMIN_OPERATOR_ONBOARDING_MANUAL_SOURCE_FLOW_REHEARSED: "yes",
        OUTPOST_ADMIN_OPERATOR_ONBOARDING_RESET_ROLLBACK_REHEARSED: "yes",
        OUTPOST_ADMIN_OPERATOR_ONBOARDING_SUPPORT_PACKET_REHEARSED: "yes",
        OUTPOST_ADMIN_OPERATOR_ONBOARDING_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED:
          "yes",
      },
    );
    expect(rehearsalResult.status, rehearsalResult.stderr).toBe(0);
    expect(rehearsalResult.stdout).toContain(
      "Internal end-to-end test readiness: prepared",
    );
    const rehearsalInspect = run(
      "scripts/inspect-admin-operator-onboarding-rehearsal.mjs",
      {
        OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH: rehearsalPath,
      },
    );
    expect(rehearsalInspect.status, rehearsalInspect.stderr).toBe(0);

    const bundleResult = run("scripts/prepare-admin-handoff-proof-bundle.mjs", {
      OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: bundlePath,
    });
    expect(bundleResult.status, bundleResult.stderr).toBe(0);
    expect(bundleResult.stdout).toContain("Admin handoff proof bundle wrote");
    const bundleInspect = run("scripts/inspect-admin-handoff-proof-bundle.mjs", {
      OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: bundlePath,
    });
    expect(bundleInspect.status, bundleInspect.stderr).toBe(0);

    const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
    expect(bundle).toMatchObject({
      artifact_kind: "admin_handoff_proof_bundle",
      ready_for_internal_end_to_end_test: true,
      customer_observed_completion_recorded: false,
      public_self_serve_launch_allowed: false,
      invite_delivery_allowed: false,
      live_provider_enablement_allowed: false,
      product_auth_admin_api_allowed: false,
      billing_pos_member_writes_allowed: false,
    });
    expect(bundle.replay_commands).toContain(
      "npm run admin:handoff-proof:bundle:inspect",
    );
  });

  it("fails closed on tampered parent hashes, unsafe paths, and secret-shaped content", () => {
    const ownerAccessPath = artifactPath("tamper-owner-access.json");
    const ownerCompletionPath = artifactPath("tamper-owner-completion.json");
    const bundlePath = artifactPath("tamper-bundle.json");
    for (const path of [ownerAccessPath, ownerCompletionPath, bundlePath]) {
      removeIfExists(path);
    }
    writeJsonArtifact(ownerAccessPath, validOwnerAccessEvidence());
    const ownerResult = run(
      "scripts/prepare-admin-owner-access-completion-proof.mjs",
      {
        OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerAccessPath,
        OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
        OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PREVIEW_URL:
          "https://preview.example.test",
        OUTPOST_ADMIN_OWNER_ACCESS_PREVIEW_SIGN_IN_OBSERVED: "yes",
        OUTPOST_ADMIN_OWNER_ACCESS_WORKSPACE_OBSERVED: "yes",
        OUTPOST_ADMIN_OWNER_ACCESS_HANDOFF_PACKET_REVIEWED: "yes",
        OUTPOST_ADMIN_OWNER_ACCESS_RESET_ROLLBACK_REVIEWED: "yes",
        OUTPOST_ADMIN_OWNER_ACCESS_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
        OUTPOST_ADMIN_OWNER_ACCESS_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
      },
    );
    expect(ownerResult.status, ownerResult.stderr).toBe(0);
    writeJsonArtifact(ownerAccessPath, validOwnerAccessEvidence({ notes: "changed" }));
    const tamperInspect = run(
      "scripts/inspect-admin-owner-access-completion-proof.mjs",
      {
        OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
      },
    );
    expect(tamperInspect.status).not.toBe(0);
    expect(tamperInspect.stderr).toContain("SHA256 mismatch");

    const unsafeResult = run("scripts/prepare-admin-handoff-proof-bundle.mjs", {
      OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH: "../outside.json",
      OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: bundlePath,
    });
    expect(unsafeResult.status).not.toBe(0);
    expect(unsafeResult.stderr).toContain("must stay inside repository");

    writeJsonArtifact(bundlePath, {
      artifact_kind: "admin_handoff_proof_bundle",
      status: "admin_handoff_proof_bundle_prepared",
      private_token: "abc",
    });
    const secretInspect = run("scripts/inspect-admin-handoff-proof-bundle.mjs", {
      OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: bundlePath,
    });
  expect(secretInspect.status).not.toBe(0);
  expect(secretInspect.stderr).toContain("secret-shaped key");
});

it("fails closed on live gate flips, local preview proof, missing observations, owner mismatch, and secret values", () => {
  const ownerAccessPath = artifactPath("closed-owner-access.json");
  const staffPreflightPath = artifactPath("closed-staff-preflight.json");
  const ownerCompletionPath = artifactPath("closed-owner-completion.json");
  const staffHandoffPath = artifactPath("closed-staff-handoff.json");

  for (const path of [
    ownerAccessPath,
    staffPreflightPath,
    ownerCompletionPath,
    staffHandoffPath,
  ]) {
    removeIfExists(path);
  }

  writeJsonArtifact(ownerAccessPath, validOwnerAccessEvidence());
  const localPreviewResult = run(
    "scripts/prepare-admin-owner-access-completion-proof.mjs",
    {
      OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerAccessPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PREVIEW_URL:
        "https://localhost:3000",
      OUTPOST_ADMIN_OWNER_ACCESS_PREVIEW_SIGN_IN_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_WORKSPACE_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_HANDOFF_PACKET_REVIEWED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_RESET_ROLLBACK_REVIEWED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
    },
  );
  expect(localPreviewResult.status).not.toBe(0);
  expect(localPreviewResult.stderr).toContain("must not be local");

  const missingObservationResult = run(
    "scripts/prepare-admin-owner-access-completion-proof.mjs",
    {
      OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerAccessPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PREVIEW_URL:
        "https://preview.example.test",
      OUTPOST_ADMIN_OWNER_ACCESS_PREVIEW_SIGN_IN_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_WORKSPACE_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_HANDOFF_PACKET_REVIEWED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_RESET_ROLLBACK_REVIEWED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
    },
  );
  expect(missingObservationResult.status).not.toBe(0);
  expect(missingObservationResult.stderr).toContain(
    "OUTPOST_ADMIN_OWNER_ACCESS_UNEXPECTED_DATA_NOT_OBSERVED=yes is required",
  );

  writeJsonArtifact(
    ownerAccessPath,
    validOwnerAccessEvidence({
      live_provider_enablement_allowed: true,
    }),
  );
  const liveGateResult = run(
    "scripts/prepare-admin-owner-access-completion-proof.mjs",
    {
      OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerAccessPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PREVIEW_URL:
        "https://preview.example.test",
      OUTPOST_ADMIN_OWNER_ACCESS_PREVIEW_SIGN_IN_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_WORKSPACE_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_HANDOFF_PACKET_REVIEWED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_RESET_ROLLBACK_REVIEWED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
    },
  );
  expect(liveGateResult.status).not.toBe(0);
  expect(liveGateResult.stderr).toContain("Live providers blocked");

  writeJsonArtifact(
    ownerAccessPath,
    validOwnerAccessEvidence({
      operator_access_method:
        "napi_test_fake_key_0000000000000000000000000000000000000000000000000000",
    }),
  );
  const secretValueResult = run(
    "scripts/prepare-admin-owner-access-completion-proof.mjs",
    {
      OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerAccessPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PREVIEW_URL:
        "https://preview.example.test",
      OUTPOST_ADMIN_OWNER_ACCESS_PREVIEW_SIGN_IN_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_WORKSPACE_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_HANDOFF_PACKET_REVIEWED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_RESET_ROLLBACK_REVIEWED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
    },
  );
  expect(secretValueResult.status).not.toBe(0);
  expect(secretValueResult.stderr).toContain("secret-shaped value");

  writeJsonArtifact(ownerAccessPath, validOwnerAccessEvidence());
  const ownerResult = run(
    "scripts/prepare-admin-owner-access-completion-proof.mjs",
    {
      OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH: ownerAccessPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PREVIEW_URL:
        "https://preview.example.test",
      OUTPOST_ADMIN_OWNER_ACCESS_PREVIEW_SIGN_IN_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_WORKSPACE_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_HANDOFF_PACKET_REVIEWED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_RESET_ROLLBACK_REVIEWED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_UNEXPECTED_DATA_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_OWNER_ACCESS_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
    },
  );
  expect(ownerResult.status, ownerResult.stderr).toBe(0);
  writeJsonArtifact(
    staffPreflightPath,
    validStaffInviteNoSend({ reviewed_owner_email: "other@northloop.example" }),
  );
  const ownerMismatchResult = run(
    "scripts/prepare-admin-staff-roster-handoff-evidence.mjs",
    {
      OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH: staffPreflightPath,
      OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH: ownerCompletionPath,
      OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH: staffHandoffPath,
      OUTPOST_ADMIN_STAFF_ROSTER_CLAIM_PATH_OBSERVED: "yes",
      OUTPOST_ADMIN_STAFF_ROSTER_WORKBOARD_OBSERVED: "yes",
      OUTPOST_ADMIN_STAFF_ROSTER_OWNER_MANAGED_REVIEWED: "yes",
      OUTPOST_ADMIN_STAFF_ROSTER_INVITE_DELIVERY_NOT_OBSERVED: "yes",
      OUTPOST_ADMIN_STAFF_ROSTER_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED: "yes",
    },
  );
  expect(ownerMismatchResult.status).not.toBe(0);
  expect(ownerMismatchResult.stderr).toContain(
    "Staff preflight owner must match owner completion",
  );
});

it("bundle inspection fails closed on deep parent tampering", () => {
  const { ownerCompletionPath, bundlePath } = buildProofChain("deep-tamper");

  const ownerCompletion = JSON.parse(readFileSync(ownerCompletionPath, "utf8"));
  writeJsonArtifact(ownerCompletionPath, {
    ...ownerCompletion,
    reviewed_owner_email: "tampered-owner@northloop.example",
  });

  const bundleInspect = run("scripts/inspect-admin-handoff-proof-bundle.mjs", {
    OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH: bundlePath,
  });
  expect(bundleInspect.status).not.toBe(0);
  expect(bundleInspect.stderr).toContain("Owner completion grandparent SHA mismatch");
});
});
