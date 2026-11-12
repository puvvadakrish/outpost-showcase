import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const operatorScript = readFileSync("scripts/provision-owner-beta-access.mjs", "utf8");
const runbook = readFileSync("docs/setup/hosted-beta-operator-access.md", "utf8");

describe("beta operator access ops", () => {
  it("registers an operator-only owner beta access command", () => {
    expect(packageJson).toContain('"beta:operator:owner-access"');
    expect(packageJson).toContain("provision-owner-beta-access.mjs");
  });

  it("reuses hosted Neon proof config and refuses unsafe branches or credentials", () => {
    expect(operatorScript).toContain("readHostedReadinessConfig");
    expect(operatorScript).toContain("NEON_API_KEY is required");
    expect(operatorScript).toContain("Refusing to provision beta owner access on Neon production");
    expect(operatorScript).toContain("Refusing to provision beta owner access on the Neon migration spike branch");
    expect(operatorScript).toContain("OUTPOST_OWNER_BETA_PASSWORD must be at least 12 characters");
    expect(operatorScript).toContain("Refusing to use the local seed password");
    expect(operatorScript).not.toContain("service_role");
    expect(operatorScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(operatorScript).toContain("function sqlLiteral");
    expect(operatorScript).not.toContain("function shellQuote");
  });

  it("creates or verifies hosted Neon Auth owners and upserts the beta access grant", () => {
    expect(operatorScript).toContain("/sign-up/email");
    expect(operatorScript).toContain("emailVerified");
    expect(operatorScript).toContain('update neon_auth."user"');
    expect(operatorScript).toContain("insert into owner_beta_access_grants");
    expect(operatorScript).toContain("on conflict (email) do update");
    expect(operatorScript).toContain("status = 'active'");
  });

  it("proves the grant through the signed-in owner and keeps cross-email checks closed", () => {
    expect(operatorScript).toContain("/sign-in/email");
    expect(operatorScript).toContain("/token");
    expect(operatorScript).toContain('dataApiRpc("has_active_owner_beta_access"');
    expect(operatorScript).toContain("attempt <= 6");
    expect(operatorScript).toContain("setTimeout(resolve, ms)");
    expect(operatorScript).toContain("lastError");
    expect(operatorScript).toContain("p_owner_email: OWNER_EMAIL");
    expect(operatorScript).toContain("p_owner_email: CROSS_EMAIL");
    expect(operatorScript).toContain("exposed another owner email");
  });

  it("keeps no-live-provider gates and reset/rotate instructions explicit", () => {
    expect(operatorScript).toContain("provider_connections");
    expect(operatorScript).toContain("where status not in ('not_configured', 'disabled', 'pending_review')");
    expect(operatorScript).toContain("or secret_ref is not null");
    expect(operatorScript).toContain("or external_account_label is not null");
    expect(operatorScript).toContain("Live-provider gates remain blocked");
    expect(runbook).toContain("No invite email is sent");
    expect(runbook).toContain("Retell, Resend, Gmail, live phone/email");
    expect(runbook).toContain("billing, POS, payment processing, member-ledger writes");
    expect(runbook).toContain("Reset And Rotate");
    expect(runbook).toContain("OUTPOST_OWNER_BETA_PASSWORD");
  });
});
