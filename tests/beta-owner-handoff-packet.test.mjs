import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const packetScript = readFileSync("scripts/prepare-beta-owner-handoff-packet.mjs", "utf8");
const operatorRunbook = readFileSync("docs/setup/hosted-beta-operator-access.md", "utf8");

function packetPath() {
  return join(mkdtempSync(join(tmpdir(), "outpost-beta-owner-packet-test-")), "packet.md");
}

function baseEnv(overrides = {}) {
  return {
    OUTPOST_BETA_HANDOFF_GYM_NAME: "Summit Strength",
    OUTPOST_BETA_HANDOFF_OWNER_EMAIL: "owner@summitstrength.example",
    OUTPOST_BETA_HANDOFF_OWNER_NAME: "Jordan Owner",
    OUTPOST_BETA_HANDOFF_OPERATOR_NAME: "Krish",
    OUTPOST_BETA_HANDOFF_PACKET_PATH: packetPath(),
    OUTPOST_BETA_HANDOFF_PREVIEW_URL: "https://outpost-preview-20260610-example.vercel.app",
    OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW: "June beta proof window",
    OUTPOST_NEON_BRANCH_NAME: "outpost-beta-access-scoped-20260622120000",
    ...overrides
  };
}

function runPacket(env) {
  return spawnSync("node", ["scripts/prepare-beta-owner-handoff-packet.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env
    }
  });
}

describe("beta owner handoff packet", () => {
  it("registers a generic operator handoff packet command", () => {
    expect(packageJson).toContain('"beta:owner-handoff:packet"');
    expect(packageJson).toContain("prepare-beta-owner-handoff-packet.mjs");
  });

  it("writes a customer-safe packet for an operator-assisted beta gym", () => {
    const env = baseEnv();
    const result = runPacket(env);

    expect(result.status, result.stderr).toBe(0);
    const packet = readFileSync(env.OUTPOST_BETA_HANDOFF_PACKET_PATH, "utf8");
    expect(packet).toContain("# Summit Strength Beta Owner Handoff Packet");
    expect(packet).toContain("owner@summitstrength.example");
    expect(packet).toContain("outpost-beta-access-scoped-20260622120000");
    expect(packet).toContain("operator-assisted beta");
    expect(packet).toContain("| Live-provider status | blocked |");
    expect(packet).toContain("manual source facts to answer review to staff task handoff");
    expect(packet).toContain("Public self-signup is not open.");
    expect(packet).toContain("Invite email and notification delivery are off.");
    expect(packet).toContain("Phone, email, billing, POS, access control, and member-ledger writes are blocked.");
    expect(packet).toContain("No claim that a customer-observed handoff has completed");
    expect(packet).not.toContain("napi_");
    expect(packet).not.toContain("Bearer ");
    expect(packet).not.toContain("__Secure-neon-auth");
  });

  it("fails closed when required inputs are missing or malformed", () => {
    let result = runPacket(baseEnv({ OUTPOST_BETA_HANDOFF_GYM_NAME: "" }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("OUTPOST_BETA_HANDOFF_GYM_NAME is required");

    result = runPacket(baseEnv({ OUTPOST_BETA_HANDOFF_OWNER_EMAIL: "not-an-email" }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("beta owner email must be an email address");

    result = runPacket(baseEnv({ OUTPOST_BETA_HANDOFF_PREVIEW_URL: "http://localhost:3000" }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("protected Preview URL must use https");
  });

  it("fails closed for tracked repo output paths and secret-shaped values", () => {
    let result = runPacket(baseEnv({ OUTPOST_BETA_HANDOFF_PACKET_PATH: "docs/beta-owner-packet.md" }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gitignored artifacts");

    result = runPacket(baseEnv({ OUTPOST_BETA_HANDOFF_GYM_NAME: "Bearer abcdefghijklmnopqrstuvwxyz012345" }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");

    result = runPacket(baseEnv({ OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW: "password=do-not-store" }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");

    result = runPacket(baseEnv({ OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW: "postgres://user:pass@db.example/neondb" }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");
  });

  it("pins the reusable handoff boundaries in code and docs", () => {
    expect(packetScript).toContain("OUTPOST_BETA_HANDOFF_GYM_NAME");
    expect(packetScript).toContain("OUTPOST_BETA_HANDOFF_OWNER_EMAIL");
    expect(packetScript).toContain("OUTPOST_BETA_HANDOFF_PREVIEW_URL");
    expect(packetScript).toContain("OUTPOST_BETA_HANDOFF_PACKET_PATH");
    expect(packetScript).toContain("Public self-signup is not open.");
    expect(packetScript).toContain("No phone or email provider activation.");
    expect(packetScript).not.toContain("service_role");
    expect(packetScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(operatorRunbook).toContain("Hosted Beta Operator Access");
  });
});
