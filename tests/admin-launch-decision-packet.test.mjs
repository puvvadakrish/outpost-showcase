import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const prepareScript = readFileSync("scripts/prepare-hosted-launch-decision-packet.mjs", "utf8");
const inspectScript = readFileSync("scripts/inspect-admin-launch-decision-packet.mjs", "utf8");
const recordScript = readFileSync("scripts/record-admin-launch-decision.mjs", "utf8");
const followThroughScript = readFileSync("scripts/prepare-admin-launch-followthrough.mjs", "utf8");
const rehearsalPacketScript = readFileSync("scripts/prepare-operator-self-serve-rehearsal-packet.mjs", "utf8");
const rehearsalRecordScript = readFileSync("scripts/record-operator-self-serve-rehearsal.mjs", "utf8");
const betaRequestTriagePacketScript = readFileSync("scripts/prepare-owner-beta-request-triage-packet.mjs", "utf8");
const betaRequestTriageRecordScript = readFileSync("scripts/record-owner-beta-request-triage.mjs", "utf8");

function artifactPath(filename) {
  return join(mkdtempSync(join(tmpdir(), "outpost-admin-launch-decision-test-")), filename);
}

function writePacket(path, overrides = {}) {
  const packet = {
    status: "admin_launch_decision_packet_prepared",
    packet_kind: "manual_launch_review_packet",
    generated_at: "2026-06-24T00:00:00.000Z",
    preview_url: "https://outpost-preview-20260610-example.vercel.app",
    neon_proof_branch: "outpost-proof-records-202606240520",
    public_self_serve_launch_allowed: false,
    launch_enablement_allowed: false,
    requires_human_review: true,
    launch_package_recorded: true,
    launch_bundle_sha256: "b".repeat(64),
    artifacts: {
      packet_path: path,
      launch_bundle_path: path.replace("decision-packet.json", "launch-bundle.json"),
      export_path: path.replace("decision-packet.json", "launch-readiness.json"),
      promotion_path: path.replace("decision-packet.json", "promotion-candidate.json"),
      release_note_path: path.replace("decision-packet.json", "promotion-release-note.md")
    },
    launch_package_record: {
      id: "admin_launch_package_abc123",
      recorded_at: "2026-06-24T00:00:00.000Z",
      gym_name: "Summit Strength",
      owner_label: "owner@summitstrength.example",
      owner_message_sha256: "c".repeat(64),
      customer_handoff_recorded: true,
      public_self_serve_launch_allowed: false
    },
    ready_evidence: [
      "Protected Preview proof",
      "Admin portal proof",
      "Customer-observed handoff",
      "Operator fulfillment path",
      "Reset and rollback readiness",
      "Launch package record"
    ],
    blocked_gates: [
      "Public self-serve launch",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone provider activation",
      "Email provider activation",
      "Billing",
      "POS",
      "Access control",
      "Member-ledger writes"
    ],
    non_goals: [
      "public_self_signup",
      "browser_approval_buttons",
      "invite_delivery",
      "notification_sending",
      "phone_provider_activation",
      "email_provider_activation",
      "billing",
      "pos",
      "access_control",
      "member_ledger_writes"
    ],
    review_boundary:
      "This packet is a manual review artifact only. It does not approve launch, enable public self-serve, send invites, activate providers, or mutate member systems.",
    next_step:
      "Attach this packet to human launch review. Any future launch-enabling slice must be separately planned, reviewed, and proven.",
    ...overrides
  };

  writeFileSync(path, `${JSON.stringify(packet, null, 2)}\n`);
}

function inspectPacket(path) {
  return spawnSync("node", ["scripts/inspect-admin-launch-decision-packet.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH: path
    }
  });
}

function writeFollowThroughArtifact(path, overrides = {}) {
  const artifact = {
    status: "admin_launch_followthrough_prepared",
    generated_at: "2026-06-24T00:00:00.000Z",
    preview_url: "https://outpost-preview-20260610-example.vercel.app",
    neon_proof_branch: "outpost-proof-records-202606240520",
    public_self_serve_launch_allowed: false,
    launch_enablement_allowed: false,
    requires_human_review: true,
    recommended_next_slice: {
      id: "operator_assisted_self_serve_rehearsal",
      label: "Operator-assisted self-serve rehearsal"
    },
    launch_decision_record: {
      id: "admin_launch_decision_abc123",
      decision_packet_sha256: "d".repeat(64)
    },
    ...overrides
  };

  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
}

function prepareRehearsalPacket(followThroughPath, packetPath) {
  return spawnSync("node", ["scripts/prepare-operator-self-serve-rehearsal-packet.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_FOLLOWTHROUGH_PATH: followThroughPath,
      OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_PACKET_PATH: packetPath
    }
  });
}

function writeBetaRequestTriagePacket(path, overrides = {}) {
  const packet = {
    status: "owner_beta_request_triage_packet_prepared",
    packet_kind: "owner_beta_request_triage",
    generated_at: "2026-06-24T00:00:00.000Z",
    preview_url: "https://outpost-preview-20260610-example.vercel.app",
    neon_proof_branch: "outpost-proof-records-202606240520",
    request: {
      id: "owner_beta_request_abc123",
      owner_email: "owner@summitstrength.example",
      owner_name: "Jordan Owner",
      gym_name: "Summit Strength",
      location_hint: "Austin, TX",
      note_present: true,
      status: "new",
      request_count: 2,
      created_at: "2026-06-22T00:01:00.000Z",
      last_requested_at: "2026-06-22T00:07:00.000Z",
      fulfillment: {
        fulfilled: false,
        grant_linked: false
      }
    },
    public_self_serve_launch_allowed: false,
    launch_enablement_allowed: false,
    requires_human_review: true,
    completion_record_command: "npm run admin:beta-request:triage-record",
    triage_checklist: ["Record triage only with a customer-safe reviewer label and decision."],
    still_blocked: ["public owner self-signup", "phone or email provider activation"],
    ...overrides
  };

  writeFileSync(path, `${JSON.stringify(packet, null, 2)}\n`);
}

function recordBetaRequestTriage(packetPath, overrides = {}) {
  return spawnSync("node", ["scripts/record-owner-beta-request-triage.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-example.neonauth.neon.tech/neondb/auth",
      NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-example.apirest.neon.tech/neondb/rest/v1",
      OUTPOST_BETA_REQUEST_TRIAGE_DECISION: "ready_for_operator_fulfillment",
      OUTPOST_BETA_REQUEST_TRIAGE_PACKET_PATH: packetPath,
      OUTPOST_BETA_REQUEST_TRIAGE_REVIEWER_LABEL: "Krish",
      OUTPOST_NEON_BRANCH_NAME: "outpost-proof-records-202606240520",
      OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
      OUTPOST_NEON_SEED_PASSWORD: "local-test-password-that-is-long-enough",
      OUTPOST_VERCEL_DEPLOYMENT_URL: "https://outpost-preview-20260610-example.vercel.app",
      ...overrides
    }
  });
}

describe("admin launch decision packet", () => {
  it("registers terminal-only packet commands with guarded proof checks", () => {
    expect(packageJson).toContain('"hosted:launch-decision:packet"');
    expect(packageJson).toContain("prepare-hosted-launch-decision-packet.mjs");
    expect(packageJson).toContain('"admin:launch-decision:inspect"');
    expect(packageJson).toContain("inspect-admin-launch-decision-packet.mjs");
    expect(packageJson).toContain('"admin:launch-decision:record"');
    expect(packageJson).toContain("record-admin-launch-decision.mjs");
    expect(packageJson).toContain('"admin:launch-decision:followthrough"');
    expect(packageJson).toContain("prepare-admin-launch-followthrough.mjs");
    expect(packageJson).toContain('"admin:self-serve-rehearsal:packet"');
  expect(packageJson).toContain("prepare-operator-self-serve-rehearsal-packet.mjs");
  expect(packageJson).toContain('"admin:self-serve-rehearsal:record"');
  expect(packageJson).toContain("record-operator-self-serve-rehearsal.mjs");
  expect(packageJson).toContain('"admin:beta-request:triage-packet"');
  expect(packageJson).toContain("prepare-owner-beta-request-triage-packet.mjs");
  expect(packageJson).toContain('"admin:beta-request:triage-record"');
  expect(packageJson).toContain("record-owner-beta-request-triage.mjs");
    expect(prepareScript).toContain("admin_launch_package_records");
    expect(prepareScript).toContain("inspect-admin-launch-readiness-bundle.mjs");
    expect(prepareScript).toContain("public_self_serve_launch_allowed");
    expect(prepareScript).toContain("launch_enablement_allowed: false");
    expect(prepareScript).toContain("requires_human_review: true");
    expect(inspectScript).toContain("launch_enablement_allowed === false");
    expect(recordScript).toContain("admin_launch_decision_records");
    expect(recordScript).toContain("inspect-admin-launch-decision-packet.mjs");
    expect(recordScript).toContain("reviewed_for_next_launch_slice");
    expect(recordScript).toContain("reviewerDigest");
    expect(recordScript).toContain("admin_launch_decision_records_unique_packet_review");
    expect(recordScript).toContain("Admin launch decision record id did not match the reviewer-specific business key");
    expect(recordScript).toContain("Admin launch decision record already existed");
    expect(recordScript).toContain("No matching hosted admin launch package record exists");
    expect(recordScript).toContain("unexpected_live_provider_records");
    expect(recordScript).toContain("Hosted provider records unexpectedly include live-provider configuration");
    expect(recordScript).not.toContain("OUTPOST_ADMIN_LAUNCH_DECISION_RECORD_ID");
    expect(recordScript).toContain("launch_enablement_allowed: false");
    expect(recordScript).toContain("public_self_serve_launch_allowed: false");
    expect(followThroughScript).toContain("admin_launch_followthrough_prepared");
    expect(followThroughScript).toContain("reviewed_for_next_launch_slice");
    expect(followThroughScript).toContain("unexpected_live_provider_records");
    expect(followThroughScript).toContain("No reviewed launch decision record exists");
    expect(followThroughScript).toContain("public owner self-signup");
    expect(followThroughScript).toContain("billing, POS, access control, member-ledger writes");
    expect(followThroughScript).toContain('!value.startsWith("INFO:") && value.startsWith("{")');
    expect(rehearsalPacketScript).toContain("operator_self_serve_rehearsal_packet_prepared");
    expect(rehearsalPacketScript).toContain("admin_launch_followthrough_prepared");
    expect(rehearsalPacketScript).toContain("operator_assisted_self_serve_rehearsal");
    expect(rehearsalPacketScript).toContain("public owner self-signup");
  expect(rehearsalRecordScript).toContain("operator_self_serve_rehearsal_records");
  expect(rehearsalRecordScript).toContain("reviewed_for_next_launch_slice");
  expect(rehearsalRecordScript).toContain("public_self_serve_launch_allowed = false");
  expect(rehearsalRecordScript).toContain("launch_enablement_allowed = false");
  expect(betaRequestTriagePacketScript).toContain("owner_beta_request_triage_packet_prepared");
  expect(betaRequestTriagePacketScript).toContain("owner_beta_access_requests");
  expect(betaRequestTriagePacketScript).toContain("public owner self-signup");
  expect(betaRequestTriagePacketScript).toContain("unexpected_live_provider_records");
  expect(betaRequestTriageRecordScript).toContain("owner_beta_access_request_triage_receipts");
  expect(betaRequestTriageRecordScript).toContain("ready_for_operator_fulfillment");
  expect(betaRequestTriageRecordScript).toContain("public_self_serve_launch_allowed");
  expect(betaRequestTriageRecordScript).toContain("launch_enablement_allowed");
    expect(prepareScript).not.toMatch(/sendInvite|sendEmail|bootstrap_owner_tenant|provider_ingress/iu);
    expect(recordScript).not.toMatch(/sendInvite|sendEmail|bootstrap_owner_tenant|provider_ingress/iu);
    expect(followThroughScript).not.toMatch(/sendInvite|sendEmail|bootstrap_owner_tenant|provider_ingress/iu);
  expect(rehearsalPacketScript).not.toMatch(/sendInvite|sendEmail|bootstrap_owner_tenant|provider_ingress/iu);
  expect(rehearsalRecordScript).not.toMatch(/sendInvite|sendEmail|bootstrap_owner_tenant|provider_ingress/iu);
  expect(betaRequestTriagePacketScript).not.toMatch(/sendInvite|sendEmail|bootstrap_owner_tenant|provider_ingress/iu);
  expect(betaRequestTriageRecordScript).not.toMatch(/sendInvite|sendEmail|bootstrap_owner_tenant|provider_ingress/iu);
 });

 it("writes sanitized operator self-serve rehearsal packets and rejects launch enablement", () => {
  const followThroughPath = artifactPath("admin-launch-followthrough.json");
  const packetPath = artifactPath("operator-self-serve-rehearsal.json");
  writeFollowThroughArtifact(followThroughPath);

  let result = prepareRehearsalPacket(followThroughPath, packetPath);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Operator-assisted self-serve rehearsal packet wrote");
  expect(result.stdout).toContain("Public self-serve launch: blocked");
  expect(result.stdout).toContain("Live providers: blocked");

  const packet = JSON.parse(readFileSync(packetPath, "utf8"));
  expect(packet).toMatchObject({
   status: "operator_self_serve_rehearsal_packet_prepared",
   packet_kind: "operator_assisted_self_serve_rehearsal",
   preview_url: "https://outpost-preview-20260610-example.vercel.app",
   neon_proof_branch: "outpost-proof-records-202606240520",
   public_self_serve_launch_allowed: false,
   launch_enablement_allowed: false,
   requires_human_review: true,
   completion_record_command: "npm run admin:self-serve-rehearsal:record"
  });
  expect(packet.operator_rehearsal_checklist).toEqual(
   expect.arrayContaining([expect.stringContaining("Record completion only with customer-safe labels")])
  );
  expect(JSON.stringify(packet)).not.toMatch(
   /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}|\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@|\bnapi_[A-Za-z0-9]{20,}|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/iu
  );

  writeFollowThroughArtifact(followThroughPath, { launch_enablement_allowed: true });
  result = prepareRehearsalPacket(followThroughPath, artifactPath("operator-self-serve-rehearsal-blocked.json"));
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("follow-through artifact must keep launch enablement blocked");
 });

 it("rejects unsafe owner beta request triage packets before hosted write", () => {
  const packetPath = artifactPath("owner-beta-request-triage.json");
  writeBetaRequestTriagePacket(packetPath, { launch_enablement_allowed: true });

  const result = recordBetaRequestTriage(packetPath);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("packet must keep launch enablement blocked");

  const productionPacketPath = artifactPath("owner-beta-request-triage-production.json");
  writeBetaRequestTriagePacket(productionPacketPath, {
    preview_url: "https://outpost.vercel.app"
  });
  const productionResult = recordBetaRequestTriage(productionPacketPath);
  expect(productionResult.status).not.toBe(0);
  expect(productionResult.stderr).toContain("packet Preview URL must match env");
 });

 it("fails closed without hosted Neon configuration", () => {
    const packetPath = artifactPath("decision-packet.json");
    const result = spawnSync("node", ["scripts/prepare-hosted-launch-decision-packet.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH: packetPath
      }
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("OUTPOST_NEON_PROJECT_ID is required");
  });

  it("keeps launch decision recording terminal-only and fail-closed", () => {
    const packetPath = artifactPath("decision-packet.json");
    writePacket(packetPath);
    const result = spawnSync("node", ["scripts/record-admin-launch-decision.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        OUTPOST_ADMIN_LAUNCH_DECISION: "reviewed_for_next_launch_slice",
        OUTPOST_ADMIN_LAUNCH_DECISION_NOTE: "Manual review looked ready for the next planned slice.",
        OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH: packetPath,
        OUTPOST_ADMIN_LAUNCH_DECISION_REVIEWER: "Krish"
      }
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("OUTPOST_NEON_PROJECT_ID is required");
    expect(recordScript).toContain("VALID_DECISIONS");
    expect(recordScript).toContain("Refusing admin launch decision record against the Neon production branch");
    expect(recordScript).toContain("Refusing admin launch decision record against the migration spike branch");
    expect(recordScript).toContain("packet must keep launch enablement blocked");
    expect(recordScript).toContain("packet must keep public self-serve blocked");
  });

  it("inspects a sanitized launch decision packet and rejects launch enablement", () => {
    const packetPath = artifactPath("decision-packet.json");
    writePacket(packetPath);

    let result = inspectPacket(packetPath);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Manual launch review: required");
    expect(result.stdout).toContain("Public self-serve launch: blocked");

    writePacket(packetPath, { public_self_serve_launch_allowed: true });
    result = inspectPacket(packetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("public self-serve must not be launch-allowed");

    writePacket(packetPath, { launch_enablement_allowed: true });
    result = inspectPacket(packetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("launch enablement must remain blocked");
  });

  it("rejects unsafe Preview origins and hosted branch names during inspection", () => {
    const packetPath = artifactPath("decision-packet.json");

    writePacket(packetPath, { preview_url: "https://outpost.vercel.app" });
    let result = inspectPacket(packetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("packet Preview URL must not target a production-like Vercel origin");

    writePacket(packetPath, { preview_url: "https://user:pass@outpost-preview-20260610-example.vercel.app" });
    result = inspectPacket(packetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("packet Preview URL must not include embedded credentials");

    writePacket(packetPath, { preview_url: "https://evil.example/?next=.vercel.app" });
    result = inspectPacket(packetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("packet Preview URL must be a Vercel Preview URL");

    writePacket(packetPath, { neon_proof_branch: "production" });
    result = inspectPacket(packetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("packet Neon proof branch must not be production");

    writePacket(packetPath, { neon_proof_branch: "outpost-neon-spike" });
    result = inspectPacket(packetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("packet Neon proof branch must not be the migration spike branch");
  });
});
