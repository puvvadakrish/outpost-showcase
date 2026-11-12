import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const dryRunScript = readFileSync("scripts/verify-acme-dry-run-onboarding.mjs", "utf8");
const runbook = readFileSync("docs/setup/acme-dry-run-onboarding-handoff.md", "utf8");

function expectInOrder(source, statements) {
  let previousIndex = -1;

  for (const statement of statements) {
    const index = source.indexOf(statement);
    expect(index, `${statement} should exist`).toBeGreaterThanOrEqual(0);
    expect(index, `${statement} should appear after the previous rollback statement`).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
}

describe("Acme Fitness dry-run onboarding verifier", () => {
  it("registers a dedicated hosted dry-run onboarding command", () => {
    expect(packageJson).toContain('"acme:dry-run:onboarding"');
    expect(packageJson).toContain("verify-acme-dry-run-onboarding.mjs");
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

  it("proves the first-run owner workflow without staff invite delivery", () => {
    expect(dryRunScript).toContain('dataApiRpc("has_active_owner_beta_access"');
    expect(dryRunScript).toContain('dataApiRpc("bootstrap_owner_tenant"');
    expect(dryRunScript).toContain('dataApiRpc("upsert_manual_source_document"');
    expect(dryRunScript).toContain('dataApiRpc("propose_answers_from_manual_source"');
    expect(dryRunScript).toContain('dataApiRpc("create_task_from_answer_bank_entry"');
    expect(dryRunScript).toContain('routeSmoke(owner, "/owner"');
    expect(dryRunScript).not.toContain("sendInvite");
    expect(dryRunScript).not.toContain("sendEmail");
  });

  it("refuses unsafe owner emails and seeded Acme Fitness rollback", () => {
    expect(dryRunScript).toContain('OWNER_EMAIL !== "owner-acme@example.com"');
    expect(dryRunScript).not.toContain("OUTPOST_ALLOW_REAL_ACME_DRY_RUN_EMAIL");
    expect(dryRunScript).toContain("OWNER_EMAIL.includes(\"+dry-run\")");
    expect(dryRunScript).toContain('OWNER_EMAIL.endsWith("@owner.outpost.local")');
    expect(dryRunScript).toContain("memberships.role = 'owner'");
    expect(dryRunScript).toContain("memberships.invite_status = 'active'");
    expect(dryRunScript).toContain("dry-run owner email % is not the active owner of tenant %");
    expect(dryRunScript).toContain("tenant_id <> v_tenant_id");
    expect(dryRunScript).toContain("refusing to roll back the seeded Acme Fitness tenant");
    expect(dryRunScript).toContain("v_tenant_name not like 'Acme Fitness Dry Run%'");
  });

  it("rolls back tenant-owned rows in dependency order and verifies cleanup", () => {
    const rollbackOrder = [
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
    ];

    expectInOrder(dryRunScript, rollbackOrder);

    expect(dryRunScript).toContain("TENANT_OWNED_TABLES_IN_ROLLBACK_ORDER");
    expect(dryRunScript).toContain("TENANT_ROLLBACK_SQL_STATEMENTS");
    expect(dryRunScript).toContain("update audit_events set support_access_grant_id = null where tenant_id = v_tenant_id;");
    expect(dryRunScript).toContain("delete from ${table} where tenant_id = v_tenant_id;");
    expect(dryRunScript).toContain("(select count(*) from ${table} where tenant_id");
    expect(dryRunScript).toContain("delete from owner_beta_access_grants");
    expect(dryRunScript).toContain('delete from neon_auth."user"');
    expect(dryRunScript).toContain("assertRollbackClean");

    for (const table of [
      "task_events",
      "tasks",
      "channel_events",
      "conversations",
      "usage_events",
      "domain_events",
      "support_access_grants",
      "audit_events",
      "source_facts",
      "answer_bank_revisions",
      "answer_bank_entries",
      "handoff_rule_revisions",
      "handoff_rules",
      "notification_destination_revisions",
      "notification_destinations",
      "provider_connections",
      "location_revisions",
      "source_documents",
      "locations",
      "tenant_memberships"
    ]) {
      expect(dryRunScript).toContain(`"${table}"`);
    }

    expect(dryRunScript).toContain("from tenants where id");
  });

  it("uses protected Preview bypass headers and cleans up interrupted runs", () => {
    expect(dryRunScript).toContain("function protectionHeaders()");
    expect(dryRunScript).toContain('"x-vercel-protection-bypass"');
    expect(dryRunScript).toContain("routeSmokeWithVercelCurl");
    expect(dryRunScript).toContain('"--fail"');
    expect(dryRunScript).toContain('args.push("--header", `${name}: ${value}`)');
    expect(dryRunScript).toContain("finally");
    expect(dryRunScript).toContain("rollbackTenantId && !KEEP_DATA && !rollbackComplete");
    expect(dryRunScript).toContain("Rollback after failure also failed");
    expect(dryRunScript).toContain("Dry-run interrupted after bootstrap; attempting rollback before exiting.");
  });

  it("can write a non-secret handoff evidence artifact", () => {
    expect(dryRunScript).toContain("OUTPOST_ACME_DRY_RUN_EVIDENCE_PATH");
    expect(dryRunScript).toContain("function normalizeEvidencePath");
    expect(dryRunScript).toContain("must live under gitignored artifacts/");
    expect(dryRunScript).toContain("function writeHandoffEvidence");
    expect(dryRunScript).toContain("app_origin: APP_ORIGIN");
    expect(dryRunScript).toContain("branch_name: config.branchName");
    expect(dryRunScript).toContain("project_id: config.projectId");
    expect(dryRunScript).toContain("owner_email: OWNER_EMAIL");
    expect(dryRunScript).toContain("live_provider_gate: \"blocked\"");
    expect(dryRunScript).toContain("passed_with_automatic_rollback");
    expect(dryRunScript).toContain("passed_retained_data");
    expect(dryRunScript).toContain("rollback_only_cleaned");
    expect(dryRunScript).toContain("automatic_cleanup_complete");
    expect(dryRunScript).toContain("retained_for_browser_smoke");
    expect(dryRunScript).toContain("rollback_only_cleanup_complete");
    expect(dryRunScript).toContain("console.warn(`Evidence: unable to write");
    expect(dryRunScript).not.toContain("owner_password:");
    expect(dryRunScript).not.toContain("neon_api_key:");
    expect(dryRunScript).not.toContain("vercel_bypass_secret:");
    expect(runbook).toContain("OUTPOST_ACME_DRY_RUN_EVIDENCE_PATH");
    expect(runbook).toContain("non-secret JSON summary");
    expect(runbook).toContain("Do not put passwords, Neon API keys, JWTs, cookies, or Vercel bypass");
  });

  it("keeps live-provider gates and the support runbook explicit", () => {
    expect(dryRunScript).toContain("Live-provider gates remain blocked");
    expect(dryRunScript).toContain("provider_connections");
    expect(dryRunScript).toContain("where status not in");
    expect(dryRunScript).not.toContain("service_role");
    expect(dryRunScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(runbook).toContain("Chrome Codex extension");
    expect(runbook).toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(runbook).toContain("Rollback Only");
    expect(runbook).toContain("Do not enable phone/email providers");
    expect(runbook).toContain("billing, POS, access control, or member-ledger writes");
  });
});
