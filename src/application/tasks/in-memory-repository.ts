import type { AuditEvent } from "@/domain/audit";
import { unresolvedTaskStatuses } from "@/domain/models";
import type { Task, TaskEvent } from "@/domain/tasks";
import {
  buildTaskAssignedEvent,
  buildTaskNoteAddedEvent,
  canTransitionTaskStatus,
  STAFF_MANUAL_TASK_CLAIM_NOTE,
  STAFF_MANUAL_TASK_CREATED_NOTE,
  transitionTaskStatus
} from "@/domain/tasks";
import type { UsageEvent } from "@/domain/usage";
import type {
  AddTaskNoteTransactionResult,
  AssignTaskTransactionResult,
  CreateManualTaskTransactionResult,
  CreateTaskFromAnswerTransactionResult,
  TaskPersistenceState,
  TaskRepository,
  TransactionalAddTaskNoteInput,
  TransactionalAssignTaskInput,
  TransactionalCreateManualTaskInput,
  TransactionalCreateTaskFromAnswerInput,
  TransactionalUpdateTaskStatusInput,
  UpdateTaskStatusTransactionResult
} from "./ports";

const DEFAULT_STATUS_NOTE = "Status changed through backend-backed staff task persistence.";
const ANSWER_TASK_CREATED_NOTE = "Task created from owner answer-bank review item";
const OPEN_TASK_STATUSES = new Set<string>(unresolvedTaskStatuses);

export class InMemoryTaskRepository implements TaskRepository {
  private failAfterTaskAssignmentUpdate = false;
  private failAfterTaskInsert = false;
  private failAfterTaskNoteUpdate = false;
  private failAfterTaskUpdate = false;
  private state: TaskPersistenceState;

  constructor(seed: TaskPersistenceState) {
    this.state = {
      auditEvents: seed.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      taskEvents: seed.taskEvents.map((event) => ({ ...event })),
      tasks: seed.tasks.map((task) => ({ ...task })),
      usageEvents: seed.usageEvents.map((event) => ({ ...event }))
    };
  }

  requestFailureAfterTaskInsert() {
    this.failAfterTaskInsert = true;
  }

  requestFailureAfterTaskAssignmentUpdate() {
    this.failAfterTaskAssignmentUpdate = true;
  }

  requestFailureAfterTaskNoteUpdate() {
    this.failAfterTaskNoteUpdate = true;
  }

  requestFailureAfterTaskUpdate() {
    this.failAfterTaskUpdate = true;
  }

  snapshot(): TaskPersistenceState {
    return {
      auditEvents: this.state.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      taskEvents: this.state.taskEvents.map((event) => ({ ...event })),
      tasks: this.state.tasks.map((task) => ({ ...task })),
      usageEvents: this.state.usageEvents.map((event) => ({ ...event }))
    };
  }

  async addTaskNoteTransaction(input: TransactionalAddTaskNoteInput): Promise<AddTaskNoteTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const taskIndex = this.state.tasks.findIndex(
      (task) =>
        task.tenantId === input.tenantId &&
        task.locationId === input.locationId &&
        task.id === input.taskId
    );

    try {
      if (taskIndex === -1) {
        throw new Error("Task not found.");
      }

      const existing = this.state.tasks[taskIndex];
      const updated: Task = { ...existing, updatedAt: now };
      this.state.tasks[taskIndex] = updated;

      if (this.failAfterTaskNoteUpdate) {
        throw new Error("Injected failure after task note update.");
      }

      const event = buildTaskNoteAddedEvent(updated, input.actorUserId, input.note, now);
      const auditEvent: AuditEvent = {
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "task",
        subjectId: updated.id,
        action: "task.note_added",
        metadata: {
          location_id: updated.locationId,
          task_event_id: event.id
        },
        occurredAt: now
      };

      this.state.taskEvents.push(event);
      this.state.auditEvents.push(auditEvent);

      return { taskEvent: { ...event } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterTaskNoteUpdate = false;
    }
  }

  async assignTaskTransaction(input: TransactionalAssignTaskInput): Promise<AssignTaskTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const taskIndex = this.state.tasks.findIndex(
      (task) =>
        task.tenantId === input.tenantId &&
        task.locationId === input.locationId &&
        task.id === input.taskId
    );

    try {
      if (taskIndex === -1) {
        throw new Error("Task not found.");
      }

      const existing = this.state.tasks[taskIndex];

      if (existing.assigneeUserId === input.assigneeUserId) {
        return { task: { ...existing } };
      }

      const updated: Task = {
        ...existing,
        assigneeUserId: input.assigneeUserId,
        updatedAt: now
      };
      this.state.tasks[taskIndex] = updated;

      if (this.failAfterTaskAssignmentUpdate) {
        throw new Error("Injected failure after task assignment update.");
      }

      const event = {
        ...buildTaskAssignedEvent(updated, input.actorUserId, input.assigneeUserId, now),
        note: input.note
      };
      const auditEvent: AuditEvent = {
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "task",
        subjectId: updated.id,
        action: "task.assigned",
        metadata: {
          location_id: updated.locationId,
          previous_assignee_user_id: existing.assigneeUserId ?? null,
          next_assignee_user_id: updated.assigneeUserId ?? null,
          task_event_id: event.id
        },
        occurredAt: now
      };

      this.state.taskEvents.push(event);
      this.state.auditEvents.push(auditEvent);

      return { task: { ...updated } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterTaskAssignmentUpdate = false;
    }
  }

  async listEventsForTenant(tenantId: string) {
    return this.state.taskEvents
      .filter((event) => event.tenantId === tenantId)
      .map((event) => ({ ...event }));
  }

  async listAssignableUsersForTenant(_tenantId: string) {
    return [];
  }

  async listForTenant(tenantId: string) {
    return this.state.tasks.filter((task) => task.tenantId === tenantId).map((task) => ({ ...task }));
  }

  async createManualTaskTransaction(
    input: TransactionalCreateManualTaskInput
  ): Promise<CreateManualTaskTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const taskId = `task_manual_${this.state.tasks.length + 1}`;
    const task: Task = {
      id: taskId,
      tenantId: input.tenantId,
      locationId: input.locationId,
      channel: input.channel,
      requesterName: input.requesterName,
      requesterContact: input.requesterContact,
      intent: input.intent,
      summary: input.summary,
      confidence: input.confidence,
      suggestedNextStep: input.suggestedNextStep,
      assigneeUserId: input.claimForActor ? input.actorUserId : undefined,
      status: "new",
      createdAt: now,
      updatedAt: now
    };

    try {
      this.state.tasks.push(task);

      if (this.failAfterTaskInsert) {
        throw new Error("Injected failure after task insert.");
      }

      const taskEvent: TaskEvent = {
        id: `task_event_${this.state.taskEvents.length + 1}`,
        tenantId: input.tenantId,
        locationId: input.locationId,
        taskId,
        actorUserId: input.actorUserId,
        eventType: "created",
        toStatus: "new",
        note: STAFF_MANUAL_TASK_CREATED_NOTE,
        createdAt: now
      };
      const usageEvent: UsageEvent = {
        id: `usage_event_${this.state.usageEvents.length + 1}`,
        tenantId: input.tenantId,
        locationId: input.locationId,
        meter: "task_created",
        quantity: 1,
        sourceType: "task",
        sourceId: taskId,
        periodKey: now.slice(0, 7),
        occurredAt: now
      };
      const assignmentEvent = input.claimForActor
        ? buildTaskAssignedEvent(
            { ...task, assigneeUserId: undefined },
            input.actorUserId,
            input.actorUserId,
            now,
            STAFF_MANUAL_TASK_CLAIM_NOTE
          )
        : undefined;
      const auditEvent: AuditEvent = {
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "task",
        subjectId: taskId,
        action: "task.created",
        metadata: {
          location_id: input.locationId,
          channel: input.channel,
          status: "new",
          task_event_id: taskEvent.id,
          usage_event_id: usageEvent.id
        },
        occurredAt: now
      };

      this.state.taskEvents.push(taskEvent);
      if (assignmentEvent) {
        this.state.taskEvents.push(assignmentEvent);
        this.state.auditEvents.push({
          id: `audit_event_${this.state.auditEvents.length + 2}`,
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          subjectType: "task",
          subjectId: taskId,
          action: "task.assigned",
          metadata: {
            assignee_user_id: input.actorUserId,
            location_id: input.locationId,
            task_event_id: assignmentEvent.id
          },
          occurredAt: now
        });
      }
      this.state.usageEvents.push(usageEvent);
      this.state.auditEvents.push(auditEvent);

      return { task: { ...task } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterTaskInsert = false;
    }
  }

  async createTaskFromAnswerTransaction(
    input: TransactionalCreateTaskFromAnswerInput
  ): Promise<CreateTaskFromAnswerTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const locationId = "loc_acme_main";
    const existingOpenTask = this.state.auditEvents
      .filter(
        (event) =>
          event.tenantId === input.tenantId &&
          event.subjectType === "task" &&
          event.action === "task.created_from_answer" &&
          event.metadata.answer_bank_entry_id === input.answerBankEntryId
      )
      .map((event) =>
        this.state.tasks.find(
          (task) =>
            task.tenantId === input.tenantId &&
            task.id === event.subjectId &&
            OPEN_TASK_STATUSES.has(task.status)
        )
      )
      .find((task): task is Task => task !== undefined);

    if (existingOpenTask) {
      return { task: { ...existingOpenTask } };
    }

    const taskId = `task_answer_${this.state.tasks.length + 1}`;
    const task: Task = {
      id: taskId,
      tenantId: input.tenantId,
      locationId,
      channel: "manual",
      requesterName: "Owner review",
      requesterContact: input.answerBankEntryId,
      intent: "Answer follow-up",
      summary: `Owner requested staff follow-up for answer ${input.answerBankEntryId}.`,
      confidence: 0.9,
      suggestedNextStep: "Review this answer-bank item with staff before live use.",
      status: "new",
      createdAt: now,
      updatedAt: now
    };

    try {
      this.state.tasks.push(task);

      if (this.failAfterTaskInsert) {
        throw new Error("Injected failure after task insert.");
      }

      const taskEvent: TaskEvent = {
        id: `task_event_${this.state.taskEvents.length + 1}`,
        tenantId: input.tenantId,
        locationId,
        taskId,
        actorUserId: input.actorUserId,
        eventType: "created",
        toStatus: "new",
        note: `${ANSWER_TASK_CREATED_NOTE} ${input.answerBankEntryId}.`,
        createdAt: now
      };
      const usageEvent: UsageEvent = {
        id: `usage_event_${this.state.usageEvents.length + 1}`,
        tenantId: input.tenantId,
        locationId,
        meter: "task_created",
        quantity: 1,
        sourceType: "task",
        sourceId: taskId,
        periodKey: now.slice(0, 7),
        occurredAt: now
      };
      const auditEvent: AuditEvent = {
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "task",
        subjectId: taskId,
        action: "task.created_from_answer",
        metadata: {
          location_id: locationId,
          answer_bank_entry_id: input.answerBankEntryId,
          task_event_id: taskEvent.id,
          usage_event_id: usageEvent.id
        },
        occurredAt: now
      };

      this.state.taskEvents.push(taskEvent);
      this.state.usageEvents.push(usageEvent);
      this.state.auditEvents.push(auditEvent);

      return { task: { ...task } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterTaskInsert = false;
    }
  }

  async updateTaskStatusTransaction(
    input: TransactionalUpdateTaskStatusInput
  ): Promise<UpdateTaskStatusTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const taskIndex = this.state.tasks.findIndex(
      (task) =>
        task.tenantId === input.tenantId &&
        task.locationId === input.locationId &&
        task.id === input.taskId
    );

    try {
      if (taskIndex === -1) {
        throw new Error("Task not found.");
      }

      const existing = this.state.tasks[taskIndex];

      if (!canTransitionTaskStatus(existing.status, input.toStatus)) {
        throw new Error("Task status transition is not allowed.");
      }

      const result = transitionTaskStatus(existing, input.toStatus, input.actorUserId, now);

      if (!result.changed || !result.event) {
        return { task: { ...existing } };
      }

      const updated: Task = result.task;
      const event: TaskEvent = {
        ...result.event,
        note: DEFAULT_STATUS_NOTE
      };

      this.state.tasks[taskIndex] = updated;

      if (this.failAfterTaskUpdate) {
        throw new Error("Injected failure after task update.");
      }

      const auditEvent: AuditEvent = {
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "task",
        subjectId: updated.id,
        action: event.eventType === "reopened" ? "task.reopened" : "task.status_changed",
        metadata: {
          location_id: updated.locationId,
          previous_status: existing.status,
          next_status: updated.status,
          task_event_id: event.id
        },
        occurredAt: now
      };

      this.state.taskEvents.push(event);
      this.state.auditEvents.push(auditEvent);

      return { task: { ...updated } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterTaskUpdate = false;
    }
  }
}
