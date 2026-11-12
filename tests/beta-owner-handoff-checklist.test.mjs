import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const checklistScript = readFileSync("scripts/prepare-beta-owner-handoff-checklist.mjs", "utf8");
const operatorRunbook = readFileSync("docs/setup/hosted-beta-operator-access.md", "utf8");

function checklistPath() {
  return join(mkdtempSync(join(tmpdir(), "outpost-beta-handoff-checklist-test-")), "checklist.md");
}

function baseEnv(path, extraEnv = {}) {
  return {
    ...process.env,
    OUTPOST_BETA_HANDOFF_CHECKLIST_PATH: path,
    OUTPOST_BETA_HANDOFF_GYM_NAME: "Summit Strength",
    OUTPOST_BETA_HANDOFF_OPERATOR_NAME: "Outpost operator",
    OUTPOST_BETA_HANDOFF_OWNER_EMAIL: "owner@summitstrength.example",
    OUTPOST_BETA_HANDOFF_OWNER_NAME: "Jordan Owner",
    OUTPOST_BETA_HANDOFF_PREVIEW_URL: "https://outpost-preview-20260610-example.vercel.app",
    OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW: "June beta proof window",
    OUTPOST_NEON_BRANCH_NAME: "outpost-beta-access-scoped-20260622120000",
    ...extraEnv
  };
}

function runChecklist(path, extraEnv = {}) {
  return spawnSync("node", ["scripts/prepare-beta-owner-handoff-checklist.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: baseEnv(path, extraEnv)
  });
}

describe("beta owner handoff execution checklist", () => {
  it("registers a generic handoff checklist command", () => {
    expect(packageJson).toContain('"beta:owner-handoff:checklist"');
    expect(packageJson).toContain("prepare-beta-owner-handoff-checklist.mjs");
  });

  it("writes a non-secret run sheet that sequences packet, completion, gate, and hosted record import", () => {
    const path = checklistPath();
    const result = runChecklist(path);

    expect(result.status, result.stderr).toBe(0);
    const checklist = readFileSync(path, "utf8");

    expect(checklist).toContain("Summit Strength Beta Handoff Execution Checklist");
    expect(checklist).toContain("npm run beta:owner-handoff:packet");
    expect(checklist).toContain("npm run beta:owner-handoff:complete");
    expect(checklist).toContain("npm run beta:owner-handoff:gate");
    expect(checklist).toContain("npm run beta:owner-handoff:record");
    expect(checklist).toContain("OUTPOST_BETA_HANDOFF_PARTICIPANT='<external beta owner name>'");
    expect(checklist).toContain("Public self-signup remains blocked.");
    expect(checklist).toContain("Invite delivery remains blocked.");
    expect(checklist).toContain("Phone/email providers remain blocked.");
    expect(checklist).toContain("Billing, POS, access control, and member-ledger writes remain blocked.");
    expect(checklist).toContain("do not count as customer-observed completion");
    expect(checklist).not.toContain("napi_");
    expect(checklist).not.toContain("Bearer ");
    expect(checklist).not.toContain("__Secure-neon-auth");
    expect(checklist).not.toMatch(/password\s*[:=]/iu);
  });

  it("allows optional explicit artifact paths while keeping repo-local files under artifacts", () => {
    const path = checklistPath();
    const result = runChecklist(path, {
      OUTPOST_BETA_HANDOFF_COMPLETION_PATH: "artifacts/beta-owner-handoff/custom-completion.json",
      OUTPOST_BETA_HANDOFF_GATE_PATH: "artifacts/beta-owner-handoff/custom-gate.json",
      OUTPOST_BETA_HANDOFF_PACKET_PATH: "artifacts/beta-owner-handoff/custom-packet.md"
    });

    expect(result.status, result.stderr).toBe(0);
    const checklist = readFileSync(path, "utf8");
    expect(checklist).toContain("artifacts/beta-owner-handoff/custom-packet.md");
    expect(checklist).toContain("artifacts/beta-owner-handoff/custom-completion.json");
    expect(checklist).toContain("artifacts/beta-owner-handoff/custom-gate.json");
  });

  it("fails closed for missing inputs, non-HTTPS Preview URLs, unsafe paths, and secret-shaped values", () => {
    let path = checklistPath();
    let result = runChecklist(path, { OUTPOST_BETA_HANDOFF_PREVIEW_URL: "http://preview.example.test" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must use https");

    path = checklistPath();
    result = runChecklist(path, { OUTPOST_BETA_HANDOFF_OWNER_EMAIL: "" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("OUTPOST_BETA_HANDOFF_OWNER_EMAIL is required");

    path = checklistPath();
    result = runChecklist(path, { OUTPOST_BETA_HANDOFF_CHECKLIST_PATH: "docs/handoff-checklist.md" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gitignored artifacts");

    path = checklistPath();
    result = runChecklist(path, { OUTPOST_BETA_HANDOFF_OPERATOR_NAME: "api_key: nope" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("secret-shaped value");
  });

  it("pins checklist boundaries in code and docs", () => {
    expect(checklistScript).toContain("This run sheet prepares an operator-assisted beta owner handoff.");
    expect(checklistScript).toContain("record customer-observed completion");
    expect(checklistScript).toContain("Phone/email providers remain blocked");
    expect(checklistScript).toContain("member-ledger writes remain blocked");
    expect(checklistScript).toContain("assertNoSecretShapedValue");
    expect(checklistScript).not.toContain("service_role");
    expect(checklistScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(operatorRunbook).toContain("Generic Beta Owner Handoff Packet");
  });
});
