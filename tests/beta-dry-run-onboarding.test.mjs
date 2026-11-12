import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const dryRunScript = readFileSync("scripts/verify-beta-dry-run-onboarding.mjs", "utf8");
const runbook = readFileSync("docs/setup/beta-dry-run-onboarding-handoff.md", "utf8");

function expectInOrder(source, statements) {
  let previousIndex = -1;

  for (const statement of statements) {
    const index = source.indexOf(statement);
    expect(index, `${statement} should exist`).toBeGreaterThanOrEqual(0);
    expect(index, `${statement} should appear after the previous statement`).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
}

describe("generic beta dry-run onboarding verifier", () => {
  it("registers a generic hosted dry-run onboarding command", () => {
    expect(packageJson).toContain('"beta:dry-run:onboarding"');
    expect(packageJson).toContain("verify-beta-dry-run-onboarding.mjs");
  });

  it("builds on hosted readiness and operator-provisioned owner access", () => {
    expect(dryRunScript).toContain('runCommand(["npm", "run", "hosted:readiness"]');
    expect(dryRunScript).toContain('runCommand(["npm", "run", "beta:operator:owner-access"]');
    expect(dryRunScript.indexOf('runCommand(["npm", "run", "hosted:readiness"]')).toBeLessThan(
      dryRunScript.indexOf('runCommand(["npm", "run", "beta:operator:owner-access"]')
    );
    expect(dryRunScript.indexOf('runCommand(["npm", "run", "beta:operator:owner-access"]')).toBeLessThan(
      dryRunScript.indexOf('dataApiRpc("bootstrap_owner_tenant"')
    );
  });

  it("requires disposable gym-specific dry-run inputs", () => {
    expect(dryRunScript).toContain("OUTPOST_BETA_DRY_RUN_GYM_NAME");
    expect(dryRunScript).toContain("OUTPOST_BETA_DRY_RUN_TENANT_NAME");
    expect(dryRunScript).toContain("OUTPOST_BETA_DRY_RUN_ID");
    expect(dryRunScript).toContain('TENANT_NAME.includes(" Dry Run ")');
    expect(dryRunScript).toContain('OWNER_EMAIL !== "owner-acme@example.com"');
    expect(dryRunScript).toContain("OWNER_EMAIL.includes(\"+dry-run\")");
    expect(dryRunScript).toContain('OWNER_EMAIL.endsWith("@owner.outpost.local")');
    expect(dryRunScript).not.toContain("OUTPOST_ALLOW_REAL");
  });

  it("proves the first-run owner workflow without invite delivery", () => {
    expect(dryRunScript).toContain('dataApiRpc("has_active_owner_beta_access"');
    expect(dryRunScript).toContain('dataApiRpc("bootstrap_owner_tenant"');
    expect(dryRunScript).toContain('dataApiRpc("upsert_manual_source_document"');
    expect(dryRunScript).toContain('dataApiRpc("propose_answers_from_manual_source"');
    expect(dryRunScript).toContain('dataApiRpc("create_task_from_answer_bank_entry"');
    expect(dryRunScript).toContain('routeSmoke(owner, "/owner"');
    expect(dryRunScript).not.toContain("sendInvite");
    expect(dryRunScript).not.toContain("sendEmail");
  });

  it("rolls back guarded dry-run rows in dependency order", () => {
    expect(dryRunScript).toContain("TENANT_OWNED_TABLES_IN_ROLLBACK_ORDER");
    expect(dryRunScript).toContain("TENANT_ROLLBACK_SQL_STATEMENTS");
    expect(dryRunScript).toContain('const SEEDED_TENANT_IDS = ["tenant_acme_fitness", "tenant_crossfit_north"]');
    expect(dryRunScript).toContain("refusing to roll back seeded tenant %");
    expect(dryRunScript).toContain("position(' Dry Run ' in v_tenant_name) = 0");
    expect(dryRunScript).toContain("dry-run owner email % is not the active owner of tenant %");
    expect(dryRunScript).toContain("tenant_id <> v_tenant_id");
    expect(dryRunScript).toContain("assertRollbackClean");

    expectInOrder(dryRunScript, [
      '"task_events"',
      '"tasks"',
      '"channel_events"',
      '"conversations"',
      '"usage_events"',
      '"domain_events"',
      '"support_access_grants"',
      '"audit_events"',
      '"source_facts"',
      '"answer_bank_revisions"',
      '"answer_bank_entries"',
      '"handoff_rule_revisions"',
      '"handoff_rules"',
      '"notification_destination_revisions"',
      '"notification_destinations"',
      '"provider_connections"',
      '"location_revisions"',
      '"source_documents"',
      '"locations"',
      '"tenant_memberships"',
      "delete from tenants"
    ]);
  });

  it("uses protected Preview bypass headers and can retain data for browser smoke", () => {
    expect(dryRunScript).toContain("function protectionHeaders()");
    expect(dryRunScript).toContain('"x-vercel-protection-bypass"');
    expect(dryRunScript).toContain("routeSmokeWithVercelCurl");
    expect(dryRunScript).toContain("OUTPOST_BETA_DRY_RUN_KEEP_DATA");
    expect(dryRunScript).toContain("retained_for_browser_smoke");
    expect(dryRunScript).toContain("OUTPOST_BETA_DRY_RUN_ROLLBACK_ONLY=1");
    expect(dryRunScript.match(/Rollback command:/gu)).toBeNull();
  });

  it("writes non-secret evidence and keeps live providers blocked", () => {
    expect(dryRunScript).toContain("OUTPOST_BETA_DRY_RUN_EVIDENCE_PATH");
    expect(dryRunScript).toContain("function normalizeEvidencePath");
    expect(dryRunScript).toContain("must live under gitignored artifacts/");
    expect(dryRunScript).toContain("function writeHandoffEvidence");
    expect(dryRunScript).toContain("gym_name: GYM_NAME");
    expect(dryRunScript).toContain("live_provider_gate: \"blocked\"");
    expect(dryRunScript).toContain("where status not in");
    expect(dryRunScript).not.toContain("owner_password:");
    expect(dryRunScript).not.toContain("neon_api_key:");
    expect(dryRunScript).not.toContain("vercel_bypass_secret:");
    expect(dryRunScript).not.toContain("service_role");
    expect(dryRunScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(runbook).toContain("OUTPOST_BETA_DRY_RUN_EVIDENCE_PATH");
    expect(runbook).toContain("non-secret");
    expect(runbook).toContain("throwaway dry-run owner email");
    expect(runbook).toContain("Do not put passwords, Neon API keys, JWTs, cookies, or Vercel bypass");
    expect(runbook).toContain("Do not enable phone/email providers");
  });
});
