import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const readinessScript = readFileSync("scripts/check-beta-owner-readiness.mjs", "utf8");
const brainstorm = readFileSync("docs/brainstorms/2026-06-22-beta-owner-readiness-command-brainstorm.md", "utf8");
const plan = readFileSync("docs/plans/2026-06-22-feat-beta-owner-readiness-command-plan.md", "utf8");

describe("beta owner readiness command", () => {
  it("registers the production-safe operator readiness command", () => {
    expect(packageJson).toContain('"beta:owner-readiness"');
    expect(packageJson).toContain("check-beta-owner-readiness.mjs");
  });

  it("reuses hosted Neon proof config and refuses unsafe operator contexts", () => {
    expect(readinessScript).toContain("readHostedReadinessConfig");
    expect(readinessScript).toContain("NEON_API_KEY is required for beta owner readiness inspection");
    expect(readinessScript).toContain("Refusing beta owner readiness inspection on Neon production");
    expect(readinessScript).toContain("Refusing beta owner readiness inspection on the Neon migration spike branch");
    expect(readinessScript).not.toContain("service_role");
    expect(readinessScript).not.toContain("SUPABASE_SERVICE_ROLE");
  });

  it("keeps hosted inspection read-only and scoped to beta readiness state", () => {
    expect(readinessScript).toContain("begin transaction read only");
    expect(readinessScript).toContain("commit;");
    expect(readinessScript).toContain('"OUTPOST_BETA_READINESS_OWNER_EMAIL"');
    expect(readinessScript).toContain("owner_beta_access_grants");
    expect(readinessScript).toContain("tenant_memberships");
    expect(readinessScript).toContain("source_documents");
    expect(readinessScript).toContain("answer_bank_entries");
    expect(readinessScript).toContain("tasks");
    expect(readinessScript).toContain("provider_connections");
    expect(readinessScript).toContain("limit 25");
    expect(readinessScript).not.toMatch(/\binsert\s+into\b/iu);
    expect(readinessScript).not.toMatch(/\bupdate\s+[\w."]+\s+set\b/iu);
    expect(readinessScript).not.toMatch(/\bdelete\s+from\b/iu);
    expect(readinessScript).not.toContain("bootstrap_owner_tenant");
    expect(readinessScript).not.toContain("sign-up/email");
    expect(readinessScript).not.toContain("sign-in/email");
  });

  it("reports packet, completion, rollback, and no-live-provider gates without exposing secrets", () => {
    expect(readinessScript).toContain("OUTPOST_BETA_HANDOFF_PACKET_PATH");
    expect(readinessScript).toContain("OUTPOST_BETA_HANDOFF_COMPLETION_PATH");
    expect(readinessScript).toContain("OUTPOST_BETA_READINESS_EVIDENCE_PATH");
    expect(readinessScript).toContain("assertNoSecretShapedValue");
    expect(readinessScript).toContain("assertNoSecretShapedKeys");
    expect(readinessScript).toContain("main().catch((error) =>");
    expect(readinessScript).toContain("error instanceof Error ? error.message : String(error)");
    expect(readinessScript).toContain("dry_run_rollback_ready");
    expect(readinessScript).toContain("manual_review_required");
    expect(readinessScript).toContain("blocked_seeded_tenant");
    expect(readinessScript).toContain("unexpected_live_records");
    expect(readinessScript).toContain("self-serve, invite delivery, notifications, phone/email providers");
    expect(readinessScript).toContain("member-ledger writes");
    expect(readinessScript).not.toContain("target_grants.note,");
    expect(readinessScript).not.toContain("'note'");
    expect(readinessScript).toContain("'note_present'");
  });

  it("documents the CE scope and why this is a CLI-first slice", () => {
    expect(brainstorm).toContain("Add a production-safe CLI command rather than a web admin page");
    expect(brainstorm).toContain("No schema, RLS, or RPC changes.");
    expect(brainstorm).toContain("No invite delivery");
    expect(plan).toContain("Create `scripts/check-beta-owner-readiness.mjs`");
    expect(plan).toContain("A web operator/admin view would need app-side");
    expect(plan).toContain("support authorization and data-access boundaries");
    expect(plan).toContain("Rollback readiness can only be automatic for disposable dry-run tenants");
  });
});
