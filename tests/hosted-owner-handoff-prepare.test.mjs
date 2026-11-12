import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const hostedPrepareScript = readFileSync("scripts/prepare-hosted-owner-handoff.mjs", "utf8");

function runHostedPrepare(extraEnv = {}) {
  return spawnSync(process.execPath, ["scripts/prepare-hosted-owner-handoff.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnv
    }
  });
}

describe("hosted owner handoff preparation", () => {
  it("registers a hosted owner handoff preparation command", () => {
    expect(packageJson).toContain('"hosted:owner-handoff:prepare"');
    expect(packageJson).toContain("prepare-hosted-owner-handoff.mjs");
  });

  it("smokes the hosted owner sign-in route before delegating to the bundle command", () => {
    expect(hostedPrepareScript).toContain("normalizeHostedPreviewOrigin");
    expect(hostedPrepareScript).toContain('routeSmoke(origin, "/owner/sign-in"');
    expect(hostedPrepareScript).toContain('"Owner sign-in"');
    expect(hostedPrepareScript).toContain('"Request owner beta access"');
    expect(hostedPrepareScript).toContain('spawnSync("npm", ["run", "beta:owner-handoff:bundle"]');
    expect(hostedPrepareScript).toContain("OUTPOST_BETA_HANDOFF_PREVIEW_URL: origin");
    expect(hostedPrepareScript.indexOf('routeSmoke(origin, "/owner/sign-in"')).toBeLessThan(
      hostedPrepareScript.indexOf('console.log("/owner/sign-in smoke passed.")')
    );
    expect(hostedPrepareScript.indexOf('console.log("/owner/sign-in smoke passed.")')).toBeLessThan(
      hostedPrepareScript.lastIndexOf("runBundle(origin)")
    );
  });

  it("supports protected Vercel Preview access without printing bypass material", () => {
    expect(hostedPrepareScript).toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(hostedPrepareScript).toContain('"x-vercel-protection-bypass"');
    expect(hostedPrepareScript).toContain('"x-vercel-set-bypass-cookie"');
    expect(hostedPrepareScript).toContain("OUTPOST_USE_VERCEL_CURL");
    expect(hostedPrepareScript).toContain('runVercelCurl([route, "--deployment"');
    expect(hostedPrepareScript).not.toContain("vercel_bypass_secret:");
    expect(hostedPrepareScript).not.toMatch(/console\.log\(VERCEL_BYPASS_SECRET|console\.error\(VERCEL_BYPASS_SECRET/u);
  });

  it("keeps hosted preparation non-mutating and customer-observed completion pending", () => {
    expect(hostedPrepareScript).toContain("non-mutating handoff bundle preparation");
    expect(hostedPrepareScript).toContain("Customer-observed completion remains pending");
    expect(hostedPrepareScript).not.toMatch(
      /record-beta-owner-handoff-completion|verify-beta-owner-handoff-gate|record-customer-handoff-gate-proof|bootstrap_owner_tenant|sign-in\/email/iu
    );
    expect(hostedPrepareScript).not.toMatch(/send.*invite|invite.*send|provider_connections|member_ledger|billing/iu);
  });

  it("fails closed for missing, local, non-HTTPS, non-Vercel, and production-like origins before smoke", () => {
    let result = runHostedPrepare({});
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain(
      "OUTPOST_VERCEL_DEPLOYMENT_URL or NEXT_PUBLIC_OUTPOST_APP_URL is required"
    );

    result = runHostedPrepare({ OUTPOST_VERCEL_DEPLOYMENT_URL: "http://outpost-preview-test.vercel.app" });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain("must use an HTTPS Vercel Preview URL");

    result = runHostedPrepare({ OUTPOST_VERCEL_DEPLOYMENT_URL: "https://localhost:3104" });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain("refuses local app origins");

    result = runHostedPrepare({ OUTPOST_VERCEL_DEPLOYMENT_URL: "https://example.com" });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain("must target a Vercel Preview URL");

    result = runHostedPrepare({ OUTPOST_VERCEL_DEPLOYMENT_URL: "https://outpost.vercel.app" });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain("refuses production-like Vercel origins");
  });
});
