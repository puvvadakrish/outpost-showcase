import { describe, expect, it } from "vitest";
import {
  addDraftTaskNote,
  assignDraftTask,
  changeDraftTaskStatus,
  createDraftManualTask,
  createStaffTaskDraftState,
  staffTaskStorageKey
} from "@/domain/staff-task-draft";
import { STAFF_MANUAL_TASK_CREATED_NOTE, STAFF_TASK_CLAIM_NOTE, STAFF_TASK_RELEASE_NOTE } from "@/domain/tasks";
import { taskEvents, tasks } from "@/domain/seed";

describe("staff task draft helpers", () => {
  const seed = { tasks, taskEvents };

  it("uses tenant-scoped local storage keys", () => {
    expect(staffTaskStorageKey("tenant_acme_fitness")).toBe(
      "outpost:staff-tasks:tenant_acme_fitness:slice3a"
    );
  });

  it("creates cloned local task state from seed data", () => {
    const state = createStaffTaskDraftState(seed, "2026-06-09T12:00:00.000Z");

    expect(state.tasks).toHaveLength(tasks.length);
    expect(state.tasks[0]).not.toBe(tasks[0]);
    expect(state.taskEvents[0]).not.toBe(taskEvents[0]);
    expect(state.updatedAt).toBe("2026-06-09T12:00:00.000Z");
  });

  it("creates a channel-aware local rehearsal task with manual provenance only", () => {
    const state = createStaffTaskDraftState(seed, "2026-06-09T12:00:00.000Z");
    const next = createDraftManualTask(
      state,
      {
        actorUserId: "user_staff_acme",
        channel: "email",
        claimForActor: true,
        confidence: 0.75,
        intent: "  tour  ",
        locationId: "loc_acme_main",
        requesterContact: "  jordan@example.com  ",
        requesterName: "  Jordan Lee  ",
        suggestedNextStep: "  Confirm a tour window.  ",
        summary: "  Asked for a weekday tour.  ",
        taskId: "task_local_email",
        tenantId: "tenant_acme_fitness"
      },
      "2026-06-09T12:05:00.000Z"
    );

    expect(next.tasks[0]).toMatchObject({
      channel: "email",
      id: "task_local_email",
      assigneeUserId: "user_staff_acme",
      requesterName: "Jordan Lee",
      status: "new"
    });
    expect(next.taskEvents[0]).toMatchObject({
      eventType: "created",
      note: STAFF_MANUAL_TASK_CREATED_NOTE,
      taskId: "task_local_email"
    });
    expect(next.taskEvents[1]).toMatchObject({
      eventType: "assigned",
      note: "Task claimed during human-entered intake.",
      taskId: "task_local_email"
    });
    expect(Object.keys(next)).toEqual(["tasks", "taskEvents", "updatedAt"]);
  });

  it("rejects invalid local rehearsal input without changing draft state", () => {
    const state = createStaffTaskDraftState(seed, "2026-06-09T12:00:00.000Z");

    expect(() =>
      createDraftManualTask(state, {
        actorUserId: "user_staff_acme",
        channel: "email",
        confidence: 0.75,
        intent: "tour",
        locationId: "loc_acme_main",
        requesterContact: "jordan@example.com",
        requesterName: " ",
        suggestedNextStep: "Confirm a tour window.",
        summary: "Asked for a weekday tour.",
        taskId: "task_local_invalid",
        tenantId: "tenant_acme_fitness"
      })
    ).toThrow("Requester name is required.");
    expect(state.tasks).toHaveLength(tasks.length);
  });

  it("applies allowed status changes and appends an audit-shaped event", () => {
    const state = createStaffTaskDraftState(seed, "2026-06-09T12:00:00.000Z");
    const next = changeDraftTaskStatus(
      state,
      "tenant_acme_fitness",
      "task_new_tour",
      "in_progress",
      "user_staff_acme",
      "2026-06-09T12:10:00.000Z"
    );

    expect(next.tasks.find((task) => task.id === "task_new_tour")?.status).toBe("in_progress");
    expect(next.taskEvents[0]).toMatchObject({
      taskId: "task_new_tour",
      eventType: "status_changed",
      fromStatus: "new",
      toStatus: "in_progress",
      actorUserId: "user_staff_acme"
    });
    expect(next.updatedAt).toBe("2026-06-09T12:10:00.000Z");
  });

  it("blocks unsupported terminal status changes without appending events", () => {
    const state = createStaffTaskDraftState(seed, "2026-06-09T12:00:00.000Z");
    const next = changeDraftTaskStatus(
      state,
      "tenant_acme_fitness",
      "task_done_hours",
      "in_progress",
      "user_staff_acme",
      "2026-06-09T12:10:00.000Z"
    );

    expect(next).toBe(state);
    expect(next.tasks.find((task) => task.id === "task_done_hours")?.status).toBe("done");
    expect(next.taskEvents).toHaveLength(state.taskEvents.length);
  });

  it("reopens terminal local rehearsal work with a reopened event", () => {
    const state = createStaffTaskDraftState(seed, "2026-06-09T12:00:00.000Z");
    const next = changeDraftTaskStatus(
      state,
      "tenant_acme_fitness",
      "task_done_hours",
      "new",
      "user_staff_acme",
      "2026-06-09T12:10:00.000Z"
    );

    expect(next.tasks.find((task) => task.id === "task_done_hours")?.status).toBe("new");
    expect(next.taskEvents[0]).toMatchObject({
      taskId: "task_done_hours",
      eventType: "reopened",
      fromStatus: "done",
      toStatus: "new"
    });
  });

  it("appends assignment events when assignee changes", () => {
    const state = createStaffTaskDraftState(seed, "2026-06-09T12:00:00.000Z");
    const next = assignDraftTask(
      state,
      "tenant_acme_fitness",
      "task_needs_human_freeze",
      "user_staff_acme",
      "user_owner_acme",
      "2026-06-09T12:15:00.000Z"
    );

    expect(next.tasks.find((task) => task.id === "task_needs_human_freeze")?.assigneeUserId).toBe(
      "user_staff_acme"
    );
    expect(next.taskEvents[0]).toMatchObject({
      taskId: "task_needs_human_freeze",
      actorUserId: "user_owner_acme",
      eventType: "assigned"
    });
  });

  it("records explicit claim activity while assigning the current staff member", () => {
    const state = createStaffTaskDraftState(seed, "2026-06-09T12:00:00.000Z");
    const next = assignDraftTask(
      state,
      "tenant_acme_fitness",
      "task_needs_human_freeze",
      "user_staff_acme",
      "user_staff_acme",
      "2026-06-09T12:16:00.000Z",
      STAFF_TASK_CLAIM_NOTE
    );

    expect(next.tasks.find((task) => task.id === "task_needs_human_freeze")?.assigneeUserId).toBe(
      "user_staff_acme"
    );
    expect(next.taskEvents[0]).toMatchObject({
      actorUserId: "user_staff_acme",
      eventType: "assigned",
      note: STAFF_TASK_CLAIM_NOTE,
      taskId: "task_needs_human_freeze"
    });
  });

  it("records explicit release activity while clearing the current staff member", () => {
    const state = createStaffTaskDraftState(seed, "2026-06-09T12:00:00.000Z");
    const next = assignDraftTask(
      state,
      "tenant_acme_fitness",
      "task_new_tour",
      undefined,
      "user_staff_acme",
      "2026-06-09T12:17:00.000Z",
      STAFF_TASK_RELEASE_NOTE
    );

    expect(next.tasks.find((task) => task.id === "task_new_tour")?.assigneeUserId).toBeUndefined();
    expect(next.taskEvents[0]).toMatchObject({
      actorUserId: "user_staff_acme",
      eventType: "assigned",
      note: STAFF_TASK_RELEASE_NOTE,
      taskId: "task_new_tour"
    });
  });

  it("appends trimmed staff notes as local events", () => {
    const state = createStaffTaskDraftState(seed, "2026-06-09T12:00:00.000Z");
    const next = addDraftTaskNote(
      state,
      "tenant_acme_fitness",
      "task_needs_human_freeze",
      "  Freeze policy needs owner approval.  ",
      "user_staff_acme",
      "2026-06-09T12:20:00.000Z"
    );

    expect(next.taskEvents[0]).toMatchObject({
      taskId: "task_needs_human_freeze",
      actorUserId: "user_staff_acme",
      eventType: "note_added",
      note: "Freeze policy needs owner approval."
    });
  });
});
