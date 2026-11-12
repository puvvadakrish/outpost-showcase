import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const bundleScript = readFileSync("scripts/prepare-beta-owner-handoff-bundle.mjs", "utf8");
const messageScript = readFileSync("scripts/prepare-beta-owner-handoff-message.mjs", "utf8");
const operatorRunbook = readFileSync("docs/setup/hosted-beta-operator-access.md", "utf8");

function artifactPaths() {
  const dir = mkdtempSync(join(tmpdir(), "outpost-beta-handoff-bundle-test-"));
  return {
    bundle: join(dir, "bundle.json"),
    checklist: join(dir, "checklist.md"),
    completion: join(dir, "completion.json"),
    gate: join(dir, "gate.json"),
    message: join(dir, "message.md"),
    packet: join(dir, "packet.md")
  };
}

function baseEnv(paths, extraEnv = {}) {
  return {
    ...process.env,
    OUTPOST_BETA_HANDOFF_BUNDLE_PATH: paths.bundle,
    OUTPOST_BETA_HANDOFF_CHECKLIST_PATH: paths.checklist,
    OUTPOST_BETA_HANDOFF_COMPLETION_PATH: paths.completion,
    OUTPOST_BETA_HANDOFF_GATE_PATH: paths.gate,
    OUTPOST_BETA_HANDOFF_GYM_NAME: "Summit Strength",
    OUTPOST_BETA_HANDOFF_OPERATOR_NAME: "Outpost operator",
    OUTPOST_BETA_HANDOFF_OWNER_EMAIL: "owner@summitstrength.example",
    OUTPOST_BETA_HANDOFF_OWNER_NAME: "Jordan Owner",
    OUTPOST_BETA_HANDOFF_PACKET_PATH: paths.packet,
    OUTPOST_BETA_HANDOFF_PREVIEW_URL: "https://outpost-preview-20260610-example.vercel.app",
    OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW: "June beta proof window",
    OUTPOST_NEON_BRANCH_NAME: "outpost-beta-access-scoped-20260622120000",
    ...extraEnv
  };
}

function runBundle(paths, extraEnv = {}) {
  return spawnSync("node", ["scripts/prepare-beta-owner-handoff-bundle.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: baseEnv(paths, extraEnv)
  });
}

function runMessage(paths, extraEnv = {}) {
  return spawnSync("node", ["scripts/prepare-beta-owner-handoff-message.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_BETA_HANDOFF_BUNDLE_PATH: paths.bundle,
      OUTPOST_BETA_HANDOFF_MESSAGE_PATH: paths.message,
      ...extraEnv
    }
  });
}

describe("beta owner handoff artifact bundle", () => {
  it("registers a generic handoff bundle command", () => {
    expect(packageJson).toContain('"beta:owner-handoff:bundle"');
    expect(packageJson).toContain("prepare-beta-owner-handoff-bundle.mjs");
    expect(packageJson).toContain('"beta:owner-handoff:message"');
    expect(packageJson).toContain("prepare-beta-owner-handoff-message.mjs");
  });

  it("writes checklist, packet, and preparation manifest without recording customer completion", () => {
    const paths = artifactPaths();
    const result = runBundle(paths);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Beta owner handoff checklist wrote");
    expect(result.stdout).toContain("Beta owner handoff packet wrote");
    expect(result.stdout).toContain("Beta owner handoff bundle wrote");

    const checklist = readFileSync(paths.checklist, "utf8");
    const packet = readFileSync(paths.packet, "utf8");
    const manifest = JSON.parse(readFileSync(paths.bundle, "utf8"));

    expect(checklist).toContain("Summit Strength Beta Handoff Execution Checklist");
    expect(packet).toContain("Summit Strength Beta Owner Handoff Packet");
    expect(manifest).toMatchObject({
      status: "beta_owner_handoff_prepared",
      customer_observed: false,
      evidence_basis: "operator_generated_checklist_and_packet",
      live_provider_gate: "blocked",
      next_command: "npm run beta:owner-handoff:complete"
    });
    expect(manifest.artifacts).toMatchObject({
      checklist_path: paths.checklist,
      packet_path: paths.packet,
      completion_path: paths.completion,
      gate_path: paths.gate,
      manifest_path: paths.bundle
    });
    expect(manifest.prepared_steps).toEqual(["checklist", "packet"]);
    expect(manifest.pending_steps).toEqual([
      "customer_observed_completion",
      "final_gate_validation",
      "hosted_record_import"
    ]);
    expect(JSON.stringify(manifest)).not.toContain("napi_");
    expect(JSON.stringify(manifest)).not.toContain("Bearer ");
    expect(JSON.stringify(manifest)).not.toMatch(/password\s*[:=]/iu);
  });

  it("defaults related artifact paths from the gym slug", () => {
    const paths = artifactPaths();
    const result = runBundle(paths, {
      OUTPOST_BETA_HANDOFF_CHECKLIST_PATH: "",
      OUTPOST_BETA_HANDOFF_COMPLETION_PATH: "",
      OUTPOST_BETA_HANDOFF_GATE_PATH: "",
      OUTPOST_BETA_HANDOFF_PACKET_PATH: ""
    });

    expect(result.status, result.stderr).toBe(0);
    const manifest = JSON.parse(readFileSync(paths.bundle, "utf8"));
    expect(manifest.artifacts.checklist_path).toBe("artifacts/beta-owner-handoff/summit-strength-checklist.md");
    expect(manifest.artifacts.packet_path).toBe("artifacts/beta-owner-handoff/summit-strength-packet.md");
    expect(manifest.artifacts.completion_path).toBe("artifacts/beta-owner-handoff/summit-strength-completion.json");
    expect(manifest.artifacts.gate_path).toBe(
      "artifacts/beta-owner-handoff/summit-strength-customer-observed-gate.json"
    );
  });

  it("fails closed for non-HTTPS Preview URLs, unsafe paths, and secret-shaped values", () => {
    let paths = artifactPaths();
    let result = runBundle(paths, { OUTPOST_BETA_HANDOFF_PREVIEW_URL: "http://preview.example.test" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must use https");

    paths = artifactPaths();
    result = runBundle(paths, { OUTPOST_BETA_HANDOFF_BUNDLE_PATH: "docs/handoff-bundle.json" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gitignored artifacts");

    paths = artifactPaths();
    result = runBundle(paths, { OUTPOST_BETA_HANDOFF_OPERATOR_NAME: "token: nope" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");
  });

  it("pins preparation-only boundaries in code and docs", () => {
    expect(bundleScript).toContain("prepare-beta-owner-handoff-checklist.mjs");
    expect(bundleScript).toContain("prepare-beta-owner-handoff-packet.mjs");
    expect(bundleScript).toContain("customer_observed: false");
    expect(bundleScript).toContain("This manifest records artifact preparation only");
    expect(bundleScript).not.toMatch(
      /record-beta-owner-handoff-completion|verify-beta-owner-handoff-gate|record-customer-handoff-gate-proof|sign-in\/email|bootstrap_owner_tenant/iu
    );
    expect(messageScript).toContain("handoff message cannot start from customer-observed completion");
    expect(messageScript).toContain("It does not send an invite or notification");
    expect(messageScript).not.toMatch(
      /record-beta-owner-handoff-completion|verify-beta-owner-handoff-gate|record-customer-handoff-gate-proof|sign-in\/email|bootstrap_owner_tenant/iu
    );
    expect(operatorRunbook).toContain("npm run beta:owner-handoff:bundle");
    expect(operatorRunbook).toContain("The bundle command prepares artifacts only.");
  });

  it("writes a customer-safe handoff message from a prepared bundle without sending invites", () => {
    const paths = artifactPaths();
    const bundle = runBundle(paths);
    expect(bundle.status, bundle.stderr).toBe(0);

    const result = runMessage(paths);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Beta owner handoff message wrote");
    expect(result.stdout).toContain("Invite delivery: blocked");
    expect(result.stdout).toContain("Customer-observed completion: pending");

    const message = readFileSync(paths.message, "utf8");
    expect(message).toContain("Summit Strength Beta Owner Handoff Message");
    expect(message).toContain("Subject: Outpost beta walkthrough for Summit Strength");
    expect(message).toContain("It does not create an account.");
    expect(message).toContain("It does not send an invite or notification.");
    expect(message).toContain("It does not claim the customer-observed handoff is complete.");
    expect(message).toContain("owner@summitstrength.example");
    expect(message).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|Bearer |napi_|password\s*[:=]|cookie|jwt/iu
    );
  });

  it("fails handoff message generation for unsafe manifests and paths", () => {
    const paths = artifactPaths();
    const bundle = runBundle(paths);
    expect(bundle.status, bundle.stderr).toBe(0);

    let result = runMessage(paths, { OUTPOST_BETA_HANDOFF_MESSAGE_PATH: paths.bundle });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must be different");

    result = runMessage(paths, {
      OUTPOST_BETA_HANDOFF_BUNDLE_PATH: paths.bundle,
      OUTPOST_BETA_HANDOFF_MESSAGE_PATH: join(paths.bundle, "..", basename(paths.bundle))
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must be different");

    const manifest = JSON.parse(readFileSync(paths.bundle, "utf8"));
    manifest.customer_observed = true;
    writeFileSync(paths.bundle, `${JSON.stringify(manifest, null, 2)}\n`);
    result = runMessage(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("cannot start from customer-observed completion");

    manifest.customer_observed = false;
    delete manifest.support_window;
    writeFileSync(paths.bundle, `${JSON.stringify(manifest, null, 2)}\n`);
    result = runMessage(paths);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("requires a support window");
  });
});
