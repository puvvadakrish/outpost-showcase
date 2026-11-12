import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addTaskNote: vi.fn(),
  revalidatePath: vi.fn(),
  resolveMembershipSession: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/application/tasks/service", () => ({
  TaskApplicationService: class {
    addTaskNote = mocks.addTaskNote;
  }
}));
vi.mock("@/infrastructure/neon/task-repository", () => ({
  NeonTaskRepository: class {}
}));
vi.mock("@/server/neon/env", () => ({ isNeonConfigured: () => true }));
vi.mock("@/server/neon/server-client", () => ({
  createOutpostServerNeonClient: async () => ({})
}));
vi.mock("@/server/session-context", () => ({
  resolveMembershipSession: mocks.resolveMembershipSession
}));

import { addTaskNoteAction } from "@/app/staff/tasks/actions";

describe("staff task note action", () => {
  beforeEach(() => {
    mocks.addTaskNote.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.resolveMembershipSession.mockReset();
    mocks.resolveMembershipSession.mockResolvedValue({
      state: "resolved",
      session: {
        account: { role: "staff" },
        memberUserId: "user_staff_acme",
        tenant: { id: "tenant_acme_fitness" }
      }
    });
  });

  it("returns submitted task identity with the authoritative note event", async () => {
    const taskEvent = {
      actorUserId: "user_staff_acme",
      createdAt: "2026-07-10T23:05:00.000Z",
      eventType: "note_added" as const,
      id: "event_note_1",
      locationId: "loc_acme_main",
      note: "Call back after 5 PM.",
      taskId: "task_new_tour",
      tenantId: "tenant_acme_fitness"
    };
    mocks.addTaskNote.mockResolvedValue(taskEvent);
    const formData = new FormData();
    formData.set("tenantId", "tenant_acme_fitness");
    formData.set("locationId", "loc_acme_main");
    formData.set("taskId", "task_new_tour");
    formData.set("note", "Call back after 5 PM.");

    const result = await addTaskNoteAction({ ok: false, message: "" }, formData);

    expect(result).toEqual({
      message: "Task note saved with a task event and audit event.",
      ok: true,
      taskEvent,
      taskId: "task_new_tour"
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/staff/tasks");
  });

  it("keeps submitted task identity on note authorization failures", async () => {
    mocks.resolveMembershipSession.mockResolvedValue({ state: "no_authenticated_user" });
    const formData = new FormData();
    formData.set("taskId", "task_new_tour");

    const result = await addTaskNoteAction({ ok: false, message: "" }, formData);

    expect(result).toEqual({
      message: "Sign in is required before adding backend task notes.",
      ok: false,
      taskId: "task_new_tour"
    });
    expect(mocks.addTaskNote).not.toHaveBeenCalled();
  });
});
