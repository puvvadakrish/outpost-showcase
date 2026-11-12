import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  betaWalkthroughSteps,
  ownerBetaLoopSummary,
  ownerLocalBetaRehearsalChecklist,
  staffBetaProofWalkthrough
} from "@/domain/beta-loop";
import { getCustomerZeroTenant } from "@/domain/app-data";
import { taskProofSummary } from "@/domain/tasks";

describe("owner beta loop summary", () => {
  it("summarizes the customer-zero local proof loop without opening live gates", () => {
    const seed = getCustomerZeroTenant();
    const summary = ownerBetaLoopSummary({
      answerBankEntries: seed.answerBankEntries,
      notificationDestinations: seed.notificationDestinations,
      providerConnections: seed.providerConnections,
      sourceDocuments: seed.sourceDocuments,
      tasks: seed.tasks
    });

    expect(summary.steps).toEqual([
      expect.objectContaining({ id: "sources", state: "done" }),
      expect.objectContaining({ id: "answers", state: "active" }),
      expect.objectContaining({ id: "tasks", state: "active" }),
      expect.objectContaining({ id: "channels", state: "blocked" })
    ]);
    expect(summary.currentFocus.id).toBe("answers");
    expect(summary.completedSteps).toBe(1);
    expect(summary.totalLocalProofSteps).toBe(3);
    expect(summary.localProofPercent).toBe(33);
    expect(summary.primaryActionHref).toBe("/owner#answers");
    expect(summary.primaryActionLabel).toBe("Approve safe answers");
    expect(summary.readyForLocalBeta).toBe(false);
    expect(summary.blockedReasons).toContain("answer review is not complete");
    expect(summary.blockedReasons).toContain("hosted Neon proof must stay current in AGENTS.md/PLOT.md before any customer beta handoff");
    expect(summary.blockedReasons).toContain("phone and email providers are intentionally disconnected");
  });

  it("points owners to source intake before task proof when nothing has been staged", () => {
    const seed = getCustomerZeroTenant();
    const summary = ownerBetaLoopSummary({
      answerBankEntries: [],
      notificationDestinations: seed.notificationDestinations,
      providerConnections: seed.providerConnections,
      sourceDocuments: [],
      tasks: []
    });

    expect(summary.currentFocus).toMatchObject({
      id: "sources",
      href: "/owner#manual-source-intake",
      state: "active"
    });
    expect(summary.completedSteps).toBe(0);
    expect(summary.totalLocalProofSteps).toBe(3);
    expect(summary.localProofPercent).toBe(0);
    expect(summary.primaryActionLabel).toBe("Stage source facts");
    expect(summary.steps.find((step) => step.id === "answers")).toMatchObject({
      state: "blocked"
    });
    expect(summary.steps.find((step) => step.id === "tasks")).toMatchObject({
      state: "blocked"
    });
    expect(summary.blockedReasons).toContain("source facts have not been staged");
    expect(summary.blockedReasons).toContain("no approved answers are ready");
    expect(summary.blockedReasons).toContain("no staff task has been created for local proof");
  });

  it("keeps the local beta loop active until staff task proof is resolved", () => {
    const seed = getCustomerZeroTenant();
    const approvedAnswers = seed.answerBankEntries.map((entry) => ({
      ...entry,
      approvalStatus: "approved" as const
    }));
    const summary = ownerBetaLoopSummary({
      answerBankEntries: approvedAnswers,
      notificationDestinations: seed.notificationDestinations,
      providerConnections: seed.providerConnections,
      sourceDocuments: seed.sourceDocuments,
      tasks: seed.tasks
    });

    expect(summary.readyForLocalBeta).toBe(false);
    expect(summary.completedSteps).toBe(2);
    expect(summary.totalLocalProofSteps).toBe(3);
    expect(summary.localProofPercent).toBe(67);
    expect(summary.currentFocus.id).toBe("tasks");
    expect(summary.primaryActionLabel).toBe("Prove staff work");
    expect(summary.steps.find((step) => step.id === "answers")).toMatchObject({
      state: "done"
    });
    expect(summary.steps.find((step) => step.id === "channels")).toMatchObject({
      state: "blocked"
    });
    expect(summary.blockedReasons).toContain("staff task proof is still unresolved");
    expect(summary.blockedReasons).toContain("hosted Neon proof must stay current in AGENTS.md/PLOT.md before any customer beta handoff");
    expect(summary.blockedReasons).toContain("phone and email providers are intentionally disconnected");
  });

  it("marks the local beta loop ready when all local proof steps are done while live channels stay blocked", () => {
    const seed = getCustomerZeroTenant();
    const approvedAnswers = seed.answerBankEntries.map((entry) => ({
      ...entry,
      approvalStatus: "approved" as const
    }));
    const resolvedTasks = seed.tasks.map((task) => ({
      ...task,
      status: "done" as const
    }));
    const summary = ownerBetaLoopSummary({
      answerBankEntries: approvedAnswers,
      notificationDestinations: seed.notificationDestinations,
      providerConnections: seed.providerConnections,
      sourceDocuments: seed.sourceDocuments,
      tasks: resolvedTasks
    });

    expect(summary.readyForLocalBeta).toBe(true);
    expect(summary.completedSteps).toBe(3);
    expect(summary.totalLocalProofSteps).toBe(3);
    expect(summary.localProofPercent).toBe(100);
    expect(summary.currentFocus.id).toBe("channels");
    expect(summary.primaryActionLabel).toBe("Review blocked gate");
    expect(summary.steps.find((step) => step.id === "channels")).toMatchObject({
      state: "blocked"
    });
    expect(summary.blockedReasons).toContain("hosted Neon proof must stay current in AGENTS.md/PLOT.md before any customer beta handoff");
    expect(summary.blockedReasons).toContain("phone and email providers are intentionally disconnected");
  });

  it("builds a local-only rehearsal checklist without opening hosted or live gates", () => {
    const seed = getCustomerZeroTenant();
    const summary = ownerBetaLoopSummary({
      answerBankEntries: seed.answerBankEntries,
      notificationDestinations: seed.notificationDestinations,
      providerConnections: seed.providerConnections,
      sourceDocuments: seed.sourceDocuments,
      tasks: seed.tasks
    });
    const checklist = ownerLocalBetaRehearsalChecklist(summary);

    expect(checklist.heading).toBe("Local rehearsal command");
    expect(checklist.docsHref).toBe("/docs/setup/local-beta-operator-runbook.md");
    expect(existsSync(checklist.docsHref.replace(/^\//u, ""))).toBe(true);
    expect(checklist.commands.map((command) => command.label)).toEqual([
      "Neon Auth/Data API verifier",
      "Staff claim verifier placeholder",
      "Hosted beta workflow verifier"
    ]);
    expect(checklist.commands[0]?.command).toContain("npm run beta:rehearsal:local");
    expect(checklist.commands[0]?.command).toContain("NEXT_PUBLIC_NEON_DATA_API_URL=<Neon Data API URL>");
    expect(checklist.commands[1]?.command).toContain("npm run staff:claim:rehearsal:local");
    expect(checklist.commands[2]?.command).toContain("npm run hosted:beta-workflow");
    expect(checklist.commands[2]?.detail).toContain("staff Auth claim");
    expect(checklist.commands[2]?.detail).toContain("owner/staff route smoke");
    expect(checklist.operatorSteps.map((step) => step.label)).toEqual([
      "Reset local proof data",
      "Run both verifier entry points",
      "Inspect owner and staff screens",
      "Reset after proof"
    ]);
    expect(checklist.readinessChecks.map((check) => check.label)).toEqual([
      "Source facts staged",
      "Owner review complete",
      "Staff proof resolved",
      "Hosted/live gates closed"
    ]);
    expect(checklist.readinessChecks.at(-1)).toMatchObject({
      done: false,
      detail: "Hosted Neon proof must stay current and live providers remain disconnected before customer readiness."
    });
    expect(checklist.stateLabel).toBe("Local proof pending");
    expect(checklist.nextAction).toContain("Neon Auth and Data API endpoint env vars");
    expect(checklist.steps.map((step) => step.label)).toEqual([
      "Seed Neon Auth users",
      "Prove tenant RLS reads",
      "Edit one answer through RPC",
      "Deny cross-tenant mutation",
      "Keep live gates blocked"
    ]);
    expect(checklist.blockers).toContain("Hosted Neon proof is tracked in AGENTS.md/PLOT.md; rerun it before any customer beta handoff.");
    expect(checklist.blockers).toContain(
      "Phone, email, Retell, Resend/Gmail, billing, and live provider behavior remain disconnected."
    );
  });

  it("projects the owner local proof route in source-review-task-guardrail order", () => {
    const seed = getCustomerZeroTenant();
    const summary = ownerBetaLoopSummary({
      answerBankEntries: seed.answerBankEntries,
      notificationDestinations: seed.notificationDestinations,
      providerConnections: seed.providerConnections,
      sourceDocuments: seed.sourceDocuments,
      tasks: seed.tasks
    });

    expect(betaWalkthroughSteps(summary)).toEqual([
      {
        detail: "Manual facts saved",
        href: "/owner#manual-source-intake",
        label: "Source",
        state: "done"
      },
      {
        detail: "Owner decides",
        href: "/owner#answers",
        label: "Review",
        state: "active"
      },
      {
        detail: "Staff work created",
        href: "/staff/tasks",
        label: "Task",
        state: "active"
      },
      {
        detail: "Live gates closed",
        href: "/owner#channels",
        label: "Guardrails",
        state: "blocked"
      }
    ]);
  });

  it("projects staff task proof into the same local beta route", () => {
    const seed = getCustomerZeroTenant();
    const task = seed.tasks.find((candidate) => candidate.status === "needs_human") ?? seed.tasks[0];
    const walkthrough = staffBetaProofWalkthrough(taskProofSummary(task, seed.taskEvents));

    expect(walkthrough.heading).toBe("Staff proof is in progress");
    expect(walkthrough.steps.map((step) => step.label)).toEqual([
      "Source",
      "Review",
      "Task",
      "Guardrails"
    ]);
    expect(walkthrough.steps.find((step) => step.label === "Task")).toMatchObject({
      detail: "Seeded front-desk task",
      href: "/staff/tasks",
      state: "active"
    });
    expect(walkthrough.steps.find((step) => step.label === "Guardrails")).toMatchObject({
      detail: "Phone and email off",
      href: "/owner#channels",
      state: "blocked"
    });
  });

  it("marks the rehearsal checklist complete only when the local proof loop is complete", () => {
    const seed = getCustomerZeroTenant();
    const approvedAnswers = seed.answerBankEntries.map((entry) => ({
      ...entry,
      approvalStatus: "approved" as const
    }));
    const resolvedTasks = seed.tasks.map((task) => ({
      ...task,
      status: "done" as const
    }));
    const summary = ownerBetaLoopSummary({
      answerBankEntries: approvedAnswers,
      notificationDestinations: seed.notificationDestinations,
      providerConnections: seed.providerConnections,
      sourceDocuments: seed.sourceDocuments,
      tasks: resolvedTasks
    });

    expect(ownerLocalBetaRehearsalChecklist(summary)).toMatchObject({
      heading: "Local rehearsal complete",
      nextAction: "Reset the Neon branch before rerunning the verifier or before recording a fresh demo path.",
      stateLabel: "Local proof packaged"
    });
    expect(ownerLocalBetaRehearsalChecklist(summary).readinessChecks).toEqual([
      expect.objectContaining({ done: true, label: "Source facts staged" }),
      expect.objectContaining({ done: true, label: "Owner review complete" }),
      expect.objectContaining({ done: true, label: "Staff proof resolved" }),
      expect.objectContaining({ done: false, label: "Hosted/live gates closed" })
    ]);
  });
});
