import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const exportScript = readFileSync("scripts/export-admin-proof-freshness.mjs", "utf8");
const inspectScript = readFileSync("scripts/inspect-admin-proof-freshness.mjs", "utf8");

function artifactPath(filename) {
  return join(mkdtempSync(join(tmpdir(), "outpost-admin-proof-freshness-test-")), filename);
}

function runExport(path, overrides = {}) {
  return spawnSync("node", ["scripts/export-admin-proof-freshness.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_PROOF_FRESHNESS_BLOCKED_COUNT: "0",
      OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH: path,
      OUTPOST_ADMIN_PROOF_FRESHNESS_FRESH_COUNT: "7",
      OUTPOST_ADMIN_PROOF_FRESHNESS_MISSING_COUNT: "0",
      OUTPOST_ADMIN_PROOF_FRESHNESS_NEXT_COMMAND: "none",
      OUTPOST_ADMIN_PROOF_FRESHNESS_OVERALL: "fresh",
      OUTPOST_ADMIN_PROOF_FRESHNESS_PREVIEW_URL: "https://outpost-preview-20260610-example.vercel.app",
      OUTPOST_ADMIN_PROOF_FRESHNESS_STALE_COUNT: "0",
      OUTPOST_NEON_BRANCH_NAME: "outpost-beta-access-scoped-proof",
      ...overrides
    }
  });
}

function runInspect(path) {
  return spawnSync("node", ["scripts/inspect-admin-proof-freshness.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH: path
    }
  });
}

describe("admin proof freshness artifact", () => {
  it("is registered in package scripts and keeps live gates blocked", () => {
    expect(packageJson).toContain('"admin:proof-freshness:export"');
    expect(packageJson).toContain('"admin:proof-freshness:inspect"');
    expect(exportScript).toContain("admin_proof_freshness_exported");
    expect(inspectScript).toContain("Proof freshness must be fresh");
    expect(exportScript).toContain("public_self_serve_launch_allowed: false");
    expect(inspectScript).toContain("Live-provider enablement must remain blocked");
  });

  it("writes and inspects a fresh non-secret artifact", () => {
    const path = artifactPath("proof-freshness.json");
    const result = runExport(path);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Admin proof freshness export");

    const artifact = JSON.parse(readFileSync(path, "utf8"));
    expect(artifact).toEqual(
      expect.objectContaining({
        live_provider_enablement_allowed: false,
        overall_state: "fresh",
        preview_url: "https://outpost-preview-20260610-example.vercel.app",
        public_self_serve_launch_allowed: false,
        status: "admin_proof_freshness_exported"
      })
    );
    expect(artifact.counts).toEqual({ blocked: 0, fresh: 7, missing: 0, stale: 0 });
    expect(JSON.stringify(artifact)).not.toMatch(/NEON_API_KEY|VERCEL_AUTOMATION_BYPASS_SECRET|Bearer |napi_|password|cookie|jwt/iu);

    const inspect = runInspect(path);
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain("Admin proof freshness inspection");
  });

  it("normalizes Preview URLs to credential-free origins", () => {
    const path = artifactPath("proof-freshness-origin.json");
    const result = runExport(path, {
      OUTPOST_ADMIN_PROOF_FRESHNESS_PREVIEW_URL: "https://outpost-preview.example.vercel.app/admin?token=secret"
    });
    expect(result.status, result.stderr).toBe(0);
    const artifact = JSON.parse(readFileSync(path, "utf8"));
    expect(artifact.preview_url).toBe("https://outpost-preview.example.vercel.app");

    const credentialed = runExport(artifactPath("credentialed.json"), {
      OUTPOST_ADMIN_PROOF_FRESHNESS_PREVIEW_URL: "https://user:pass@outpost-preview.example.vercel.app"
    });
    expect(credentialed.status).not.toBe(0);
    expect(`${credentialed.stderr}${credentialed.stdout}`).toContain("must not include credentials");

    const loopback = runExport(artifactPath("ipv6-loopback.json"), {
      OUTPOST_ADMIN_PROOF_FRESHNESS_PREVIEW_URL: "https://[::1]/"
    });
    expect(loopback.status).not.toBe(0);
    expect(`${loopback.stderr}${loopback.stdout}`).toContain("must not be local");
  });

  it("inspector rejects tampered credentialed or loopback Preview URLs", () => {
    const credentialedPath = artifactPath("tampered-credentialed.json");
    const exported = runExport(credentialedPath);
    expect(exported.status, exported.stderr).toBe(0);
    const credentialedArtifact = JSON.parse(readFileSync(credentialedPath, "utf8"));
    credentialedArtifact.preview_url = "https://user:pass@outpost-preview.example.vercel.app";
    writeFileSync(credentialedPath, `${JSON.stringify(credentialedArtifact, null, 2)}\n`, "utf8");
    const credentialedInspect = runInspect(credentialedPath);
    expect(credentialedInspect.status).not.toBe(0);
    expect(`${credentialedInspect.stderr}${credentialedInspect.stdout}`).toContain("must not include credentials");

    const loopbackPath = artifactPath("tampered-loopback.json");
    const loopbackExported = runExport(loopbackPath);
    expect(loopbackExported.status, loopbackExported.stderr).toBe(0);
    const loopbackArtifact = JSON.parse(readFileSync(loopbackPath, "utf8"));
    loopbackArtifact.preview_url = "https://[::1]/";
    writeFileSync(loopbackPath, `${JSON.stringify(loopbackArtifact, null, 2)}\n`, "utf8");
    const loopbackInspect = runInspect(loopbackPath);
    expect(loopbackInspect.status).not.toBe(0);
    expect(`${loopbackInspect.stderr}${loopbackInspect.stdout}`).toContain("must not be local");
  });

  it("refuses inconsistent freshness state and counts at export time", () => {
    const result = runExport(artifactPath("inconsistent.json"), {
      OUTPOST_ADMIN_PROOF_FRESHNESS_OVERALL: "fresh",
      OUTPOST_ADMIN_PROOF_FRESHNESS_STALE_COUNT: "1"
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("Fresh proof state requires only fresh counts");
  });

  it("fails closed for stale, missing, local, production, and blocked command inputs", () => {
    let path = artifactPath("stale.json");
    let result = runExport(path, {
      OUTPOST_ADMIN_PROOF_FRESHNESS_FRESH_COUNT: "6",
      OUTPOST_ADMIN_PROOF_FRESHNESS_OVERALL: "stale",
      OUTPOST_ADMIN_PROOF_FRESHNESS_STALE_COUNT: "1"
    });
    expect(result.status).toBe(0);
    expect(runInspect(path).status).not.toBe(0);

    path = artifactPath("missing.json");
    result = runExport(path, {
      OUTPOST_ADMIN_PROOF_FRESHNESS_FRESH_COUNT: "6",
      OUTPOST_ADMIN_PROOF_FRESHNESS_MISSING_COUNT: "1",
      OUTPOST_ADMIN_PROOF_FRESHNESS_OVERALL: "missing"
    });
    expect(result.status).toBe(0);
    expect(runInspect(path).status).not.toBe(0);

    result = runExport(artifactPath("local.json"), {
      OUTPOST_ADMIN_PROOF_FRESHNESS_PREVIEW_URL: "http://localhost:3000"
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("must use https");

    result = runExport(artifactPath("production.json"), {
      OUTPOST_NEON_BRANCH_NAME: "production"
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("production branch");

    result = runExport(artifactPath("blocked-command.json"), {
      OUTPOST_ADMIN_PROOF_FRESHNESS_NEXT_COMMAND: "sendInvite"
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("blocked browser/live-provider affordance");
  });
});
