import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const exportScript = readFileSync("scripts/export-admin-operator-next-actions.mjs", "utf8");
const inspectScript = readFileSync("scripts/inspect-admin-operator-next-actions.mjs", "utf8");

function artifactPath(filename) {
  return join(mkdtempSync(join(tmpdir(), "outpost-admin-next-actions-test-")), filename);
}

function runExport(path, overrides = {}) {
  return spawnSync("node", ["scripts/export-admin-operator-next-actions.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_NEXT_ACTIONS_COMMAND: "npm run admin:launch-readiness:export",
      OUTPOST_ADMIN_NEXT_ACTIONS_DETAIL: "Write sanitized launch-readiness artifact.",
      OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH: path,
      OUTPOST_ADMIN_NEXT_ACTIONS_LABEL: "Write launch-readiness export",
      OUTPOST_ADMIN_NEXT_ACTIONS_PREVIEW_URL: "https://outpost-preview-20260610-example.vercel.app",
      OUTPOST_ADMIN_NEXT_ACTIONS_STATE: "next",
      OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STATE: "fresh",
      OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_FRESH_COUNT: "7",
      OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STALE_COUNT: "0",
      OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_MISSING_COUNT: "0",
      OUTPOST_NEON_BRANCH_NAME: "outpost-beta-access-scoped-proof",
      ...overrides
    }
  });
}

function runInspect(path) {
  return spawnSync("node", ["scripts/inspect-admin-operator-next-actions.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH: path
    }
  });
}

describe("Admin operator next-action export", () => {
  it("wires package scripts to the export and inspect commands", () => {
    expect(packageJson).toContain('"admin:next-actions:export"');
    expect(packageJson).toContain('"admin:next-actions:inspect"');
    expect(exportScript).toContain("admin_operator_next_action_queue_exported");
    expect(inspectScript).toContain("Admin operator next actions export is actionable");
  });

  it("exports and inspects a sanitized next-action artifact", () => {
    const path = artifactPath("admin-next-actions.json");
    const exported = runExport(path, {
      OUTPOST_ADMIN_NEXT_ACTIONS_PREVIEW_URL: "https://outpost-preview-20260610-example.vercel.app/admin?ignored=true"
    });
    expect(exported.status, exported.stderr).toBe(0);

    const artifact = JSON.parse(readFileSync(path, "utf8"));
    expect(artifact.preview_url).toBe("https://outpost-preview-20260610-example.vercel.app");
    expect(artifact.proof_freshness).toEqual({
      fresh: 7,
      missing: 0,
      stale: 0,
      state: "fresh"
    });
    expect(JSON.stringify(artifact)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|cookie|token/iu
    );

    const inspected = runInspect(path);
    expect(inspected.status, inspected.stderr).toBe(0);
    expect(inspected.stdout).toContain("Admin operator next actions export is actionable");
    expect(inspected.stdout).toContain("Next action: Write launch-readiness export");
  });

  it("allows a complete queue artifact with no runnable action", () => {
    const path = artifactPath("admin-next-actions-done.json");
    const exported = runExport(path, {
      OUTPOST_ADMIN_NEXT_ACTIONS_COMMAND: "No runnable action remains.",
      OUTPOST_ADMIN_NEXT_ACTIONS_DETAIL: "No runnable action remains.",
      OUTPOST_ADMIN_NEXT_ACTIONS_LABEL: "Queue complete",
      OUTPOST_ADMIN_NEXT_ACTIONS_STATE: "done"
    });
    expect(exported.status).toBe(0);

    const inspected = runInspect(path);
    expect(inspected.status).toBe(0);
    expect(inspected.stdout).toContain("Next action: Queue complete");
  });

  it("refuses stale proof freshness in exported queue snapshots", () => {
    const path = artifactPath("admin-next-actions-stale.json");
    const exported = runExport(path, {
      OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STATE: "stale",
      OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STALE_COUNT: "1"
    });
    expect(exported.status).toBe(0);

    const inspected = runInspect(path);
    expect(inspected.status).not.toBe(0);
    expect(`${inspected.stderr}${inspected.stdout}`).toContain("Proof freshness must be fresh");
  });

  it("refuses credentialed or local Preview URLs", () => {
    let result = runExport(artifactPath("credentialed.json"), {
      OUTPOST_ADMIN_NEXT_ACTIONS_PREVIEW_URL: "https://user:pass@outpost-preview.example.vercel.app"
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("must not include credentials");

    result = runExport(artifactPath("local.json"), {
      OUTPOST_ADMIN_NEXT_ACTIONS_PREVIEW_URL: "http://localhost:3000"
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("must use https");

    result = runExport(artifactPath("ipv6-loopback.json"), {
      OUTPOST_ADMIN_NEXT_ACTIONS_PREVIEW_URL: "https://[::1]/"
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("must not be local");
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

  it("refuses inconsistent freshness counts and browser approval affordance commands", () => {
    let result = runExport(artifactPath("inconsistent.json"), {
      OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STATE: "fresh",
      OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STALE_COUNT: "1"
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("Fresh proof state requires only fresh counts");

    result = runExport(artifactPath("approval.json"), {
      OUTPOST_ADMIN_NEXT_ACTIONS_COMMAND: "approve browser launch"
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("blocked browser/live-provider affordance");
  });
});
