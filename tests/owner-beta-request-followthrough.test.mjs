import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const followThroughScript = readFileSync("scripts/prepare-owner-beta-request-followthrough.mjs", "utf8");
const followThroughOutcomeScript = readFileSync("scripts/record-owner-beta-request-followthrough-outcome.mjs", "utf8");
const followThroughOutcomeMigration = readFileSync(
  "neon/migrations/20260624070000_owner_beta_request_followthrough_outcomes.sql",
  "utf8"
);
const adminConsole = readFileSync("src/components/founder-admin/FounderAdminReadinessConsole.tsx", "utf8");
const domain = readFileSync("src/domain/founder-admin-readiness.ts", "utf8");
const brainstorm = readFileSync("docs/brainstorms/2026-06-24-owner-beta-request-followthrough-brainstorm.md", "utf8");
const plan = readFileSync("docs/plans/2026-06-24-feat-owner-beta-request-followthrough-plan.md", "utf8");

function artifactPath(filename) {
  return join(mkdtempSync(join(tmpdir(), "outpost-owner-beta-request-followthrough-test-")), filename);
}

describe("owner beta request follow-through", () => {
  it("registers terminal-only follow-through command and admin read-only state", () => {
expect(packageJson).toContain('"admin:beta-request:followthrough"');
expect(packageJson).toContain('"admin:beta-request:followthrough-record"');
expect(packageJson).toContain("prepare-owner-beta-request-followthrough.mjs");
expect(packageJson).toContain("record-owner-beta-request-followthrough-outcome.mjs");
    expect(followThroughScript).toContain("owner_beta_request_followthrough_prepared");
    expect(followThroughScript).toContain("ready_for_operator_fulfillment");
    expect(followThroughScript).toContain("owner_beta_access_request_triage_receipts");
    expect(followThroughScript).toContain("public_self_serve_launch_allowed = false");
    expect(followThroughScript).toContain("launch_enablement_allowed = false");
    expect(followThroughScript).toContain("status not in ('not_configured', 'disabled', 'pending_review')");
    expect(followThroughScript).toContain("secret_ref is not null");
    expect(followThroughScript).toContain("nullif(external_account_label, '') is not null");
    expect(followThroughScript).toContain("npm run beta:operator:request-fulfillment");
expect(followThroughOutcomeScript).toContain("owner_beta_request_followthrough_outcome_recorded");
expect(followThroughOutcomeScript).toContain("operator_handoff_completed");
expect(followThroughOutcomeScript).toContain("followup_required");
expect(followThroughOutcomeScript).toContain("deferred_not_ready");
    expect(followThroughOutcomeScript).toContain("Refusing request follow-through outcome record against Neon production branch.");
    expect(followThroughOutcomeScript).toContain("with matching_request as");
    expect(followThroughOutcomeScript).toContain("requests.status in ('new', 'reviewing', 'approved')");
    expect(followThroughOutcomeScript).toContain("latest_triage as");
    expect(followThroughOutcomeScript).toContain("join latest_triage latest on latest.id = receipts.id");
    expect(followThroughOutcomeScript).toContain("matching_triage as");
    expect(followThroughOutcomeScript).toContain("packet triage receipt id missing.");
    expect(followThroughOutcomeScript).toContain("packet triage receipt packet digest missing.");
    expect(followThroughOutcomeScript).toContain("receipts.id = ${sqlLiteral(record.triageReceiptId)}");
    expect(followThroughOutcomeScript).toContain("receipts.packet_sha256 = ${sqlLiteral(record.triagePacketSha256)}");
    expect(followThroughOutcomeScript).toContain("decision = 'ready_for_operator_fulfillment'");
    expect(followThroughOutcomeScript).toContain("unexpected_live_provider_records as");
    expect(followThroughOutcomeScript).toContain("status not in ('not_configured', 'disabled', 'pending_review')");
    expect(followThroughOutcomeScript).toContain("secret_ref is not null");
    expect(followThroughOutcomeScript).toContain("nullif(external_account_label, '') is not null");
    expect(followThroughOutcomeScript).toContain("No active owner beta access request matched follow-through packet.");
    expect(followThroughOutcomeScript).toContain("No ready owner beta access triage receipt matched follow-through packet.");
    expect(followThroughOutcomeScript).toContain("Unexpected live provider records present");
    expect(followThroughOutcomeScript).toContain("public_self_serve_launch_allowed");
    expect(followThroughOutcomeScript).toContain("launch_enablement_allowed");
expect(followThroughOutcomeMigration).toContain("owner_beta_access_request_followthrough_outcomes");
expect(followThroughOutcomeMigration).toContain("list_founder_admin_beta_access_request_followthrough_outcomes");
expect(followThroughOutcomeMigration).toContain("public_self_serve_launch_allowed = false");
expect(followThroughOutcomeMigration).toContain("launch_enablement_allowed = false");
    expect(followThroughScript).not.toMatch(/sendInvite|sendEmail|createAuthUser|enableProvider|memberLedgerWrite/u);
    expect(adminConsole).toContain("founderAdminBetaRequestFollowThroughReadiness");
expect(adminConsole).toContain("Request follow-through");
expect(adminConsole).toContain("followThrough.recordCommand");
expect(adminConsole).toContain("followThrough.outcome");
    expect(domain).toContain("founderAdminBetaRequestFollowThroughReadiness");
    expect(domain).toContain("betaAccessRequestFollowThroughOutcomes");
    expect(domain).toContain("candidate.summary.triage_receipt_id === receipt.id");
    expect(domain).toContain("candidate.summary.triage_packet_sha256 === receipt.packet_sha256");
    expect(domain).toContain("npm run admin:beta-request:followthrough-record");
    expect(domain).toContain("Run this terminal-only packet");
    expect(brainstorm).toContain("No invite delivery or notification sending");
    expect(plan).toContain("Admin portal request row shows follow-through state");
  });

  it("fails closed before hosted query for local Preview URLs", () => {
    const result = spawnSync(process.execPath, ["scripts/prepare-owner-beta-request-followthrough.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth",
        NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-test.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
        OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: artifactPath("followthrough.json"),
        OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REQUEST_ID: "owner_beta_request_abc123",
        OUTPOST_NEON_BRANCH_NAME: "outpost-proof-request-followthrough",
        OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
        OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password",
        OUTPOST_VERCEL_DEPLOYMENT_URL: "http://localhost:3000"
      }
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain("must be a protected HTTPS Vercel Preview URL");
    expect(`${result.stderr}\n${result.stdout}`).not.toContain("Neon owner beta request follow-through query failed");
  });

  it("refuses production Neon branch before hosted writes", () => {
    const result = spawnSync(process.execPath, ["scripts/prepare-owner-beta-request-followthrough.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth",
        NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-test.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
        OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH: artifactPath("followthrough-production.json"),
        OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REQUEST_ID: "owner_beta_request_abc123",
        OUTPOST_NEON_BRANCH_NAME: "production",
        OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
        OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password",
        OUTPOST_VERCEL_DEPLOYMENT_URL: "https://outpost-preview-20260610-example.vercel.app"
      }
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}\n${result.stdout}`).toContain("Refusing request follow-through against Neon production branch");
    expect(`${result.stderr}\n${result.stdout}`).not.toContain("Neon owner beta request follow-through query failed");
  });
});
