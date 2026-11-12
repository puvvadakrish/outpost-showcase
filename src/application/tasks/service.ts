import { taskStatuses } from "@/domain/models";
import { normalizeManualTaskIntake } from "@/domain/manual-task-intake";
import type {
  AddTaskNoteCommand,
  AssignTaskCommand,
  CreateManualTaskCommand,
  CreateTaskFromAnswerCommand,
  TaskRepository,
  UpdateTaskStatusCommand
} from "./ports";

const DEFAULT_ASSIGNMENT_NOTE = "Task assignment changed through Outpost staff workboard.";

function includesValue<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

function assertMaxLength(label: string, value: string, maxLength: number) {
  if (value.length > maxLength) {
    throw new Error(`${label} is too long.`);
  }
}

export class TaskApplicationService {
  constructor(private readonly repository: TaskRepository) {}

  async addTaskNote(command: AddTaskNoteCommand) {
    const tenantId = command.tenantId.trim();
    const locationId = command.locationId.trim();
    const taskId = command.taskId.trim();
    const note = command.note.trim();

    if (!tenantId) {
      throw new Error("Tenant identifier is required.");
    }

    if (!locationId) {
      throw new Error("Location identifier is required.");
    }

    if (!taskId) {
      throw new Error("Task identifier is required.");
    }

    if (!note) {
      throw new Error("Task note is required.");
    }

    assertMaxLength("Task note", note, 1200);

    const result = await this.repository.addTaskNoteTransaction({
      ...command,
      tenantId,
      locationId,
      taskId,
      note
    });

    return result.taskEvent;
  }

  async assignTask(command: AssignTaskCommand) {
    const tenantId = command.tenantId.trim();
    const locationId = command.locationId.trim();
    const taskId = command.taskId.trim();
    const assigneeUserId = command.assigneeUserId?.trim() || undefined;
    const note = command.note?.trim() || DEFAULT_ASSIGNMENT_NOTE;

    if (!tenantId) {
      throw new Error("Tenant identifier is required.");
    }

    if (!locationId) {
      throw new Error("Location identifier is required.");
    }

    if (!taskId) {
      throw new Error("Task identifier is required.");
    }

    assertMaxLength("Assignment note", note, 1200);

    const result = await this.repository.assignTaskTransaction({
      ...command,
      tenantId,
      locationId,
      taskId,
      assigneeUserId,
      note
    });

    return result.task;
  }

  async createManualTask(command: CreateManualTaskCommand) {
    const tenantId = command.tenantId.trim();
    const locationId = command.locationId.trim();
    const normalized = normalizeManualTaskIntake(command);

    if (!tenantId) {
      throw new Error("Tenant identifier is required.");
    }

    if (!locationId) {
      throw new Error("Location identifier is required.");
    }

    const result = await this.repository.createManualTaskTransaction({
      ...command,
      tenantId,
      locationId,
      ...normalized
    });

    return result.task;
  }

  async createTaskFromAnswer(command: CreateTaskFromAnswerCommand) {
    const tenantId = command.tenantId.trim();
    const answerBankEntryId = command.answerBankEntryId.trim();

    if (!tenantId) {
      throw new Error("Tenant identifier is required.");
    }

    if (!answerBankEntryId) {
      throw new Error("Answer identifier is required.");
    }

    const result = await this.repository.createTaskFromAnswerTransaction({
      ...command,
      tenantId,
      answerBankEntryId
    });

    return result.task;
  }

  async loadTenantTaskEvents(tenantId: string) {
    if (!tenantId.trim()) {
      throw new Error("Tenant identifier is required.");
    }

    return this.repository.listEventsForTenant(tenantId.trim());
  }

  async loadTenantAssignableUsers(tenantId: string) {
    if (!tenantId.trim()) {
      throw new Error("Tenant identifier is required.");
    }

    return this.repository.listAssignableUsersForTenant(tenantId.trim());
  }

  async loadTenantTasks(tenantId: string) {
    if (!tenantId.trim()) {
      throw new Error("Tenant identifier is required.");
    }

    return this.repository.listForTenant(tenantId.trim());
  }

  async updateTaskStatus(command: UpdateTaskStatusCommand) {
    const tenantId = command.tenantId.trim();
    const locationId = command.locationId.trim();
    const taskId = command.taskId.trim();

    if (!tenantId) {
      throw new Error("Tenant identifier is required.");
    }

    if (!locationId) {
      throw new Error("Location identifier is required.");
    }

    if (!taskId) {
      throw new Error("Task identifier is required.");
    }

    if (!includesValue(taskStatuses, command.toStatus)) {
      throw new Error("Task status is invalid.");
    }

    const result = await this.repository.updateTaskStatusTransaction({
      ...command,
      tenantId,
      locationId,
      taskId
    });

    return result.task;
  }
}
