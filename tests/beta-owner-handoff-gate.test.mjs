import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const gateScript = readFileSync("scripts/verify-beta-owner-handoff-gate.mjs", "utf8");
const operatorRunbook = readFileSync("docs/setup/hosted-beta-operator-access.md", "utf8");
const ownerLedger = readFileSync("src/domain/beta-support-readiness.ts", "utf8");

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

function completionRecord(overrides = {}) {
  return {
    status: "beta_owner_handoff_recorded",
    evidence_basis: "customer_observed_operator_attested_from_beta_owner_handoff_packet",
    customer_observed: true,
    generated_at: "2026-06-22T22:00:00.000Z",
    session_at: "2026-06-22T21:00:00.000Z",
    observer: "Outpost operator",
    participant: "Summit Strength owner",
    stop_concerns: "none",
    packet: {
      betaOwner: "Jordan Owner <owner@summitstrength.example>",
      betaState: "operator-assisted beta",
      gym: "Summit Strength",
      liveProviderStatus: "blocked",
      neonProofBranch: "outpost-beta-access-scoped-20260622120000",
      previewUrl: "https://outpost-preview-20260610-example.vercel.app"
    },
    confirmations: [
      "OUTPOST_BETA_HANDOFF_CONFIRMED_PREVIEW",
      "OUTPOST_BETA_HANDOFF_OWNER_SIGNIN",
      "OUTPOST_BETA_HANDOFF_OWNER_WORKSPACE",
      "OUTPOST_BETA_HANDOFF_FIRST_WORKFLOW",
      "OUTPOST_BETA_HANDOFF_RESET_REVIEWED",
      "OUTPOST_BETA_HANDOFF_LIVE_GATES_BLOCKED",
      "OUTPOST_BETA_HANDOFF_NO_UNEXPECTED_DATA"
    ].map((env) => ({ confirmed: true, description: env, env })),
    beta_access_gate: "operator_assisted",
    live_provider_gate: "blocked",
    non_goals: [
      "public_self_signup",
      "invite_delivery",
      "notification_sending",
      "phone_provider_activation",
      "email_provider_activation",
      "billing",
      "pos",
      "access_control",
      "member_ledger_writes"
    ],
    ...overrides
  };
}

function writeArtifacts({ completion = completionRecord(), packet = packetMarkdown() } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "outpost-beta-owner-gate-test-"));
  const packetPath = join(dir, "packet.md");
  const completionPath = join(dir, "completion.json");
  const gatePath = join(dir, "gate.json");
  writeFileSync(packetPath, packet);
  writeFileSync(completionPath, `${JSON.stringify(completion, null, 2)}
`);
  return { completionPath, gatePath, packetPath };
}

function adminHandoffPacket(overrides = {}) {
  return {
    artifact_kind: "admin_handoff_readiness_packet",
    status: "admin_handoff_readiness_packet_exported",
    preview_url: "https://outpost-preview-20260610-example.vercel.app",
    neon_branch_name: "outpost-beta-access-scoped-20260622120000",
    readiness_state: "action_required",
    public_self_serve_launch_allowed: false,
    live_provider_enablement_allowed: false,
    ...overrides
  };
}

function writeAdminPacket(paths, artifact = adminHandoffPacket()) {
  const adminPacketPath = join(paths.gatePath.replace(/gate\.json$/u, ""), "admin-packet.json");
  writeFileSync(adminPacketPath, `${JSON.stringify(artifact, null, 2)}
`);
  return { ...paths, adminPacketPath };
}

function runGate(paths, extraEnv = {}) {
  return spawnSync("node", ["scripts/verify-beta-owner-handoff-gate.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_BETA_HANDOFF_COMPLETION_PATH: paths.completionPath,
      OUTPOST_BETA_HANDOFF_GATE_PATH: paths.gatePath,
      OUTPOST_BETA_HANDOFF_PACKET_PATH: paths.packetPath,
      ...(paths.adminPacketPath ? { OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH: paths.adminPacketPath } : {}),
      ...extraEnv
    }
  });
}
describe("beta owner handoff gate", () => {
  it("registers the final customer-observed gate command", () => {
    expect(packageJson).toContain('"beta:owner-handoff:gate"');
    expect(packageJson).toContain("verify-beta-owner-handoff-gate.mjs");
  });

  it("writes a sanitized gate record from matching packet and customer-observed completion evidence", () => {
    const paths = writeArtifacts();
    const result = runGate(paths);

    expect(result.status, result.stderr).toBe(0);
    const gate = JSON.parse(readFileSync(paths.gatePath, "utf8"));
    expect(gate.status).toBe("customer_observed_beta_handoff_gate_passed");
    expect(gate.evidence_basis).toBe("validated_packet_and_customer_observed_completion_artifacts");
    expect(gate.gym).toBe("Summit Strength");
    expect(gate.preview_url).toBe("https://outpost-preview-20260610-example.vercel.app");
    expect(gate.neon_proof_branch).toBe("outpost-beta-access-scoped-20260622120000");
    expect(gate.gates.customer_observed).toBe("passed");
    expect(gate.gates.live_providers).toBe("blocked");
    expect(gate.gates.invite_delivery).toBe("blocked");
    expect(gate.non_goals).toContain("member_ledger_writes");
    expect(JSON.stringify(gate)).not.toContain("napi_");
    expect(JSON.stringify(gate)).not.toContain("Bearer ");
    expect(JSON.stringify(gate)).not.toContain("__Secure-neon-auth");
  });

  it("fails closed when completion is not customer-observed or has stop concerns", () => {
    let paths = writeArtifacts({ completion: completionRecord({ customer_observed: false }) });
    let result = runGate(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("explicitly customer-observed");

    paths = writeArtifacts({ completion: completionRecord({ stop_concerns: "owner saw unexpected data" }) });
    result = runGate(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("stop concerns must be exactly 'none'");
  });

  it("fails closed for internal dry-run participants", () => {
    const paths = writeArtifacts({ completion: completionRecord({ participant: "Outpost internal dry-run operator" }) });
    const result = runGate(paths);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("external beta owner or customer");
  });

  it("fails closed when the customer participant is the same as the internal observer", () => {
    const paths = writeArtifacts({ completion: completionRecord({ observer: "Summit Strength owner" }) });
    const result = runGate(paths);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("participant must be distinct");
  });

  it("fails closed when packet and completion evidence do not match", () => {
    const paths = writeArtifacts({
      completion: completionRecord({
        packet: {
          ...completionRecord().packet,
          previewUrl: "https://different-preview.vercel.app"
        }
      })
    });
    const result = runGate(paths);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Preview URL must match");
  });

  it("fails closed for missing confirmations, unblocked providers, unsafe paths, and secret-shaped content", () => {
    let paths = writeArtifacts({
      completion: completionRecord({ confirmations: completionRecord().confirmations.slice(1) })
    });
    let result = runGate(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("OUTPOST_BETA_HANDOFF_CONFIRMED_PREVIEW");

    paths = writeArtifacts({ packet: packetMarkdown({ liveProviderStatus: "enabled" }) });
    result = runGate(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("blocked live-provider status");

    paths = writeArtifacts();
    result = runGate(paths, { OUTPOST_BETA_HANDOFF_GATE_PATH: "docs/beta-owner-gate.json" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gitignored artifacts");

    paths = writeArtifacts({ packet: `${packetMarkdown()}\nnapi_abcdefghijklmnopqrstuvwxyz0123456789` });
    result = runGate(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");

    paths = writeArtifacts({ packet: `${packetMarkdown()}\npostgres://user:pass@db.example/neondb` });
    result = runGate(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");
  });

  it("documents the final gate without enabling blocked product surfaces", () => {
    expect(gateScript).toContain("customer_observed_beta_handoff_gate_passed");
    expect(gateScript).toContain("OUTPOST_BETA_HANDOFF_GATE_PATH");
    expect(gateScript).toContain("customer_observed_operator_attested_from_beta_owner_handoff_packet");
    expect(gateScript).toContain("completion participant must be the external beta owner or customer");
    expect(gateScript).toContain("participant must be distinct from the internal observer");
    expect(gateScript).toContain("postgres(?:ql)?");
    expect(gateScript).toContain("member_ledger_writes");
    expect(gateScript).not.toContain("service_role");
    expect(gateScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(operatorRunbook).toContain("npm run beta:owner-handoff:gate");
    expect(ownerLedger).toContain("Customer-observed gate record");
  });
});
