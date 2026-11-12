import { describe, expect, it } from "vitest";
import { displayLabel } from "@/domain/formatting";
import { locations, taskEvents, tasks, users } from "@/domain/seed";
import {
  allowedNextTaskStatuses,
  adjacentTaskId,
  canStaffMarkTaskIgnored,
  canStaffMarkTaskNeedsHuman,
  canStaffStartTask,
  buildTaskStatusChangedEvent,
  canTransitionTaskStatus,
  isUnresolvedTask,
  normalizeTaskConfidence,
  resolveTaskSelectionId,
  sortTasksForInbox,
  staffTaskDeepLink,
  taskActivityItemsForTask,
  taskActivityTrailKindForTask,
  taskActivityTrailSummaries,
  taskAgeBucketForTask,
  taskAgeSummaries,
  taskAttentionProfileForTask,
  taskAttentionSummaries,
  taskAssigneeSummaries,
  taskChannelSummaries,
  taskConfidenceBucketForTask,
  taskConfidenceSummaries,
  taskEventsForTask,
  taskForTenant,
  taskIntentKeyForTask,
  taskIntentSummaries,
  taskLastTouchBucketForTask,
  taskLastTouchSummaries,
  taskLocationSummaries,
  taskMemberSystemBoundaryForTask,
  taskMemberSystemBoundarySummaries,
  taskMemberSystemHoldQueue,
  taskOwnerPolicyDependencyForTask,
  taskOwnerPolicyDependencySummaries,
  taskOwnerPolicyReviewQueue,
  taskNextStepKeyForTask,
  taskNextStepSummaries,
  taskPersonalWorkSummary,
  taskFollowUpModeForTask,
  taskFollowUpModeSummaries,
  taskHumanIntakeContributorSummaries,
  taskProofCompletionStateForTask,
  taskProofCompletionSummaries,
  taskProofOriginSummaries,
  taskProofSummary,
  taskQueuePosition,
  taskRequesterContactKindForTask,
  taskRequesterContactSummaries,
  taskQueueStateSummary,
  taskStaffActionLaneForTask,
  taskStaffActionLaneSummaries,
  taskStaffReplyReadyQueue,
  taskStaffClipboardBrief,
  taskStatusSummaries,
  taskSubmittedWorkSummary,
  taskWorkflowStageForTask,
  taskWorkflowStageSummaries,
  tasksForTenant
} from "@/domain/tasks";

describe("task inbox domain helpers", () => {
  it("keeps task records tenant scoped", () => {
    expect(tasksForTenant(tasks, "tenant_acme_fitness")).toHaveLength(tasks.length);
    expect(tasksForTenant(tasks, "tenant_other")).toEqual([]);
  });

  it("looks up a task detail only inside the requested tenant", () => {
    expect(taskForTenant(tasks, "tenant_acme_fitness", "task_new_tour")?.requesterName).toBe(
      "Taylor Morgan"
    );
    expect(taskForTenant(tasks, "tenant_other", "task_new_tour")).toBeUndefined();
  });

  it("filters task events by tenant and task", () => {
    expect(taskEventsForTask(taskEvents, "tenant_acme_fitness", "task_new_tour")).toHaveLength(1);
    expect(taskEventsForTask(taskEvents, "tenant_acme_fitness", "task_done_hours")).toEqual([]);
    expect(taskEventsForTask(taskEvents, "tenant_other", "task_new_tour")).toEqual([]);
  });

  it("projects task events into tenant-scoped activity items", () => {
    const activity = taskActivityItemsForTask(
      [
        {
          actorUserId: "user_staff_acme",
          createdAt: "2026-06-09T11:30:00.000Z",
          eventType: "created",
          id: "event_created",
          locationId: "loc_acme_main",
          note: "Task created from manual intake.",
          taskId: "task_new_tour",
          tenantId: "tenant_acme_fitness"
        },
        {
          actorUserId: "user_owner_acme",
          createdAt: "2026-06-09T11:45:00.000Z",
          eventType: "assigned",
          id: "event_assigned",
          locationId: "loc_acme_main",
          note: "Task assigned to front desk.",
          taskId: "task_new_tour",
          tenantId: "tenant_acme_fitness"
        },
        {
          createdAt: "2026-06-09T11:50:00.000Z",
          eventType: "notification",
          id: "event_notification",
          locationId: "loc_acme_main",
          note: "Notification placeholder.",
          taskId: "task_new_tour",
          tenantId: "tenant_acme_fitness"
        },
        {
          actorUserId: "user_staff_acme",
          createdAt: "2026-06-09T12:10:00.000Z",
          eventType: "note_added",
          id: "event_note",
          locationId: "loc_acme_main",
          note: "Left voicemail.",
          taskId: "task_new_tour",
          tenantId: "tenant_acme_fitness"
        },
        {
          actorUserId: "user_owner_acme",
          createdAt: "2026-06-09T12:00:00.000Z",
          eventType: "status_changed",
          fromStatus: "new",
          id: "event_status",
          locationId: "loc_acme_main",
          note: "Owner moved the task forward.",
          taskId: "task_new_tour",
          tenantId: "tenant_acme_fitness",
          toStatus: "in_progress"
        },
        {
          createdAt: "2026-06-09T12:20:00.000Z",
          eventType: "note_added",
          id: "event_other_tenant",
          locationId: "loc_other",
          note: "Do not leak.",
          taskId: "task_new_tour",
          tenantId: "tenant_other"
        }
      ],
      "tenant_acme_fitness",
      "task_new_tour"
    );

    expect(activity.map((item) => item.id)).toEqual([
      "event_note",
      "event_status",
      "event_notification",
      "event_assigned",
      "event_created"
    ]);
    expect(activity[0]).toMatchObject({
      kind: "note",
      note: "Left voicemail.",
      title: "Staff note"
    });
    expect(activity[1]).toMatchObject({
      detail: "new -> in progress",
      kind: "status",
      title: "Status changed"
    });
    expect(activity[2]).toMatchObject({
      detail: "Notification placeholder.",
      kind: "system",
      title: "notification"
    });
    expect(activity[3]).toMatchObject({
      detail: "Task assigned to front desk.",
      kind: "assignment",
      title: "Assignment changed"
    });
    expect(activity[4]).toMatchObject({
      detail: "Task created from manual intake.",
      kind: "creation",
      title: "Task created"
    });
  });

  it("summarizes task activity trails without creating events", () => {
    const activityTasks = [
      { ...tasks[0], id: "task_staff_activity", status: "new" as const },
      { ...tasks[1], id: "task_source_only", status: "needs_human" as const },
      { ...tasks[2], id: "task_no_trail", status: "done" as const }
    ];
    const activityEvents = [
      {
        actorUserId: "user_staff_acme",
        createdAt: "2026-06-09T11:30:00.000Z",
        eventType: "note_added" as const,
        id: "event_staff_note",
        locationId: "loc_acme_main",
        note: "Left voicemail.",
        taskId: "task_staff_activity",
        tenantId: "tenant_acme_fitness"
      },
      {
        createdAt: "2026-06-09T11:00:00.000Z",
        eventType: "created" as const,
        id: "event_source_created",
        locationId: "loc_acme_main",
        taskId: "task_source_only",
        tenantId: "tenant_acme_fitness"
      },
      {
        createdAt: "2026-06-09T11:05:00.000Z",
        eventType: "source_linked" as const,
        id: "event_source_linked",
        locationId: "loc_other",
        taskId: "task_no_trail",
        tenantId: "tenant_other"
      }
    ];

    expect(taskActivityTrailSummaries(activityTasks, activityEvents)).toEqual([
      {
        count: 1,
        detail: "assigned, status, note, or reopened",
        label: "Staff activity",
        trailKind: "staff_activity",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "created or source-linked",
        label: "Source only",
        trailKind: "source_only",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "no task events yet",
        label: "No trail",
        trailKind: "no_trail",
        unresolvedCount: 0
      }
    ]);
    expect(taskActivityTrailKindForTask(activityTasks[0], activityEvents)).toBe("staff_activity");
    expect(taskActivityTrailKindForTask(activityTasks[1], activityEvents)).toBe("source_only");
    expect(taskActivityTrailKindForTask(activityTasks[2], activityEvents)).toBe("no_trail");
  });

  it("derives answer-review proof context from existing task events", () => {
    const answerTask = {
      ...tasks[0],
      id: "task_answer_hours",
      requesterName: "Owner review",
      requesterContact: "owner seed",
      intent: "Answer follow-up: hours",
      summary:
        'Owner requested staff follow-up for answer "What are your staffed hours?". Current draft: Staffed hours are pending owner approval before live use.',
      suggestedNextStep: "Review this answer-bank item with staff before live use.",
      status: "new" as const
    };
    const proof = taskProofSummary(answerTask, [
      {
        actorUserId: "user_owner_acme",
        createdAt: "2026-06-15T12:00:00.000Z",
        eventType: "created",
        id: "task_event_answer_created",
        locationId: "loc_acme_main",
        note: "Task created from owner answer-bank review item answer_hours.",
        taskId: "task_answer_hours",
        tenantId: "tenant_acme_fitness",
        toStatus: "new"
      }
    ]);

    expect(proof).toMatchObject({
      isComplete: false,
      label: "Answer review proof",
      origin: "answer_review",
      sourceDetail: "Answer review item answer_hours",
      title: "Owner answer review task"
    });
    expect(proof.checklist).toEqual([
      { done: true, label: "Owner review created this staff task" },
      { done: true, label: "Task has an owner" },
      { done: false, label: "Resolve or ignore after staff action" }
    ]);
  });

  it("marks answer-review task proof complete only after terminal staff status", () => {
    const proof = taskProofSummary({
      ...tasks[0],
      requesterName: "Owner review",
      status: "done"
    });

    expect(proof).toMatchObject({
      isComplete: true,
      label: "Proof complete",
      origin: "answer_review"
    });
    expect(proof.checklist.at(-1)).toEqual({ done: true, label: "Task is terminal" });
  });

  it("keeps answer-review task proof ahead of generic manual proof", () => {
    const proof = taskProofSummary({
      ...tasks[0],
      channel: "manual",
      requesterName: "Owner review",
      summary: "Owner requested staff follow-up for answer content.",
      status: "new"
    });

    expect(proof).toMatchObject({
      label: "Answer review proof",
      origin: "answer_review",
      title: "Owner answer review task"
    });
  });

  it("derives manual task proof without treating it as answer-review provenance", () => {
    const proof = taskProofSummary({
      ...tasks[0],
      channel: "manual",
      requesterName: "Front desk",
      summary: "Human entered task.",
      status: "needs_human"
    });

    expect(proof).toMatchObject({
      isComplete: false,
      label: "Manual task proof",
      origin: "manual_intake",
      title: "Manual task proof"
    });
  });

  it("keeps human-entered email channel work under manual provenance", () => {
    const task = {
      ...tasks[0],
      channel: "email" as const,
      id: "task_human_email",
      requesterName: "Front desk",
      summary: "Human entered email follow-up.",
      status: "new" as const
    };
    const proof = taskProofSummary(task, [
      {
        actorUserId: "user_staff_acme",
        createdAt: "2026-07-12T10:00:00.000Z",
        eventType: "created",
        id: "event_human_email",
        locationId: task.locationId,
        note: "Manual task created through Outpost staff workboard.",
        taskId: task.id,
        tenantId: task.tenantId,
        toStatus: "new"
      }
    ]);

    expect(proof).toMatchObject({ origin: "manual_intake", title: "Manual task proof" });
  });

  it("derives seeded provider proof for non-manual local tasks", () => {
    const proof = taskProofSummary({
      ...tasks[0],
      channel: "phone",
      requesterName: "Taylor Morgan",
      summary: "Prospect asked for trial pass.",
      status: "done"
    });

    expect(proof).toMatchObject({
      isComplete: true,
      label: "Seed proof complete",
      origin: "provider_stub",
      title: "Seeded front-desk task"
    });
    expect(proof.checklist.at(-1)).toEqual({ done: true, label: "Task is terminal" });
  });

  it("derives provider replay proof from source-linked backend task events", () => {
    const providerTask = {
      ...tasks[0],
      channel: "email",
      requesterName: "Gym member",
      requesterContact: "Email thread",
      summary: "Member asked staff to freeze an account.",
      status: "needs_human"
    } as const;
    const proof = taskProofSummary(providerTask, [
      {
        createdAt: "2026-07-08T10:00:00.000Z",
        eventType: "source_linked",
        id: "task_event_source_provider",
        locationId: providerTask.locationId,
        note:
          "Provider normalized source: resend.email_received; reference: fixture/tests/fixtures/resend/inbound-gym-freeze-request.json; live providers remain blocked.",
        taskId: providerTask.id,
        tenantId: providerTask.tenantId
      }
    ]);

    expect(proof).toMatchObject({
      detail:
        "Provider-ingested tasks come from sanitized hosted fixture replay only; live phone and email providers remain blocked.",
      isComplete: false,
      label: "Provider replay proof",
      origin: "provider_ingested",
      sourceDetail:
        "resend.email_received · fixture/tests/fixtures/resend/inbound-gym-freeze-request.json",
      title: "Provider-normalized task"
    });
    expect(proof.checklist[0]).toEqual({
      done: true,
      label: "Provider fixture normalized into this staff task"
    });
  });

  it("uses requester contact instead of opaque answer ids for backend answer-review source labels", () => {
    const proof = taskProofSummary(
      {
        ...tasks[0],
        channel: "manual",
        requesterContact: "Manual FAQ source",
        requesterName: "Owner review",
        summary: "Owner requested staff follow-up for answer content.",
        status: "new"
      },
      [
        {
          actorUserId: "user_owner_acme",
          createdAt: "2026-06-15T12:00:00.000Z",
          eventType: "created",
          id: "task_event_answer_created_uuid",
          locationId: "loc_acme_main",
          note: "Task created from owner answer-bank review item 3f2504e0-4f89-41d3-9a0c-0305e82c3301.",
          taskId: tasks[0].id,
          tenantId: "tenant_acme_fitness",
          toStatus: "new"
        }
      ]
    );

    expect(proof.sourceDetail).toBe("Manual FAQ source");
  });

  it("summarizes task proof origins from tasks and source-linked events", () => {
    const manualTask = {
      ...tasks[0],
      channel: "manual",
      id: "task_manual",
      requesterName: "Front desk",
      summary: "Human entered task."
    } as const;
    const answerTask = {
      ...tasks[0],
      id: "task_answer",
      requesterName: "Owner review",
      summary: "Owner requested staff follow-up for answer content."
    } as const;
    const providerTask = {
      ...tasks[0],
      id: "task_provider",
      summary: "Provider replay task."
    } as const;
    const seedTask = {
      ...tasks[0],
      id: "task_seed",
      summary: "Seed task."
    } as const;

    expect(
      taskProofOriginSummaries([manualTask, answerTask, providerTask, seedTask], [
        {
          createdAt: "2026-07-08T10:00:00.000Z",
          eventType: "source_linked",
          id: "task_event_source_provider",
          locationId: providerTask.locationId,
          note:
            "Provider normalized source: retell.call_ended; reference: fixtures/retell/call-ended.json; live providers remain blocked.",
          taskId: providerTask.id,
          tenantId: providerTask.tenantId
        }
      ])
    ).toEqual([
      { count: 1, label: "Owner review", origin: "answer_review", unresolvedCount: 1 },
      { count: 1, label: "Manual intake", origin: "manual_intake", unresolvedCount: 1 },
      { count: 1, label: "Provider replay", origin: "provider_ingested", unresolvedCount: 1 },
      { count: 1, label: "Seed tasks", origin: "provider_stub", unresolvedCount: 1 }
    ]);
  });

  it("summarizes task proof completion from existing proof state", () => {
    const pendingTask = {
      ...tasks[0],
      id: "task_pending_proof",
      status: "needs_human" as const
    };
    const completeTask = {
      ...tasks[1],
      id: "task_complete_proof",
      status: "done" as const
    };

    expect(taskProofCompletionSummaries([pendingTask, completeTask])).toEqual([
      {
        count: 1,
        detail: "needs terminal status",
        label: "Proof pending",
        state: "pending",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "terminal staff work",
        label: "Proof complete",
        state: "complete",
        unresolvedCount: 0
      }
    ]);
    expect(taskProofCompletionStateForTask(pendingTask)).toBe("pending");
    expect(taskProofCompletionStateForTask(completeTask)).toBe("complete");
  });

  it("treats only new, needs human, and in progress as unresolved", () => {
    const unresolved = tasks.filter(isUnresolvedTask);

    expect(unresolved.map((task) => task.status)).toEqual([
      "new",
      "needs_human",
      "in_progress"
    ]);
  });

  it("summarizes open and terminal queue state from existing status semantics", () => {
    expect(taskQueueStateSummary(tasks)).toEqual({
      openCount: 3,
      terminalCount: 2,
      totalCount: 5
    });
  });

  it("summarizes task workflow stages from status and assignment state", () => {
    expect(taskWorkflowStageSummaries(tasks)).toEqual([
      {
        count: 1,
        detail: "needs owner",
        label: "Unassigned intake",
        stage: "unassigned_intake",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "assigned open work",
        label: "Ready for staff",
        stage: "ready_for_staff",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "being handled",
        label: "In progress",
        stage: "in_progress",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "done",
        label: "Completed",
        stage: "completed",
        unresolvedCount: 0
      },
      {
        count: 1,
        detail: "ignored",
        label: "Ignored",
        stage: "ignored",
        unresolvedCount: 0
      }
    ]);
    expect(taskWorkflowStageForTask(tasks[0])).toBe("ready_for_staff");
    expect(taskWorkflowStageForTask(tasks[1])).toBe("unassigned_intake");
    expect(taskWorkflowStageForTask(tasks[2])).toBe("in_progress");
  });

  it("summarizes every required task status", () => {
    expect(taskStatusSummaries(tasks)).toEqual([
      { status: "new", label: "new", count: 1 },
      { status: "needs_human", label: "needs human", count: 1 },
      { status: "in_progress", label: "in progress", count: 1 },
      { status: "done", label: "done", count: 1 },
      { status: "ignored", label: "ignored", count: 1 }
    ]);
  });

  it("summarizes staff tasks by channel with unresolved counts", () => {
    expect(taskChannelSummaries(tasks)).toEqual([
      { channel: "phone", count: 2, label: "phone", unresolvedCount: 2 },
      { channel: "email", count: 3, label: "email", unresolvedCount: 1 },
      { channel: "manual", count: 0, label: "manual", unresolvedCount: 0 }
    ]);
  });

  it("summarizes staff tasks by location with unresolved counts", () => {
    expect(taskLocationSummaries(tasks, locations)).toEqual([
      {
        count: 5,
        label: "Acme Fitness Main",
        locationId: "loc_acme_main",
        unresolvedCount: 3
      }
    ]);
  });

  it("keeps missing task locations visible in summaries", () => {
    expect(
      taskLocationSummaries(
        [{ ...tasks[0], id: "task_unknown_location", locationId: "loc_missing" }],
        locations
      )
    ).toEqual([
      {
        count: 0,
        label: "Acme Fitness Main",
        locationId: "loc_acme_main",
        unresolvedCount: 0
      },
      {
        count: 1,
        label: "Unknown location",
        locationId: "unknown_location",
        unresolvedCount: 1
      }
    ]);
  });

  it("summarizes staff tasks by assignee with unresolved counts", () => {
    expect(taskAssigneeSummaries(tasks, users)).toEqual([
      {
        assigneeUserId: "user_staff_acme",
        count: 1,
        known: true,
        label: "Front Desk",
        unresolvedCount: 1,
        value: "user_staff_acme"
      },
      {
        assigneeUserId: "user_owner_acme",
        count: 1,
        known: true,
        label: "Owner Operator",
        unresolvedCount: 1,
        value: "user_owner_acme"
      },
      {
        count: 3,
        known: true,
        label: "Unassigned",
        unresolvedCount: 1,
        value: "unassigned"
      }
    ]);
  });

  it("summarizes staff tasks by age with unresolved counts", () => {
    const referenceTime = new Date("2026-06-08T16:00:00.000Z");
    const ageTasks = [
      { ...tasks[0], id: "task_fresh", createdAt: "2026-06-08T15:00:00.000Z", status: "new" as const },
      { ...tasks[1], id: "task_waiting", createdAt: "2026-06-07T12:00:00.000Z", status: "needs_human" as const },
      { ...tasks[2], id: "task_stale", createdAt: "2026-06-04T12:00:00.000Z", status: "in_progress" as const },
      { ...tasks[3], id: "task_stale_done", createdAt: "2026-06-04T12:00:00.000Z", status: "done" as const }
    ];

    expect(taskAgeSummaries(ageTasks, referenceTime)).toEqual([
      { ageBucket: "fresh", count: 1, detail: "under 24h", label: "Fresh", unresolvedCount: 1 },
      { ageBucket: "waiting", count: 1, detail: "1-3d old", label: "Waiting", unresolvedCount: 1 },
      { ageBucket: "stale", count: 2, detail: "3d or more", label: "Stale", unresolvedCount: 1 }
    ]);
    expect(taskAgeBucketForTask(ageTasks[0], referenceTime)).toBe("fresh");
    expect(taskAgeBucketForTask(ageTasks[1], referenceTime)).toBe("waiting");
    expect(taskAgeBucketForTask(ageTasks[2], referenceTime)).toBe("stale");
  });

  it("summarizes staff tasks by last touch with unresolved counts", () => {
    const referenceTime = new Date("2026-06-10T12:00:00.000Z");
    const lastTouchTasks = [
      { ...tasks[0], id: "task_fresh_touch", status: "new" as const, updatedAt: "2026-06-10T08:00:00.000Z" },
      { ...tasks[1], id: "task_quiet", status: "needs_human" as const, updatedAt: "2026-06-09T06:00:00.000Z" },
      { ...tasks[2], id: "task_stalled", status: "in_progress" as const, updatedAt: "2026-06-06T06:00:00.000Z" },
      { ...tasks[3], id: "task_stalled_done", status: "done" as const, updatedAt: "2026-06-01T06:00:00.000Z" }
    ];

    expect(taskLastTouchSummaries(lastTouchTasks, referenceTime)).toEqual([
      {
        count: 1,
        detail: "updated under 24h",
        label: "Fresh touch",
        lastTouchBucket: "fresh_touch",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "no update 1-3d",
        label: "Quiet",
        lastTouchBucket: "quiet",
        unresolvedCount: 1
      },
      {
        count: 2,
        detail: "no update 3d+",
        label: "Stalled",
        lastTouchBucket: "stalled",
        unresolvedCount: 1
      }
    ]);
    expect(taskLastTouchBucketForTask(lastTouchTasks[0], referenceTime)).toBe("fresh_touch");
    expect(taskLastTouchBucketForTask(lastTouchTasks[1], referenceTime)).toBe("quiet");
    expect(taskLastTouchBucketForTask(lastTouchTasks[2], referenceTime)).toBe("stalled");
  });

  it("summarizes staff tasks by confidence with unresolved counts", () => {
    const confidenceTasks = [
      { ...tasks[0], id: "task_low", confidence: 0.42, status: "needs_human" as const },
      { ...tasks[1], id: "task_medium", confidence: 0.74, status: "in_progress" as const },
      { ...tasks[2], id: "task_high", confidence: 0.91, status: "new" as const },
      { ...tasks[3], id: "task_high_done", confidence: 1.4, status: "done" as const },
      { ...tasks[4], id: "task_invalid_confidence", confidence: Number.NaN, status: "ignored" as const }
    ];

    expect(taskConfidenceSummaries(confidenceTasks)).toEqual([
      { confidenceBucket: "low", count: 2, detail: "under 70%", label: "Low", unresolvedCount: 1 },
      { confidenceBucket: "medium", count: 1, detail: "70-84%", label: "Medium", unresolvedCount: 1 },
      { confidenceBucket: "high", count: 2, detail: "85%+", label: "High", unresolvedCount: 1 }
    ]);
    expect(taskConfidenceBucketForTask(confidenceTasks[0])).toBe("low");
    expect(taskConfidenceBucketForTask(confidenceTasks[1])).toBe("medium");
    expect(taskConfidenceBucketForTask(confidenceTasks[2])).toBe("high");
    expect(taskConfidenceBucketForTask(confidenceTasks[4])).toBe("low");
  });

  it("summarizes staff tasks by attention level with unresolved counts", () => {
    const referenceTime = new Date("2026-06-10T12:00:00.000Z");
    const attentionTasks = [
      {
        ...tasks[0],
        id: "task_attention",
        confidence: 0.42,
        status: "needs_human" as const,
        createdAt: "2026-06-10T11:00:00.000Z"
      },
      {
        ...tasks[1],
        id: "task_watch",
        confidence: 0.74,
        status: "in_progress" as const,
        createdAt: "2026-06-09T06:00:00.000Z"
      },
      {
        ...tasks[2],
        id: "task_clear_open",
        confidence: 0.92,
        status: "new" as const,
        createdAt: "2026-06-10T10:30:00.000Z"
      },
      {
        ...tasks[3],
        id: "task_clear_terminal",
        confidence: 0.2,
        status: "done" as const,
        createdAt: "2026-06-01T10:30:00.000Z"
      }
    ];

    expect(taskAttentionSummaries(attentionTasks, referenceTime)).toEqual([
      {
        count: 1,
        detail: "human, stale, or low confidence",
        label: "Attention",
        level: "attention",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "waiting or medium confidence",
        label: "Watch",
        level: "watch",
        unresolvedCount: 1
      },
      {
        count: 2,
        detail: "terminal or routine",
        label: "Clear",
        level: "clear",
        unresolvedCount: 1
      }
    ]);
    expect(taskAttentionProfileForTask(attentionTasks[0], referenceTime)).toEqual({
      detail: "human review + low confidence",
      level: "attention",
      reasons: ["human review", "low confidence"]
    });
    expect(taskAttentionProfileForTask(attentionTasks[1], referenceTime)).toEqual({
      detail: "waiting + medium confidence",
      level: "watch",
      reasons: ["waiting", "medium confidence"]
    });
  });

  it("summarizes staff tasks by requester contact kind with unresolved counts", () => {
    const requesterContactTasks = [
      { ...tasks[0], id: "task_email", requesterContact: " member@example.com ", status: "new" as const },
      { ...tasks[1], id: "task_phone", requesterContact: "+1 (555) 010-3333", status: "needs_human" as const },
      { ...tasks[2], id: "task_other", requesterContact: "answer_review_pricing", status: "done" as const }
    ];

    expect(taskRequesterContactSummaries(requesterContactTasks)).toEqual([
      {
        contactKind: "email",
        count: 1,
        detail: "email follow-up",
        label: "Email",
        unresolvedCount: 1
      },
      {
        contactKind: "phone",
        count: 1,
        detail: "phone follow-up",
        label: "Phone",
        unresolvedCount: 1
      },
      {
        contactKind: "other",
        count: 1,
        detail: "manual/reference follow-up",
        label: "Other",
        unresolvedCount: 0
      }
    ]);
    expect(taskRequesterContactKindForTask(requesterContactTasks[0])).toBe("email");
    expect(taskRequesterContactKindForTask(requesterContactTasks[1])).toBe("phone");
    expect(taskRequesterContactKindForTask(requesterContactTasks[2])).toBe("other");
  });

  it("summarizes staff tasks by likely follow-up mode", () => {
    const followUpTasks = [
      { ...tasks[0], id: "task_email_mode", channel: "email" as const, requesterContact: "a@example.com" },
      { ...tasks[1], id: "task_phone_mode", channel: "phone" as const, requesterContact: "not listed" },
      { ...tasks[2], id: "task_manual_mode", channel: "manual" as const, requesterContact: "front desk" },
      { ...tasks[3], id: "task_phone_contact_mode", channel: "email" as const, requesterContact: "(555) 010-1111" },
      { ...tasks[4], id: "task_contact_check_mode", channel: "email" as const, requesterContact: "front desk" }
    ];

    expect(taskFollowUpModeSummaries(followUpTasks)).toEqual([
      {
        count: 2,
        detail: "phone-shaped",
        label: "Phone follow-up",
        mode: "phone_follow_up",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "email-shaped",
        label: "Email follow-up",
        mode: "email_follow_up",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "manual/internal",
        label: "Internal follow-up",
        mode: "internal_follow_up",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "review contact",
        label: "Contact check",
        mode: "contact_check",
        unresolvedCount: 0
      }
    ]);
    expect(taskFollowUpModeForTask(followUpTasks[0])).toBe("email_follow_up");
    expect(taskFollowUpModeForTask(followUpTasks[1])).toBe("phone_follow_up");
    expect(taskFollowUpModeForTask(followUpTasks[2])).toBe("internal_follow_up");
    expect(taskFollowUpModeForTask(followUpTasks[3])).toBe("phone_follow_up");
    expect(taskFollowUpModeForTask(followUpTasks[4])).toBe("contact_check");
  });

  it("summarizes staff tasks by member-system boundary without granting writes", () => {
    const boundaryTasks = [
      {
        ...tasks[0],
        id: "task_member_system_blocked",
        status: "needs_human" as const,
        intent: "Membership freeze request",
        summary: "Prospect asked staff to freeze a member account.",
        suggestedNextStep: "Keep billing and account changes blocked; prepare owner-safe follow-up."
      },
      {
        ...tasks[1],
        id: "task_staff_follow_up_only",
        status: "new" as const,
        intent: "Tour follow-up",
        summary: "Prospect wants staffed hours before visiting.",
        suggestedNextStep: "Call back with owner-approved hours."
      },
      {
        ...tasks[2],
        id: "task_closed_no_write",
        status: "done" as const,
        intent: "Access control question",
        summary: "Door access question was closed by staff.",
        suggestedNextStep: "No member-system write."
      }
    ];

    expect(taskMemberSystemBoundarySummaries(boundaryTasks)).toEqual([
      {
        boundary: "member_system_blocked",
        count: 1,
        detail: "billing, POS, access, or account boundary",
        label: "Member-system blocked",
        unresolvedCount: 1
      },
      {
        boundary: "staff_follow_up_only",
        count: 1,
        detail: "front-desk task only",
        label: "Staff follow-up only",
        unresolvedCount: 1
      },
      {
        boundary: "closed_no_member_write",
        count: 1,
        detail: "terminal without writes",
        label: "Closed no-write",
        unresolvedCount: 0
      }
    ]);
    expect(taskMemberSystemBoundaryForTask(boundaryTasks[0])).toBe("member_system_blocked");
    expect(taskMemberSystemBoundaryForTask(boundaryTasks[1])).toBe("staff_follow_up_only");
    expect(taskMemberSystemBoundaryForTask(boundaryTasks[2])).toBe("closed_no_member_write");
  });

  it("keeps member-system boundary keywords covered", () => {
    const blockedPhrases = [
      "billing question",
      "payment update",
      "POS adjustment",
      "access control issue",
      "member ledger entry",
      "membership change",
      "freeze account",
      "cancel membership",
      "cancellation request",
      "account change",
      "account changes",
      "member account update",
      "door access",
      "key fob replacement",
      "Club Automation lookup"
    ];

    for (const phrase of blockedPhrases) {
      expect(
        taskMemberSystemBoundaryForTask({
          ...tasks[0],
          id: `task_boundary_${phrase.replaceAll(/[^a-z0-9]+/giu, "_")}`,
          status: "new" as const,
          intent: "Boundary review",
          summary: `Prospect asked about ${phrase}.`,
          suggestedNextStep: "Keep member-system writes blocked."
        })
      ).toBe("member_system_blocked");
    }
  });

  it("summarizes staff tasks by owner-policy dependency", () => {
    const policyTasks = [
      {
        ...tasks[0],
        id: "task_owner_policy_needed",
        status: "needs_human" as const,
        intent: "Pricing approval",
        summary: "Prospect asked for owner-approved membership pricing.",
        suggestedNextStep: "Wait for owner policy before replying."
      },
      {
        ...tasks[1],
        id: "task_staff_ready",
        status: "new" as const,
        intent: "Callback request",
        summary: "Prospect wants a tour callback.",
        suggestedNextStep: "Call back with the confirmed hours already in the answer bank."
      },
      {
        ...tasks[2],
        id: "task_closed_policy_done",
        status: "ignored" as const,
        intent: "Freeze policy",
        summary: "Duplicate freeze policy task was closed.",
        suggestedNextStep: "No further policy review."
      }
    ];

    expect(taskOwnerPolicyDependencySummaries(policyTasks)).toEqual([
      {
        count: 1,
        dependency: "owner_policy_needed",
        detail: "owner approval or policy",
        label: "Owner policy needed",
        unresolvedCount: 1
      },
      {
        count: 1,
        dependency: "staff_ready",
        detail: "staff can follow up",
        label: "Staff-ready",
        unresolvedCount: 1
      },
      {
        count: 1,
        dependency: "closed_policy_done",
        detail: "terminal policy state",
        label: "Closed policy done",
        unresolvedCount: 0
      }
    ]);
    expect(taskOwnerPolicyDependencyForTask(policyTasks[0])).toBe("owner_policy_needed");
    expect(taskOwnerPolicyDependencyForTask(policyTasks[1])).toBe("staff_ready");
    expect(taskOwnerPolicyDependencyForTask(policyTasks[2])).toBe("closed_policy_done");
  });

  it("keeps owner-policy dependency keywords covered", () => {
    const policyPhrases = [
      "owner needs to approve",
      "approved answer",
      "approval pending",
      "policy decision",
      "staffed hour change",
      "staffed-hour update",
      "pricing question",
      "price exception",
      "membership policy",
      "freeze request",
      "cancel membership",
      "cancellation terms"
    ];

    for (const phrase of policyPhrases) {
      expect(
        taskOwnerPolicyDependencyForTask({
          ...tasks[0],
          id: `task_policy_${phrase.replaceAll(/[^a-z0-9]+/giu, "_")}`,
          status: "new" as const,
          intent: "Front desk review",
          summary: `Prospect asked about ${phrase}.`,
          suggestedNextStep: "Hold for staff review."
        })
      ).toBe("owner_policy_needed");
    }
  });

  it("summarizes staff tasks by synthesized action lane with safe precedence", () => {
    const laneTasks = [
      {
        ...tasks[0],
        id: "task_lane_member_system",
        status: "needs_human" as const,
        intent: "Membership cancellation policy",
        summary: "Prospect asked staff to cancel a membership.",
        suggestedNextStep: "Keep billing changes blocked."
      },
      {
        ...tasks[1],
        id: "task_lane_owner_policy",
        status: "new" as const,
        intent: "Pricing approval",
        summary: "Prospect asked for owner-approved pricing.",
        suggestedNextStep: "Wait for owner policy before replying."
      },
      {
        ...tasks[2],
        id: "task_lane_staff_ready",
        status: "in_progress" as const,
        intent: "Tour callback",
        summary: "Prospect asked for a tour callback.",
        suggestedNextStep: "Call back with confirmed hours."
      },
      {
        ...tasks[3],
        id: "task_lane_closed",
        status: "done" as const,
        intent: "Membership freeze",
        summary: "Freeze policy task was closed.",
        suggestedNextStep: "No further action."
      }
    ];

    expect(taskStaffActionLaneSummaries(laneTasks)).toEqual([
      {
        count: 1,
        detail: "do not write member systems",
        label: "Member-system hold",
        lane: "member_system_hold",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "needs owner judgment",
        label: "Owner policy review",
        lane: "owner_policy_review",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "staff can follow up",
        label: "Staff reply-ready",
        lane: "staff_reply_ready",
        unresolvedCount: 1
      },
      {
        count: 1,
        detail: "terminal work",
        label: "Closed",
        lane: "closed",
        unresolvedCount: 0
      }
    ]);
    expect(taskStaffActionLaneForTask(laneTasks[0])).toBe("member_system_hold");
    expect(taskStaffActionLaneForTask(laneTasks[1])).toBe("owner_policy_review");
    expect(taskStaffActionLaneForTask(laneTasks[2])).toBe("staff_reply_ready");
    expect(taskStaffActionLaneForTask(laneTasks[3])).toBe("closed");
  });

  it("builds owner-policy review queue from unresolved policy-review lane tasks", () => {
    const queueTasks = [
      {
        ...tasks[0],
        id: "task_policy_newer",
        status: "new" as const,
        createdAt: "2026-07-01T12:00:00.000Z",
        intent: "Pricing approval",
        summary: "Prospect asked for owner-approved pricing.",
        suggestedNextStep: "Owner should confirm pricing before staff reply."
      },
      {
        ...tasks[1],
        id: "task_policy_needs_human",
        status: "needs_human" as const,
        createdAt: "2026-06-30T12:00:00.000Z",
        intent: "Staffed hours policy",
        summary: "Prospect asked about staffed hour policy.",
        suggestedNextStep: "Owner should confirm staffed hours."
      },
      {
        ...tasks[2],
        id: "task_policy_closed",
        status: "done" as const,
        intent: "Pricing approval",
        summary: "Closed owner pricing task.",
        suggestedNextStep: "No action."
      },
      {
        ...tasks[3],
        id: "task_member_hold",
        status: "new" as const,
        intent: "Membership cancellation",
        summary: "Prospect asked staff to cancel a membership.",
        suggestedNextStep: "Keep billing blocked."
      },
      {
        ...tasks[4],
        id: "task_staff_ready",
        status: "new" as const,
        intent: "Tour callback",
        summary: "Prospect asked for a tour callback.",
        suggestedNextStep: "Call back with confirmed hours."
      }
    ];

    expect(taskOwnerPolicyReviewQueue(queueTasks)).toEqual([
      {
        intent: "Staffed hours policy",
        requesterName: queueTasks[1].requesterName,
        suggestedNextStep: "Owner should confirm staffed hours.",
        taskId: "task_policy_needs_human"
      },
      {
        intent: "Pricing approval",
        requesterName: queueTasks[0].requesterName,
        suggestedNextStep: "Owner should confirm pricing before staff reply.",
        taskId: "task_policy_newer"
      }
    ]);
    expect(taskOwnerPolicyReviewQueue(queueTasks, 1)).toHaveLength(1);
    expect(taskOwnerPolicyReviewQueue(queueTasks, 0)).toEqual([]);
  });

  it("builds staff reply-ready queue from unresolved staff-ready lane tasks", () => {
    const queueTasks = [
      {
        ...tasks[0],
        id: "task_staff_ready_newer",
        status: "new" as const,
        createdAt: "2026-07-01T12:00:00.000Z",
        intent: "Tour callback",
        summary: "Prospect asked for a tour callback.",
        suggestedNextStep: "Call back with confirmed hours."
      },
      {
        ...tasks[1],
        id: "task_staff_ready_needs_human",
        status: "needs_human" as const,
        createdAt: "2026-06-30T12:00:00.000Z",
        intent: "Guest pass follow-up",
        summary: "Prospect asked for a guest pass callback.",
        suggestedNextStep: "Reply with the guest pass details."
      },
      {
        ...tasks[2],
        id: "task_staff_ready_closed",
        status: "done" as const,
        intent: "Tour callback",
        summary: "Closed tour follow-up.",
        suggestedNextStep: "No action."
      },
      {
        ...tasks[2],
        id: "task_staff_ready_in_progress",
        status: "in_progress" as const,
        createdAt: "2026-06-29T12:00:00.000Z",
        intent: "Training callback",
        summary: "Prospect is waiting for a training callback.",
        suggestedNextStep: "Call back with training availability."
      },
      {
        ...tasks[4],
        id: "task_staff_ready_ignored",
        status: "ignored" as const,
        intent: "Duplicate callback",
        summary: "Duplicate callback task.",
        suggestedNextStep: "No action."
      },
      {
        ...tasks[3],
        id: "task_member_hold",
        status: "new" as const,
        intent: "Membership cancellation",
        summary: "Prospect asked staff to cancel a membership.",
        suggestedNextStep: "Keep billing blocked."
      },
      {
        ...tasks[4],
        id: "task_owner_policy",
        status: "new" as const,
        intent: "Pricing approval",
        summary: "Prospect asked for owner-approved pricing.",
        suggestedNextStep: "Owner should confirm pricing."
      }
    ];

    expect(taskStaffReplyReadyQueue(queueTasks)).toEqual([
      {
        intent: "Guest pass follow-up",
        requesterName: queueTasks[1].requesterName,
        suggestedNextStep: "Reply with the guest pass details.",
        taskId: "task_staff_ready_needs_human"
      },
      {
        intent: "Tour callback",
        requesterName: queueTasks[0].requesterName,
        suggestedNextStep: "Call back with confirmed hours.",
        taskId: "task_staff_ready_newer"
      },
      {
        intent: "Training callback",
        requesterName: queueTasks[3].requesterName,
        suggestedNextStep: "Call back with training availability.",
        taskId: "task_staff_ready_in_progress"
      }
    ]);
    expect(taskStaffReplyReadyQueue(queueTasks, 1)).toHaveLength(1);
    expect(taskStaffReplyReadyQueue(queueTasks, 0)).toEqual([]);
  });

  it("builds member-system hold queue from unresolved member-system tasks", () => {
    const queueTasks = [
      {
        ...tasks[0],
        id: "task_member_hold_newer",
        status: "new" as const,
        createdAt: "2026-07-01T12:00:00.000Z",
        intent: "Door access",
        summary: "Member asked staff to change door access.",
        suggestedNextStep: "Keep access-control writes blocked."
      },
      {
        ...tasks[1],
        id: "task_member_hold_needs_human",
        status: "needs_human" as const,
        createdAt: "2026-06-30T12:00:00.000Z",
        intent: "Owner-approved membership cancellation",
        summary: "Member asked staff to cancel a membership with owner approval.",
        suggestedNextStep: "Explain the no-write boundary."
      },
      {
        ...tasks[2],
        id: "task_member_hold_in_progress",
        status: "in_progress" as const,
        createdAt: "2026-06-29T12:00:00.000Z",
        intent: "Payment update",
        summary: "Member asked staff to update a payment method.",
        suggestedNextStep: "Keep billing writes blocked."
      },
      {
        ...tasks[3],
        id: "task_member_hold_closed",
        status: "done" as const,
        intent: "Owner-approved membership cancellation",
        summary: "Closed cancellation request.",
        suggestedNextStep: "No action."
      },
      {
        ...tasks[4],
        id: "task_member_hold_ignored",
        status: "ignored" as const,
        intent: "Duplicate billing request",
        summary: "Duplicate billing request.",
        suggestedNextStep: "No action."
      },
      {
        ...tasks[0],
        id: "task_owner_policy",
        status: "new" as const,
        intent: "Pricing approval",
        summary: "Prospect asked for owner-approved pricing.",
        suggestedNextStep: "Owner should confirm pricing."
      },
      {
        ...tasks[2],
        id: "task_staff_ready",
        status: "new" as const,
        intent: "Training callback",
        summary: "Prospect asked for a training callback.",
        suggestedNextStep: "Call back with training availability."
      }
    ];

    expect(taskMemberSystemHoldQueue(queueTasks)).toEqual([
      {
        intent: "Owner-approved membership cancellation",
        requesterName: queueTasks[1].requesterName,
        suggestedNextStep: "Explain the no-write boundary.",
        taskId: "task_member_hold_needs_human"
      },
      {
        intent: "Door access",
        requesterName: queueTasks[0].requesterName,
        suggestedNextStep: "Keep access-control writes blocked.",
        taskId: "task_member_hold_newer"
      },
      {
        intent: "Payment update",
        requesterName: queueTasks[2].requesterName,
        suggestedNextStep: "Keep billing writes blocked.",
        taskId: "task_member_hold_in_progress"
      }
    ]);
    expect(taskMemberSystemHoldQueue(queueTasks, 1)).toHaveLength(1);
    expect(taskMemberSystemHoldQueue(queueTasks, 0)).toEqual([]);
  });

  it("summarizes staff tasks by normalized intent with unresolved counts", () => {
    const intentTasks = [
      { ...tasks[0], id: "task_tour_1", intent: "tour", status: "needs_human" as const },
      { ...tasks[1], id: "task_tour_2", intent: " Tour  ", status: "done" as const },
      { ...tasks[2], id: "task_freeze", intent: "membership freeze", status: "new" as const },
      { ...tasks[3], id: "task_blank", intent: "   ", status: "in_progress" as const },
      {
        ...tasks[4],
        id: "task_long_intent",
        intent: "this is a very long free-form customer request intent label",
        status: "ignored" as const
      }
    ];

    expect(taskIntentSummaries(intentTasks)).toEqual([
      {
        count: 2,
        fullLabel: "tour",
        intentKey: "intent:tour",
        intentKeys: ["intent:tour"],
        label: "tour",
        unresolvedCount: 1
      },
      {
        count: 1,
        fullLabel: "membership freeze",
        intentKey: "intent:membership freeze",
        intentKeys: ["intent:membership freeze"],
        label: "membership freeze",
        unresolvedCount: 1
      },
      {
        count: 1,
        fullLabel: "Unknown intent",
        intentKey: "__unknown_intent",
        intentKeys: ["__unknown_intent"],
        label: "Unknown intent",
        unresolvedCount: 1
      },
      {
        count: 1,
        fullLabel: "this is a very long free-form customer request intent label",
        intentKey: "intent:this is a very long free-form customer request intent label",
        intentKeys: ["intent:this is a very long free-form customer request intent label"],
        label: "this is a very long free-form customer...",
        unresolvedCount: 0
      }
    ]);
    expect(taskIntentKeyForTask(intentTasks[1])).toBe("intent:tour");
    expect(taskIntentKeyForTask(intentTasks[3])).toBe("__unknown_intent");
  });

  it("rolls lower-ranked task intents into an other bucket", () => {
    const intentTasks = [
      { ...tasks[0], id: "task_tour", intent: "tour", status: "needs_human" as const },
      { ...tasks[1], id: "task_freeze", intent: "membership freeze", status: "new" as const },
      { ...tasks[2], id: "task_callback", intent: "callback", status: "in_progress" as const },
      { ...tasks[3], id: "task_hours", intent: "hours", status: "done" as const },
      { ...tasks[4], id: "task_duplicate", intent: "duplicate", status: "ignored" as const }
    ];

    expect(taskIntentSummaries(intentTasks, 4)).toEqual([
      {
        count: 1,
        fullLabel: "callback",
        intentKey: "intent:callback",
        intentKeys: ["intent:callback"],
        label: "callback",
        unresolvedCount: 1
      },
      {
        count: 1,
        fullLabel: "membership freeze",
        intentKey: "intent:membership freeze",
        intentKeys: ["intent:membership freeze"],
        label: "membership freeze",
        unresolvedCount: 1
      },
      {
        count: 1,
        fullLabel: "tour",
        intentKey: "intent:tour",
        intentKeys: ["intent:tour"],
        label: "tour",
        unresolvedCount: 1
      },
      {
        count: 2,
        fullLabel: "Other intents",
        intentKey: "__other_intents",
        intentKeys: ["intent:duplicate", "intent:hours"],
        label: "Other intents",
        unresolvedCount: 0
      }
    ]);
  });

  it("keeps long task intent labels visually distinguishable after truncation", () => {
    const intentTasks = [
      {
        ...tasks[0],
        id: "task_relocation_paperwork",
        intent: "membership freeze billing question about relocation paperwork",
        status: "needs_human" as const
      },
      {
        ...tasks[1],
        id: "task_relocation_timing",
        intent: "membership freeze billing question about relocation timing",
        status: "new" as const
      }
    ];

    expect(taskIntentSummaries(intentTasks)).toEqual([
      {
        count: 1,
        fullLabel: "membership freeze billing question about relocation paperwork",
        intentKey: "intent:membership freeze billing question about relocation paperwork",
        intentKeys: ["intent:membership freeze billing question about relocation paperwork"],
        label: "membership freeze billing question abou #1",
        unresolvedCount: 1
      },
      {
        count: 1,
        fullLabel: "membership freeze billing question about relocation timing",
        intentKey: "intent:membership freeze billing question about relocation timing",
        intentKeys: ["intent:membership freeze billing question about relocation timing"],
        label: "membership freeze billing question abou #2",
        unresolvedCount: 1
      }
    ]);
  });

  it("summarizes staff tasks by normalized suggested next step with unresolved counts", () => {
    const nextStepTasks = [
      {
        ...tasks[0],
        id: "task_call_1",
        status: "needs_human" as const,
        suggestedNextStep: "Call member"
      },
      {
        ...tasks[1],
        id: "task_call_2",
        status: "done" as const,
        suggestedNextStep: " call   member "
      },
      {
        ...tasks[2],
        id: "task_email",
        status: "new" as const,
        suggestedNextStep: "Email owner for approval"
      },
      {
        ...tasks[3],
        id: "task_blank",
        status: "in_progress" as const,
        suggestedNextStep: "   "
      },
      {
        ...tasks[4],
        id: "task_long_next_step",
        status: "ignored" as const,
        suggestedNextStep: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNO"
      }
    ];

    expect(taskNextStepSummaries(nextStepTasks)).toEqual([
      {
        count: 2,
        fullLabel: "Call member",
        label: "Call member",
        nextStepKey: "next_step:call member",
        nextStepKeys: ["next_step:call member"],
        unresolvedCount: 1
      },
      {
        count: 1,
        fullLabel: "Email owner for approval",
        label: "Email owner for approval",
        nextStepKey: "next_step:email owner for approval",
        nextStepKeys: ["next_step:email owner for approval"],
        unresolvedCount: 1
      },
      {
        count: 1,
        fullLabel: "Unknown next step",
        label: "Unknown next step",
        nextStepKey: "__unknown_next_step",
        nextStepKeys: ["__unknown_next_step"],
        unresolvedCount: 1
      },
      {
        count: 1,
        fullLabel: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNO",
        label: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG...",
        nextStepKey: "next_step:abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmno",
        nextStepKeys: ["next_step:abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmno"],
        unresolvedCount: 0
      }
    ]);
    expect(taskNextStepKeyForTask(nextStepTasks[1])).toBe("next_step:call member");
    expect(taskNextStepKeyForTask(nextStepTasks[3])).toBe("__unknown_next_step");
  });

  it("rolls lower-ranked task next steps into an other bucket", () => {
    const nextStepTasks = [
      { ...tasks[0], id: "task_call", status: "needs_human" as const, suggestedNextStep: "Call" },
      { ...tasks[1], id: "task_email", status: "new" as const, suggestedNextStep: "Email" },
      { ...tasks[2], id: "task_review", status: "in_progress" as const, suggestedNextStep: "Review" },
      { ...tasks[3], id: "task_file", status: "done" as const, suggestedNextStep: "File" },
      { ...tasks[4], id: "task_ignore", status: "ignored" as const, suggestedNextStep: "Ignore" }
    ];

    expect(taskNextStepSummaries(nextStepTasks, 4)).toEqual([
      {
        count: 1,
        fullLabel: "Call",
        label: "Call",
        nextStepKey: "next_step:call",
        nextStepKeys: ["next_step:call"],
        unresolvedCount: 1
      },
      {
        count: 1,
        fullLabel: "Email",
        label: "Email",
        nextStepKey: "next_step:email",
        nextStepKeys: ["next_step:email"],
        unresolvedCount: 1
      },
      {
        count: 1,
        fullLabel: "Review",
        label: "Review",
        nextStepKey: "next_step:review",
        nextStepKeys: ["next_step:review"],
        unresolvedCount: 1
      },
      {
        count: 2,
        fullLabel: "Other next steps",
        label: "Other next steps",
        nextStepKey: "__other_next_steps",
        nextStepKeys: ["next_step:file", "next_step:ignore"],
        unresolvedCount: 0
      }
    ]);
  });

  it("keeps long task next-step labels visually distinguishable after truncation", () => {
    const nextStepTasks = [
      {
        ...tasks[0],
        id: "task_relocation_paperwork",
        status: "needs_human" as const,
        suggestedNextStep: "membership freeze billing question about relocation paperwork"
      },
      {
        ...tasks[1],
        id: "task_relocation_timing",
        status: "new" as const,
        suggestedNextStep: "membership freeze billing question about relocation timing"
      }
    ];

    expect(taskNextStepSummaries(nextStepTasks)).toEqual([
      {
        count: 1,
        fullLabel: "membership freeze billing question about relocation paperwork",
        label: "membership freeze billing question about re #1",
        nextStepKey: "next_step:membership freeze billing question about relocation paperwork",
        nextStepKeys: ["next_step:membership freeze billing question about relocation paperwork"],
        unresolvedCount: 1
      },
      {
        count: 1,
        fullLabel: "membership freeze billing question about relocation timing",
        label: "membership freeze billing question about re #2",
        nextStepKey: "next_step:membership freeze billing question about relocation timing",
        nextStepKeys: ["next_step:membership freeze billing question about relocation timing"],
        unresolvedCount: 1
      }
    ]);
  });

  it("keeps missing task assignees visible in summaries", () => {
    expect(
      taskAssigneeSummaries(
        [{ ...tasks[0], id: "task_unknown_assignee", assigneeUserId: "user_missing" }],
        users
      )
    ).toEqual([
      {
        assigneeUserId: "user_missing",
        count: 1,
        known: false,
        label: "Unknown assignee",
        unresolvedCount: 1,
        value: "user_missing"
      }
    ]);
  });

  it("sorts needs-human work before routine new tasks", () => {
    expect(sortTasksForInbox(tasks).map((task) => task.status).slice(0, 3)).toEqual([
      "needs_human",
      "new",
      "in_progress"
    ]);
  });

  it("summarizes only the selected staff member's assigned work", () => {
    const staffTerminalTask = {
      ...tasks[3],
      assigneeUserId: "user_staff_acme",
      id: "task_staff_terminal"
    };
    const staffNeedsHumanTask = {
      ...tasks[1],
      assigneeUserId: "user_staff_acme",
      id: "task_staff_needs_human"
    };
    const staffIgnoredTask = {
      ...tasks[4],
      assigneeUserId: "user_staff_acme",
      id: "task_staff_ignored"
    };

    expect(
      taskPersonalWorkSummary(
        [...tasks, staffTerminalTask, staffNeedsHumanTask, staffIgnoredTask],
        "user_staff_acme"
      )
    ).toEqual({
      activeCount: 0,
      completedCount: 1,
      ignoredCount: 1,
      needsHumanCount: 1,
      openCount: 2,
      readyCount: 1,
      totalCount: 4
    });
    expect(taskPersonalWorkSummary(tasks, "user_owner_acme")).toEqual({
      activeCount: 1,
      completedCount: 0,
      ignoredCount: 0,
      needsHumanCount: 0,
      openCount: 1,
      readyCount: 0,
      totalCount: 1
    });
    expect(taskPersonalWorkSummary(tasks, "user_missing")).toEqual({
      activeCount: 0,
      completedCount: 0,
      ignoredCount: 0,
      needsHumanCount: 0,
      openCount: 0,
      readyCount: 0,
      totalCount: 0
    });
    expect(taskPersonalWorkSummary(tasks, undefined)).toEqual({
      activeCount: 0,
      completedCount: 0,
      ignoredCount: 0,
      needsHumanCount: 0,
      openCount: 0,
      readyCount: 0,
      totalCount: 0
    });
  });

  it("summarizes human intake submitted by the selected staff actor", () => {
    const openTask = { ...tasks[0], id: "task_submitted_open", status: "new" as const };
    const terminalTask = { ...tasks[3], id: "task_submitted_done", status: "done" as const };
    const otherTask = { ...tasks[1], id: "task_submitted_other" };
    const submittedEvents = [
      {
        actorUserId: "user_staff_acme",
        createdAt: "2026-07-12T10:00:00.000Z",
        eventType: "created" as const,
        id: "event_submitted_open",
        locationId: openTask.locationId,
        note: "Manual task created through Outpost staff workboard.",
        taskId: openTask.id,
        tenantId: openTask.tenantId,
        toStatus: "new" as const
      },
      {
        actorUserId: "user_staff_acme",
        createdAt: "2026-07-12T10:01:00.000Z",
        eventType: "created" as const,
        id: "event_submitted_done",
        locationId: terminalTask.locationId,
        note: "Manual task created through Outpost staff workboard.",
        taskId: terminalTask.id,
        tenantId: terminalTask.tenantId,
        toStatus: "new" as const
      },
      {
        actorUserId: "user_owner_acme",
        createdAt: "2026-07-12T10:02:00.000Z",
        eventType: "created" as const,
        id: "event_submitted_other",
        locationId: otherTask.locationId,
        note: "Manual task created through Outpost staff workboard.",
        taskId: otherTask.id,
        tenantId: otherTask.tenantId,
        toStatus: "new" as const
      },
      {
        actorUserId: "user_staff_acme",
        createdAt: "2026-07-12T10:03:00.000Z",
        eventType: "created" as const,
        id: "event_submitted_foreign_tenant",
        locationId: openTask.locationId,
        note: "Manual task created through Outpost staff workboard.",
        taskId: otherTask.id,
        tenantId: "tenant_other",
        toStatus: "new" as const
      }
    ];

    expect(
      taskSubmittedWorkSummary(
        [openTask, terminalTask, otherTask],
        submittedEvents,
        "user_staff_acme"
      )
    ).toEqual({
      taskIds: [openTask.id, terminalTask.id],
      totalCount: 2,
      unresolvedCount: 1
    });
    expect(taskSubmittedWorkSummary([openTask], submittedEvents, undefined)).toEqual({
      taskIds: [],
      totalCount: 0,
      unresolvedCount: 0
    });
  });

  it("summarizes human intake contribution without ranking or dropping unknown actors", () => {
    const openTask = { ...tasks[0], id: "task_contributor_open", status: "new" as const };
    const doneTask = { ...tasks[3], id: "task_contributor_done", status: "done" as const };
    const unknownTask = { ...tasks[1], id: "task_contributor_unknown", status: "new" as const };
    const missingUserTask = { ...tasks[2], id: "task_contributor_missing_user", status: "new" as const };
    const createdEvent = (task: (typeof tasks)[number], id: string, actorUserId?: string) => ({
      actorUserId,
      createdAt: "2026-07-12T10:00:00.000Z",
      eventType: "created" as const,
      id,
      locationId: task.locationId,
      note: "Manual task created through Outpost staff workboard.",
      taskId: task.id,
      tenantId: task.tenantId,
      toStatus: "new" as const
    });
    const events = [
      createdEvent(openTask, "event_contributor_open", "user_staff_acme"),
      {
        ...createdEvent(openTask, "event_contributor_open_duplicate", "user_owner_acme"),
        createdAt: "2026-07-12T10:05:00.000Z"
      },
      createdEvent(doneTask, "event_contributor_done", "user_staff_acme"),
      createdEvent(unknownTask, "event_contributor_unknown"),
      createdEvent(missingUserTask, "event_contributor_missing_user", "user_missing")
    ];

    expect(
      taskHumanIntakeContributorSummaries(
        [openTask, doneTask, unknownTask, missingUserTask],
        events,
        users
      )
    ).toEqual([
      {
        actorUserId: "user_staff_acme",
        known: true,
        label: "Front Desk",
        resolvedCount: 1,
        totalCount: 2,
        unresolvedCount: 1
      },
      {
        actorUserId: undefined,
        known: false,
        label: "Unknown staff",
        resolvedCount: 0,
        totalCount: 2,
        unresolvedCount: 2
      }
    ]);
  });

  it("allows current staff to start only assigned new or needs-human work", () => {
    const newTask = tasks.find((task) => task.id === "task_new_tour")!;
    const needsHumanTask = {
      ...tasks.find((task) => task.id === "task_needs_human_freeze")!,
      assigneeUserId: "user_staff_acme"
    };

    expect(canStaffStartTask(newTask, "user_staff_acme")).toBe(true);
    expect(canStaffStartTask(needsHumanTask, "user_staff_acme")).toBe(true);
    expect(canStaffStartTask({ ...newTask, status: "in_progress" }, "user_staff_acme")).toBe(false);
    expect(canStaffStartTask(newTask, "user_owner_acme")).toBe(false);
    expect(canStaffStartTask({ ...newTask, assigneeUserId: undefined }, "user_staff_acme")).toBe(false);
    expect(canStaffStartTask(newTask, undefined)).toBe(false);
  });

  it("allows current staff to mark only assigned active work needs human", () => {
    const activeTask = {
      ...tasks.find((task) => task.id === "task_new_tour")!,
      status: "in_progress" as const
    };

    expect(canStaffMarkTaskNeedsHuman(activeTask, "user_staff_acme")).toBe(true);
    expect(canStaffMarkTaskNeedsHuman({ ...activeTask, status: "new" }, "user_staff_acme")).toBe(false);
    expect(canStaffMarkTaskNeedsHuman(activeTask, "user_owner_acme")).toBe(false);
    expect(canStaffMarkTaskNeedsHuman({ ...activeTask, assigneeUserId: undefined }, "user_staff_acme")).toBe(false);
    expect(canStaffMarkTaskNeedsHuman(activeTask, undefined)).toBe(false);
  });

  it("allows current staff to ignore only assigned active work", () => {
    const activeTask = {
      ...tasks.find((task) => task.id === "task_new_tour")!,
      status: "in_progress" as const
    };

    expect(canStaffMarkTaskIgnored(activeTask, "user_staff_acme")).toBe(true);
    expect(canStaffMarkTaskIgnored({ ...activeTask, status: "new" }, "user_staff_acme")).toBe(false);
    expect(canStaffMarkTaskIgnored(activeTask, "user_owner_acme")).toBe(false);
    expect(canStaffMarkTaskIgnored({ ...activeTask, assigneeUserId: undefined }, "user_staff_acme")).toBe(false);
    expect(canStaffMarkTaskIgnored(activeTask, undefined)).toBe(false);
  });

  it("uses newest createdAt first when inbox priorities match", () => {
    const older = { ...tasks[0], id: "task_same_priority_older", createdAt: "2026-06-08T10:00:00.000Z" };
    const newer = { ...tasks[0], id: "task_same_priority_newer", createdAt: "2026-06-08T11:00:00.000Z" };

    expect(sortTasksForInbox([older, newer]).map((task) => task.id)).toEqual([
      "task_same_priority_newer",
      "task_same_priority_older"
    ]);
  });

  it("resolves requested task selection only inside the provided task set", () => {
    expect(resolveTaskSelectionId(tasks, "task_in_progress_callback")).toBe(
      "task_in_progress_callback"
    );
    expect(resolveTaskSelectionId(tasks)).toBe("task_needs_human_freeze");
    expect(resolveTaskSelectionId(tasks, "")).toBe("task_needs_human_freeze");
    expect(resolveTaskSelectionId(tasks, "task_unknown")).toBe("task_needs_human_freeze");
    expect(
      resolveTaskSelectionId(
        tasks.filter((task) => task.tenantId === "tenant_acme_fitness"),
        "task_other_tenant"
      )
    ).toBe("task_needs_human_freeze");
    expect(resolveTaskSelectionId([], "task_in_progress_callback")).toBeUndefined();
  });

  it("reports selected position inside the provided visible queue", () => {
    const visibleTasks = sortTasksForInbox(tasks).slice(0, 3);

    expect(taskQueuePosition(visibleTasks, visibleTasks[1]?.id)).toEqual({
      current: 2,
      total: 3
    });
    expect(taskQueuePosition(visibleTasks, "task_not_visible")).toEqual({
      current: 0,
      total: 3
    });
    expect(taskQueuePosition([], undefined)).toEqual({ current: 0, total: 0 });
  });

  it("resolves bounded adjacent tasks inside the provided queue", () => {
    const visibleTasks = sortTasksForInbox(tasks).slice(0, 3);

    expect(adjacentTaskId(visibleTasks, visibleTasks[1]?.id, "previous")).toBe(
      visibleTasks[0]?.id
    );
    expect(adjacentTaskId(visibleTasks, visibleTasks[1]?.id, "next")).toBe(
      visibleTasks[2]?.id
    );
    expect(adjacentTaskId(visibleTasks, visibleTasks[0]?.id, "previous")).toBeUndefined();
    expect(adjacentTaskId(visibleTasks, visibleTasks[2]?.id, "next")).toBeUndefined();
    expect(adjacentTaskId(visibleTasks, "task_not_visible", "next")).toBeUndefined();
    expect(adjacentTaskId([], undefined, "next")).toBeUndefined();
  });

  it("builds privacy-minimal encoded staff task links", () => {
    expect(staffTaskDeepLink("https://preview.example/app", "task id?#")).toBe(
      "https://preview.example/staff/tasks?taskId=task+id%3F%23"
    );
  });

  it("builds a whitespace-normalized privacy-bounded staff task brief", () => {
    const task = {
      ...tasks[0],
      assigneeUserId: "user_internal_secret",
      channel: "phone" as const,
      id: "task_internal_secret",
      intent: "  membership\n freeze  ",
      requesterContact: "  (555) 010-3333  ",
      requesterName: " Jordan   Lee ",
      summary: " Member asked about\nfreezing for travel. ",
      suggestedNextStep: " Explain the approved\tfreeze process. ",
      tenantId: "tenant_internal_secret"
    };

    expect(taskStaffClipboardBrief(task)).toBe(
      [
        "Requester: Jordan Lee",
        "Contact: (555) 010-3333",
        "Channel: Phone",
        "Intent: membership freeze",
        "Summary: Member asked about freezing for travel.",
        "Next step: Explain the approved freeze process."
      ].join("\n")
    );
    expect(taskStaffClipboardBrief(task)).not.toContain("internal_secret");
    expect(taskStaffClipboardBrief(task)).not.toContain("Confidence");
    expect(taskStaffClipboardBrief(task)).not.toContain("Proof");
  });

  it("uses explicit fallbacks for blank staff task brief fields", () => {
    const task = {
      ...tasks[0],
      intent: " \n ",
      requesterContact: "\t",
      requesterName: " ",
      summary: "",
      suggestedNextStep: "  "
    };

    expect(taskStaffClipboardBrief(task)).toBe(
      [
        "Requester: Unknown requester",
        "Contact: Not provided",
        "Channel: Email",
        "Intent: Not provided",
        "Summary: Not provided",
        "Next step: Not provided"
      ].join("\n")
    );
  });

  it("keeps done and ignored terminal unless a future audited reopen is added", () => {
    expect(canTransitionTaskStatus("new", "needs_human")).toBe(true);
    expect(canTransitionTaskStatus("needs_human", "in_progress")).toBe(true);
    expect(canTransitionTaskStatus("in_progress", "done")).toBe(true);
    expect(canTransitionTaskStatus("done", "new")).toBe(true);
    expect(canTransitionTaskStatus("ignored", "new")).toBe(true);
    expect(canTransitionTaskStatus("ignored", "in_progress")).toBe(false);
  });

  it("does not treat no-op status saves as invalid transitions", () => {
    expect(canTransitionTaskStatus("done", "done")).toBe(true);
  });

  it("exposes only new as the audited terminal recovery status", () => {
    expect(allowedNextTaskStatuses("done")).toEqual(["new"]);
    expect(allowedNextTaskStatuses("ignored")).toEqual(["new"]);
  });

  it("builds a distinct reopened event for terminal recovery", () => {
    const task = tasks.find((candidate) => candidate.status === "done")!;
    expect(buildTaskStatusChangedEvent(task, "new", "user_staff_acme", "2026-07-11T12:00:00.000Z"))
      .toMatchObject({ eventType: "reopened", fromStatus: "done", toStatus: "new" });
  });

  it("builds status changed events for allowed transitions", () => {
    const event = buildTaskStatusChangedEvent(
      tasks.find((task) => task.id === "task_new_tour")!,
      "in_progress",
      "user_staff_acme",
      "2026-06-09T12:00:00.000Z"
    );

    expect(event).toMatchObject({
      tenantId: "tenant_acme_fitness",
      taskId: "task_new_tour",
      actorUserId: "user_staff_acme",
      eventType: "status_changed",
      fromStatus: "new",
      toStatus: "in_progress"
    });
  });

  it("does not build status events for unsupported terminal transitions", () => {
    expect(
      buildTaskStatusChangedEvent(
        tasks.find((task) => task.id === "task_done_hours")!,
        "in_progress",
        "user_staff_acme"
      )
    ).toBeUndefined();
  });

  it("clamps confidence before rendering percentages", () => {
    expect(normalizeTaskConfidence(-0.2)).toBe(0);
    expect(normalizeTaskConfidence(0.42)).toBe(0.42);
    expect(normalizeTaskConfidence(1.4)).toBe(1);
    expect(normalizeTaskConfidence(Number.NaN)).toBe(0);
  });

  it("formats enum-like values for human-facing labels", () => {
    expect(displayLabel("not_configured")).toBe("Not configured");
    expect(displayLabel("phone")).toBe("Phone");
    expect(displayLabel("needs_human")).toBe("Needs human");
  });
});
