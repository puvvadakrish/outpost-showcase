import { normalizeManualTaskIntake, type ManualTaskIntakeInput } from "./manual-task-intake";
import type { Id, TaskStatus } from "./models";
import type { Task, TaskEvent } from "./tasks";
import {
  buildTaskAssignedEvent,
  buildTaskNoteAddedEvent,
  STAFF_MANUAL_TASK_CREATED_NOTE,
  STAFF_MANUAL_TASK_CLAIM_NOTE,
  taskForTenant,
  transitionTaskStatus
} from "./tasks";

export interface StaffTaskDraftSeed {
  tasks: Task[];
  taskEvents: TaskEvent[];
}

export interface CreateDraftManualTaskInput extends ManualTaskIntakeInput {
  actorUserId: Id | undefined;
  claimForActor?: boolean;
  locationId: Id;
  taskId: Id;
  tenantId: Id;
}

export function createDraftManualTask(
  state: StaffTaskDraftState,
  input: CreateDraftManualTaskInput,
  now = new Date().toISOString()
): StaffTaskDraftState {
  if (!input.tenantId.trim()) throw new Error("Tenant identifier is required.");
  if (!input.locationId.trim()) throw new Error("Location identifier is required.");
  if (!input.taskId.trim()) throw new Error("Task identifier is required.");
  const normalized = normalizeManualTaskIntake(input);
  const task: Task = {
    ...normalized,
    id: input.taskId,
    tenantId: input.tenantId,
    locationId: input.locationId,
    status: "new",
    assigneeUserId: input.claimForActor ? input.actorUserId : undefined,
    createdAt: now,
    updatedAt: now
  };
  const assignmentEvent = input.claimForActor && input.actorUserId
    ? buildTaskAssignedEvent(
        { ...task, assigneeUserId: undefined },
        input.actorUserId,
        input.actorUserId,
        now,
        STAFF_MANUAL_TASK_CLAIM_NOTE
      )
    : undefined;
  const event: TaskEvent = {
    id: `task_event_created_${input.taskId}_${now}`,
    tenantId: input.tenantId,
    locationId: input.locationId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    eventType: "created",
    toStatus: "new",
    note: STAFF_MANUAL_TASK_CREATED_NOTE,
    createdAt: now
  };

  return {
    ...state,
    tasks: [task, ...state.tasks],
    taskEvents: [event, ...(assignmentEvent ? [assignmentEvent] : []), ...state.taskEvents],
    updatedAt: now
  };
}

export interface StaffTaskDraftState extends StaffTaskDraftSeed {
  updatedAt: string;
}

export function staffTaskStorageKey(tenantId: Id) {
  return `outpost:staff-tasks:${tenantId}:slice3a`;
}

export function createStaffTaskDraftState(
  seed: StaffTaskDraftSeed,
  updatedAt = new Date().toISOString()
): StaffTaskDraftState {
  return {
    tasks: seed.tasks.map((task) => ({ ...task })),
    taskEvents: seed.taskEvents.map((event) => ({ ...event })),
    updatedAt
  };
}

export function changeDraftTaskStatus(
  state: StaffTaskDraftState,
  tenantId: Id,
  taskId: Id,
  toStatus: TaskStatus,
  actorUserId: Id | undefined,
  now = new Date().toISOString()
): StaffTaskDraftState {
  const task = taskForTenant(state.tasks, tenantId, taskId);
  if (!task) {
    return state;
  }

  const result = transitionTaskStatus(task, toStatus, actorUserId, now);
  if (!result.changed || !result.event) {
    return state;
  }

  return {
    ...state,
    tasks: state.tasks.map((candidate) => (candidate.id === taskId ? result.task : candidate)),
    taskEvents: [result.event, ...state.taskEvents],
    updatedAt: now
  };
}

export function assignDraftTask(
  state: StaffTaskDraftState,
  tenantId: Id,
  taskId: Id,
  assigneeUserId: Id | undefined,
  actorUserId: Id | undefined,
  now = new Date().toISOString(),
  note?: string
): StaffTaskDraftState {
  const task = taskForTenant(state.tasks, tenantId, taskId);
  if (!task || task.assigneeUserId === assigneeUserId) {
    return state;
  }

  const event = buildTaskAssignedEvent(task, actorUserId, assigneeUserId, now, note);

  return {
    ...state,
    tasks: state.tasks.map((candidate) =>
      candidate.id === taskId
        ? {
            ...candidate,
            assigneeUserId,
            updatedAt: now
          }
        : candidate
    ),
    taskEvents: [event, ...state.taskEvents],
    updatedAt: now
  };
}

export function addDraftTaskNote(
  state: StaffTaskDraftState,
  tenantId: Id,
  taskId: Id,
  note: string,
  actorUserId: Id | undefined,
  now = new Date().toISOString()
): StaffTaskDraftState {
  const trimmedNote = note.trim();
  const task = taskForTenant(state.tasks, tenantId, taskId);
  if (!task || trimmedNote.length === 0) {
    return state;
  }

  const event = buildTaskNoteAddedEvent(task, actorUserId, trimmedNote, now);

  return {
    ...state,
    taskEvents: [event, ...state.taskEvents],
    updatedAt: now
  };
}
