import { beforeEach, describe, expect, it, vi } from "vitest";
import { STAFF_TASK_CLAIM_NOTE, STAFF_TASK_RELEASE_NOTE } from "@/domain/tasks";
import { tasks } from "@/domain/seed";

const mocks = vi.hoisted(() => ({
  assignTask: vi.fn(),
  revalidatePath: vi.fn(),
  resolveMembershipSession: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/application/tasks/service", () => ({
  TaskApplicationService: class {
    assignTask = mocks.assignTask;
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

import { assignTaskAction } from "@/app/staff/tasks/actions";

describe("staff task claim action", () => {
  beforeEach(() => {
    mocks.assignTask.mockReset();
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

  it("derives claim actor and assignee from the authenticated internal member", async () => {
    const authoritativeTask = {
      ...tasks.find((task) => task.id === "task_needs_human_freeze")!,
      assigneeUserId: "user_staff_acme",
      updatedAt: "2026-07-09T23:59:00.000Z"
    };
    mocks.assignTask.mockResolvedValue(authoritativeTask);
    const formData = new FormData();
    formData.set("tenantId", "tenant_acme_fitness");
    formData.set("locationId", "loc_acme_main");
    formData.set("taskId", "task_needs_human_freeze");
    formData.set("assignmentIntent", "claim");
    formData.set("assigneeUserId", "user_owner_acme");

    const result = await assignTaskAction({ ok: false, message: "" }, formData);

    expect(mocks.assignTask).toHaveBeenCalledWith({
      actorUserId: "user_staff_acme",
      assigneeUserId: "user_staff_acme",
      locationId: "loc_acme_main",
      note: STAFF_TASK_CLAIM_NOTE,
      taskId: "task_needs_human_freeze",
      tenantId: "tenant_acme_fitness"
    });
    expect(result).toEqual({
      message: "Task claimed with a task event and audit event.",
      ok: true,
      task: authoritativeTask,
      taskId: "task_needs_human_freeze"
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/staff/tasks");
  });

  it("derives release from intent and ignores a submitted assignee", async () => {
    const authoritativeTask = {
      ...tasks.find((task) => task.id === "task_new_tour")!,
      assigneeUserId: undefined,
      updatedAt: "2026-07-10T00:01:00.000Z"
    };
    mocks.assignTask.mockResolvedValue(authoritativeTask);
    const formData = new FormData();
    formData.set("tenantId", "tenant_acme_fitness");
    formData.set("locationId", "loc_acme_main");
    formData.set("taskId", "task_new_tour");
    formData.set("assignmentIntent", "release");
    formData.set("assigneeUserId", "user_owner_acme");

    const result = await assignTaskAction({ ok: false, message: "" }, formData);

    expect(mocks.assignTask).toHaveBeenCalledWith({
      actorUserId: "user_staff_acme",
      assigneeUserId: undefined,
      locationId: "loc_acme_main",
      note: STAFF_TASK_RELEASE_NOTE,
      taskId: "task_new_tour",
      tenantId: "tenant_acme_fitness"
    });
    expect(result).toEqual({
      message: "Task released with a task event and audit event.",
      ok: true,
      task: authoritativeTask,
      taskId: "task_new_tour"
    });
  });

  it("keeps submitted task identity on assignment authorization failures", async () => {
    mocks.resolveMembershipSession.mockResolvedValue({ state: "no_authenticated_user" });
    const formData = new FormData();
    formData.set("taskId", "task_needs_human_freeze");

    const result = await assignTaskAction({ ok: false, message: "" }, formData);

    expect(result).toEqual({
      message: "Sign in is required before changing backend task assignment.",
      ok: false,
      taskId: "task_needs_human_freeze"
    });
    expect(mocks.assignTask).not.toHaveBeenCalled();
  });
});
