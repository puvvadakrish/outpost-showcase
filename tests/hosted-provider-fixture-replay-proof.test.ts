import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const script = readFileSync(
  "scripts/verify-hosted-provider-fixture-replay-proof.mjs",
  "utf8"
);

describe("hosted provider fixture replay proof", () => {
  it("registers a single hosted replay proof command", () => {
    expect(packageJson.scripts["hosted:provider-fixtures:replay-proof"]).toBe(
      "node scripts/verify-hosted-provider-fixture-replay-proof.mjs"
    );
  });

  it("fails closed to hosted Preview and hosted Neon proof branches", () => {
    expect(script).toContain("readProviderFixtureReplayConfig");
    expect(script).toContain("OUTPOST_NEON_BRANCH_NAME is required when OUTPOST_DATABASE_URL is used");
    expect(script).toContain("OUTPOST_DATABASE_URL must use postgres:// or postgresql://");
    expect(script).toContain("Hosted provider fixture replay proof must use an HTTPS Vercel Preview URL");
    expect(script).toContain("Hosted provider fixture replay proof must target a Vercel Preview URL");
    expect(script).toContain("Hosted provider fixture replay proof refuses local app origins");
    expect(script).toContain("Refusing hosted provider fixture replay proof on Neon production");
    expect(script).toContain("Refusing hosted provider fixture replay proof on the Neon migration spike branch");
  });

  it("reuses the fixture enqueue command and drains only through the protected internal route", () => {
    expect(script).toContain('runCommand(["npm", "run", "admin:provider-fixtures:enqueue"]');
    expect(script).toContain("OUTPOST_DATABASE_URL: connectionString");
    expect(script).toContain("OUTPOST_INTERNAL_JOB_DRAIN_TOKEN");
    expect(script).toContain('Authorization: `Bearer ${INTERNAL_JOB_DRAIN_TOKEN}`');
    expect(script).toContain("x-vercel-protection-bypass");
    expect(script).toContain("OUTPOST_USE_VERCEL_CURL");
    expect(script).toContain("vercel");
    expect(script).toContain("curl");
    expect(script).toContain("Hosted job drain hit Vercel Deployment Protection");
    expect(script).toContain('/api/internal/jobs/drain?batch=10');
    expect(script).toContain("body.failed === 0");
    expect(script).toContain("body.settlementFailed === 0");
  });

  it("creates only disabled fixture provider stubs and refuses secret-backed provider rows", () => {
    expect(script).toContain("Fixture provider connection stubs must not be pending_review or carry secret_ref");
    expect(script).toContain("'fixture normalization proof only - live provider remains blocked'");
    expect(script).toContain("provider_connections.status in ('not_configured', 'disabled')");
    expect(script).toContain("provider_connections.secret_ref is null");
    expect(script).toContain("secret_ref = null");
    expect(script).toContain("provider_retell_acme_fitness_preview");
    expect(script).toContain("provider_resend_acme_fitness_preview");
  });

  it("verifies sanitized normalized domain projections instead of raw provider payloads", () => {
    expect(script).toContain("retell_call_preview_001:call_ended");
    expect(script).toContain("email_preview_001:email.received");
    expect(script).toContain("retell.call_ended");
    expect(script).toContain("resend.email_received");
    expect(script).toContain("channel_events");
    expect(script).toContain("usage_events");
    expect(script).toContain("stableProviderId(");
    expect(script).toContain("RETELL_FIXTURE_TASK_ID");
    expect(script).toContain("RESEND_FIXTURE_TASK_ID");
    expect(script).toContain("RETELL_FIXTURE_PAYLOAD_REF");
    expect(script).toContain("RESEND_FIXTURE_PAYLOAD_REF");
    expect(script).toContain("source_linked_task_events");
    expect(script).toContain("join matched_events");
    expect(script).toContain("task_events.note = concat");
    expect(script).toContain("task_events.event_type = 'source_linked'");
    expect(script).toContain("source_linked_task_event_count");
    expect(script).toContain("proof.source_linked_task_event_count === 2");
    expect(script).toContain("Expected fixture task source-link events");
    expect(script).toContain("'call_completed'::usage_meter");
    expect(script).toContain("'email_received'::usage_meter");
    expect(script).toContain("'task_created'::usage_meter");
    expect(script).toContain("'voice_seconds'::usage_meter");
    expect(script).toContain("tasks");
    expect(script).toContain("payload_digest_prefix");
    expect(script).toContain("assertNoSecretShapedValue(JSON.stringify(proof)");
    expect(script).not.toContain("provider_payload");
    expect(script).not.toContain("transcript");
    expect(script).not.toContain("requester_contact");
  });

  it("keeps live-provider, revenue, public launch, and member-system gates blocked", () => {
    const executableScript = script.replace(/^\/\/.*$/gmu, "");

    expect(script).toContain("live_provider_calls");
    expect(script).toContain("invite_delivery");
    expect(script).toContain("billing");
    expect(script).toContain("pos");
    expect(script).toContain("access_control");
    expect(script).toContain("member_ledger_writes");
    expect(script).toContain("public_self_serve");
    expect(executableScript).not.toMatch(/retell-sdk|resend-sdk|send\s+email|invoice|member\s+ledger/iu);
  });
});
