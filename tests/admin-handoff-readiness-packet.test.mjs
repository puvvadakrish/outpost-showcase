import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const packetScript = readFileSync("scripts/prepare-admin-handoff-readiness-packet.mjs", "utf8");
const inspectScript = readFileSync("scripts/inspect-admin-handoff-readiness-packet.mjs", "utf8");
const replayScript = readFileSync("scripts/replay-admin-handoff-readiness-packet.mjs", "utf8");
const recordScript = readFileSync("scripts/record-admin-handoff-readiness-packet.mjs", "utf8");
const hostedProofScript = readFileSync("scripts/verify-admin-handoff-readiness-hosted-proof.mjs", "utf8");
const recordMigration = readFileSync("neon/migrations/20260625010000_admin_handoff_packet_records.sql", "utf8");

function artifactDir() {
  mkdirSync("artifacts/admin-handoff-packet-tests", { recursive: true });
  return mkdtempSync("artifacts/admin-handoff-packet-tests/run-");
}

function runNode(script, env) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env
    }
  });
}

function writeProofFreshness(path, overrides = {}) {
  return runNode("scripts/export-admin-proof-freshness.mjs", {
    OUTPOST_ADMIN_PROOF_FRESHNESS_BLOCKED_COUNT: "0",
    OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH: path,
    OUTPOST_ADMIN_PROOF_FRESHNESS_FRESH_COUNT: "7",
    OUTPOST_ADMIN_PROOF_FRESHNESS_MISSING_COUNT: "0",
    OUTPOST_ADMIN_PROOF_FRESHNESS_NEXT_COMMAND: "none",
    OUTPOST_ADMIN_PROOF_FRESHNESS_OVERALL: "fresh",
    OUTPOST_ADMIN_PROOF_FRESHNESS_PREVIEW_URL: "https://outpost-preview.example.vercel.app",
    OUTPOST_ADMIN_PROOF_FRESHNESS_STALE_COUNT: "0",
    OUTPOST_NEON_BRANCH_NAME: "outpost-beta-access-scoped-proof",
    ...overrides
  });
}

function writeNextActions(path, overrides = {}) {
  return runNode("scripts/export-admin-operator-next-actions.mjs", {
    OUTPOST_ADMIN_NEXT_ACTIONS_ACTION_ID: "launch_readiness_export",
    OUTPOST_ADMIN_NEXT_ACTIONS_COMMAND: "npm run admin:launch-readiness:export",
    OUTPOST_ADMIN_NEXT_ACTIONS_DETAIL: "Writes secret-scanned JSON artifact under ignored artifacts/.",
    OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH: path,
    OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_FRESH_COUNT: "7",
    OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_MISSING_COUNT: "0",
    OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STALE_COUNT: "0",
    OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STATE: "fresh",
    OUTPOST_ADMIN_NEXT_ACTIONS_LABEL: "Write launch-readiness export",
    OUTPOST_ADMIN_NEXT_ACTIONS_PREVIEW_URL: "https://outpost-preview.example.vercel.app",
    OUTPOST_ADMIN_NEXT_ACTIONS_SOURCE: "Launch readiness",
    OUTPOST_ADMIN_NEXT_ACTIONS_STATE: "next",
    OUTPOST_NEON_BRANCH_NAME: "outpost-beta-access-scoped-proof",
    ...overrides
  });
}

function writeLaunchReadiness(path, overrides = {}) {
  const artifact = {
    artifact_kind: "admin_launch_readiness",
    generated_at: "2026-06-25T00:00:00.000Z",
    gates: [
      { label: "Protected Preview proof", state: "ready" },
      { label: "Public self-serve launch", state: "blocked" },
      { label: "Live-provider and billing gates", state: "blocked" }
    ],
    neon_branch_name: "outpost-beta-access-scoped-proof",
    preview_url: "https://outpost-preview.example.vercel.app",
    public_self_serve_launch_allowed: false,
    status: "admin_launch_readiness_exported",
    ...overrides
  };
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return { status: 0 };
}

function writePacket({ launchPath, nextPath, packetPath, proofPath }, overrides = {}) {
  return runNode("scripts/prepare-admin-handoff-readiness-packet.mjs", {
    OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH: packetPath,
    OUTPOST_ADMIN_HANDOFF_READINESS_PREVIEW_URL: "https://outpost-preview.example.vercel.app",
    OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH: launchPath,
    OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH: nextPath,
    OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH: proofPath,
    OUTPOST_NEON_BRANCH_NAME: "outpost-beta-access-scoped-proof",
    ...overrides
  });
}

function inspectPacket(packetPath) {
  return runNode("scripts/inspect-admin-handoff-readiness-packet.mjs", {
    OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH: packetPath
  });
}

function replayPacket({ launchPath, nextPath, packetPath, proofPath }) {
  return runNode("scripts/replay-admin-handoff-readiness-packet.mjs", {
    OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH: packetPath,
    OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH: launchPath,
    OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH: nextPath,
    OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH: proofPath
  });
}

function seedArtifacts() {
  const dir = artifactDir();
  const paths = {
    launchPath: join(dir, "launch-readiness.json"),
    nextPath: join(dir, "next-actions.json"),
    packetPath: join(dir, "handoff-readiness-packet.json"),
    proofPath: join(dir, "proof-freshness.json")
  };
  expect(writeProofFreshness(paths.proofPath).status).toBe(0);
  expect(writeNextActions(paths.nextPath).status).toBe(0);
  expect(writeLaunchReadiness(paths.launchPath).status).toBe(0);
  return paths;
}

describe("Admin handoff readiness packet", () => {
  it("wires package scripts keeps no-live-provider boundaries visible", () => {
    expect(packageJson).toContain('"admin:handoff-readiness:packet"');
    expect(packageJson).toContain('"admin:handoff-readiness:inspect"');
    expect(packageJson).toContain('"admin:handoff-readiness:replay"');
    expect(packageJson).toContain('"admin:handoff-readiness:record"');
    expect(packageJson).toContain('"admin:handoff-readiness:hosted-proof"');
    expect(packetScript).toContain("admin_handoff_readiness_packet_exported");
    expect(inspectScript).toContain("Public self-serve");
    expect(replayScript).toContain("Packet proof freshness input path mismatch");
    expect(recordScript).toContain("insert into admin_handoff_packet_records");
    expect(hostedProofScript).toContain("admin_handoff_readiness_hosted_proof_passed");
    expect(hostedProofScript).toContain("scripts/replay-admin-handoff-readiness-packet.mjs");
    expect(hostedProofScript).toContain("scripts/record-admin-handoff-readiness-packet.mjs");
    expect(hostedProofScript).toContain("Refusing Admin handoff hosted proof against production branch");
    expect(hostedProofScript).toContain("Public self-serve and live-provider gates remain blocked.");
    expect(recordMigration).toContain("create table admin_handoff_packet_records");
    expect(recordMigration).toContain("list_founder_admin_handoff_packet_records");
    expect(recordMigration).toContain("from app_admins");
    expect(recordMigration).toContain("users.external_auth_id = v_auth_user_id");
    expect(recordMigration).toContain("app_admins.status = 'active'");
    expect(recordMigration).toContain("memberships.role = 'founder_admin'");
    expect(recordMigration).toContain("memberships.invite_status = 'active'");
    expect(recordMigration).not.toContain("users.auth_user_id");
    expect(recordMigration).not.toContain("auth.email()");
    expect(recordMigration).toContain("revoke all on admin_handoff_packet_records from public, anonymous, authenticated");
    expect(recordMigration).toContain("'review_note_present', recent_records.review_note_present");
    expect(recordMigration).not.toContain("'review_note'");
    expect(recordMigration).toContain("public_self_serve_launch_allowed = false");
    expect(recordMigration).toContain("live_provider_enablement_allowed = false");
  });

  it("writes inspects replays sanitized action-required packet existing artifacts", () => {
    const paths = seedArtifacts();
    const result = writePacket(paths);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Admin handoff readiness packet export");
    const artifact = JSON.parse(readFileSync(paths.packetPath, "utf8"));
    expect(artifact).toEqual(
      expect.objectContaining({
        artifact_kind: "admin_handoff_readiness_packet",
        live_provider_enablement_allowed: false,
        preview_url: "https://outpost-preview.example.vercel.app",
        public_self_serve_launch_allowed: false,
        readiness_state: "action_required",
        status: "admin_handoff_readiness_packet_exported"
      })
    );
    expect(artifact.packet_inputs).toEqual(
      expect.objectContaining({
        launch_readiness_export: expect.stringContaining("launch-readiness.json"),
        next_actions_export: expect.stringContaining("next-actions.json"),
        proof_freshness_export: expect.stringContaining("proof-freshness.json")
      })
    );
    expect(JSON.stringify(artifact)).not.toMatch(/NEON_API_KEY|VERCEL_AUTOMATION_BYPASS_SECRET|Bearer |napi_|password|cookie|jwt/iu);
    const inspected = inspectPacket(paths.packetPath);
    expect(inspected.status, inspected.stderr).toBe(0);
    expect(inspected.stdout).toContain("Admin handoff readiness packet inspection");
    const replayed = replayPacket(paths);
    expect(replayed.status, replayed.stderr).toBe(0);
    expect(replayed.stdout).toContain("Admin handoff readiness packet replay");
    expect(replayed.stdout).toContain("Proof freshness SHA256:");
  });

  it("replay rejects packet source artifact drift", () => {
    const paths = seedArtifacts();
    expect(writePacket(paths).status).toBe(0);
    const artifact = JSON.parse(readFileSync(paths.packetPath, "utf8"));
    artifact.packet_inputs.next_actions_export = "artifacts/admin-launch-readiness/other-next-actions.json";
    writeFileSync(paths.packetPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    const result = replayPacket(paths);
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("Packet next-actions input path mismatch");
  });

  it("refuses stale proof freshness before writing packet", () => {
    const paths = seedArtifacts();
    const stale = writeProofFreshness(paths.proofPath, {
      OUTPOST_ADMIN_PROOF_FRESHNESS_FRESH_COUNT: "6",
      OUTPOST_ADMIN_PROOF_FRESHNESS_OVERALL: "stale",
      OUTPOST_ADMIN_PROOF_FRESHNESS_STALE_COUNT: "1"
    });
    expect(stale.status).toBe(0);
    const result = writePacket(paths);
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("Proof freshness must be fresh");
  });

  it("inspector rejects tampered packet launch and provider flags", () => {
    const paths = seedArtifacts();
    expect(writePacket(paths).status).toBe(0);
    const artifact = JSON.parse(readFileSync(paths.packetPath, "utf8"));
    artifact.public_self_serve_launch_allowed = true;
    writeFileSync(paths.packetPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    const result = inspectPacket(paths.packetPath);
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("Public self-serve launch must stay blocked");
  });

  it("packet exporter rejects production and migration spike branches case-insensitively", () => {
    const paths = seedArtifacts();
    const productionResult = writePacket(paths, { OUTPOST_NEON_BRANCH_NAME: "Production" });
    expect(productionResult.status).not.toBe(0);
    expect(`${productionResult.stderr}${productionResult.stdout}`).toContain("production branch");
    const spikeResult = writePacket(paths, { OUTPOST_NEON_BRANCH_NAME: "OUTPOST-NEON-SPIKE" });
    expect(spikeResult.status).not.toBe(0);
    expect(`${spikeResult.stderr}${spikeResult.stdout}`).toContain("migration spike branch");
  });

  it("packet inspector rejects production and migration spike packet branches case-insensitively", () => {
    const paths = seedArtifacts();
    expect(writePacket(paths).status).toBe(0);
    const artifact = JSON.parse(readFileSync(paths.packetPath, "utf8"));
    artifact.neon_branch_name = "Production";
    writeFileSync(paths.packetPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    const productionResult = inspectPacket(paths.packetPath);
    expect(productionResult.status).not.toBe(0);
    expect(`${productionResult.stderr}${productionResult.stdout}`).toContain("production branch");
    artifact.neon_branch_name = "OUTPOST-NEON-SPIKE";
    writeFileSync(paths.packetPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    const spikeResult = inspectPacket(paths.packetPath);
    expect(spikeResult.status).not.toBe(0);
    expect(`${spikeResult.stderr}${spikeResult.stdout}`).toContain("migration spike branch");
  });
});
