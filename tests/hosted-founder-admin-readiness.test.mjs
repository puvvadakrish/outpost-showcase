import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminScript = readFileSync("scripts/verify-hosted-founder-admin-readiness.mjs", "utf8");

describe("hosted admin portal readiness verifier", () => {
  it("registers a hosted Neon admin portal readiness command", () => {
    expect(packageJson).toContain('"hosted:admin-portal-readiness"');
    expect(packageJson).toContain('"hosted:founder-admin-readiness"');
    expect(packageJson).toContain("verify-hosted-founder-admin-readiness.mjs");
  });

  it("builds on hosted readiness before provisioning a disposable admin portal proof user", () => {
    expect(founderAdminScript).toContain('runCommand(["npm", "run", "hosted:readiness"]');
    expect(founderAdminScript).toContain("assertHostedProofBranch");
    expect(founderAdminScript).toContain("Refusing admin portal hosted proof against the Neon production branch");
    expect(founderAdminScript).toContain("Refusing admin portal hosted proof against the migration spike branch");
    expect(founderAdminScript).toContain("must point at hosted Neon, not a local service");
    expect(founderAdminScript.indexOf('runCommand(["npm", "run", "hosted:readiness"]')).toBeLessThan(
      founderAdminScript.indexOf("await provisionFounderAdmin")
    );
    expect(founderAdminScript).toContain("/sign-up/email");
    expect(founderAdminScript).toContain('set "emailVerified" = true');
    expect(founderAdminScript).toContain("insert into users");
    expect(founderAdminScript).toContain("insert into app_admins");
    expect(founderAdminScript).toContain("insert into tenant_memberships");
    expect(founderAdminScript).toContain("'founder_admin'");
  });

  it("proves admin portal allow and owner/staff/anonymous denial through Data API", () => {
    expect(founderAdminScript).toContain('dataApiRpc("list_founder_admin_owner_readiness", founder.token');
    expect(founderAdminScript).toContain('dataApiRpc("list_founder_admin_owner_readiness", owner.token');
    expect(founderAdminScript).toContain('dataApiRpc("list_founder_admin_owner_readiness", staff.token');
    expect(founderAdminScript).toContain('dataApiAnonymousRpc("list_founder_admin_owner_readiness"');
    expect(founderAdminScript).toContain('dataApiRpc("list_founder_admin_proof_runs", founder.token');
    expect(founderAdminScript).toContain('dataApiRpc("list_founder_admin_proof_runs", owner.token');
    expect(founderAdminScript).toContain('dataApiRpc("list_founder_admin_proof_runs", staff.token');
    expect(founderAdminScript).toContain('dataApiAnonymousRpc("list_founder_admin_proof_runs"');
    expect(founderAdminScript).toContain('dataApiRpc("list_founder_admin_launch_package_records", founder.token');
    expect(founderAdminScript).toContain('dataApiRpc("list_founder_admin_launch_package_records", owner.token');
    expect(founderAdminScript).toContain('dataApiRpc("list_founder_admin_launch_package_records", staff.token');
    expect(founderAdminScript).toContain('dataApiAnonymousRpc("list_founder_admin_launch_package_records"');
    expect(founderAdminScript).toContain("assertAuthorizedLaunchPackageRecordReport");
    expect(founderAdminScript).toContain("assertAuthorizedProofRunReport");
    expect(founderAdminScript).toContain("assertAuthorizedReport");
    expect(founderAdminScript).toContain("assertDeniedReport");
    expect(founderAdminScript).toContain('["display_name", "note", "secret_ref"]');
    expect(founderAdminScript).toContain("unexpected_live_records");
    expect(founderAdminScript).toContain("blocked_seeded_tenant");
  });

  it("proves immediate beta-request repeats preserve first-submission fields and cooldown count", () => {
    expect(founderAdminScript).toContain("submitted.request_count !== 1");
    expect(founderAdminScript).toContain("submitted.owner_name !== baseRequest.p_owner_name");
    expect(founderAdminScript).toContain("submitted.gym_name !== baseRequest.p_gym_name");
    expect(founderAdminScript).toContain("submitted.location_hint !== baseRequest.p_location_hint");
    expect(founderAdminScript).toContain("immediate-repeat cooldown contract");
    expect(founderAdminScript).not.toContain("submitted.request_count !== 2");
  });

  it("smokes protected admin portal routes with Vercel curl or local fetch", () => {
    expect(founderAdminScript).toContain("assertAppServerAvailable");
    expect(founderAdminScript).toContain("app server is required");
    expect(founderAdminScript).toContain("attempt < 6");
    expect(founderAdminScript).toContain("setTimeout(resolve, 500)");
    expect(founderAdminScript).toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(founderAdminScript).toContain("x-vercel-protection-bypass");
    expect(founderAdminScript).toContain("OUTPOST_USE_VERCEL_CURL");
    expect(founderAdminScript).toContain("routeSmokeWithVercelCurl");
    expect(founderAdminScript).toContain('runVercelCurl(["/", "--deployment"');
    expect(founderAdminScript).toContain('routeSmoke(founder, "/admin"');
    expect(founderAdminScript).toContain('routeSmoke(owner, "/admin"');
    expect(founderAdminScript).toContain("routeSmokeFollowingRedirect");
    expect(founderAdminScript).toContain('routeSmokeFollowingRedirect(founder, "/founder-admin"');
    expect(founderAdminScript).toContain('redirect: followRedirect ? "follow" : "manual"');
    expect(founderAdminScript).toContain("curlArgs.unshift(\"--location\")");
    expect(founderAdminScript).toContain("Admin portal session required");
  });

  it("keeps no-live-provider gates explicit and avoids provider/admin secrets", () => {
    expect(founderAdminScript).toContain("Live-provider gates remain blocked");
    expect(founderAdminScript).toContain("provider_connections");
    expect(founderAdminScript).toContain("where status not in");
    expect(founderAdminScript).toContain("recordHostedFounderAdminProofRun");
    expect(founderAdminScript).toContain("insert into hosted_proof_runs");
    expect(founderAdminScript).toContain("'hosted_founder_admin_readiness'");
    expect(founderAdminScript).toContain("founder_admin_projection");
    expect(founderAdminScript).toContain("launch_package_record_projection");
    expect(founderAdminScript.indexOf("assertNoLiveProviderGates();")).toBeLessThan(
      founderAdminScript.indexOf("recordHostedFounderAdminProofRun();")
    );
    expect(founderAdminScript).toContain("function sqlLiteral");
    expect(founderAdminScript).not.toContain("function shellQuote");
    expect(founderAdminScript).not.toContain("service_role");
    expect(founderAdminScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(founderAdminScript).not.toContain("NEON_API_KEY");
    expect(founderAdminScript).not.toMatch(/summary[\s\S]{0,240}(password|api[_-]?key|cookie|token)/iu);
  });
});
