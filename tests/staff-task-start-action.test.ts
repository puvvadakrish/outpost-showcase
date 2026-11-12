import { beforeEach, describe, expect, it, vi } from "vitest";
import { tasks } from "@/domain/seed";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  resolveMembershipSession: vi.fn(),
  updateTaskStatus: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/application/tasks/service", () => ({
  TaskApplicationService: class {
    updateTaskStatus = mocks.updateTaskStatus;
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

import { updateTaskStatusAction } from "@/app/staff/tasks/actions";

describe("staff Start work action", () => {
  beforeEach(() => {
    mocks.revalidatePath.mockReset();
    mocks.resolveMembershipSession.mockReset();
    mocks.updateTaskStatus.mockReset();
    mocks.resolveMembershipSession.mockResolvedValue({
      state: "resolved",
      session: {
        account: { role: "staff" },
        memberUserId: "user_staff_acme",
        tenant: { id: "tenant_acme_fitness" }
      }
    });
  });

  it("derives in-progress status from intent and ignores a submitted terminal status", async () => {
    const authoritativeTask = {
      ...tasks.find((task) => task.id === "task_new_tour")!,
      status: "in_progress" as const,
      updatedAt: "2026-07-10T00:05:00.000Z"
    };
    mocks.updateTaskStatus.mockResolvedValue(authoritativeTask);
    const formData = new FormData();
    formData.set("tenantId", "tenant_acme_fitness");
    formData.set("locationId", "loc_acme_main");
    formData.set("taskId", "task_new_tour");
    formData.set("statusIntent", "start");
    formData.set("toStatus", "done");

    const result = await updateTaskStatusAction({ ok: false, message: "" }, formData);

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith({
      actorUserId: "user_staff_acme",
      locationId: "loc_acme_main",
      taskId: "task_new_tour",
      tenantId: "tenant_acme_fitness",
      toStatus: "in_progress"
    });
    expect(result).toEqual({
      message: "Task started with a task event and audit event.",
      ok: true,
      task: authoritativeTask,
      taskId: "task_new_tour"
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/staff/tasks");
  });

  it("derives needs-human status from intent and ignores a submitted terminal status", async () => {
    const activeAssignedTask = {
      ...tasks.find((task) => task.id === "task_new_tour")!,
      status: "in_progress" as const
    };
    const authoritativeTask = {
      ...activeAssignedTask,
      status: "needs_human" as const,
      updatedAt: "2026-07-10T00:10:00.000Z"
    };
    mocks.updateTaskStatus.mockResolvedValue(authoritativeTask);
    const formData = new FormData();
    formData.set("tenantId", "tenant_acme_fitness");
    formData.set("locationId", "loc_acme_main");
    formData.set("taskId", "task_new_tour");
    formData.set("statusIntent", "needs_human");
    formData.set("toStatus", "done");

    const result = await updateTaskStatusAction({ ok: false, message: "" }, formData);

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith({
      actorUserId: "user_staff_acme",
      locationId: "loc_acme_main",
      taskId: "task_new_tour",
      tenantId: "tenant_acme_fitness",
      toStatus: "needs_human"
    });
    expect(result).toEqual({
      message: "Task marked needs human with a task event and audit event.",
      ok: true,
      task: authoritativeTask,
      taskId: "task_new_tour"
    });
  });

  it("keeps submitted task identity on status authorization failures", async () => {
    mocks.resolveMembershipSession.mockResolvedValue({ state: "no_authenticated_user" });
    const formData = new FormData();
    formData.set("taskId", "task_new_tour");

    const result = await updateTaskStatusAction({ ok: false, message: "" }, formData);

    expect(result).toEqual({
      message: "Sign in is required before changing backend task status.",
      ok: false,
      taskId: "task_new_tour"
    });
    expect(mocks.updateTaskStatus).not.toHaveBeenCalled();
  });

  it("derives new status from reopen intent and ignores a submitted terminal status", async () => {
    const authoritativeTask = { ...tasks.find((task) => task.status === "done")!, status: "new" as const };
    mocks.updateTaskStatus.mockResolvedValue(authoritativeTask);
    const formData = new FormData();
    formData.set("tenantId", "tenant_acme_fitness");
    formData.set("locationId", authoritativeTask.locationId);
    formData.set("taskId", authoritativeTask.id);
    formData.set("statusIntent", "reopen");
    formData.set("toStatus", "ignored");

    const result = await updateTaskStatusAction({ ok: false, message: "" }, formData);

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith(expect.objectContaining({ taskId: authoritativeTask.id, toStatus: "new" }));
    expect(result).toMatchObject({ ok: true, message: "Task reopened with a task event and audit event." });
  });

  it("derives done status from completion intent and ignores a submitted reopen status", async () => {
    const authoritativeTask = { ...tasks.find((task) => task.id === "task_in_progress_callback")!, status: "done" as const };
    mocks.updateTaskStatus.mockResolvedValue(authoritativeTask);
    const formData = new FormData();
    formData.set("tenantId", "tenant_acme_fitness");
    formData.set("locationId", authoritativeTask.locationId);
    formData.set("taskId", authoritativeTask.id);
    formData.set("statusIntent", "done");
    formData.set("toStatus", "new");

    const result = await updateTaskStatusAction({ ok: false, message: "" }, formData);

    expect(mocks.updateTaskStatus).toHaveBeenCalledWith(expect.objectContaining({ taskId: authoritativeTask.id, toStatus: "done" }));
    expect(result).toMatchObject({ ok: true, message: "Task marked done with a task event and audit event." });
  });

  it("derives ignored status from ignore intent and ignores a submitted completion status", async () => {
    const authoritativeTask = { ...tasks.find((task) => task.id === "task_in_progress_callback")!, status: "ignored" as const };
    mocks.updateTaskStatus.mockResolvedValue(authoritativeTask);
    const formData = new FormData();
    formData.set("tenantId", "tenant_acme_fitness");
    formData.set("locationId", authoritativeTask.locationId);
    formData.set("taskId", authoritativeTask.id);
    formData.set("statusIntent", "ignored");
    formData.set("toStatus", "done");
    const result = await updateTaskStatusAction({ ok: false, message: "" }, formData);
    expect(mocks.updateTaskStatus).toHaveBeenCalledWith(expect.objectContaining({ toStatus: "ignored" }));
    expect(result).toMatchObject({ ok: true, message: "Task marked ignored with a task event and audit event." });
  });
});
