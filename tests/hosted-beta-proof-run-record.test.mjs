import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const migration = readFileSync(
  "neon/migrations/20260624080000_hosted_beta_proof_run_summary_records.sql",
  "utf8"
);
const repairMigration = readFileSync(
  "neon/migrations/20260624083000_repair_hosted_beta_proof_run_summary_records_rpc.sql",
  "utf8"
);
const authorityRepairMigration = readFileSync(
  "neon/migrations/20260713050000_restore_founder_admin_beta_proof_summary_authority.sql",
  "utf8"
);
const script = readFileSync("scripts/record-hosted-beta-proof-run-summary.mjs", "utf8");
const proofScript = readFileSync("scripts/verify-hosted-beta-proof-run-record-proof.mjs", "utf8");

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function artifactPath(filename) {
  return join(mkdtempSync(join(tmpdir(), "outpost-beta-proof-record-test-")), filename);
}

function writeJson(path, value) {
  const raw = JSON.stringify(value, null, 2);
  writeFileSync(path, raw, "utf8");
  return sha256(raw);
}

function writeSummary(path, browserPath, browserHash, chainPath, chainHash, overrides = {}) {
  writeJson(path, {
    app_origin: "https://outpost-preview-20260610-example.vercel.app",
    blocked_gates: [
      "Public self-serve launch",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone/email providers",
      "Billing",
      "POS/access control/member-ledger writes"
    ],
    cleanup: {
      browser_request: "cleanup_requested",
      request_chain: "cleanup_requested"
    },
    neon_branch_name: "outpost-beta-proof-records-20260624",
    proofs: {
      browser_request: {
        artifact_path: browserPath,
        artifact_sha256: browserHash,
        status: "passed"
      },
      request_chain: {
        artifact_path: chainPath,
        artifact_sha256: chainHash,
        status: "passed"
      }
    },
    ready_for_next_slice: true,
    summary_kind: "hosted_beta_request_proof_run_summary",
    ...overrides
  });
}

function runRecord(summaryPath, extraEnv = {}) {
  return spawnSync("node", ["scripts/record-hosted-beta-proof-run-summary.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-proof.neonauth.neon.tech/neondb/auth",
      NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-proof.apirest.neon.tech/neondb/rest/v1",
      NEXT_PUBLIC_OUTPOST_APP_URL: "https://outpost-preview-20260610-example.vercel.app",
      OUTPOST_BETA_PROOF_RUN_SUMMARY_PATH: summaryPath,
      OUTPOST_NEON_BRANCH_NAME: "outpost-beta-proof-records-20260624",
      OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
      OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password",
      ...extraEnv
    }
  });
}

describe("hosted beta proof-run summary record import", () => {
  it("registers a terminal-only import command and founder-admin projection", () => {
    expect(packageJson).toContain('"hosted:beta-proof-run:record"');
    expect(packageJson).toContain('"hosted:beta-proof-run:record-proof"');
    expect(packageJson).toContain("record-hosted-beta-proof-run-summary.mjs");
    expect(packageJson).toContain("verify-hosted-beta-proof-run-record-proof.mjs");
    expect(migration).toContain("create table hosted_beta_proof_run_summary_records");
    expect(migration).toContain("alter table hosted_beta_proof_run_summary_records enable row level security");
    expect(migration).toContain("list_founder_admin_beta_proof_run_summary_records");
    expect(migration).toContain("from users");
    expect(migration).toContain("join tenant_memberships memberships");
    expect(migration).toContain("users.external_auth_id = auth.uid()");
    expect(migration).toContain("memberships.invite_status = 'active'");
    expect(migration).not.toContain("app_users");
    expect(migration).not.toContain("join memberships");
    expect(repairMigration).toContain("create or replace function list_founder_admin_beta_proof_run_summary_records()");
    expect(repairMigration).toContain("from users");
    expect(repairMigration).toContain("join tenant_memberships memberships");
    expect(repairMigration).toContain("users.external_auth_id = auth.uid()");
    expect(repairMigration).toContain("memberships.invite_status = 'active'");
    expect(repairMigration).not.toContain("app_users");
    expect(repairMigration).not.toContain("join memberships");
    expect(authorityRepairMigration).toContain(
      "create or replace function list_founder_admin_beta_proof_run_summary_records()"
    );
    expect(authorityRepairMigration).toContain("from app_admins");
    expect(authorityRepairMigration).toContain("app_admins.status = 'active'");
    expect(authorityRepairMigration).toContain(
      "memberships.user_id = users.id"
    );
    expect(authorityRepairMigration).toContain(
      "memberships.role = 'founder_admin'"
    );
    expect(authorityRepairMigration).toContain(
      "memberships.invite_status = 'active'"
    );
    expect(authorityRepairMigration).toContain(
      "order by recorded_at desc, id desc"
    );
    expect(migration).toContain("public_self_serve_launch_allowed = false");
    expect(migration).toContain("live_provider_enablement_allowed = false");
    expect(migration).not.toContain("summary jsonb");
    expect(migration).not.toContain("'summary', summary");
    expect(script).toContain("summary_kind === \"hosted_beta_request_proof_run_summary\"");
    expect(script).toContain("already recorded");
    expect(proofScript).toContain("hosted:beta-proof-run:summary:inspect");
    expect(proofScript).toContain("hosted:beta-proof-run:record");
    expect(proofScript).toContain("list_founder_admin_beta_proof_run_summary_records");
    expect(proofScript).toContain("Founder-admin RPC visibility: passed");
    expect(proofScript).toContain("safeJsonForError");
    expect(proofScript).toContain("lookupFounderAuthUserId");
    expect(proofScript).toContain("cleanupFounderAuthUser");
    expect(proofScript).toContain("cleanupFounderAuthUserByEmail");
    expect(proofScript).toContain("[\"']?\\s*[:=]");
    expect(proofScript).toContain("insert into app_admins");
    expect(proofScript).toContain("delete from app_admins");
    expect(proofScript).toContain("delete from tenant_memberships");
    expect(proofScript).toContain("delete from neon_auth");
    expect(script).toContain("Phone/email providers");
    expect(script).toContain("POS/access control/member-ledger writes");
    expect(script).not.toMatch(/submit_owner_beta_access_request|bootstrap_owner_tenant|sendInvite|sendEmail/iu);
  });

  it("fails closed before Neon writes when blocked gates are incomplete", () => {
    const browserPath = artifactPath("browser-proof.json");
    const chainPath = artifactPath("request-chain-proof.json");
    const summaryPath = artifactPath("summary.json");
    const browserHash = writeJson(browserPath, { proof: "browser", status: "passed" });
    const chainHash = writeJson(chainPath, { proof: "chain", status: "passed" });
    writeSummary(summaryPath, browserPath, browserHash, chainPath, chainHash, {
      blocked_gates: ["Public self-serve launch", "Browser approval buttons", "Invite delivery"]
    });

    const result = runRecord(summaryPath);

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("blocked gates must include Notification sending");
  });

  it("refuses production branch imports", () => {
    const browserPath = artifactPath("browser-proof.json");
    const chainPath = artifactPath("request-chain-proof.json");
    const summaryPath = artifactPath("summary.json");
    const browserHash = writeJson(browserPath, { proof: "browser", status: "passed" });
    const chainHash = writeJson(chainPath, { proof: "chain", status: "passed" });
    writeSummary(summaryPath, browserPath, browserHash, chainPath, chainHash, {
      neon_branch_name: "production"
    });

    const result = runRecord(summaryPath, { OUTPOST_NEON_BRANCH_NAME: "production" });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toContain("production branch");
  });
});
