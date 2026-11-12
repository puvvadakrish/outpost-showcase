import type { AuditEvent } from "@/domain/audit";
import type { Id, TaskChannel, TaskStatus } from "@/domain/models";
import type { Task, TaskEvent } from "@/domain/tasks";
import type { User } from "@/domain/tenancy";
import type { UsageEvent } from "@/domain/usage";

export interface CreateManualTaskCommand {
  tenantId: Id;
  locationId: Id;
  actorUserId: Id;
  channel: TaskChannel;
  claimForActor: boolean;
  requesterName: string;
  requesterContact: string;
  intent: string;
  summary: string;
  suggestedNextStep: string;
  confidence: number;
}

export interface CreateTaskFromAnswerCommand {
  tenantId: Id;
  answerBankEntryId: Id;
  actorUserId: Id;
}

export interface UpdateTaskStatusCommand {
  tenantId: Id;
  locationId: Id;
  taskId: Id;
  actorUserId: Id;
  toStatus: TaskStatus;
}

export interface AssignTaskCommand {
  tenantId: Id;
  locationId: Id;
  taskId: Id;
  actorUserId: Id;
  assigneeUserId?: Id;
  note?: string;
}

export interface AddTaskNoteCommand {
  tenantId: Id;
  locationId: Id;
  taskId: Id;
  actorUserId: Id;
  note: string;
}

export interface TransactionalCreateManualTaskInput extends CreateManualTaskCommand {}

export interface TransactionalCreateTaskFromAnswerInput extends CreateTaskFromAnswerCommand {}

export interface TransactionalUpdateTaskStatusInput extends UpdateTaskStatusCommand {}

export interface TransactionalAssignTaskInput extends AssignTaskCommand {
  note: string;
}

export interface TransactionalAddTaskNoteInput extends AddTaskNoteCommand {}

export interface CreateManualTaskTransactionResult {
  task: Task;
}

export interface CreateTaskFromAnswerTransactionResult {
  task: Task;
}

export interface UpdateTaskStatusTransactionResult {
  task: Task;
}

export interface AssignTaskTransactionResult {
  task: Task;
}

export interface AddTaskNoteTransactionResult {
  taskEvent: TaskEvent;
}

export interface TaskRepository {
  addTaskNoteTransaction(
    input: TransactionalAddTaskNoteInput
  ): Promise<AddTaskNoteTransactionResult>;
  assignTaskTransaction(input: TransactionalAssignTaskInput): Promise<AssignTaskTransactionResult>;
  createManualTaskTransaction(
    input: TransactionalCreateManualTaskInput
  ): Promise<CreateManualTaskTransactionResult>;
  createTaskFromAnswerTransaction(
    input: TransactionalCreateTaskFromAnswerInput
  ): Promise<CreateTaskFromAnswerTransactionResult>;
  listAssignableUsersForTenant(tenantId: Id): Promise<User[]>;
  listEventsForTenant(tenantId: Id): Promise<TaskEvent[]>;
  listForTenant(tenantId: Id): Promise<Task[]>;
  updateTaskStatusTransaction(
    input: TransactionalUpdateTaskStatusInput
  ): Promise<UpdateTaskStatusTransactionResult>;
}

export interface TaskPersistenceState {
  auditEvents: AuditEvent[];
  taskEvents: TaskEvent[];
  tasks: Task[];
  usageEvents: UsageEvent[];
}
