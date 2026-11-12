import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const migration = readFileSync(
  "neon/migrations/20260627010000_admin_customer_session_records.sql",
  "utf8",
);
const recordScript = readFileSync(
  "scripts/record-admin-customer-session-hosted.mjs",
  "utf8",
);
const proofScript = readFileSync(
  "scripts/verify-hosted-customer-session-record-proof.mjs",
  "utf8",
);
const domain = readFileSync("src/domain/founder-admin-readiness.ts", "utf8");
const repository = readFileSync(
  "src/infrastructure/neon/founder-admin-readiness-repository.ts",
  "utf8",
);
const adminPage = readFileSync("src/app/admin/page.tsx", "utf8");
const consoleComponent = readFileSync(
  "src/components/founder-admin/FounderAdminReadinessConsole.tsx",
  "utf8",
);

describe("admin customer session hosted record", () => {
  it("defines append-only hosted customer session digest table and founder-admin RPC", () => {
    expect(migration).toContain("create table admin_customer_session_records");
    expect(migration).toContain("session_record_sha256 text not null unique");
    expect(migration).toContain("customer_observed_session_recorded = true");
    expect(migration).toContain("public_self_serve_launch_allowed = false");
    expect(migration).toContain("invite_delivery_allowed = false");
    expect(migration).toContain("live_provider_enablement_allowed = false");
    expect(migration).toContain("billing_pos_member_writes_allowed = false");
    expect(migration).toContain(
      "alter table admin_customer_session_records enable row level security",
    );
    expect(migration).toContain(
      "revoke all on admin_customer_session_records from public, anonymous, authenticated",
    );
    expect(migration).toContain(
      "create or replace function list_founder_admin_customer_session_records()",
    );
    expect(migration).toContain("users.external_auth_id = v_auth_user_id");
    expect(migration).toContain("memberships.role = 'founder_admin'");
    expect(migration).toContain(
      "grant execute on function list_founder_admin_customer_session_records() to authenticated",
    );
  });

  it("wires package scripts, repository loader, domain report, and admin timeline copy", () => {
    expect(packageJson).toContain("admin:customer-session:record-hosted");
    expect(packageJson).toContain("hosted:customer-session-record:proof");
    expect(repository).toContain("list_founder_admin_customer_session_records");
    expect(repository).toContain("normalizeCustomerSessionRecordReport");
    expect(domain).toContain("FounderAdminCustomerSessionRecord");
    expect(domain).toContain(
      "customerSessionRecords: FounderAdminCustomerSessionRecord[]",
    );
    expect(adminPage).toContain("authorizedReports.customerSessionRecords");
    expect(adminPage).toContain("customerSessionRecordReport");
    expect(consoleComponent).toContain("Customer session record");
    expect(consoleComponent).toContain("session_record_sha256");
  });

  it("keeps hosted import and proof scripts fail-closed and no-live-provider scoped", () => {
    expect(recordScript).toContain("runCustomerSessionInspect");
    expect(recordScript).toContain("admin_customer_observed_session_record");
    expect(recordScript).toContain("admin_customer_session_records");
    expect(recordScript).toContain("NEXT_PUBLIC_OUTPOST_APP_URL");
    expect(recordScript).toContain("must be a Vercel Preview origin");
    expect(recordScript).toContain(
      "public_self_serve_launch_allowed === false",
    );
    expect(recordScript).toContain("invite_delivery_allowed === false");
    expect(recordScript).toContain(
      "live_provider_enablement_allowed === false",
    );
    expect(recordScript).toContain(
      "billing_pos_member_writes_allowed === false",
    );
    expect(proofScript).toContain("signUpVerifiedFounder");
    expect(proofScript).toContain(
      "list_founder_admin_customer_session_records",
    );
    expect(proofScript).toContain("assertFounderAdminDenied");
    expect(proofScript).toContain(
      "Refusing customer session record proof against production branch",
    );
    expect(proofScript).toContain(
      "Refusing customer session record proof against migration spike branch",
    );
    expect(`${recordScript}\n${proofScript}`).not.toMatch(
      /sendEmail|sendInvite|connect.*gmail|resend\.emails|stripe|provider.*activate/iu,
    );
  });
});
