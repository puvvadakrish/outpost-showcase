import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const branchPrepScript = readFileSync("scripts/prepare-hosted-neon-proof-branch.mjs", "utf8");
const vercelPreviewScript = readFileSync("scripts/verify-vercel-preview-deployment.mjs", "utf8");
const vercelJson = readFileSync("vercel.json", "utf8");

describe("Vercel preview proof harness", () => {
  it("registers proof branch preparation and Vercel preview verification commands", () => {
    expect(packageJson).toContain('"hosted:proof-branch:prepare"');
    expect(packageJson).toContain('"vercel:preview:verify"');
    expect(packageJson).toContain("prepare-hosted-neon-proof-branch.mjs");
    expect(packageJson).toContain("verify-vercel-preview-deployment.mjs");
  });

  it("pins the Vercel project to the Next.js framework preset", () => {
    expect(vercelJson).toContain('"framework": "nextjs"');
    expect(vercelJson).toContain('"buildCommand": "npm run build"');
    expect(vercelJson).not.toContain("outputDirectory");
  });

  it("prepares fresh non-spike Neon proof branches with a rotated seed password file", () => {
    expect(branchPrepScript).not.toContain("NEON_API_KEY is required");
    expect(branchPrepScript).toContain("assertAllowedProjectId(PROJECT_ID)");
    expect(branchPrepScript).toContain("Refusing to prepare the Neon production branch");
    expect(branchPrepScript).toContain("Refusing to use the Neon migration spike branch");
    expect(branchPrepScript).toContain("Hosted proof branches must be created from the Neon production branch");
    expect(branchPrepScript).toContain("already exists. Use a fresh branch name");
    expect(branchPrepScript).toContain("applyNeonMigrations");
    expect(branchPrepScript).toContain("connection-string");
    expect(branchPrepScript).not.toContain("neon:migration:build");
    expect(branchPrepScript).toContain("neon-auth");
    expect(branchPrepScript).toContain("data-api");
    expect(branchPrepScript).toContain("randomBytes");
    expect(branchPrepScript).toContain("Rotated seed password file");
  });

  it("verifies deployed Preview URLs before delegating to hosted beta and admin portal proof", () => {
    expect(vercelPreviewScript).toContain("OUTPOST_VERCEL_DEPLOYMENT_URL");
    expect(vercelPreviewScript).toContain("must use an https deployment URL");
    expect(vercelPreviewScript).toContain("Refusing Vercel preview proof against a local app URL");
    expect(vercelPreviewScript).toContain("must target a vercel.app deployment URL");
    expect(vercelPreviewScript).toContain("Refusing Vercel preview proof against a production deployment target");
    expect(vercelPreviewScript).toContain("readHostedReadinessConfig");
    expect(vercelPreviewScript).toContain("ensureNeonAuthTrustedDomain");
    expect(vercelPreviewScript).toContain("neon-auth");
    expect(vercelPreviewScript).toContain("domain");
    expect(vercelPreviewScript).toContain("add");
    expect(vercelPreviewScript).toContain("OUTPOST_USE_VERCEL_CURL");
    expect(vercelPreviewScript).toContain('runCommand(["npm", "run", "hosted:beta-workflow"]');
    expect(vercelPreviewScript).toContain('["npm", "run", "hosted:admin-portal-readiness"]');
    expect(vercelPreviewScript).toContain("recordVercelPreviewProofRun");
    expect(vercelPreviewScript).toContain("insert into hosted_proof_runs");
    expect(vercelPreviewScript).toContain("'vercel_preview_verify'");
    expect(vercelPreviewScript).toContain("hosted_beta_workflow");
    expect(vercelPreviewScript).toContain("founder_admin_readiness");
    expect(vercelPreviewScript).toContain("function sqlLiteral");
    expect(vercelPreviewScript).not.toContain("function shellQuote");
    expect(vercelPreviewScript.indexOf('runCommand(["npm", "run", "hosted:beta-workflow"]')).toBeLessThan(
      vercelPreviewScript.indexOf('["npm", "run", "hosted:admin-portal-readiness"]')
    );
    expect(vercelPreviewScript.indexOf('["npm", "run", "hosted:admin-portal-readiness"]')).toBeLessThan(
      vercelPreviewScript.lastIndexOf("recordVercelPreviewProofRun(config)")
    );
    expect(vercelPreviewScript).not.toContain("service_role");
    expect(vercelPreviewScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(vercelPreviewScript).not.toMatch(/summary[\s\S]{0,240}(password|api[_-]?key|cookie|token)/iu);
  });
});
