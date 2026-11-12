import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const script = readFileSync("scripts/record-admin-launch-package.mjs", "utf8");

function artifactPath(filename) {
  return join(mkdtempSync(join(tmpdir(), "outpost-admin-launch-package-test-")), filename);
}

function writeLaunchBundle(path, overrides = {}) {
  const manifest = {
    status: "admin_launch_readiness_bundle_prepared",
    evidence_basis: "admin_launch_readiness_export_promotion_and_release_note",
    customer_observed_completion_claimed: true,
    public_self_serve_launch_allowed: false,
    preview_url: "https://outpost-preview-20260610-example.vercel.app",
    neon_proof_branch: "outpost-proof-records-202606220520",
    gym: "Summit Strength",
    owner_email: "owner@summitstrength.example",
    artifacts: {
      bundle_path: path,
      export_path: path.replace("bundle.json", "export.json"),
      promotion_path: path.replace("bundle.json", "promotion.json"),
      release_note_path: path.replace("bundle.json", "release-note.md")
    },
    ready_gates: [
      "Protected Preview proof",
      "Operator fulfillment path",
      "Reset and rollback readiness",
      "Customer-observed handoff"
    ],
    blocked_gates: [
      "Live-provider and billing gates",
      "Public self-serve launch",
      "Invite delivery",
      "Member-ledger writes"
    ],
    command_sequence: [
      "npm run admin:launch-readiness:export",
      "npm run admin:launch-readiness:inspect",
      "npm run admin:launch-readiness:promote",
      "npm run admin:launch-readiness:release-note"
    ],
    non_goals: [
      "public_self_signup",
      "invite_delivery",
      "phone_provider_activation",
      "email_provider_activation",
      "billing",
      "pos",
      "access_control",
      "member_ledger_writes"
    ],
    ...overrides
  };

  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

function writeOwnerMessage(path, content = null) {
  writeFileSync(
    path,
    content ??
      [
        "# Beta owner handoff message",
        "",
        "Invite delivery: blocked",
        "Customer-observed completion: pending",
        "Next step: schedule the observed protected Preview session."
      ].join("\n")
  );
}

function runRecord(bundlePath, messagePath, extraEnv = {}) {
  return spawnSync("node", ["scripts/record-admin-launch-package.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-proof.neonauth.neon.tech/neondb/auth",
      NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-proof.apirest.neon.tech/neondb/rest/v1",
      NEXT_PUBLIC_OUTPOST_APP_URL: "https://outpost-preview-20260610-example.vercel.app",
      OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH: bundlePath,
      OUTPOST_BETA_HANDOFF_MESSAGE_PATH: messagePath,
      OUTPOST_NEON_BRANCH_NAME: "outpost-proof-records-202606220520",
      OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
      OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password",
      ...extraEnv
    }
  });
}

describe("admin launch package record import", () => {
  it("registers a terminal-only launch package import command", () => {
    expect(packageJson).toContain('"admin:launch-package:record"');
    expect(packageJson).toContain("record-admin-launch-package.mjs");
    expect(script).toContain("admin_launch_package_records");
    expect(script).toContain("public_self_serve_launch_allowed");
    expect(script).toContain("Live-provider and billing gates");
    expect(script).toContain("launchBundleSha256.slice(0, 16)");
    expect(script).toContain("ownerMessageSha256.slice(0, 16)");
    expect(script).not.toMatch(/submit_owner_beta_access_request|bootstrap_owner_tenant|sendInvite|sendEmail/iu);
  });

  it("fails closed before Neon writes when reviewed artifacts do not keep gates blocked", () => {
    const bundlePath = artifactPath("bundle.json");
    const messagePath = artifactPath("owner-message.md");
    writeLaunchBundle(bundlePath, { customer_observed_completion_claimed: false });
    writeOwnerMessage(messagePath);

    let result = runRecord(bundlePath, messagePath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("launch bundle must claim customer-observed completion");

    writeLaunchBundle(bundlePath);
    writeOwnerMessage(messagePath, "Invite delivery: blocked\nNext step: schedule the observed protected Preview session.");
    result = runRecord(bundlePath, messagePath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("owner handoff message must not claim completion");

    writeLaunchBundle(bundlePath, { public_self_serve_launch_allowed: true });
    writeOwnerMessage(messagePath);
    result = runRecord(bundlePath, messagePath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("launch bundle must keep public self-serve blocked");
  });
});
