import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const proofScript = readFileSync("scripts/verify-hosted-beta-request-browser-proof.mjs", "utf8");
const domain = readFileSync("src/domain/founder-admin-readiness.ts", "utf8");
const brainstorm = readFileSync(
  "docs/brainstorms/2026-06-24-hosted-beta-request-browser-proof-brainstorm.md",
  "utf8"
);
const plan = readFileSync("docs/plans/2026-06-24-feat-hosted-beta-request-browser-proof-plan.md", "utf8");

describe("hosted beta request browser proof", () => {
  it("registers the protected Preview browser proof command", () => {
    expect(packageJson).toContain(
      '"hosted:beta-request-browser-proof": "node scripts/verify-hosted-beta-request-browser-proof.mjs"'
    );
    expect(domain).toContain("Hosted beta request browser proof");
    expect(domain).toContain("npm run hosted:beta-request-browser-proof");
    expect(brainstorm).toContain("real browser path");
    expect(plan).toContain("Submit one disposable owner beta request");
  });

  it("uses browser form submission, hosted Neon verification, evidence, and cleanup", () => {
    expect(proofScript).toContain("form.beta-access-request-form");
    expect(proofScript).toContain('form.querySelector(\'input[name="ownerName"]\')');
    expect(proofScript).toContain("Request received.");
    expect(proofScript).toContain("verifyPreviewRuntimeBranch");
    expect(proofScript).toContain("Protected Preview runtime branch did not match OUTPOST_NEON_BRANCH_NAME before browser submit.");
    expect(proofScript).toContain("loadRequest");
    expect(proofScript).toContain("verifyNoLiveProviders");
    expect(proofScript).toContain("writeEvidence");
    expect(proofScript).toContain("const PROOF_REQUEST_ID = ownerBetaRequestId(OWNER_EMAIL)");
    expect(proofScript).toContain("proofRequestId = PROOF_REQUEST_ID");
    expect(proofScript).toContain("delete from owner_beta_access_requests where id = ${sqlLiteral(proofRequestId)}");
    expect(proofScript).toContain("x-vercel-protection-bypass");
    expect(proofScript).toContain("x-vercel-set-bypass-cookie");
    expect(proofScript).toContain('cdp.on("Fetch.requestPaused"');
    expect(proofScript).toContain('cdp.send("Fetch.enable"');
    expect(proofScript).toContain("urlPattern: `${APP_ORIGIN}/*`");
    expect(proofScript).not.toContain("Network.setExtraHTTPHeaders");
    expect(proofScript).toContain("if (chrome.exitCode === null)");
  });

  it("preserves no-live-provider and no-self-serve boundaries", () => {
    expect(proofScript).toContain("status not in ('not_configured', 'disabled', 'pending_review')");
    expect(proofScript).toContain("secret_ref is not null");
    expect(proofScript).toContain("nullif(external_account_label, '') is not null");
    expect(proofScript).not.toContain("beta:operator:request-fulfillment");
    expect(proofScript).not.toContain("admin:beta-request:triage-record");
    expect(proofScript).not.toContain("admin:beta-request:followthrough-record");
  });

  it("fails closed before browser work for local Preview URLs", () => {
    const result = spawnSync(process.execPath, ["scripts/verify-hosted-beta-request-browser-proof.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NEON_API_KEY: "napi_test_operator_key_value_1234567890",
        NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth",
        NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-test.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
        OUTPOST_BETA_REQUEST_BROWSER_APP_URL: "http://localhost:3000",
        OUTPOST_NEON_BRANCH_NAME: "outpost-proof-branch",
        OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
        OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password-123",
        VERCEL_AUTOMATION_BYPASS_SECRET: "test-bypass-secret"
      }
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Hosted beta request browser proof must use an HTTPS Vercel Preview URL."
    );
    expect(`${result.stdout}\n${result.stderr}`).not.toContain("Request received.");
  });

  it("refuses customer-like proof email overrides before browser work", () => {
    const result = spawnSync(process.execPath, ["scripts/verify-hosted-beta-request-browser-proof.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NEON_API_KEY: "napi_test_operator_key_value_1234567890",
        NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth",
        NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-test.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
        OUTPOST_BETA_REQUEST_BROWSER_APP_URL: "https://outpost-preview-abc123-<team-scope>.vercel.app",
        OUTPOST_BETA_REQUEST_BROWSER_EMAIL: "owner@example.com",
        OUTPOST_CHROME_PATH: process.execPath,
        OUTPOST_NEON_BRANCH_NAME: "outpost-proof-branch",
        OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
        OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password-123",
        VERCEL_AUTOMATION_BYPASS_SECRET: "test-bypass-secret"
      }
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "OUTPOST_BETA_REQUEST_BROWSER_EMAIL must use the disposable @beta-browser-proof.outpost.local domain."
    );
    expect(`${result.stdout}\n${result.stderr}`).not.toContain("Request received.");
  });
});
