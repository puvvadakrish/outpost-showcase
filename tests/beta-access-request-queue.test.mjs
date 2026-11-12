import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "neon/migrations/20260622040000_owner_beta_access_requests.sql",
  "utf8",
);
const fulfillmentMigration = readFileSync(
  "neon/migrations/20260622050000_owner_beta_access_request_fulfillment.sql",
  "utf8",
);
const preflightMigration = readFileSync(
  "neon/migrations/20260622060000_owner_beta_access_request_preflight.sql",
  "utf8",
);
const receiptMigration = readFileSync(
  "neon/migrations/20260622070000_owner_beta_access_fulfillment_receipts.sql",
  "utf8",
);
const packageJson = readFileSync("package.json", "utf8");
const preflightScript = readFileSync(
  "scripts/preflight-owner-beta-access-request.mjs",
  "utf8",
);
const fulfillmentScript = readFileSync(
  "scripts/fulfill-owner-beta-access-request.mjs",
  "utf8",
);
const ownerSignInActions = readFileSync(
  "src/app/owner/sign-in/actions.ts",
  "utf8",
);
const ownerSignInForm = readFileSync(
  "src/app/owner/sign-in/SignInForm.tsx",
  "utf8",
);
const founderAdminRepository = readFileSync(
  "src/infrastructure/neon/founder-admin-readiness-repository.ts",
  "utf8",
);
const founderAdminPage = readFileSync("src/app/admin/page.tsx", "utf8");
const founderAdminComponent = readFileSync(
  "src/components/founder-admin/FounderAdminReadinessConsole.tsx",
  "utf8",
);
const founderAdminDomain = readFileSync(
  "src/domain/founder-admin-readiness.ts",
  "utf8",
);
const hostedFounderAdminScript = readFileSync(
  "scripts/verify-hosted-founder-admin-readiness.mjs",
  "utf8",
);

describe("beta access request queue", () => {
  it("adds a public request RPC with direct table access revoked", () => {
    expect(migration).toContain("create table owner_beta_access_requests");
    expect(migration).toContain(
      "alter table owner_beta_access_requests enable row level security",
    );
    expect(migration).toContain(
      "revoke all on table owner_beta_access_requests from public, anonymous, authenticated",
    );
    expect(migration).toContain(
      "create or replace function submit_owner_beta_access_request",
    );
    expect(migration).toContain(
      "grant execute on function submit_owner_beta_access_request(text, text, text, text, text, text) to anonymous, authenticated",
    );
    expect(migration).toContain("on conflict (email) do update");
    expect(migration).toContain(
      "request_count = owner_beta_access_requests.request_count + 1",
    );
    expect(migration).not.toContain("else 'new'");
    expect(migration).toContain("'status', 'received'");
    expect(migration).not.toMatch(/\bneon\.auth\.signUp\b/u);
  });

  it("guards request content and keeps the public response enumeration-safe", () => {
    expect(migration).toContain("p_company_website");
    expect(migration).toContain("owner email must be valid");
    expect(migration).toContain(
      "request cannot include secrets or credentials",
    );
    expect(migration).toContain("NEON_API_KEY");
    expect(migration).toContain("OUTPOST_NEON_SEED_PASSWORD");
    expect(migration).toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(migration).not.toContain("already_granted");
  });

  it("adds a admin-portal-only request queue projection", () => {
    expect(migration).toContain(
      "create or replace function list_founder_admin_beta_access_requests()",
    );
    expect(migration).toContain("app_admins.status = 'active'");
    expect(migration).toContain("memberships.role = 'founder_admin'");
    expect(migration).toContain("'authorized', false");
    expect(migration).toContain("left join owner_beta_access_grants grants");
    expect(migration).toContain("left join users app_users");
    expect(migration).toContain("left join tenants");
    expect(migration).toContain(
      "grant execute on function list_founder_admin_beta_access_requests() to authenticated",
    );
    expect(migration).toContain(
      "revoke execute on function list_founder_admin_beta_access_requests() from public, anonymous",
    );
    expect(migration).not.toMatch(/\bupdate\s+owner_beta_access_requests\b/iu);
    expect(migration).not.toMatch(
      /\bdelete\s+from\s+owner_beta_access_requests\b/iu,
    );
    expect(fulfillmentMigration).toContain("'fulfillment', jsonb_build_object");
    expect(fulfillmentMigration).toContain(
      "'fulfilled', fulfilled_at is not null",
    );
    expect(fulfillmentMigration).toContain(
      "'grant_linked', fulfilled_grant_id is not null",
    );
    expect(fulfillmentMigration).toContain(
      "grant execute on function list_founder_admin_beta_access_requests() to authenticated",
    );
    expect(preflightMigration).toContain("'provider_gate', jsonb_build_object");
    expect(preflightMigration).toContain("'unexpected_live_records'");
    expect(preflightMigration).toContain("provider_connections providers");
    expect(preflightMigration).toContain("app_admins.status = 'active'");
    expect(preflightMigration).toContain("memberships.role = 'founder_admin'");
    expect(preflightMigration).not.toMatch(
      /\bupdate\s+owner_beta_access_requests\b/iu,
    );
    expect(preflightMigration).not.toMatch(
      /\binsert\s+into\s+owner_beta_access_requests\b/iu,
    );
    expect(preflightMigration).not.toMatch(/\bdelete\s+from\b/iu);
    expect(receiptMigration).toContain(
      "create table owner_beta_access_fulfillment_receipts",
    );
    expect(receiptMigration).toContain(
      "alter table owner_beta_access_fulfillment_receipts enable row level security",
    );
    expect(receiptMigration).toContain(
      "revoke all on table owner_beta_access_fulfillment_receipts from public, anonymous, authenticated",
    );
    expect(receiptMigration).toContain("left join lateral");
    expect(receiptMigration).toContain("'fulfillment_receipt', case");
    expect(receiptMigration).toContain("'command_name', receipt_command_name");
    expect(receiptMigration).toContain(
      "'neon_branch_name', receipt_neon_branch_name",
    );
    expect(receiptMigration).toContain(
      "grant execute on function list_founder_admin_beta_access_requests() to authenticated",
    );
  });

  it("wires the owner sign-in request form without creating accounts or sending invites", () => {
    expect(ownerSignInActions).toContain("requestOwnerBetaAccessAction");
    expect(ownerSignInActions).toContain(
      'neon.rpc("submit_owner_beta_access_request"',
    );
    expect(ownerSignInActions).toContain("p_company_website");
    expect(ownerSignInActions).not.toContain("neon.auth.signUp");
    expect(ownerSignInActions).not.toMatch(
      /send.*invite|invite.*send|email.*delivery/iu,
    );
    expect(ownerSignInForm).toContain("requestOwnerBetaAccessAction");
    expect(ownerSignInForm).toContain(
      "Owner accounts are operator-provisioned after review",
    );
    expect(ownerSignInForm).toContain("Beta access request steps");
    expect(ownerSignInForm).toContain("No public owner self-signup");
    expect(ownerSignInForm).toContain(
      "No invite delivery or notification sending",
    );
    expect(ownerSignInForm).toContain(
      "No billing, POS, or member-ledger writes",
    );
    expect(ownerSignInForm).toContain('name="companyWebsite"');
    expect(ownerSignInForm).toContain("Request beta access");
  });

  it("wires the admin portal request queue without mutation controls", () => {
    expect(founderAdminRepository).toContain("loadBetaAccessRequests");
    expect(founderAdminRepository).toMatch(
      /this\.neon\.rpc\(\s*"list_founder_admin_beta_access_requests"/u,
    );
    expect(founderAdminPage).toContain(
      "betaAccessRequestReport={authorizedReports?.betaAccessRequests}",
    );
    expect(founderAdminPage).toContain("loadBetaAccessRequests");
    expect(founderAdminPage).toContain("betaAccessRequestReport=");
    expect(founderAdminComponent).toContain("Beta access request console");
    expect(founderAdminComponent).toContain("CLI not completed");
    expect(founderAdminComponent).toContain("Owner onboarding timeline");
    expect(founderAdminComponent).toContain(
      "founderAdminOwnerOnboardingTimeline",
    );
    expect(founderAdminComponent).toContain("rollback proof");
    expect(founderAdminComponent).toContain("Fulfillment preflight");
    expect(founderAdminComponent).toContain(
      "founderAdminBetaFulfillmentPreflight",
    );
    expect(founderAdminComponent).toContain("Operator command sequence");
    expect(founderAdminComponent).toContain(
      "founderAdminBetaRequestOperatorSequence",
    );
    expect(founderAdminDomain).toContain("OUTPOST_OWNER_BETA_REQUEST_EMAIL=");
    expect(founderAdminDomain).toContain(
      "OUTPOST_OWNER_BETA_PASSWORD='<temporary-password>'",
    );
    expect(founderAdminComponent).toContain("request.fulfillment.fulfilled");
    expect(founderAdminComponent).toContain("CLI not completed");
    expect(founderAdminComponent).toContain("Fulfillment receipt");
    expect(founderAdminComponent).toContain(
      "request.fulfillment_receipt?.present",
    );
    expect(founderAdminComponent).toContain(
      "Append-only CLI receipt recorded without secrets",
    );
    expect(founderAdminComponent).not.toMatch(
      /Approve request|Decline request|form action=.*betaAccess/iu,
    );
    expect(founderAdminComponent).not.toMatch(
      /signUp|sign-in\/email|send.*invite|invite.*send/iu,
    );
  });

  it("adds a dry-run operator preflight command without hosted writes", () => {
    expect(packageJson).toContain(
      '"beta:operator:request-preflight": "node scripts/preflight-owner-beta-access-request.mjs"',
    );
    expect(preflightScript).toContain(
      'requireEnv("OUTPOST_OWNER_BETA_REQUEST_EMAIL")',
    );
    expect(preflightScript).toContain(
      "NEON_API_KEY is required for beta request fulfillment preflight",
    );
    expect(preflightScript).toContain(
      "Refusing beta request preflight on Neon production",
    );
    expect(preflightScript).toContain(
      "Refusing beta request preflight on the Neon migration spike branch",
    );
    expect(preflightScript).toContain(
      "Dry-run complete; no hosted rows were written.",
    );
    expect(preflightScript).toContain(
      "OUTPOST_OWNER_BETA_PREFLIGHT_ALLOW_BLOCKED",
    );
    expect(preflightScript).toContain("Unexpected live-provider records exist");
    expect(preflightScript).toContain(
      "npm run beta:operator:request-fulfillment",
    );
    expect(preflightScript).not.toMatch(/\binsert\s+into\b/iu);
    expect(preflightScript).not.toMatch(/\bupdate\s+[\w."]+\s+set\b/iu);
    expect(preflightScript).not.toMatch(/\bdelete\s+from\b/iu);
    expect(preflightScript).not.toMatch(
      /sign-up\/email|sign-in\/email|send.*invite|invite.*send/iu,
    );
  });

  it("records sanitized CLI fulfillment receipts without exposing secrets", () => {
    expect(fulfillmentScript).toContain(
      "owner_beta_access_fulfillment_receipts",
    );
    expect(fulfillmentScript).toContain("recordFulfillmentReceipt");
    expect(fulfillmentScript).toContain("stableReceiptId");
    expect(fulfillmentScript).toContain("beta:operator:request-fulfillment");
    expect(fulfillmentScript).toContain("operator_cli_fulfillment_receipt");
    expect(fulfillmentScript).toContain(
      "assertNoSecretShapedValue(JSON.stringify(summary)",
    );
    expect(fulfillmentScript).toContain("on conflict (id) do nothing");
    expect(fulfillmentScript).toContain("Fulfillment receipt recorded");
    expect(fulfillmentScript).not.toMatch(
      /summary[\s\S]{0,260}(password|api[_-]?key|cookie|token)/iu,
    );
    expect(receiptMigration).toContain(
      "owner_beta_access_fulfillment_receipts_no_secret_summary",
    );
    expect(receiptMigration).toContain(
      "password|secret|token|cookie|api[_-]?key",
    );
  });

  it("extends hosted admin portal proof to cover request queue denial", () => {
    expect(hostedFounderAdminScript).toContain(
      "list_founder_admin_beta_access_requests",
    );
    expect(hostedFounderAdminScript).toContain(
      "submit_owner_beta_access_request",
    );
    expect(hostedFounderAdminScript).toContain(
      "assertAuthorizedBetaAccessRequestReport",
    );
    expect(hostedFounderAdminScript).toContain(
      "assertPublicBetaAccessRequestRuntime",
    );
    expect(hostedFounderAdminScript).toContain(
      "assertAnonymousBetaAccessRequestsDenied",
    );
    expect(hostedFounderAdminScript).toContain(
      "owner_beta_access_requests?select=id,email,status&limit=1",
    );
    expect(hostedFounderAdminScript).toContain(
      "Secret-shaped beta access request unexpectedly succeeded",
    );
    expect(hostedFounderAdminScript).toContain(
      "Honeypot beta access request unexpectedly became visible",
    );
    expect(hostedFounderAdminScript).toContain(
      "Beta access request queue RPC proof",
    );
    expect(hostedFounderAdminScript).toContain(
      "beta_access_request_projection",
    );
    expect(hostedFounderAdminScript).toContain("Beta access request console");
    expect(hostedFounderAdminScript).toContain("Beta proof-run summary");
    expect(hostedFounderAdminScript).toContain("Proof evidence timeline");
    expect(hostedFounderAdminScript).not.toContain("service_role");
    expect(hostedFounderAdminScript).not.toContain("SUPABASE_SERVICE_ROLE");
  });
});
