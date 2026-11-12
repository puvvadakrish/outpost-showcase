import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const exportScript = readFileSync("scripts/prepare-admin-launch-readiness-export.mjs", "utf8");
const inspectScript = readFileSync("scripts/inspect-admin-launch-readiness-export.mjs", "utf8");
const promoteScript = readFileSync("scripts/verify-admin-launch-readiness-promotion.mjs", "utf8");
const releaseNoteScript = readFileSync("scripts/prepare-admin-launch-promotion-release-note.mjs", "utf8");
const bundleScript = readFileSync("scripts/prepare-admin-launch-readiness-bundle.mjs", "utf8");
const bundleInspectScript = readFileSync("scripts/inspect-admin-launch-readiness-bundle.mjs", "utf8");

function artifactPath() {
  return join(mkdtempSync(join(tmpdir(), "outpost-admin-launch-readiness-test-")), "launch-readiness.json");
}

function baseEnv(path, extraEnv = {}) {
  return {
    ...process.env,
    OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF: "blocked",
    OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH: path,
    OUTPOST_ADMIN_LAUNCH_READINESS_FULFILLMENT: "ready",
    OUTPOST_ADMIN_LAUNCH_READINESS_GYM_NAME: "Summit Strength",
    OUTPOST_ADMIN_LAUNCH_READINESS_OPERATOR: "Outpost operator",
    OUTPOST_ADMIN_LAUNCH_READINESS_OWNER_EMAIL: "owner@summitstrength.example",
    OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_PROOF: "ready",
    OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL: "https://outpost-preview-20260610-example.vercel.app",
    OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK: "pending",
    OUTPOST_NEON_BRANCH_NAME: "outpost-proof-records-202606220520",
    ...extraEnv
  };
}

function runExport(path, extraEnv = {}) {
  return spawnSync("node", ["scripts/prepare-admin-launch-readiness-export.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: baseEnv(path, extraEnv)
  });
}

function runInspect(path, extraEnv = {}) {
  return spawnSync("node", ["scripts/inspect-admin-launch-readiness-export.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH: path,
      ...extraEnv
    }
  });
}

function runPromote(exportPath, promotionPath, extraEnv = {}) {
  return spawnSync("node", ["scripts/verify-admin-launch-readiness-promotion.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH: exportPath,
      OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH: promotionPath,
      ...extraEnv
    }
  });
}

function runReleaseNote(promotionPath, releaseNotePath, extraEnv = {}) {
  return spawnSync("node", ["scripts/prepare-admin-launch-promotion-release-note.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH: promotionPath,
      OUTPOST_ADMIN_LAUNCH_READINESS_RELEASE_NOTE_PATH: releaseNotePath,
      ...extraEnv
    }
  });
}

function runBundle(bundlePath, extraEnv = {}) {
  return spawnSync("node", ["scripts/prepare-admin-launch-readiness-bundle.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: baseEnv(bundlePath.replace("launch-bundle.json", "launch-readiness.json"), {
      OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH: bundlePath,
      OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF: "ready",
      OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK: "ready",
      ...extraEnv
    })
  });
}

function runBundleInspect(bundlePath, extraEnv = {}) {
  return spawnSync("node", ["scripts/inspect-admin-launch-readiness-bundle.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH: bundlePath,
      ...extraEnv
    }
  });
}

describe("admin launch readiness export", () => {
  it("registers export and inspect commands", () => {
    expect(packageJson).toContain('"admin:launch-readiness:export"');
    expect(packageJson).toContain("prepare-admin-launch-readiness-export.mjs");
    expect(packageJson).toContain('"admin:launch-readiness:inspect"');
    expect(packageJson).toContain("inspect-admin-launch-readiness-export.mjs");
    expect(packageJson).toContain('"admin:launch-readiness:promote"');
    expect(packageJson).toContain("verify-admin-launch-readiness-promotion.mjs");
    expect(packageJson).toContain('"admin:launch-readiness:release-note"');
    expect(packageJson).toContain("prepare-admin-launch-promotion-release-note.mjs");
    expect(packageJson).toContain('"admin:launch-readiness:bundle"');
    expect(packageJson).toContain("prepare-admin-launch-readiness-bundle.mjs");
    expect(packageJson).toContain('"admin:launch-readiness:bundle:inspect"');
    expect(packageJson).toContain("inspect-admin-launch-readiness-bundle.mjs");
  });

  it("writes and inspects a sanitized launch-readiness artifact", () => {
    const path = artifactPath();
    const result = runExport(path);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Admin launch readiness export wrote");
    expect(result.stdout).toContain("Public self-serve launch: blocked");

    const artifact = JSON.parse(readFileSync(path, "utf8"));
    expect(artifact).toMatchObject({
      status: "admin_launch_readiness_exported",
      customer_observed_completion_claimed: false,
      public_self_serve_launch_allowed: false,
      preview_url: "https://outpost-preview-20260610-example.vercel.app",
      neon_proof_branch: "outpost-proof-records-202606220520"
    });
    expect(artifact.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Protected Preview proof", state: "ready" }),
        expect.objectContaining({ label: "Operator fulfillment path", state: "ready" }),
        expect.objectContaining({ label: "Reset and rollback readiness", state: "pending" }),
        expect.objectContaining({ label: "Customer-observed handoff", state: "blocked" }),
        expect.objectContaining({ label: "Live-provider and billing gates", state: "blocked" }),
        expect.objectContaining({ label: "Public self-serve launch", state: "blocked" })
      ])
    );
    expect(artifact.command_sequence).toEqual(
      expect.arrayContaining([
        "npm run vercel:preview:verify",
        "npm run beta:operator:request-preflight",
        "npm run beta:operator:request-fulfillment",
        "npm run hosted:owner-handoff:prepare",
        "npm run beta:owner-handoff:gate",
        "npm run beta:owner-handoff:record",
        "npm run admin:launch-readiness:inspect"
      ])
    );
    expect(JSON.stringify(artifact)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|Bearer |napi_|password\s*[:=]|cookie|jwt/iu
    );

    const inspect = runInspect(path);
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain("Admin launch readiness export inspection");
    expect(inspect.stdout).toContain("Live-provider and billing gates: blocked");
  });

  it("fails closed for local Preview URLs, unsafe paths, invalid states, and secret-shaped values", () => {
    let path = artifactPath();
    let result = runExport(path, { OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL: "http://localhost:3000" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must use https");

    path = artifactPath();
    result = runExport(path, { OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL: "https://127.0.0.1:3000" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must not be local");

    result = runExport("docs/admin-launch-readiness.json");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gitignored artifacts");

    path = artifactPath();
    result = runExport(path, { OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_PROOF: "done" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must be one of blocked, pending, or ready");

    path = artifactPath();
    result = runExport(path, { OUTPOST_ADMIN_LAUNCH_READINESS_OPERATOR: "token: nope" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");
  });

  it("pins review-only boundaries in code", () => {
    expect(exportScript).toContain("public_self_serve_launch_allowed: false");
    expect(exportScript).toContain("This export is a review artifact only");
    expect(exportScript).not.toMatch(/submit_owner_beta_access_request|bootstrap_owner_tenant|sendInvite|sendEmail/iu);
    expect(inspectScript).toContain("public self-serve must not be launch-allowed");
    expect(inspectScript).toContain("live-provider and billing gates must be blocked");
    expect(promoteScript).toContain("public_self_serve_launch_allowed: false");
    expect(promoteScript).toContain("Do not enable public self-serve or live providers");
    expect(promoteScript).not.toMatch(/submit_owner_beta_access_request|bootstrap_owner_tenant|sendInvite|sendEmail/iu);
    expect(releaseNoteScript).toContain("public_self_serve_launch_allowed === false");
    expect(releaseNoteScript).toContain("It does not");
    expect(releaseNoteScript).not.toMatch(/submit_owner_beta_access_request|bootstrap_owner_tenant|sendInvite|sendEmail/iu);
    expect(bundleScript).toContain("public_self_serve_launch_allowed: false");
    expect(bundleScript).toContain("This bundle is an operator review artifact only");
    expect(bundleScript).toContain("prepare-admin-launch-readiness-export.mjs");
    expect(bundleScript).toContain("prepare-admin-launch-promotion-release-note.mjs");
    expect(bundleScript).not.toMatch(/submit_owner_beta_access_request|bootstrap_owner_tenant|sendInvite|sendEmail/iu);
    expect(bundleInspectScript).toContain("public self-serve must not be launch-allowed");
    expect(bundleInspectScript).toContain("Live-provider and billing gates");
    expect(bundleInspectScript).not.toMatch(/submit_owner_beta_access_request|bootstrap_owner_tenant|sendInvite|sendEmail/iu);
  });

  it("promotes a ready launch-readiness artifact into a checked candidate summary", () => {
    const path = artifactPath();
    const promotionPath = artifactPath();
    const result = runExport(path, {
      OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF: "ready",
      OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK: "ready"
    });

    expect(result.status, result.stderr).toBe(0);

    const promotion = runPromote(path, promotionPath);
    expect(promotion.status, promotion.stderr).toBe(0);
    expect(promotion.stdout).toContain("Admin launch promotion gate wrote");
    expect(promotion.stdout).toContain("Public self-serve launch: blocked");

    const summary = JSON.parse(readFileSync(promotionPath, "utf8"));
    expect(summary).toMatchObject({
      status: "admin_launch_promotion_candidate_checked",
      promotion_candidate_ready: true,
      public_self_serve_launch_allowed: false,
      preview_url: "https://outpost-preview-20260610-example.vercel.app",
      neon_proof_branch: "outpost-proof-records-202606220520"
    });
    expect(summary.ready_gates).toEqual(
      expect.arrayContaining([
        "Protected Preview proof",
        "Operator fulfillment path",
        "Reset and rollback readiness",
        "Customer-observed handoff"
      ])
    );
    expect(summary.blocked_gates).toEqual(
      expect.arrayContaining([
        "Live-provider and billing gates",
        "Public self-serve launch",
        "Invite delivery",
        "Member-ledger writes"
      ])
    );
    expect(JSON.stringify(summary)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|Bearer |napi_|password\s*[:=]|cookie|jwt/iu
    );
  });

  it("fails promotion for incomplete handoff, unsafe preview, unblocked gates, and secrets", () => {
    let path = artifactPath();
    let promotionPath = artifactPath();
    let result = runExport(path, { OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK: "ready" });
    expect(result.status, result.stderr).toBe(0);
    let promotion = runPromote(path, promotionPath);
    expect(promotion.status).not.toBe(0);
    expect(promotion.stderr).toContain("customer-observed completion must be claimed");

    path = artifactPath();
    promotionPath = artifactPath();
    result = runExport(path, {
      OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF: "ready",
      OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK: "ready"
    });
    expect(result.status, result.stderr).toBe(0);
    const unsafeArtifact = JSON.parse(readFileSync(path, "utf8"));
    unsafeArtifact.preview_url = "https://localhost:3000";
    writeFileSync(path, `${JSON.stringify(unsafeArtifact, null, 2)}\n`);
    promotion = runPromote(path, promotionPath);
    expect(promotion.status).not.toBe(0);
    expect(promotion.stderr).toContain("must not be local");

    path = artifactPath();
    promotionPath = artifactPath();
    result = runExport(path, {
      OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF: "ready",
      OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK: "ready"
    });
    expect(result.status, result.stderr).toBe(0);
    const unblockedArtifact = JSON.parse(readFileSync(path, "utf8"));
    unblockedArtifact.gates = unblockedArtifact.gates.map((gate) =>
      gate.label === "Public self-serve launch" ? { ...gate, state: "ready" } : gate
    );
    writeFileSync(path, `${JSON.stringify(unblockedArtifact, null, 2)}\n`);
    promotion = runPromote(path, promotionPath);
    expect(promotion.status).not.toBe(0);
    expect(promotion.stderr).toContain("public self-serve launch must stay blocked");

    promotion = runPromote(path, path);
    expect(promotion.status).not.toBe(0);
    expect(promotion.stderr).toContain("promotion output path must be different");

    path = artifactPath();
    promotionPath = artifactPath();
    result = runExport(path, {
      OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF: "ready",
      OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK: "ready"
    });
    expect(result.status, result.stderr).toBe(0);
    const secretArtifact = JSON.parse(readFileSync(path, "utf8"));
    secretArtifact.operator = "api_key: nope";
    writeFileSync(path, `${JSON.stringify(secretArtifact, null, 2)}\n`);
    promotion = runPromote(path, promotionPath);
    expect(promotion.status).not.toBe(0);
    expect(promotion.stderr).toContain("secret-shaped value");
  });

  it("writes a sanitized launch promotion release note from a checked promotion candidate", () => {
    const path = artifactPath();
    const promotionPath = artifactPath();
    const releaseNotePath = promotionPath.replace("launch-readiness.json", "promotion-release-note.md");
    const result = runExport(path, {
      OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF: "ready",
      OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK: "ready"
    });
    expect(result.status, result.stderr).toBe(0);

    const promotion = runPromote(path, promotionPath);
    expect(promotion.status, promotion.stderr).toBe(0);

    const releaseNote = runReleaseNote(promotionPath, releaseNotePath);
    expect(releaseNote.status, releaseNote.stderr).toBe(0);
    expect(releaseNote.stdout).toContain("Admin launch promotion release note wrote");
    expect(releaseNote.stdout).toContain("Public self-serve launch: blocked");

    const markdown = readFileSync(releaseNotePath, "utf8");
    expect(markdown).toContain("# Outpost Admin Launch Promotion Candidate");
    expect(markdown).toContain("Promotion candidate ready: yes");
    expect(markdown).toContain("Public self-serve launch allowed: no");
    expect(markdown).toContain("Protected Preview: https://outpost-preview-20260610-example.vercel.app");
    expect(markdown).toContain("Hosted Neon proof branch: outpost-proof-records-202606220520");
    expect(markdown).toContain("Public self-serve launch");
    expect(markdown).toContain("Member-ledger writes");
    expect(markdown).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|Bearer |napi_|password\s*[:=]|cookie|jwt/iu
    );
  });

  it("fails release note generation for unsafe promotion artifacts", () => {
    const path = artifactPath();
    const promotionPath = artifactPath();
    const releaseNotePath = promotionPath.replace("launch-readiness.json", "promotion-release-note.md");
    const result = runExport(path, {
      OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF: "ready",
      OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK: "ready"
    });
    expect(result.status, result.stderr).toBe(0);

    const promotion = runPromote(path, promotionPath);
    expect(promotion.status, promotion.stderr).toBe(0);

    const samePath = runReleaseNote(promotionPath, promotionPath);
    expect(samePath.status).not.toBe(0);
    expect(samePath.stderr).toContain("release note output path must be different");

    const unsafeSummary = JSON.parse(readFileSync(promotionPath, "utf8"));
    unsafeSummary.preview_url = "https://localhost:3000";
    writeFileSync(promotionPath, `${JSON.stringify(unsafeSummary, null, 2)}\n`);
    const unsafe = runReleaseNote(promotionPath, releaseNotePath);
    expect(unsafe.status).not.toBe(0);
    expect(unsafe.stderr).toContain("must not be local");

    unsafeSummary.preview_url = "https://outpost-preview-20260610-example.vercel.app";
    unsafeSummary.public_self_serve_launch_allowed = true;
    writeFileSync(promotionPath, `${JSON.stringify(unsafeSummary, null, 2)}\n`);
    const publicLaunch = runReleaseNote(promotionPath, releaseNotePath);
    expect(publicLaunch.status).not.toBe(0);
    expect(publicLaunch.stderr).toContain("public-launch-allowed");

    unsafeSummary.public_self_serve_launch_allowed = false;
    unsafeSummary.ready_gates = [...unsafeSummary.ready_gates, "Public self-serve launch"];
    writeFileSync(promotionPath, `${JSON.stringify(unsafeSummary, null, 2)}\n`);
    const contradictory = runReleaseNote(promotionPath, releaseNotePath);
    expect(contradictory.status).not.toBe(0);
    expect(contradictory.stderr).toContain("contradictory ready and blocked gates");
  });

  it("writes a launch-readiness bundle manifest from the full checked artifact chain", () => {
    const bundlePath = artifactPath().replace("launch-readiness.json", "launch-bundle.json");
    const result = runBundle(bundlePath);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Admin launch readiness bundle wrote");
    expect(result.stdout).toContain("Public self-serve launch: blocked");

    const manifest = JSON.parse(readFileSync(bundlePath, "utf8"));
    expect(manifest).toMatchObject({
      status: "admin_launch_readiness_bundle_prepared",
      customer_observed_completion_claimed: true,
      public_self_serve_launch_allowed: false,
      preview_url: "https://outpost-preview-20260610-example.vercel.app",
      neon_proof_branch: "outpost-proof-records-202606220520",
      evidence_basis: "admin_launch_readiness_export_promotion_and_release_note"
    });
    expect(manifest.artifacts).toMatchObject({
      bundle_path: bundlePath,
      export_path: bundlePath.replace("launch-bundle.json", "launch-readiness.json"),
      promotion_path: bundlePath.replace("launch-bundle.json", "launch-promotion-candidate.json"),
      release_note_path: bundlePath.replace("launch-bundle.json", "launch-promotion-release-note.md")
    });
    expect(manifest.command_sequence).toEqual([
      "npm run admin:launch-readiness:export",
      "npm run admin:launch-readiness:inspect",
      "npm run admin:launch-readiness:promote",
      "npm run admin:launch-readiness:release-note"
    ]);
    expect(manifest.blocked_gates).toEqual(
      expect.arrayContaining(["Public self-serve launch", "Invite delivery", "Member-ledger writes"])
    );
    expect(JSON.stringify(manifest)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|Bearer |napi_|password\s*[:=]|cookie|jwt/iu
    );

    const inspect = runBundleInspect(bundlePath);
    expect(inspect.status, inspect.stderr).toBe(0);
    expect(inspect.stdout).toContain("Admin launch readiness bundle inspection");
    expect(inspect.stdout).toContain("Public self-serve launch: blocked");
  });

  it("fails launch bundle generation and inspection for incomplete gates, unsafe paths, and secret-shaped values", () => {
    let bundlePath = artifactPath().replace("launch-readiness.json", "launch-bundle.json");
    let result = runBundle(bundlePath, { OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF: "pending" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("customer-observed completion must be claimed");

    result = runBundle("docs/admin-launch-bundle.json");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gitignored artifacts");

    bundlePath = artifactPath().replace("launch-readiness.json", "launch-bundle.json");
    result = runBundle(bundlePath, { OUTPOST_ADMIN_LAUNCH_READINESS_OPERATOR: "api_key: nope" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");

    bundlePath = artifactPath().replace("launch-readiness.json", "launch-bundle.json");
    result = runBundle(bundlePath);
    expect(result.status, result.stderr).toBe(0);
    const publicLaunchManifest = JSON.parse(readFileSync(bundlePath, "utf8"));
    publicLaunchManifest.public_self_serve_launch_allowed = true;
    writeFileSync(bundlePath, `${JSON.stringify(publicLaunchManifest, null, 2)}\n`);
    let inspect = runBundleInspect(bundlePath);
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("public self-serve must not be launch-allowed");

    publicLaunchManifest.public_self_serve_launch_allowed = false;
    publicLaunchManifest.customer_observed_completion_claimed = false;
    writeFileSync(bundlePath, `${JSON.stringify(publicLaunchManifest, null, 2)}\n`);
    inspect = runBundleInspect(bundlePath);
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("customer-observed completion must be claimed");

    publicLaunchManifest.customer_observed_completion_claimed = true;
    publicLaunchManifest.artifacts.bundle_path = "artifacts/admin-launch-readiness/different-launch-bundle.json";
    writeFileSync(bundlePath, `${JSON.stringify(publicLaunchManifest, null, 2)}\n`);
    inspect = runBundleInspect(bundlePath);
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("bundle artifact path must match the inspected path");

    publicLaunchManifest.artifacts.bundle_path = bundlePath;
    publicLaunchManifest.blocked_gates = publicLaunchManifest.blocked_gates.filter((gate) => gate !== "Live-provider and billing gates");
    writeFileSync(bundlePath, `${JSON.stringify(publicLaunchManifest, null, 2)}\n`);
    inspect = runBundleInspect(bundlePath);
    expect(inspect.status).not.toBe(0);
    expect(inspect.stderr).toContain("bundle blocked gates must include Live-provider and billing gates");
  }, 15000);
});
