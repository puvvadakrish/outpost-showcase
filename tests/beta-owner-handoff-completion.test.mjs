import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const completionScript = readFileSync("scripts/record-beta-owner-handoff-completion.mjs", "utf8");
const operatorRunbook = readFileSync("docs/setup/hosted-beta-operator-access.md", "utf8");

function packetMarkdown(overrides = {}) {
  const values = {
    betaState: "operator-assisted beta",
    betaOwner: "Jordan Owner <owner@summitstrength.example>",
    gym: "Summit Strength",
    liveProviderStatus: "blocked",
    neonProofBranch: "outpost-beta-access-scoped-20260622120000",
    previewUrl: "https://outpost-preview-20260610-example.vercel.app",
    ...overrides
  };

  return `# ${values.gym} Beta Owner Handoff Packet

## Proof Summary

| Field | Value |
| --- | --- |
| Gym | ${values.gym} |
| Beta owner | ${values.betaOwner} |
| Preview URL | ${values.previewUrl} |
| Neon proof branch | ${values.neonProofBranch} |
| Beta state | ${values.betaState} |
| Live-provider status | ${values.liveProviderStatus} |

## Current Beta Preflight

- Public self-signup is not open.
- Invite email and notification delivery are off.
- Phone, email, billing, POS, access control, and member-ledger writes are blocked.

## Explicit Non-Goals

- No public owner self-signup.
- No invite email delivery.
- No notification sending.
- No phone or email provider activation.
- No billing, POS, access-control, Club OS replacement, or member-ledger writes.
- No claim that a customer-observed handoff has completed until the real session is observed and recorded separately.
`;
}

function writePacket(packet = packetMarkdown()) {
  const dir = mkdtempSync(join(tmpdir(), "outpost-beta-owner-completion-test-"));
  const packetPath = join(dir, "packet.md");
  const completionPath = join(dir, "completion.json");
  writeFileSync(packetPath, packet);
  return { completionPath, packetPath };
}

function baseEnv(paths, extraEnv = {}) {
  return {
    ...process.env,
    OUTPOST_BETA_HANDOFF_COMPLETION_PATH: paths.completionPath,
    OUTPOST_BETA_HANDOFF_CONFIRMED_PREVIEW: "1",
    OUTPOST_BETA_HANDOFF_CUSTOMER_OBSERVED: "1",
    OUTPOST_BETA_HANDOFF_FIRST_WORKFLOW: "1",
    OUTPOST_BETA_HANDOFF_LIVE_GATES_BLOCKED: "1",
    OUTPOST_BETA_HANDOFF_NO_UNEXPECTED_DATA: "1",
    OUTPOST_BETA_HANDOFF_OBSERVER: "Outpost operator",
    OUTPOST_BETA_HANDOFF_OWNER_SIGNIN: "1",
    OUTPOST_BETA_HANDOFF_OWNER_WORKSPACE: "1",
    OUTPOST_BETA_HANDOFF_PACKET_PATH: paths.packetPath,
    OUTPOST_BETA_HANDOFF_PARTICIPANT: "Summit Strength owner",
    OUTPOST_BETA_HANDOFF_RESET_REVIEWED: "1",
    OUTPOST_BETA_HANDOFF_SESSION_AT: "2026-06-22T21:00:00.000Z",
    OUTPOST_BETA_HANDOFF_STOP_CONCERNS: "none",
    ...extraEnv
  };
}

function runCompletion(paths, extraEnv = {}) {
  return spawnSync("node", ["scripts/record-beta-owner-handoff-completion.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: baseEnv(paths, extraEnv)
  });
}

describe("beta owner handoff completion", () => {
  it("registers a generic beta owner handoff completion command", () => {
    expect(packageJson).toContain('"beta:owner-handoff:complete"');
    expect(packageJson).toContain("record-beta-owner-handoff-completion.mjs");
  });

  it("writes a non-secret completion record after every observed gate is confirmed", () => {
    const paths = writePacket();
    const result = runCompletion(paths);

    expect(result.status, result.stderr).toBe(0);
    const record = JSON.parse(readFileSync(paths.completionPath, "utf8"));
    expect(record.status).toBe("beta_owner_handoff_recorded");
    expect(record.evidence_basis).toBe("customer_observed_operator_attested_from_beta_owner_handoff_packet");
    expect(record.customer_observed).toBe(true);
    expect(record.packet.gym).toBe("Summit Strength");
    expect(record.packet.betaState).toBe("operator-assisted beta");
    expect(record.packet.liveProviderStatus).toBe("blocked");
    expect(record.beta_access_gate).toBe("operator_assisted");
    expect(record.live_provider_gate).toBe("blocked");
    expect(record.confirmations).toHaveLength(7);
    expect(record.non_goals).toContain("public_self_signup");
    expect(record.non_goals).toContain("invite_delivery");
    expect(record.non_goals).toContain("member_ledger_writes");
    expect(JSON.stringify(record)).not.toContain("napi_");
    expect(JSON.stringify(record)).not.toContain("Bearer ");
    expect(JSON.stringify(record)).not.toContain("__Secure-neon-auth");
  });

  it("fails closed when an observed checklist gate is missing", () => {
    const paths = writePacket();
    const result = runCompletion(paths, { OUTPOST_BETA_HANDOFF_FIRST_WORKFLOW: "" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("OUTPOST_BETA_HANDOFF_FIRST_WORKFLOW=1 is required");
  });

  it("fails closed without explicit customer-observed attestation", () => {
    const paths = writePacket();
    const result = runCompletion(paths, { OUTPOST_BETA_HANDOFF_CUSTOMER_OBSERVED: "" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("OUTPOST_BETA_HANDOFF_CUSTOMER_OBSERVED=1 is required");
  });

  it("fails closed when stop concerns are not explicitly none", () => {
    const paths = writePacket();
    const result = runCompletion(paths, { OUTPOST_BETA_HANDOFF_STOP_CONCERNS: "owner saw unexpected data" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must be exactly 'none'");
  });

  it("fails closed when packet boundaries are not green", () => {
    let paths = writePacket(packetMarkdown({ liveProviderStatus: "enabled" }));
    let result = runCompletion(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("blocked live-provider status");

    paths = writePacket(packetMarkdown({ betaState: "self-serve open" }));
    result = runCompletion(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("operator-assisted beta state");
  });

  it("fails closed on secret-shaped values and unsafe repo-local output paths", () => {
    let paths = writePacket(`${packetMarkdown()}\nBearer abcdefghijklmnopqrstuvwxyz012345`);
    let result = runCompletion(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");

    paths = writePacket(`${packetMarkdown()}\npostgres://user:pass@db.example/neondb`);
    result = runCompletion(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");

    paths = writePacket();
    result = runCompletion(paths, { OUTPOST_BETA_HANDOFF_COMPLETION_PATH: "docs/beta-owner-completion.json" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gitignored artifacts");
  });

  it("pins the completion gate boundaries in code and docs", () => {
    expect(completionScript).toContain("OUTPOST_BETA_HANDOFF_STOP_CONCERNS");
    expect(completionScript).toContain("OUTPOST_BETA_HANDOFF_CUSTOMER_OBSERVED");
    expect(completionScript).toContain("beta_owner_handoff_recorded");
    expect(completionScript).toContain("customer_observed_operator_attested_from_beta_owner_handoff_packet");
    expect(completionScript).toContain("public_self_signup");
    expect(completionScript).toContain("live_provider_gate");
    expect(completionScript).toContain("blocked");
    expect(completionScript).toContain("assertNoSecretShapedKeys");
    expect(completionScript).not.toContain("service_role");
    expect(completionScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(operatorRunbook).toContain("Generic Beta Owner Handoff Packet");
  });
});
