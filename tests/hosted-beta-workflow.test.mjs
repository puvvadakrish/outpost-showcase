import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const workflowScript = readFileSync("scripts/verify-hosted-beta-workflow.mjs", "utf8");

describe("hosted beta workflow verifier", () => {
  it("registers a hosted Neon beta workflow command", () => {
    expect(packageJson).toContain('"hosted:beta-workflow"');
    expect(packageJson).toContain("verify-hosted-beta-workflow.mjs");
  });

  it("builds on hosted readiness before running beta workflow mutations", () => {
    expect(workflowScript).toContain('runCommand(["npm", "run", "hosted:readiness"]');
    expect(workflowScript.indexOf('runCommand(["npm", "run", "hosted:readiness"]')).toBeLessThan(
      workflowScript.indexOf('dataApiRpc("upsert_tenant_staff_member"')
    );
  });

  it("covers owner, staff, manual source, answer-review task, and route-smoke proof", () => {
    expect(workflowScript).toContain("assertAppServerAvailable");
    expect(workflowScript).toContain("app server is required");
    expect(workflowScript).toContain("attempt < 6");
    expect(workflowScript).toContain("setTimeout(resolve, 500)");
    expect(workflowScript).toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(workflowScript).toContain("x-vercel-protection-bypass");
    expect(workflowScript).toContain("OUTPOST_USE_VERCEL_CURL");
    expect(workflowScript).toContain("routeSmokeWithVercelCurl");
    expect(workflowScript).toContain('runVercelCurl(["/", "--deployment"');
    expect(workflowScript).toContain('dataApiRpc("upsert_tenant_staff_member"');
    expect(workflowScript).toContain('dataApiRpc("claim_staff_roster_membership"');
    expect(workflowScript).toContain('dataApiRpc("upsert_manual_source_document"');
    expect(workflowScript).toContain('dataApiRpc("propose_answers_from_manual_source"');
    expect(workflowScript).toContain('dataApiRpc("create_task_from_answer_bank_entry"');
    expect(workflowScript).toContain('dataApiRpc("assign_task"');
    expect(workflowScript).toContain('dataApiRpc("add_task_note"');
    expect(workflowScript).toContain('dataApiRpc("update_task_status"');
    expect(workflowScript).toContain('routeSmoke(owner, "/owner"');
    expect(workflowScript).toContain('routeSmoke(staff, "/staff/tasks"');
  });

  it("keeps no-live-provider gates explicit", () => {
    expect(workflowScript).toContain("Live-provider gates remain blocked");
    expect(workflowScript).toContain("provider_connections");
    expect(workflowScript).toContain("where status not in");
    expect(workflowScript).not.toContain("service_role");
    expect(workflowScript).not.toContain("SUPABASE_SERVICE_ROLE");
  });
});
