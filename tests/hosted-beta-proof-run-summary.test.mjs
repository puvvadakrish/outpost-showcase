import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const summaryScript = readFileSync("scripts/prepare-hosted-beta-proof-run-summary.mjs", "utf8");
const inspectScript = readFileSync("scripts/inspect-hosted-beta-proof-run-summary.mjs", "utf8");
const domain = readFileSync("src/domain/founder-admin-readiness.ts", "utf8");

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe("hosted beta proof run summary", () => {
  it("registers summary writer and inspector commands", () => {
    expect(packageJson).toContain(
      '"hosted:beta-proof-run:summary": "node scripts/prepare-hosted-beta-proof-run-summary.mjs"'
    );
    expect(packageJson).toContain(
      '"hosted:beta-proof-run:summary:inspect": "node scripts/inspect-hosted-beta-proof-run-summary.mjs"'
    );
    expect(domain).toContain("Write beta proof-run summary");
    expect(domain).toContain("npm run hosted:beta-proof-run:summary");
    expect(domain).toContain("Inspect beta proof-run summary");
    expect(domain).toContain("npm run hosted:beta-proof-run:summary:inspect");
  });

  it("validates browser and chain evidence before writing a non-secret summary", () => {
    expect(summaryScript).toContain("OUTPOST_BETA_REQUEST_BROWSER_EVIDENCE_PATH");
    expect(summaryScript).toContain("OUTPOST_BETA_REQUEST_CHAIN_EVIDENCE_PATH");
    expect(summaryScript).toContain("browser and chain proofs must target the same Preview origin");
    expect(summaryScript).toContain("browser and chain proofs must target the same hosted Neon branch");
    expect(summaryScript).toContain("Public self-serve launch");
    expect(summaryScript).toContain("Phone/email providers");
    expect(summaryScript).toContain("POS/access control/member-ledger writes");
    expect(inspectScript).toContain("hosted_beta_request_proof_run_summary");
    expect(inspectScript).toContain("summary must be ready for next slice");
  });

  it("writes and inspects a combined summary from sanitized proof artifacts", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-proof-summary-"));
    const browserPath = join(tempDir, "browser.json");
    const chainPath = join(tempDir, "chain.json");
    const summaryPath = join(tempDir, "summary.json");
    try {
      writeJson(browserPath, {
        app_origin: "https://outpost-preview-abc123-<team-scope>.vercel.app",
        browser: { success_message_seen: true },
        checks: {
          browser_form_submitted: true,
          live_provider_gates_blocked: true,
          request_row_verified: true
        },
        cleanup: "cleanup_requested",
        neon_branch_name: "outpost-proof-branch",
        proof_email_domain: "@beta-browser-proof.outpost.local",
        request: {
          email: "beta_request_browser_test@beta-browser-proof.outpost.local",
          gym_name: "Browser Proof Gym",
          id: "owner_beta_request_browser",
          owner_name: "Browser Owner",
          request_count: 1,
          status: "new"
        },
        run_id: "beta_request_browser_test",
        wrote_at: "2026-06-24T00:00:00.000Z"
      });
      writeJson(chainPath, {
        app_origin: "https://outpost-preview-abc123-<team-scope>.vercel.app",
        branch: "outpost-proof-branch",
        cleanup: "cleanup_requested",
        no_live_provider_gates_blocked: true,
        proof: "hosted_beta_request_chain",
        request_id: "owner_beta_request_chain",
        status: "passed",
        wrote_at: "2026-06-24T00:01:00.000Z"
      });

      const result = spawnSync(process.execPath, ["scripts/prepare-hosted-beta-proof-run-summary.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          OUTPOST_BETA_PROOF_RUN_SUMMARY_PATH: summaryPath,
          OUTPOST_BETA_REQUEST_BROWSER_EVIDENCE_PATH: browserPath,
          OUTPOST_BETA_REQUEST_CHAIN_EVIDENCE_PATH: chainPath
        }
      });
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stdout).toContain("Hosted beta proof run summary written.");
      const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
      expect(summary.summary_kind).toBe("hosted_beta_request_proof_run_summary");
      expect(summary.ready_for_next_slice).toBe(true);
      expect(summary.cleanup).toEqual({ browser_request: "cleanup_requested", request_chain: "cleanup_requested" });
      expect(summary.blocked_gates).toContain("Public self-serve launch");
      expect(summary.blocked_gates).toContain("Phone/email providers");

      const inspect = spawnSync(process.execPath, ["scripts/inspect-hosted-beta-proof-run-summary.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          OUTPOST_BETA_PROOF_RUN_SUMMARY_PATH: summaryPath
        }
      });
      expect(inspect.status, inspect.stderr || inspect.stdout).toBe(0);
      expect(inspect.stdout).toContain("Hosted beta proof run summary inspected.");
      expect(inspect.stdout).toContain("Public self-serve and live-provider gates: blocked");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("fails closed when proof artifacts contain secret-shaped values", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-proof-summary-secret-"));
    const browserPath = join(tempDir, "browser.json");
    const chainPath = join(tempDir, "chain.json");
    const summaryPath = join(tempDir, "summary.json");
    try {
      writeJson(browserPath, {
        app_origin: "https://outpost-preview-abc123-<team-scope>.vercel.app",
        browser: { success_message_seen: true },
        checks: { browser_form_submitted: true, live_provider_gates_blocked: true, request_row_verified: true },
        cleanup: "cleanup_requested",
        neon_branch_name: "outpost-proof-branch",
        request: { status: "new" },
        note: "token: should-not-be-here"
      });
      writeJson(chainPath, {
        app_origin: "https://outpost-preview-abc123-<team-scope>.vercel.app",
        branch: "outpost-proof-branch",
        cleanup: "cleanup_requested",
        no_live_provider_gates_blocked: true,
        proof: "hosted_beta_request_chain",
        request_id: "owner_beta_request_chain",
        status: "passed"
      });
      const result = spawnSync(process.execPath, ["scripts/prepare-hosted-beta-proof-run-summary.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          OUTPOST_BETA_PROOF_RUN_SUMMARY_PATH: summaryPath,
          OUTPOST_BETA_REQUEST_BROWSER_EVIDENCE_PATH: browserPath,
          OUTPOST_BETA_REQUEST_CHAIN_EVIDENCE_PATH: chainPath
        }
      });
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain("browser proof evidence contains secret-shaped value");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("fails closed when browser and chain evidence target different branches", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-proof-summary-mismatch-"));
    const browserPath = join(tempDir, "browser.json");
    const chainPath = join(tempDir, "chain.json");
    const summaryPath = join(tempDir, "summary.json");
    try {
      writeJson(browserPath, {
        app_origin: "https://outpost-preview-abc123-<team-scope>.vercel.app",
        browser: { success_message_seen: true },
        checks: { browser_form_submitted: true, live_provider_gates_blocked: true, request_row_verified: true },
        cleanup: "cleanup_requested",
        neon_branch_name: "outpost-proof-branch-a",
        request: { status: "new" }
      });
      writeJson(chainPath, {
        app_origin: "https://outpost-preview-abc123-<team-scope>.vercel.app",
        branch: "outpost-proof-branch-b",
        cleanup: "cleanup_requested",
        no_live_provider_gates_blocked: true,
        proof: "hosted_beta_request_chain",
        request_id: "owner_beta_request_chain",
        status: "passed"
      });
      const result = spawnSync(process.execPath, ["scripts/prepare-hosted-beta-proof-run-summary.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          OUTPOST_BETA_PROOF_RUN_SUMMARY_PATH: summaryPath,
          OUTPOST_BETA_REQUEST_BROWSER_EVIDENCE_PATH: browserPath,
          OUTPOST_BETA_REQUEST_CHAIN_EVIDENCE_PATH: chainPath
        }
      });
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        "browser and chain proofs must target the same hosted Neon branch"
      );
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("fails closed when browser and chain evidence target different Preview origins", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-proof-summary-origin-"));
    const browserPath = join(tempDir, "browser.json");
    const chainPath = join(tempDir, "chain.json");
    const summaryPath = join(tempDir, "summary.json");
    try {
      writeJson(browserPath, {
        app_origin: "https://outpost-preview-a-<team-scope>.vercel.app",
        browser: { success_message_seen: true },
        checks: { browser_form_submitted: true, live_provider_gates_blocked: true, request_row_verified: true },
        cleanup: "cleanup_requested",
        neon_branch_name: "outpost-proof-branch",
        request: { status: "new" }
      });
      writeJson(chainPath, {
        app_origin: "https://outpost-preview-b-<team-scope>.vercel.app",
        branch: "outpost-proof-branch",
        cleanup: "cleanup_requested",
        no_live_provider_gates_blocked: true,
        proof: "hosted_beta_request_chain",
        request_id: "owner_beta_request_chain",
        status: "passed"
      });
      const result = spawnSync(process.execPath, ["scripts/prepare-hosted-beta-proof-run-summary.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          OUTPOST_BETA_PROOF_RUN_SUMMARY_PATH: summaryPath,
          OUTPOST_BETA_REQUEST_BROWSER_EVIDENCE_PATH: browserPath,
          OUTPOST_BETA_REQUEST_CHAIN_EVIDENCE_PATH: chainPath
        }
      });
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        "browser and chain proofs must target the same Preview origin"
      );
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("inspector rejects summary source artifact hash mismatches", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-proof-summary-hash-"));
    const browserPath = join(tempDir, "browser.json");
    const chainPath = join(tempDir, "chain.json");
    const summaryPath = join(tempDir, "summary.json");
    try {
      writeJson(browserPath, {
        app_origin: "https://outpost-preview-abc123-<team-scope>.vercel.app",
        browser: { success_message_seen: true },
        checks: { browser_form_submitted: true, live_provider_gates_blocked: true, request_row_verified: true },
        cleanup: "cleanup_requested",
        neon_branch_name: "outpost-proof-branch",
        request: { status: "new" }
      });
      writeJson(chainPath, {
        app_origin: "https://outpost-preview-abc123-<team-scope>.vercel.app",
        branch: "outpost-proof-branch",
        cleanup: "cleanup_requested",
        no_live_provider_gates_blocked: true,
        proof: "hosted_beta_request_chain",
        request_id: "owner_beta_request_chain",
        status: "passed"
      });
      const writer = spawnSync(process.execPath, ["scripts/prepare-hosted-beta-proof-run-summary.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          OUTPOST_BETA_PROOF_RUN_SUMMARY_PATH: summaryPath,
          OUTPOST_BETA_REQUEST_BROWSER_EVIDENCE_PATH: browserPath,
          OUTPOST_BETA_REQUEST_CHAIN_EVIDENCE_PATH: chainPath
        }
      });
      expect(writer.status, writer.stderr || writer.stdout).toBe(0);
      writeFileSync(browserPath, `${readFileSync(browserPath, "utf8").trim()}\n `);
      const inspect = spawnSync(process.execPath, ["scripts/inspect-hosted-beta-proof-run-summary.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          OUTPOST_BETA_PROOF_RUN_SUMMARY_PATH: summaryPath
        }
      });
      expect(inspect.status).not.toBe(0);
      expect(`${inspect.stdout}\n${inspect.stderr}`).toContain("browser request proof source artifact sha256 mismatch");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
