import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const proofScript = readFileSync("scripts/verify-hosted-request-fulfillment-proof.mjs", "utf8");
const requestFulfillmentScript = readFileSync("scripts/fulfill-owner-beta-access-request.mjs", "utf8");
const runbook = readFileSync("docs/setup/hosted-beta-operator-access.md", "utf8");
const brainstorm = readFileSync("docs/brainstorms/2026-06-22-hosted-request-fulfillment-proof-brainstorm.md", "utf8");
const plan = readFileSync("docs/plans/2026-06-22-feat-hosted-request-fulfillment-proof-plan.md", "utf8");

describe("hosted request fulfillment proof", () => {
  it("registers a hosted disposable request fulfillment proof command", () => {
    expect(packageJson).toContain(
      '"hosted:request-fulfillment-proof": "node scripts/verify-hosted-request-fulfillment-proof.mjs"'
    );
    expect(proofScript).toContain("readHostedReadinessConfig");
    expect(proofScript).toContain("OUTPOST_VERCEL_DEPLOYMENT_URL");
    expect(proofScript).toContain("OUTPOST_OWNER_BETA_PASSWORD");
    expect(proofScript).toContain("OUTPOST_HOSTED_REQUEST_FULFILLMENT_RETAIN");
    expect(brainstorm).toContain("repeatable hosted proof");
    expect(plan).toContain("submits a disposable request");
    expect(plan).toContain("Runs `npm run beta:operator:request-fulfillment`");
  });

  it("composes existing hosted readiness, public request, and fulfillment paths", () => {
    expect(proofScript).toContain('runCommand(["npm", "run", "hosted:readiness"]');
    expect(proofScript).toContain('dataApiRpc("submit_owner_beta_access_request"');
    expect(proofScript).toContain('runCommand(["npm", "run", "beta:operator:request-fulfillment"]');
    expect(proofScript).toContain("OUTPOST_OWNER_BETA_REQUEST_EMAIL: OWNER_EMAIL");
    expect(proofScript).toContain("OUTPOST_OWNER_BETA_REQUEST_FULFILLMENT_NOTE");
    expect(requestFulfillmentScript).toContain('spawnSync("node", ["scripts/provision-owner-beta-access.mjs"]');
  });

  it("verifies admin portal fulfillment projection and owner-scoped access", () => {
    expect(proofScript).toContain('dataApiRpc("list_founder_admin_beta_access_requests"');
    expect(proofScript).toContain("row.fulfillment?.fulfilled !== true");
    expect(proofScript).toContain("row.fulfillment?.grant_linked !== true");
    expect(proofScript).toContain("row.fulfillment_receipt?.present !== true");
    expect(proofScript).toContain('row.fulfillment_receipt.command_name !== "beta:operator:request-fulfillment"');
    expect(proofScript).toContain('row.fulfillment_receipt.status !== "recorded"');
    expect(proofScript).toContain('dataApiRpc("has_active_owner_beta_access"');
    expect(proofScript).toContain("crossGranted !== false");
    expect(proofScript).toContain('routeSmoke("/owner"');
    expect(proofScript).toContain("Create your owner workspace");
    expect(proofScript).toContain("Seedless setup");
  });

  it("keeps hosted proof guarded and preserves no-live-provider gates", () => {
    expect(proofScript).toContain("Refusing hosted request fulfillment proof on Neon production");
    expect(proofScript).toContain("Refusing hosted request fulfillment proof on the Neon migration spike branch");
    expect(proofScript).toContain("Hosted request fulfillment proof must target a Vercel Preview URL");
    expect(proofScript).toContain("Refusing to reuse the local seed password for owner proof");
    expect(proofScript).toContain("assertDisposableProofEmail(OWNER_EMAIL, \"@beta-proof.outpost.local\"");
    expect(proofScript).toContain("assertDisposableProofEmail(FOUNDER_EMAIL, \"@founder-proof.outpost.local\"");
    expect(proofScript).toContain("assertNoSecretShapedValue(output, \"request fulfillment output\")");
    expect(proofScript).toContain("assertNoLiveProviderGates");
    expect(proofScript).not.toMatch(/send.*invite|invite.*send|email.*delivery/iu);
    expect(proofScript).not.toMatch(/insert\s+into\s+provider_connections|member_ledger/iu);
  });

  it("cleans disposable proof rows by default and requires explicit retention", () => {
    expect(proofScript).toContain("let cleanupArmed = false");
    expect(proofScript).toContain("cleanupArmed = true");
    expect(proofScript).toContain("if (RETAIN_PROOF_DATA)");
    expect(proofScript).toContain("delete from owner_beta_access_requests");
    expect(proofScript).toContain("delete from owner_beta_access_fulfillment_receipts");
    expect(proofScript).toContain("delete from owner_beta_access_grants");
    expect(proofScript).toContain('delete from neon_auth."user"');
    expect(runbook).toContain("npm run hosted:request-fulfillment-proof");
    expect(runbook).toContain("removes");
    expect(runbook).toContain("disposable receipt, request, grant, admin");
    expect(runbook).toContain("default");
    expect(runbook).toContain("@beta-proof.outpost.local");
    expect(runbook).toContain("@founder-proof.outpost.local");
  });

  it("refuses runtime proof on Neon production before cleanup is armed", () => {
    const result = spawnSync(process.execPath, ["scripts/verify-hosted-request-fulfillment-proof.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NEON_API_KEY: "napi_test_operator_key_value_1234567890",
        NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth",
        NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-test.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
        OUTPOST_NEON_BRANCH_NAME: "production",
        OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
        OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password",
        OUTPOST_OWNER_BETA_PASSWORD: "temporary-owner-password-123",
        OUTPOST_VERCEL_DEPLOYMENT_URL: "https://outpost-preview-test.vercel.app"
      }
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain("Refusing hosted request fulfillment proof on Neon production");
    expect(`${result.stderr}\n${result.stdout}`).not.toContain("Cleanup failed");
  });

  it("refuses runtime proof against a local app origin before cleanup is armed", () => {
    const result = spawnSync(process.execPath, ["scripts/verify-hosted-request-fulfillment-proof.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NEON_API_KEY: "napi_test_operator_key_value_1234567890",
        NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth",
        NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-test.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
        OUTPOST_NEON_BRANCH_NAME: "outpost-proof-request-fulfillment",
        OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
        OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password",
        OUTPOST_OWNER_BETA_PASSWORD: "temporary-owner-password-123",
        OUTPOST_VERCEL_DEPLOYMENT_URL: "http://localhost:3000"
      }
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain(
      "Hosted request fulfillment proof must use an HTTPS Vercel Preview URL"
    );
    expect(`${result.stderr}\n${result.stdout}`).not.toContain("Cleanup failed");
  });
});
