"use server";

import { revalidatePath } from "next/cache";
import type { StaffTaskActionState } from "@/application/tasks/action-result";
import { TaskApplicationService } from "@/application/tasks/service";
import {
  STAFF_TASK_CLAIM_NOTE,
  STAFF_TASK_RELEASE_NOTE,
  type Task
} from "@/domain/tasks";
import { NeonTaskRepository } from "@/infrastructure/neon/task-repository";
import { isNeonConfigured } from "@/server/neon/env";
import { createOutpostServerNeonClient, type OutpostNeonClient } from "@/server/neon/server-client";
import { resolveMembershipSession } from "@/server/session-context";

interface StaffActionContext {
  actorUserId: string;
  neon: OutpostNeonClient;
  tenantId: string;
}

type StaffActionContextResult =
  | {
      ok: true;
      context: StaffActionContext;
    }
  | {
      ok: false;
      message: string;
    };

async function requireStaffActionContext(actionLabel: string): Promise<
  StaffActionContextResult
> {
  const neon = await createOutpostServerNeonClient();
  const sessionResolution = await resolveMembershipSession(neon);

  if (sessionResolution.state === "no_authenticated_user") {
    return { ok: false, message: `Sign in is required before ${actionLabel}.` };
  }

  if (
    sessionResolution.state !== "resolved" ||
    sessionResolution.session.account.role !== "staff"
  ) {
    return { ok: false, message: `Staff access is required before ${actionLabel}.` };
  }

  return {
    ok: true,
    context: {
      actorUserId: sessionResolution.session.memberUserId,
      neon,
      tenantId: sessionResolution.session.tenant.id
    }
  };
}

function submittedTenantMatchesSession(formData: FormData, tenantId: string) {
  const submittedTenantId = String(formData.get("tenantId") ?? "");
  return !submittedTenantId || submittedTenantId === tenantId;
}

export async function addTaskNoteAction(
  _previousState: StaffTaskActionState,
  formData: FormData
): Promise<StaffTaskActionState> {
  const taskId = String(formData.get("taskId") ?? "");

  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so backend task notes are disabled.",
      taskId
    };
  }

  const actionContext = await requireStaffActionContext("adding backend task notes");
  if (!actionContext.ok) {
    return { ...actionContext, taskId };
  }
  const { actorUserId, neon, tenantId } = actionContext.context;
  const locationId = String(formData.get("locationId") ?? "");

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return {
      ok: false,
      message: "Submitted tenant does not match the signed-in staff workspace.",
      taskId
    };
  }

  if (!locationId || !taskId) {
    return { ok: false, message: "Location and task identifiers are required.", taskId };
  }

  try {
    const repository = new NeonTaskRepository(neon);
    const service = new TaskApplicationService(repository);
    const taskEvent = await service.addTaskNote({
      tenantId,
      locationId,
      taskId,
      actorUserId,
      note: String(formData.get("note") ?? "")
    });

    revalidatePath("/staff/tasks");

    return {
      ok: true,
      message: "Task note saved with a task event and audit event.",
      taskEvent,
      taskId
    };
  } catch (saveError) {
    if (saveError instanceof Error && saveError.message.includes("assignee must be an active member")) {
      return {
        ok: false,
        message: "Assignee must be an active member of this tenant.",
        taskId
      };
    }

    if (
      saveError instanceof Error &&
      (saveError.message.startsWith("Task ") ||
        saveError.message.startsWith("Tenant ") ||
        saveError.message.startsWith("Location "))
    ) {
      return { ok: false, message: saveError.message, taskId };
    }

    return {
      ok: false,
      message: "Unable to save task note through backend persistence.",
      taskId
    };
  }
}

export async function assignTaskAction(
  _previousState: StaffTaskActionState,
  formData: FormData
): Promise<StaffTaskActionState> {
  const taskId = String(formData.get("taskId") ?? "");

  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so backend task assignment is disabled.",
      taskId
    };
  }

  const actionContext = await requireStaffActionContext("changing backend task assignment");
  if (!actionContext.ok) {
    return { ...actionContext, taskId };
  }
  const { actorUserId, neon, tenantId } = actionContext.context;
  const locationId = String(formData.get("locationId") ?? "");
  const assignmentIntent = formData.get("assignmentIntent");
  const isClaim = assignmentIntent === "claim";
  const isRelease = assignmentIntent === "release";
  const submittedAssigneeUserId = String(formData.get("assigneeUserId") ?? "");
  let assigneeUserId = submittedAssigneeUserId || undefined;
  let assignmentNote: string | undefined;
  let successMessage = "Task assignment saved with a task event and audit event.";

  if (isClaim) {
    assigneeUserId = actorUserId;
    assignmentNote = STAFF_TASK_CLAIM_NOTE;
    successMessage = "Task claimed with a task event and audit event.";
  } else if (isRelease) {
    assigneeUserId = undefined;
    assignmentNote = STAFF_TASK_RELEASE_NOTE;
    successMessage = "Task released with a task event and audit event.";
  }

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return {
      ok: false,
      message: "Submitted tenant does not match the signed-in staff workspace.",
      taskId
    };
  }

  if (!locationId || !taskId) {
    return { ok: false, message: "Location and task identifiers are required.", taskId };
  }

  try {
    const repository = new NeonTaskRepository(neon);
    const service = new TaskApplicationService(repository);
    const task = await service.assignTask({
      tenantId,
      locationId,
      taskId,
      actorUserId,
      assigneeUserId,
      note: assignmentNote
    });

    revalidatePath("/staff/tasks");

    return {
      ok: true,
      message: successMessage,
      task,
      taskId
    };
  } catch (saveError) {
    if (
      saveError instanceof Error &&
      (saveError.message.startsWith("Task ") ||
        saveError.message.startsWith("Tenant ") ||
        saveError.message.startsWith("Location ") ||
        saveError.message.startsWith("Assignment "))
    ) {
      return { ok: false, message: saveError.message, taskId };
    }

    return {
      ok: false,
      message: "Unable to save task assignment through backend persistence.",
      taskId
    };
  }
}

export async function createManualTaskAction(
  _previousState: StaffTaskActionState,
  formData: FormData
): Promise<StaffTaskActionState> {
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so backend task creation is disabled."
    };
  }

  const actionContext = await requireStaffActionContext("creating backend tasks");
  if (!actionContext.ok) {
    return actionContext;
  }
  const { actorUserId, neon, tenantId } = actionContext.context;
  const confidence = Number(formData.get("confidence") ?? "0.9");
  const locationId = String(formData.get("locationId") ?? "");

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in staff workspace." };
  }

  if (!locationId) {
    return { ok: false, message: "Location identifier is required." };
  }

  try {
    const repository = new NeonTaskRepository(neon);
    const service = new TaskApplicationService(repository);
    const task = await service.createManualTask({
      tenantId,
      locationId,
      actorUserId,
      channel: String(formData.get("channel") ?? "manual") as Task["channel"],
      claimForActor: formData.get("claimForActor") === "on",
      requesterName: String(formData.get("requesterName") ?? ""),
      requesterContact: String(formData.get("requesterContact") ?? ""),
      intent: String(formData.get("intent") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      suggestedNextStep: String(formData.get("suggestedNextStep") ?? ""),
      confidence
    });

    revalidatePath("/staff/tasks");

    return { ok: true, message: "Manual task created with a task event, usage event, and audit event.", task };
  } catch (saveError) {
    if (
      saveError instanceof Error &&
      (saveError.message.startsWith("Requester ") ||
        saveError.message.startsWith("Suggested ") ||
        saveError.message.startsWith("Task ") ||
        saveError.message.startsWith("Tenant ") ||
        saveError.message.startsWith("Location "))
    ) {
      return { ok: false, message: saveError.message };
    }

    return {
      ok: false,
      message: "Unable to create manual task through backend persistence."
    };
  }
}

export async function updateTaskStatusAction(
  _previousState: StaffTaskActionState,
  formData: FormData
): Promise<StaffTaskActionState> {
  const taskId = String(formData.get("taskId") ?? "");

  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so backend task status changes are disabled.",
      taskId
    };
  }

  const actionContext = await requireStaffActionContext("changing backend task status");
  if (!actionContext.ok) {
    return { ...actionContext, taskId };
  }
  const { actorUserId, neon, tenantId } = actionContext.context;
  const locationId = String(formData.get("locationId") ?? "");
  const statusIntent = formData.get("statusIntent");
  const isStart = statusIntent === "start";
  const isNeedsHuman = statusIntent === "needs_human";
  const isDone = statusIntent === "done";
  const isIgnored = statusIntent === "ignored";
  const isReopen = statusIntent === "reopen";
  const submittedStatus = String(formData.get("toStatus") ?? "") as Task["status"];
  let toStatus: Task["status"] = submittedStatus;
  let successMessage = "Task status saved with a task event and audit event.";

  if (isStart) {
    toStatus = "in_progress";
    successMessage = "Task started with a task event and audit event.";
  } else if (isNeedsHuman) {
    toStatus = "needs_human";
    successMessage = "Task marked needs human with a task event and audit event.";
  } else if (isDone) {
    toStatus = "done";
    successMessage = "Task marked done with a task event and audit event.";
  } else if (isIgnored) {
    toStatus = "ignored";
    successMessage = "Task marked ignored with a task event and audit event.";
  } else if (isReopen) {
    toStatus = "new";
    successMessage = "Task reopened with a task event and audit event.";
  }

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return {
      ok: false,
      message: "Submitted tenant does not match the signed-in staff workspace.",
      taskId
    };
  }

  if (!locationId || !taskId) {
    return { ok: false, message: "Location and task identifiers are required.", taskId };
  }

  try {
    const repository = new NeonTaskRepository(neon);
    const service = new TaskApplicationService(repository);
    const task = await service.updateTaskStatus({
      tenantId,
      locationId,
      taskId,
      actorUserId,
      toStatus
    });

    revalidatePath("/staff/tasks");

    return {
      ok: true,
      message: successMessage,
      task,
      taskId
    };
  } catch (saveError) {
    if (
      saveError instanceof Error &&
      (saveError.message.startsWith("Task ") ||
        saveError.message.startsWith("Tenant ") ||
        saveError.message.startsWith("Location "))
    ) {
      return { ok: false, message: saveError.message, taskId };
    }

    return {
      ok: false,
      message: "Unable to save task status through backend persistence.",
      taskId
    };
  }
}
