import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const proofScript = readFileSync("scripts/verify-hosted-beta-request-chain-proof.mjs", "utf8");
const domain = readFileSync("src/domain/founder-admin-readiness.ts", "utf8");
const brainstorm = readFileSync(
  "docs/brainstorms/2026-06-24-hosted-beta-request-chain-proof-brainstorm.md",
  "utf8"
);
const plan = readFileSync("docs/plans/2026-06-24-feat-hosted-beta-request-chain-proof-plan.md", "utf8");

describe("hosted beta request chain proof", () => {
  it("registers the proof-only hosted request chain command", () => {
    expect(packageJson).toContain(
      '"hosted:beta-request-chain-proof": "node scripts/verify-hosted-beta-request-chain-proof.mjs"'
    );
    expect(domain).toContain("Hosted beta request chain proof");
    expect(domain).toContain("npm run hosted:beta-request-chain-proof");
    expect(brainstorm).toContain("public request intake");
    expect(plan).toContain("Submit one disposable owner beta request");
  });

  it("composes request, triage, follow-through, fulfillment, and admin ledger verification", () => {
    expect(proofScript).toContain('runNpmScript("hosted:readiness"');
    expect(proofScript).toContain('dataApiRpc("submit_owner_beta_access_request"');
    expect(proofScript).toContain('runNpmScript("admin:beta-request:triage-packet"');
    expect(proofScript).toContain('runNpmScript("admin:beta-request:triage-record"');
    expect(proofScript).toContain('runNpmScript("admin:beta-request:followthrough"');
    expect(proofScript).toContain('runNpmScript("admin:beta-request:followthrough-record"');
    expect(proofScript).toContain('runNpmScript("beta:operator:request-fulfillment"');
    expect(proofScript).toContain("verifyChainRows");
    expect(proofScript).toContain("OUTPOST_BETA_REQUEST_CHAIN_EVIDENCE_PATH");
    expect(proofScript).toContain("owner-beta-request-chain-proof.json");
    expect(proofScript).toContain("owner_beta_access_request_triage_receipts");
    expect(proofScript).toContain("owner_beta_access_request_followthrough_outcomes");
    expect(proofScript).toContain("owner_beta_access_fulfillment_receipts");
    expect(proofScript).toContain("status not in ('not_configured', 'disabled', 'pending_review')");
    expect(proofScript).toContain("secret_ref is not null");
    expect(proofScript).toContain("nullif(external_account_label, '') is not null");
  });

  it("keeps cleanup scoped to the disposable request chain", () => {
    expect(proofScript).toContain("let proofRequestId = null");
    expect(proofScript).toContain("proofRequestId = request.id");
    expect(proofScript).toContain("Refusing cleanup without created disposable owner beta request id.");
    expect(proofScript).toContain(
      "delete from owner_beta_access_request_followthrough_outcomes where request_id = ${sqlLiteral(proofRequestId)}"
    );
    expect(proofScript).toContain(
      "delete from owner_beta_access_requests where id = ${sqlLiteral(proofRequestId)}"
    );
    expect(proofScript).toContain("not exists (select 1 from tenant_memberships");
  });

  it("refuses customer-like owner request proof email overrides", () => {
    const result = spawnSync(process.execPath, ["scripts/verify-hosted-beta-request-chain-proof.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NEON_API_KEY: "napi_test_operator_key_value_1234567890",
        NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth",
        NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-test.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
        NEXT_PUBLIC_OUTPOST_APP_URL: "https://outpost-preview-abc123-<team-scope>.vercel.app",
        OUTPOST_HOSTED_BETA_REQUEST_CHAIN_EMAIL: "owner@example.com",
        OUTPOST_NEON_BRANCH_NAME: "outpost-proof-branch",
        OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
        OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password-123",
        OUTPOST_OWNER_BETA_PASSWORD: "not-the-local-seed-password-123"
      }
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "OUTPOST_HOSTED_BETA_REQUEST_CHAIN_EMAIL must use the disposable @beta-proof.outpost.local domain."
    );
    expect(`${result.stdout}\n${result.stderr}`).not.toContain("submit_owner_beta_access_request");
  });

  it("fails closed before hosted writes for local Preview URLs", () => {
    const result = spawnSync(process.execPath, ["scripts/verify-hosted-beta-request-chain-proof.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NEON_API_KEY: "napi_test_operator_key_value_1234567890",
        NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth",
        NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-test.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
        OUTPOST_NEON_BRANCH_NAME: "outpost-proof-beta-request-chain",
        OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
        OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password",
        OUTPOST_OWNER_BETA_PASSWORD: "temporary-owner-password-123",
        OUTPOST_VERCEL_DEPLOYMENT_URL: "http://localhost:3000"
      }
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain(
      "Hosted beta request chain proof must use an HTTPS Vercel Preview URL"
    );
    expect(`${result.stderr}\n${result.stdout}`).not.toContain("submit_owner_beta_access_request");
  });

  it("keeps no-live-provider and no-public-launch boundaries explicit", () => {
    expect(proofScript).not.toMatch(/sendInvite|sendEmail|enableProvider|memberLedgerWrite|billingWrite/u);
    expect(brainstorm).toContain("Keep phone/email providers, invite delivery, notifications, billing, POS");
    expect(plan).toContain("No public approval buttons");
  });
});
