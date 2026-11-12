import { describe, expect, it } from "vitest";
import { ownerBetaLoopSummary } from "@/domain/beta-loop";
import { ownerBurdenReport } from "@/domain/burden-report";
import { getCustomerZeroTenant } from "@/domain/app-data";
import { answerBankReadiness, sourceDocumentReadiness } from "@/domain/answer-bank";
import { manualSourceDocuments } from "@/domain/sources";

function buildReportFromSeed() {
  const seed = getCustomerZeroTenant();
  const betaLoopSummary = ownerBetaLoopSummary({
    answerBankEntries: seed.answerBankEntries,
    notificationDestinations: seed.notificationDestinations,
    providerConnections: seed.providerConnections,
    sourceDocuments: seed.sourceDocuments,
    tasks: seed.tasks
  });

  return {
    report: ownerBurdenReport({
      answerBankEntries: seed.answerBankEntries,
      betaLoopSummary,
      locations: seed.locations,
      referenceTime: new Date("2026-07-12T12:00:00.000Z"),
      sourceDocuments: seed.sourceDocuments,
      tasks: seed.tasks,
      taskEvents: seed.taskEvents,
      users: seed.users
    }),
    seed
  };
}

describe("owner burden report", () => {
  it("summarizes existing local persisted state without opening hosted or provider gates", () => {
    const { report, seed } = buildReportFromSeed();
    const answerReadiness = answerBankReadiness(seed.answerBankEntries);
    const manualSourceReadiness = sourceDocumentReadiness(manualSourceDocuments(seed.sourceDocuments));

    expect(report.headline).toBe("Local burden report is still building");
    expect(report.localProofPercent).toBe(33);
    expect(report.subheadline).toContain("Derived from existing local source, answer, task, and readiness rows.");
    expect(report.subheadline).toContain("No hosted proof, SLA, provider ingress, notifications, billing, POS, or member-ledger behavior is claimed.");
    expect(report.metrics).toEqual([
      expect.objectContaining({
        id: "tasks_created",
        label: "Staff tasks created",
        value: String(seed.tasks.length)
      }),
      expect.objectContaining({
        id: "tasks_resolved",
        label: "Tasks resolved locally",
        value: "2"
      }),
      expect.objectContaining({
        id: "answer_review",
        label: "Answer review progress",
        value: `${answerReadiness.approved}/${seed.answerBankEntries.length}`
      }),
      expect.objectContaining({
        id: "source_facts",
        label: "Manual facts staged",
        value: String(manualSourceReadiness.factsFound)
      })
    ]);
    expect(report.channelRows).toEqual([
      { channel: "phone", label: "phone", totalCount: 2, unresolvedCount: 2 },
      { channel: "email", label: "email", totalCount: 3, unresolvedCount: 1 },
      { channel: "manual", label: "manual", totalCount: 0, unresolvedCount: 0 }
    ]);
    expect(report.commonRequestRows).toEqual([
      { fullLabel: "callback", label: "callback", totalCount: 1, unresolvedCount: 1 },
      { fullLabel: "membership freeze", label: "membership freeze", totalCount: 1, unresolvedCount: 1 },
      { fullLabel: "tour", label: "tour", totalCount: 1, unresolvedCount: 1 },
      { fullLabel: "duplicate", label: "duplicate", totalCount: 1, unresolvedCount: 0 },
      { fullLabel: "hours", label: "hours", totalCount: 1, unresolvedCount: 0 }
    ]);
    expect(report.staffIntakeRows).toEqual([]);
    expect(report.locationRows).toEqual([
      { label: "Acme Fitness Main", locationId: "loc_acme_main", totalCount: 5, unresolvedCount: 3 }
    ]);
    expect(report.workflowRows.map((row) => [row.stage, row.totalCount, row.unresolvedCount])).toEqual([
      ["unassigned_intake", 1, 1],
      ["ready_for_staff", 1, 1],
      ["in_progress", 1, 1],
      ["completed", 1, 0],
      ["ignored", 1, 0]
    ]);
    expect(report.ageRows.map((row) => [row.ageBucket, row.totalCount, row.unresolvedCount])).toEqual([
      ["fresh", 0, 0],
      ["waiting", 0, 0],
      ["stale", 5, 3]
    ]);
    expect(report.rows).toContainEqual(
      expect.objectContaining({
        label: "Hosted and live gates",
        state: "blocked",
        value: "Blocked"
      })
    );
    expect(report.blockedGates).toEqual([
      "hosted Neon proof must stay current in AGENTS.md/PLOT.md before any customer beta handoff",
      "phone and email providers are intentionally disconnected"
    ]);
  });

  it("keeps all channel rows visible for an empty task set", () => {
    const seed = getCustomerZeroTenant();
    const betaLoopSummary = ownerBetaLoopSummary({
      answerBankEntries: seed.answerBankEntries,
      notificationDestinations: seed.notificationDestinations,
      providerConnections: seed.providerConnections,
      sourceDocuments: seed.sourceDocuments,
      tasks: []
    });
    const report = ownerBurdenReport({
      answerBankEntries: seed.answerBankEntries,
      betaLoopSummary,
      locations: seed.locations,
      referenceTime: new Date("2026-07-12T12:00:00.000Z"),
      sourceDocuments: seed.sourceDocuments,
      tasks: [],
      taskEvents: [],
      users: seed.users
    });

    expect(report.channelRows.map((row) => [row.channel, row.totalCount, row.unresolvedCount])).toEqual([
      ["phone", 0, 0],
      ["email", 0, 0],
      ["manual", 0, 0]
    ]);
    expect(report.commonRequestRows).toEqual([]);
    expect(report.staffIntakeRows).toEqual([]);
    expect(report.locationRows).toEqual([
      { label: "Acme Fitness Main", locationId: "loc_acme_main", totalCount: 0, unresolvedCount: 0 }
    ]);
    expect(report.workflowRows).toHaveLength(5);
    expect(report.workflowRows.every((row) => row.totalCount === 0)).toBe(true);
    expect(report.ageRows).toHaveLength(3);
    expect(report.ageRows.every((row) => row.totalCount === 0)).toBe(true);
  });

  it("marks the report complete only when local tasks and answer review are complete", () => {
    const seed = getCustomerZeroTenant();
    const approvedAnswers = seed.answerBankEntries.map((entry) => ({
      ...entry,
      approvalStatus: "approved" as const
    }));
    const resolvedTasks = seed.tasks.map((task) => ({
      ...task,
      status: "done" as const
    }));
    const betaLoopSummary = ownerBetaLoopSummary({
      answerBankEntries: approvedAnswers,
      notificationDestinations: seed.notificationDestinations,
      providerConnections: seed.providerConnections,
      sourceDocuments: seed.sourceDocuments,
      tasks: resolvedTasks
    });
    const report = ownerBurdenReport({
      answerBankEntries: approvedAnswers,
      betaLoopSummary,
      locations: seed.locations,
      referenceTime: new Date("2026-07-12T12:00:00.000Z"),
      sourceDocuments: seed.sourceDocuments,
      tasks: resolvedTasks,
      taskEvents: seed.taskEvents,
      users: seed.users
    });

    expect(report.headline).toBe("Local burden report is complete");
    expect(report.localProofPercent).toBe(100);
    expect(report.metrics.find((metric) => metric.id === "tasks_resolved")).toMatchObject({
      value: String(resolvedTasks.length)
    });
    expect(report.rows.find((row) => row.label === "Task burden captured")).toMatchObject({
      detail: "All local tasks are closed.",
      state: "complete"
    });
    expect(report.rows.find((row) => row.label === "Local proof completion")).toMatchObject({
      state: "complete",
      value: "100%"
    });
    expect(report.rows.find((row) => row.label === "Hosted and live gates")).toMatchObject({
      state: "blocked"
    });
  });

  it("adds aggregate staff intake contribution without requester data", () => {
    const seed = getCustomerZeroTenant();
    const task = { ...seed.tasks[0], id: "task_owner_intake_contribution" };
    const betaLoopSummary = ownerBetaLoopSummary({
      answerBankEntries: seed.answerBankEntries,
      notificationDestinations: seed.notificationDestinations,
      providerConnections: seed.providerConnections,
      sourceDocuments: seed.sourceDocuments,
      tasks: [task]
    });
    const report = ownerBurdenReport({
      answerBankEntries: seed.answerBankEntries,
      betaLoopSummary,
      locations: seed.locations,
      referenceTime: new Date("2026-07-12T12:00:00.000Z"),
      sourceDocuments: seed.sourceDocuments,
      tasks: [task],
      taskEvents: [
        {
          actorUserId: "user_staff_acme",
          createdAt: "2026-07-12T10:00:00.000Z",
          eventType: "created",
          id: "event_owner_intake_contribution",
          locationId: task.locationId,
          note: "Manual task created through Outpost staff workboard.",
          taskId: task.id,
          tenantId: task.tenantId,
          toStatus: "new"
        }
      ],
      users: seed.users
    });

    expect(report.staffIntakeRows).toEqual([
      {
        actorUserId: "user_staff_acme",
        known: true,
        label: "Front Desk",
        resolvedCount: 0,
        totalCount: 1,
        unresolvedCount: 1
      }
    ]);
    expect(JSON.stringify(report.staffIntakeRows)).not.toContain(task.requesterContact);
  });

  it("keeps unknown task locations visible without exposing task detail", () => {
    const seed = getCustomerZeroTenant();
    const task = { ...seed.tasks[0], id: "task_unknown_location", locationId: "missing_location" };
    const betaLoopSummary = ownerBetaLoopSummary({
      answerBankEntries: seed.answerBankEntries,
      notificationDestinations: seed.notificationDestinations,
      providerConnections: seed.providerConnections,
      sourceDocuments: seed.sourceDocuments,
      tasks: [task]
    });
    const report = ownerBurdenReport({
      answerBankEntries: seed.answerBankEntries,
      betaLoopSummary,
      locations: seed.locations,
      referenceTime: new Date("2026-07-12T12:00:00.000Z"),
      sourceDocuments: seed.sourceDocuments,
      tasks: [task],
      taskEvents: [],
      users: seed.users
    });

    expect(report.locationRows.at(-1)).toEqual({
      label: "Unknown location",
      locationId: "unknown_location",
      totalCount: 1,
      unresolvedCount: 1
    });
    expect(JSON.stringify(report.locationRows)).not.toContain(task.requesterContact);
  });
});
