import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readdirSync("neon/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(`neon/migrations/${file}`, "utf8"))
  .join("\n");
const betaAccessMigration = readFileSync(
  "neon/migrations/20260621010000_owner_beta_access_grants.sql",
  "utf8"
);
const seedSql = readFileSync("neon/seed.sql", "utf8");
const ownerSignInActions = readFileSync("src/app/owner/sign-in/actions.ts", "utf8");
const ownerSignInForm = readFileSync("src/app/owner/sign-in/SignInForm.tsx", "utf8");
const hostedBetaWorkflow = readFileSync("scripts/verify-hosted-beta-workflow.mjs", "utf8");

describe("beta access hardening", () => {
  it("adds a database-backed owner beta grant gate before tenant bootstrap writes", () => {
    expect(migration).toContain("owner_beta_access_grants");
    expect(betaAccessMigration).toContain("create table owner_beta_access_grants");
    expect(betaAccessMigration).toContain("alter table owner_beta_access_grants enable row level security");
    expect(betaAccessMigration).toContain("revoke all on table owner_beta_access_grants");
    expect(betaAccessMigration).toContain("create or replace function has_active_owner_beta_access");
    expect(betaAccessMigration).toContain("grant execute on function has_active_owner_beta_access");
    expect(betaAccessMigration).toContain("from public, anonymous");
    expect(betaAccessMigration).toContain("to authenticated");
    expect(betaAccessMigration).toContain("auth.jwt() ->> 'email'");
    expect(betaAccessMigration).toContain("if not has_active_owner_beta_access(p_owner_email) then");
    expect(betaAccessMigration).toContain("owner beta access grant is required before creating a tenant");
    expect(betaAccessMigration.indexOf("if not has_active_owner_beta_access(p_owner_email) then")).toBeLessThan(
      betaAccessMigration.indexOf("insert into users")
    );
    expect(betaAccessMigration.indexOf("if not has_active_owner_beta_access(p_owner_email) then")).toBeLessThan(
      betaAccessMigration.indexOf("insert into tenants")
    );
  });

  it("seeds existing proof owners with active beta access grants", () => {
    expect(seedSql).toContain("insert into owner_beta_access_grants");
    expect(seedSql).toContain("owner-acme@example.com");
    expect(seedSql).toContain("owner-north@example.com");
    expect(seedSql).toContain("Seeded owner for hosted beta proof");
  });

  it("keeps owner account creation operator-managed while capturing beta access requests", () => {
    expect(ownerSignInActions).toContain("requestOwnerBetaAccessAction");
    expect(ownerSignInActions).toContain("submit_owner_beta_access_request");
    expect(ownerSignInActions).toContain("provision owner access manually");
    expect(ownerSignInActions).toContain("invite delivery and public self-serve remain off");
    expect(ownerSignInActions).not.toContain("neon.auth.signUp");
    expect(ownerSignInForm).toContain("Request owner beta access");
    expect(ownerSignInForm).toContain("Owner accounts are operator-provisioned after review");
    expect(ownerSignInForm).toContain("does not create an");
    expect(ownerSignInForm).toContain("account, send an invite, or enable phone/email providers");
    expect(ownerSignInForm).toContain("Beta access request steps");
    expect(ownerSignInForm).toContain("No public owner self-signup");
    expect(ownerSignInForm).not.toMatch(/neon\.auth\.signUp|signUp\(/u);
  });

  it("extends hosted proof with an ungranted owner bootstrap denial", () => {
    expect(hostedBetaWorkflow).toContain("assertUnauthenticatedBetaAccessPreflightDenied");
    expect(hostedBetaWorkflow).toContain("assertAuthenticatedBetaAccessCheckIsSelfScoped");
    expect(hostedBetaWorkflow).toContain("has_active_owner_beta_access");
    expect(hostedBetaWorkflow).toContain("unauthenticated Data API grant checks fail closed");
    expect(hostedBetaWorkflow).toContain("authenticated grant checks are scoped to the caller email");
    expect(hostedBetaWorkflow).toContain("owner-north@example.com");
    expect(hostedBetaWorkflow).toContain("BLOCKED_OWNER_EMAIL");
    expect(hostedBetaWorkflow).toContain("assertUngrantedOwnerBootstrapDenied");
    expect(hostedBetaWorkflow).toContain('"bootstrap_owner_tenant"');
    expect(hostedBetaWorkflow).toContain("{ expectError: true }");
    expect(hostedBetaWorkflow).toContain("owner beta access grant is required");
    expect(hostedBetaWorkflow).toContain("Ungranted owner bootstrap left partial app state");
  });
});
