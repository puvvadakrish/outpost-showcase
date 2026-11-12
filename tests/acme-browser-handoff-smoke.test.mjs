import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const browserSmokeScript = readFileSync("scripts/verify-acme-browser-handoff-smoke.mjs", "utf8");
const runbook = readFileSync("docs/setup/acme-dry-run-onboarding-handoff.md", "utf8");

describe("Acme Fitness browser handoff smoke", () => {
  // These source-shape tests pin the risky orchestration boundaries. The live
  // browser behavior is verified by running the script against hosted Neon.
  it("registers a dedicated browser handoff command", () => {
    expect(packageJson).toContain('"acme:browser:handoff"');
    expect(packageJson).toContain("verify-acme-browser-handoff-smoke.mjs");
  });

  it("launches an isolated Chrome CDP session instead of using the active desktop window", () => {
    expect(browserSmokeScript).toContain("OUTPOST_CHROME_PATH");
    expect(browserSmokeScript).toContain("OUTPOST_ACME_BROWSER_APP_URL");
    expect(browserSmokeScript).toContain("--remote-debugging-port=0");
    expect(browserSmokeScript).toContain("--user-data-dir=");
    expect(browserSmokeScript).toContain("mkdtempSync(join(tmpdir(), \"outpost-acme-browser-\")");
    expect(browserSmokeScript).toContain("DevToolsActivePort");
    expect(browserSmokeScript).toContain("new WebSocket");
    expect(browserSmokeScript).toContain("Page.navigate");
    expect(browserSmokeScript).not.toContain("mcp__computer_use");
    expect(browserSmokeScript).not.toContain("osascript");
  });

  it("fails closed for protected Vercel Preview browser proof without a bypass secret", () => {
    expect(browserSmokeScript).toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(browserSmokeScript).toContain("protected Vercel Preview browser handoff smoke");
    expect(browserSmokeScript).toContain("Network.setExtraHTTPHeaders");
    expect(browserSmokeScript).toContain("x-vercel-protection-bypass");
    expect(browserSmokeScript).toContain("x-vercel-set-bypass-cookie");
  });

  it("delegates setup and rollback to the guarded dry-run verifier", () => {
    expect(browserSmokeScript).toContain('["npm", "run", "acme:dry-run:onboarding"]');
    expect(browserSmokeScript).toContain("OUTPOST_ACME_DRY_RUN_KEEP_DATA: \"1\"");
    expect(browserSmokeScript).toContain("OUTPOST_ACME_DRY_RUN_ROLLBACK_ONLY: \"1\"");
    expect(browserSmokeScript).toContain("NEXT_PUBLIC_OUTPOST_APP_URL: DRY_RUN_APP_ORIGIN");
    expect(browserSmokeScript).toContain("finally");
    expect(browserSmokeScript).toContain("extractRollbackTenantId");
    expect(browserSmokeScript).toContain("rollbackDryRun(rollbackTenantId)");
    expect(browserSmokeScript).toContain("OUTPOST_ACME_DRY_RUN_EVIDENCE_PATH");
  });

  it("submits the real owner sign-in form and checks the owner workspace proof copy", () => {
    expect(browserSmokeScript).toContain("/owner/sign-in");
    expect(browserSmokeScript).toContain('form.auth-form input[name=email]');
    expect(browserSmokeScript).toContain("form.requestSubmit()");
    expect(browserSmokeScript).toContain('location.pathname === "/owner"');
    expect(browserSmokeScript).toContain("Owner workspace");
    expect(browserSmokeScript).toContain("hosted Neon proof must stay current");
    expect(browserSmokeScript).toContain("Live providers");
    expect(browserSmokeScript).toContain("Live gates closed");
  });

  it("keeps browser evidence non-secret and documents the command", () => {
    expect(browserSmokeScript).toContain("Browser evidence: wrote non-secret handoff summary");
    expect(browserSmokeScript).not.toContain("owner_password:");
    expect(browserSmokeScript).not.toContain("neon_api_key:");
    expect(browserSmokeScript).not.toContain("vercel_bypass_secret:");
    expect(runbook).toContain("npm run acme:browser:handoff");
    expect(runbook).toContain("isolated Chrome");
    expect(runbook).toContain("passes against");
  });
});
