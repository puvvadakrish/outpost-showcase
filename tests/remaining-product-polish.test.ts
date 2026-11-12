import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appShell = readFileSync("src/components/AppShell.tsx", "utf8");
const taskTable = readFileSync("src/components/TaskTable.tsx", "utf8");
const staffTaskWorkspace = readFileSync("src/components/staff/StaffTaskWorkspaceClient.tsx", "utf8");
const manualSourceIntake = readFileSync("src/components/owner/ManualSourceIntakeEditor.tsx", "utf8");
const answerReviewClient = readFileSync("src/components/owner/AnswerBankReviewClient.tsx", "utf8");
const betaRehearsalPanel = readFileSync("src/components/owner/OwnerBetaRehearsalPanel.tsx", "utf8");
const betaLoopDomain = readFileSync("src/domain/beta-loop.ts", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");
const design = readFileSync("DESIGN.md", "utf8");
const runbook = readFileSync("docs/setup/local-beta-operator-runbook.md", "utf8");

describe("remaining product polish", () => {
  it("adds accessible shared chrome primitives for long mobile sessions", () => {
    expect(appShell).toContain('className="skip-link"');
    expect(appShell).toContain('href="#main-content"');
    expect(appShell).toContain('id="main-content"');
    expect(appShell).toContain("tabIndex={-1}");
    expect(globals).toContain(".skip-link:focus");
  });

  it("adds staff queue filters without adding new backend behavior", () => {
    expect(staffTaskWorkspace).toContain("taskQuery");
    expect(staffTaskWorkspace).toContain("taskStatusFilter");
    expect(staffTaskWorkspace).toContain("taskAssigneeFilter");
    expect(staffTaskWorkspace).toContain("task-filter-panel");
    expect(staffTaskWorkspace).toContain("Showing {visibleTasks.length} of {state.tasks.length} tasks");
    expect(taskTable).toContain("No tasks match this view");
    expect(globals).toContain(".task-filter-bar");
    expect(globals).toContain(".task-empty-state");
  });

  it("makes owner source and answer empty states operational", () => {
    expect(manualSourceIntake).toContain("manual-source-fact-index");
    expect(manualSourceIntake).toContain("removeFactRow");
    expect(manualSourceIntake).toContain("No saved facts are ready to stage.");
    expect(answerReviewClient).toContain("operational-empty-state answer-review-empty");
    expect(answerReviewClient).toContain("Add source facts");
    expect(globals).toContain(".operational-empty-state");
    expect(globals).toContain(".manual-source-fact-index");
  });

  it("documents the durable polish rules in the design system", () => {
    expect(design).toContain("Operational empty states");
    expect(design).toContain("Queue controls");
    expect(design).toContain("Skip links");
  });

  it("packages local beta proof into an operator runbook without hosted or live-provider claims", () => {
    expect(runbook).toContain("Local Beta Operator Runbook");
    expect(runbook).toContain("npm run beta:rehearsal:local");
    expect(runbook).toContain("npm run staff:claim:rehearsal:local");
    expect(runbook).toMatch(/live-provider gate review\s+have\s+passed/u);
    expect(runbook).toMatch(/live phone\/email\s+providers remain off/u);
    expect(betaLoopDomain).toContain("docs/setup/local-beta-operator-runbook.md");
    expect(betaLoopDomain).toContain("Staff claim verifier placeholder");
    expect(betaRehearsalPanel).toContain("Beta readiness checklist");
    expect(betaRehearsalPanel).toContain("Neon branch commands");
    expect(betaRehearsalPanel).not.toContain("Open runbook");
    expect(betaRehearsalPanel).not.toContain("<a ");
    expect(betaRehearsalPanel).not.toContain("href=");
    expect(betaRehearsalPanel).toContain("beta-readiness-status");
    expect(betaRehearsalPanel).toContain('"Met"');
    expect(betaRehearsalPanel).toContain('"Blocked"');
    expect(globals).toContain(".beta-runbook-layout");
    expect(globals).toContain(".beta-readiness-check");
    expect(globals).toContain(".beta-readiness-status");
  });
});
