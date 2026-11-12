import {
  taskChannels,
  taskStatuses,
  taskStatusLabel,
  unresolvedTaskStatuses,
  type Id,
  type TaskChannel,
  type TaskStatus
} from "./models";
import { displayLabel } from "./formatting";
import type { Location, User } from "./tenancy";

export interface Task {
  id: Id;
  tenantId: Id;
  locationId: Id;
  channel: TaskChannel;
  requesterName: string;
  requesterContact: string;
  intent: string;
  summary: string;
  confidence: number;
  suggestedNextStep: string;
  assigneeUserId?: Id;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEvent {
  id: Id;
  tenantId: Id;
  locationId: Id;
  taskId: Id;
  actorUserId?: Id;
  eventType: "created" | "assigned" | "status_changed" | "note_added" | "notification" | "source_linked" | "reopened";
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
  note?: string;
  createdAt: string;
}

export interface TaskStatusSummary {
  status: TaskStatus;
  label: string;
  count: number;
}

export interface TaskChannelSummary {
  channel: TaskChannel;
  count: number;
  label: string;
  unresolvedCount: number;
}

export interface TaskLocationSummary {
  count: number;
  label: string;
  locationId: Id;
  unresolvedCount: number;
}

export interface TaskAssigneeSummary {
  assigneeUserId?: Id;
  count: number;
  known: boolean;
  label: string;
  unresolvedCount: number;
  value: Id | "unassigned";
}

export interface TaskPersonalWorkSummary {
  activeCount: number;
  completedCount: number;
  ignoredCount: number;
  needsHumanCount: number;
  openCount: number;
  readyCount: number;
  totalCount: number;
}

export interface TaskSubmittedWorkSummary {
  taskIds: Id[];
  totalCount: number;
  unresolvedCount: number;
}

export interface TaskHumanIntakeContributorSummary {
  actorUserId?: Id;
  known: boolean;
  label: string;
  resolvedCount: number;
  totalCount: number;
  unresolvedCount: number;
}

export interface TaskContributorUser {
  id: Id;
  name: string;
}

export const STAFF_TASK_CLAIM_NOTE = "Task claimed through Outpost staff workboard.";
export const STAFF_TASK_RELEASE_NOTE = "Task released through Outpost staff workboard.";
export const STAFF_MANUAL_TASK_CREATED_NOTE = "Manual task created through Outpost staff workboard.";
export const STAFF_MANUAL_TASK_CLAIM_NOTE = "Task claimed during human-entered intake.";

export type TaskAgeBucket = "fresh" | "waiting" | "stale";

export interface TaskAgeSummary {
  ageBucket: TaskAgeBucket;
  count: number;
  detail: string;
  label: string;
  unresolvedCount: number;
}

export type TaskLastTouchBucket = "fresh_touch" | "quiet" | "stalled";

export interface TaskLastTouchSummary {
  count: number;
  detail: string;
  label: string;
  lastTouchBucket: TaskLastTouchBucket;
  unresolvedCount: number;
}

export type TaskConfidenceBucket = "low" | "medium" | "high";

export interface TaskConfidenceSummary {
  confidenceBucket: TaskConfidenceBucket;
  count: number;
  detail: string;
  label: string;
  unresolvedCount: number;
}

export interface TaskIntentSummary {
  count: number;
  fullLabel: string;
  intentKey: string;
  intentKeys: string[];
  label: string;
  unresolvedCount: number;
}

export interface TaskNextStepSummary {
  count: number;
  fullLabel: string;
  label: string;
  nextStepKey: string;
  nextStepKeys: string[];
  unresolvedCount: number;
}

export type TaskAttentionLevel = "attention" | "watch" | "clear";

export interface TaskAttentionProfile {
  detail: string;
  level: TaskAttentionLevel;
  reasons: string[];
}

export interface TaskAttentionSummary {
  count: number;
  detail: string;
  label: string;
  level: TaskAttentionLevel;
  unresolvedCount: number;
}

export type TaskRequesterContactKind = "email" | "phone" | "other";

export interface TaskRequesterContactSummary {
  contactKind: TaskRequesterContactKind;
  count: number;
  detail: string;
  label: string;
  unresolvedCount: number;
}

export type TaskFollowUpMode =
  | "phone_follow_up"
  | "email_follow_up"
  | "internal_follow_up"
  | "contact_check";

export interface TaskFollowUpModeSummary {
  count: number;
  detail: string;
  label: string;
  mode: TaskFollowUpMode;
  unresolvedCount: number;
}

export type TaskMemberSystemBoundary =
  | "member_system_blocked"
  | "staff_follow_up_only"
  | "closed_no_member_write";

export interface TaskMemberSystemBoundarySummary {
  boundary: TaskMemberSystemBoundary;
  count: number;
  detail: string;
  label: string;
  unresolvedCount: number;
}

export type TaskOwnerPolicyDependency =
  | "owner_policy_needed"
  | "staff_ready"
  | "closed_policy_done";

export interface TaskOwnerPolicyDependencySummary {
  count: number;
  dependency: TaskOwnerPolicyDependency;
  detail: string;
  label: string;
  unresolvedCount: number;
}

export type TaskStaffActionLane =
  | "member_system_hold"
  | "owner_policy_review"
  | "staff_reply_ready"
  | "closed";

export interface TaskStaffActionLaneSummary {
  count: number;
  detail: string;
  label: string;
  lane: TaskStaffActionLane;
  unresolvedCount: number;
}

export interface TaskActionLaneQueueItem {
  intent: string;
  requesterName: string;
  suggestedNextStep: string;
  taskId: Id;
}

export type TaskOwnerPolicyReviewQueueItem = TaskActionLaneQueueItem;
export type TaskStaffReplyReadyQueueItem = TaskActionLaneQueueItem;
export type TaskMemberSystemHoldQueueItem = TaskActionLaneQueueItem;

export type TaskActivityTrailKind = "staff_activity" | "source_only" | "no_trail";

export interface TaskActivityTrailSummary {
  count: number;
  detail: string;
  label: string;
  trailKind: TaskActivityTrailKind;
  unresolvedCount: number;
}

export type TaskActivityKind = "creation" | "assignment" | "status" | "note" | "system";

export interface TaskActivityItem {
  actorUserId?: Id;
  createdAt: string;
  detail?: string;
  event: TaskEvent;
  id: Id;
  kind: TaskActivityKind;
  note?: string;
  title: string;
}

export type TaskProofOrigin = "answer_review" | "manual_intake" | "provider_ingested" | "provider_stub";

export interface TaskProofSummary {
  checklist: Array<{
    done: boolean;
    label: string;
  }>;
  detail: string;
  isComplete: boolean;
  label: string;
  origin: TaskProofOrigin;
  sourceDetail: string;
  title: string;
}

export interface TaskProofOriginSummary {
  count: number;
  label: string;
  origin: TaskProofOrigin;
  unresolvedCount: number;
}

export type TaskProofCompletionState = "pending" | "complete";

export interface TaskProofCompletionSummary {
  count: number;
  detail: string;
  label: string;
  state: TaskProofCompletionState;
  unresolvedCount: number;
}

export type TaskWorkflowStage =
  | "unassigned_intake"
  | "ready_for_staff"
  | "in_progress"
  | "completed"
  | "ignored";

export interface TaskWorkflowStageSummary {
  count: number;
  detail: string;
  label: string;
  stage: TaskWorkflowStage;
  unresolvedCount: number;
}

export interface TaskQueueStateSummary {
  openCount: number;
  terminalCount: number;
  totalCount: number;
}

export interface TaskQueuePosition {
  current: number;
  total: number;
}

export type TaskQueueDirection = "previous" | "next";

export const taskProofOriginLabels: Record<TaskProofOrigin, string> = {
  answer_review: "Owner review",
  manual_intake: "Manual intake",
  provider_ingested: "Provider replay",
  provider_stub: "Seed tasks"
};

export const taskProofOrigins: TaskProofOrigin[] = [
  "answer_review",
  "manual_intake",
  "provider_ingested",
  "provider_stub"
];

export const taskProofCompletionStates: TaskProofCompletionState[] = ["pending", "complete"];

export const taskProofCompletionLabels: Record<TaskProofCompletionState, string> = {
  complete: "Proof complete",
  pending: "Proof pending"
};

export const taskProofCompletionDetails: Record<TaskProofCompletionState, string> = {
  complete: "terminal staff work",
  pending: "needs terminal status"
};

export const taskWorkflowStages: TaskWorkflowStage[] = [
  "unassigned_intake",
  "ready_for_staff",
  "in_progress",
  "completed",
  "ignored"
];

export const taskWorkflowStageLabels: Record<TaskWorkflowStage, string> = {
  completed: "Completed",
  ignored: "Ignored",
  in_progress: "In progress",
  ready_for_staff: "Ready for staff",
  unassigned_intake: "Unassigned intake"
};

export const taskWorkflowStageDetails: Record<TaskWorkflowStage, string> = {
  completed: "done",
  ignored: "ignored",
  in_progress: "being handled",
  ready_for_staff: "assigned open work",
  unassigned_intake: "needs owner"
};

export const taskAgeBuckets: TaskAgeBucket[] = ["fresh", "waiting", "stale"];

export const taskAgeBucketLabels: Record<TaskAgeBucket, string> = {
  fresh: "Fresh",
  stale: "Stale",
  waiting: "Waiting"
};

export const taskAgeBucketDetails: Record<TaskAgeBucket, string> = {
  fresh: "under 24h",
  stale: "3d or more",
  waiting: "1-3d old"
};

export const taskLastTouchBuckets: TaskLastTouchBucket[] = ["fresh_touch", "quiet", "stalled"];

export const taskLastTouchBucketLabels: Record<TaskLastTouchBucket, string> = {
  fresh_touch: "Fresh touch",
  quiet: "Quiet",
  stalled: "Stalled"
};

export const taskLastTouchBucketDetails: Record<TaskLastTouchBucket, string> = {
  fresh_touch: "updated under 24h",
  quiet: "no update 1-3d",
  stalled: "no update 3d+"
};

export const taskConfidenceBuckets: TaskConfidenceBucket[] = ["low", "medium", "high"];

export const taskConfidenceBucketLabels: Record<TaskConfidenceBucket, string> = {
  high: "High",
  low: "Low",
  medium: "Medium"
};

export const taskConfidenceBucketDetails: Record<TaskConfidenceBucket, string> = {
  high: "85%+",
  low: "under 70%",
  medium: "70-84%"
};

const unknownIntentKey = "__unknown_intent";
const otherIntentsKey = "__other_intents";
const maxTaskIntentLabelLength = 42;
const unknownNextStepKey = "__unknown_next_step";
const otherNextStepsKey = "__other_next_steps";
const maxTaskNextStepLabelLength = 46;

export const taskAttentionLevels: TaskAttentionLevel[] = ["attention", "watch", "clear"];

export const taskAttentionLevelLabels: Record<TaskAttentionLevel, string> = {
  attention: "Attention",
  clear: "Clear",
  watch: "Watch"
};

export const taskAttentionLevelDetails: Record<TaskAttentionLevel, string> = {
  attention: "human, stale, or low confidence",
  clear: "terminal or routine",
  watch: "waiting or medium confidence"
};

export const taskRequesterContactKinds: TaskRequesterContactKind[] = ["email", "phone", "other"];

export const taskRequesterContactKindLabels: Record<TaskRequesterContactKind, string> = {
  email: "Email",
  other: "Other",
  phone: "Phone"
};

export const taskRequesterContactKindDetails: Record<TaskRequesterContactKind, string> = {
  email: "email follow-up",
  other: "manual/reference follow-up",
  phone: "phone follow-up"
};

export const taskFollowUpModes: TaskFollowUpMode[] = [
  "phone_follow_up",
  "email_follow_up",
  "internal_follow_up",
  "contact_check"
];

export const taskFollowUpModeLabels: Record<TaskFollowUpMode, string> = {
  contact_check: "Contact check",
  email_follow_up: "Email follow-up",
  internal_follow_up: "Internal follow-up",
  phone_follow_up: "Phone follow-up"
};

export const taskFollowUpModeDetails: Record<TaskFollowUpMode, string> = {
  contact_check: "review contact",
  email_follow_up: "email-shaped",
  internal_follow_up: "manual/internal",
  phone_follow_up: "phone-shaped"
};

export const taskMemberSystemBoundaries: TaskMemberSystemBoundary[] = [
  "member_system_blocked",
  "staff_follow_up_only",
  "closed_no_member_write"
];

export const taskMemberSystemBoundaryLabels: Record<TaskMemberSystemBoundary, string> = {
  closed_no_member_write: "Closed no-write",
  member_system_blocked: "Member-system blocked",
  staff_follow_up_only: "Staff follow-up only"
};

export const taskMemberSystemBoundaryDetails: Record<TaskMemberSystemBoundary, string> = {
  closed_no_member_write: "terminal without writes",
  member_system_blocked: "billing, POS, access, or account boundary",
  staff_follow_up_only: "front-desk task only"
};

export const taskOwnerPolicyDependencies: TaskOwnerPolicyDependency[] = [
  "owner_policy_needed",
  "staff_ready",
  "closed_policy_done"
];

export const taskOwnerPolicyDependencyLabels: Record<TaskOwnerPolicyDependency, string> = {
  closed_policy_done: "Closed policy done",
  owner_policy_needed: "Owner policy needed",
  staff_ready: "Staff-ready"
};

export const taskOwnerPolicyDependencyDetails: Record<TaskOwnerPolicyDependency, string> = {
  closed_policy_done: "terminal policy state",
  owner_policy_needed: "owner approval or policy",
  staff_ready: "staff can follow up"
};

export const taskStaffActionLanes: TaskStaffActionLane[] = [
  "member_system_hold",
  "owner_policy_review",
  "staff_reply_ready",
  "closed"
];

export const taskStaffActionLaneLabels: Record<TaskStaffActionLane, string> = {
  closed: "Closed",
  member_system_hold: "Member-system hold",
  owner_policy_review: "Owner policy review",
  staff_reply_ready: "Staff reply-ready"
};

export const taskStaffActionLaneDetails: Record<TaskStaffActionLane, string> = {
  closed: "terminal work",
  member_system_hold: "do not write member systems",
  owner_policy_review: "needs owner judgment",
  staff_reply_ready: "staff can follow up"
};

export const taskActivityTrailKinds: TaskActivityTrailKind[] = [
  "staff_activity",
  "source_only",
  "no_trail"
];

export const taskActivityTrailKindLabels: Record<TaskActivityTrailKind, string> = {
  no_trail: "No trail",
  source_only: "Source only",
  staff_activity: "Staff activity"
};

export const taskActivityTrailKindDetails: Record<TaskActivityTrailKind, string> = {
  no_trail: "no task events yet",
  source_only: "created or source-linked",
  staff_activity: "assigned, status, note, or reopened"
};

const allowedTaskTransitions: Record<TaskStatus, TaskStatus[]> = {
  new: ["in_progress", "needs_human", "done", "ignored"],
  needs_human: ["in_progress", "done", "ignored"],
  in_progress: ["done", "needs_human", "ignored"],
  done: ["new"],
  ignored: ["new"]
};

let localEventCounter = 0;

function localEventId(prefix: string, taskId: Id, now: string) {
  localEventCounter += 1;

  return `${prefix}_${taskId}_${now.replaceAll(/[^0-9]/g, "")}_${localEventCounter}`;
}

function eventTypeLabel(eventType: TaskEvent["eventType"]) {
  return eventType.replaceAll("_", " ");
}

function answerReviewSourceFromEvent(taskEvents: TaskEvent[]) {
  const createdEvent = taskEvents.find(
    (event) =>
      event.eventType === "created" &&
      event.note?.toLowerCase().includes("answer-bank review")
  );
  const answerId = createdEvent?.note?.match(/item\s+([A-Za-z0-9_-]+)/u)?.[1];

  return {
    answerId,
    event: createdEvent
  };
}

function isOpaqueReference(value: string | undefined) {
  return Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu));
}

function answerReviewSourceDetail(task: Task, answerId: string | undefined) {
  if (!answerId) {
    return task.requesterContact || "Owner answer review";
  }

  if (isOpaqueReference(answerId)) {
    return task.requesterContact || `Internal answer reference ${answerId}`;
  }

  return `Answer review item ${answerId}`;
}

function providerSourceFromEvent(taskEvents: TaskEvent[]) {
  const sourceEvent = taskEvents.find(
    (event) => event.eventType === "source_linked" && event.note?.includes("Provider normalized source:")
  );

  if (!sourceEvent?.note) {
    return undefined;
  }

  const source = sourceEvent.note.match(/Provider normalized source:\s*([^;]+);/u)?.[1]?.trim();
  const reference = sourceEvent.note.match(/reference:\s*([^;]+);?/u)?.[1]?.trim();

  return {
    event: sourceEvent,
    reference,
    source
  };
}

export function isUnresolvedTask(task: Task): boolean {
  return unresolvedTaskStatuses.includes(task.status as (typeof unresolvedTaskStatuses)[number]);
}

export function tasksForTenant(tasks: Task[], tenantId: string): Task[] {
  return tasks.filter((task) => task.tenantId === tenantId);
}

export function taskForTenant(tasks: Task[], tenantId: Id, taskId: Id): Task | undefined {
  return tasks.find((task) => task.tenantId === tenantId && task.id === taskId);
}

export function taskEventsForTask(events: TaskEvent[], tenantId: Id, taskId: Id): TaskEvent[] {
  return events
    .filter((event) => event.tenantId === tenantId && event.taskId === taskId)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function taskActivityItemsForTask(
  events: TaskEvent[],
  tenantId: Id,
  taskId: Id
): TaskActivityItem[] {
  return taskEventsForTask(events, tenantId, taskId).map((event) => {
    switch (event.eventType) {
      case "created":
        return {
          actorUserId: event.actorUserId,
          createdAt: event.createdAt,
          detail: event.note,
          event,
          id: event.id,
          kind: "creation",
          title: "Task created"
        };
      case "assigned":
        return {
          actorUserId: event.actorUserId,
          createdAt: event.createdAt,
          detail: event.note,
          event,
          id: event.id,
          kind: "assignment",
          title: "Assignment changed"
        };
      case "status_changed":
        return {
          actorUserId: event.actorUserId,
          createdAt: event.createdAt,
          detail:
            event.fromStatus && event.toStatus
              ? `${taskStatusLabel(event.fromStatus)} -> ${taskStatusLabel(event.toStatus)}`
              : event.note,
          event,
          id: event.id,
          kind: "status",
          note: event.note,
          title: "Status changed"
        };
      case "note_added":
        return {
          actorUserId: event.actorUserId,
          createdAt: event.createdAt,
          event,
          id: event.id,
          kind: "note",
          note: event.note,
          title: "Staff note"
        };
      default:
        return {
          actorUserId: event.actorUserId,
          createdAt: event.createdAt,
          detail: event.note,
          event,
          id: event.id,
          kind: "system",
          title: eventTypeLabel(event.eventType)
        };
    }
  });
}

export function taskStatusSummaries(tasks: Task[]): TaskStatusSummary[] {
  return taskStatuses.map((status) => ({
    status,
    label: taskStatusLabel(status),
    count: tasks.filter((task) => task.status === status).length
  }));
}

export function taskChannelSummaries(tasks: Task[]): TaskChannelSummary[] {
  return taskChannels.map((channel) => {
    const channelTasks = tasks.filter((task) => task.channel === channel);

    return {
      channel,
      count: channelTasks.length,
      label: channel,
      unresolvedCount: channelTasks.filter(isUnresolvedTask).length
    };
  });
}

export function taskLocationSummaries(tasks: Task[], locations: Location[]): TaskLocationSummary[] {
  const locationSummaries = locations.map((location) => {
    const locationTasks = tasks.filter((task) => task.locationId === location.id);

    return {
      count: locationTasks.length,
      label: location.name,
      locationId: location.id,
      unresolvedCount: locationTasks.filter(isUnresolvedTask).length
    };
  });
  const knownLocationIds = new Set(locations.map((location) => location.id));
  const unknownTasks = tasks.filter((task) => !knownLocationIds.has(task.locationId));

  if (unknownTasks.length === 0) {
    return locationSummaries;
  }

  return [
    ...locationSummaries,
    {
      count: unknownTasks.length,
      label: "Unknown location",
      locationId: "unknown_location",
      unresolvedCount: unknownTasks.filter(isUnresolvedTask).length
    }
  ];
}

export function taskAssigneeSummaries(
  tasks: Task[],
  users: Array<Pick<User, "id" | "name">>
): TaskAssigneeSummary[] {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const assignedTaskGroups = new Map<Id, Task[]>();
  const unassignedTasks: Task[] = [];

  for (const task of tasks) {
    if (!task.assigneeUserId) {
      unassignedTasks.push(task);
      continue;
    }

    assignedTaskGroups.set(task.assigneeUserId, [
      ...(assignedTaskGroups.get(task.assigneeUserId) ?? []),
      task
    ]);
  }

  const assignedSummaries = [...assignedTaskGroups.entries()]
    .map(([assigneeUserId, assigneeTasks]) => {
      const user = usersById.get(assigneeUserId);

      return {
        assigneeUserId,
        count: assigneeTasks.length,
        known: Boolean(user),
        label: user?.name ?? "Unknown assignee",
        unresolvedCount: assigneeTasks.filter(isUnresolvedTask).length,
        value: assigneeUserId
      };
    })
    .sort((left, right) => {
      const labelDelta = left.label.localeCompare(right.label);

      if (labelDelta !== 0) {
        return labelDelta;
      }

      return left.assigneeUserId.localeCompare(right.assigneeUserId);
    });

  if (unassignedTasks.length === 0) {
    return assignedSummaries;
  }

  return [
    ...assignedSummaries,
    {
      count: unassignedTasks.length,
      known: true,
      label: "Unassigned",
      unresolvedCount: unassignedTasks.filter(isUnresolvedTask).length,
      value: "unassigned"
    }
  ];
}

export function taskPersonalWorkSummary(
  tasks: Task[],
  staffUserId: Id | undefined
): TaskPersonalWorkSummary {
  if (!staffUserId) {
    return {
      activeCount: 0,
      completedCount: 0,
      ignoredCount: 0,
      needsHumanCount: 0,
      openCount: 0,
      readyCount: 0,
      totalCount: 0
    };
  }

  const assignedTasks = tasks.filter((task) => task.assigneeUserId === staffUserId);

  return {
    activeCount: assignedTasks.filter((task) => task.status === "in_progress").length,
    completedCount: assignedTasks.filter((task) => task.status === "done").length,
    ignoredCount: assignedTasks.filter((task) => task.status === "ignored").length,
    needsHumanCount: assignedTasks.filter((task) => task.status === "needs_human").length,
    openCount: assignedTasks.filter(isUnresolvedTask).length,
    readyCount: assignedTasks.filter((task) => task.status === "new").length,
    totalCount: assignedTasks.length
  };
}

export function taskSubmittedWorkSummary(
  tasks: Task[],
  events: TaskEvent[],
  staffUserId: Id | undefined
): TaskSubmittedWorkSummary {
  if (!staffUserId) {
    return { taskIds: [], totalCount: 0, unresolvedCount: 0 };
  }

  const submittedTaskKeys = new Set(
    events
      .filter(
        (event) =>
          event.actorUserId === staffUserId &&
          event.eventType === "created" &&
          event.note === STAFF_MANUAL_TASK_CREATED_NOTE
      )
      .map((event) => `${event.tenantId}:${event.taskId}`)
  );
  const submittedTasks = tasks.filter((task) =>
    submittedTaskKeys.has(`${task.tenantId}:${task.id}`)
  );

  return {
    taskIds: submittedTasks.map((task) => task.id),
    totalCount: submittedTasks.length,
    unresolvedCount: submittedTasks.filter(isUnresolvedTask).length
  };
}

export function taskHumanIntakeContributorSummaries(
  tasks: Task[],
  events: TaskEvent[],
  users: TaskContributorUser[]
): TaskHumanIntakeContributorSummary[] {
  const createdEventByTaskKey = new Map<string, TaskEvent>();

  for (const event of events) {
    if (
      event.eventType !== "created" ||
      event.note !== STAFF_MANUAL_TASK_CREATED_NOTE
    ) {
      continue;
    }

    const taskKey = `${event.tenantId}:${event.taskId}`;
    const existingEvent = createdEventByTaskKey.get(taskKey);
    if (!existingEvent || Date.parse(event.createdAt) < Date.parse(existingEvent.createdAt)) {
      createdEventByTaskKey.set(taskKey, event);
    }
  }

  const usersById = new Map(users.map((user) => [user.id, user]));
  const tasksByActor = new Map<Id | "unknown", Task[]>();
  for (const task of tasks) {
    const taskKey = `${task.tenantId}:${task.id}`;
    const createdEvent = createdEventByTaskKey.get(taskKey);
    if (!createdEvent) continue;
    const actorKey =
      createdEvent.actorUserId && usersById.has(createdEvent.actorUserId)
        ? createdEvent.actorUserId
        : "unknown";
    tasksByActor.set(actorKey, [...(tasksByActor.get(actorKey) ?? []), task]);
  }

  return [...tasksByActor.entries()]
    .map(([actorKey, actorTasks]) => {
      const user = actorKey === "unknown" ? undefined : usersById.get(actorKey);
      const unresolvedCount = actorTasks.filter(isUnresolvedTask).length;

      return {
        actorUserId: actorKey === "unknown" ? undefined : actorKey,
        known: Boolean(user),
        label: user?.name ?? "Unknown staff",
        resolvedCount: actorTasks.length - unresolvedCount,
        totalCount: actorTasks.length,
        unresolvedCount
      };
    })
    .sort((left, right) => {
      const labelDelta = left.label.localeCompare(right.label);
      if (labelDelta !== 0) return labelDelta;
      return (left.actorUserId ?? "").localeCompare(right.actorUserId ?? "");
    });
}

export function taskAgeBucketForTask(task: Task, referenceTime = new Date()): TaskAgeBucket {
  const ageMs = Math.max(0, referenceTime.getTime() - Date.parse(task.createdAt));
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 24) {
    return "fresh";
  }

  if (ageHours < 72) {
    return "waiting";
  }

  return "stale";
}

export function taskLastTouchBucketForTask(
  task: Task,
  referenceTime = new Date()
): TaskLastTouchBucket {
  const ageMs = Math.max(0, referenceTime.getTime() - Date.parse(task.updatedAt));
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 24) {
    return "fresh_touch";
  }

  if (ageHours < 72) {
    return "quiet";
  }

  return "stalled";
}

export function taskAttentionProfileForTask(
  task: Task,
  referenceTime = new Date()
): TaskAttentionProfile {
  const unresolved = isUnresolvedTask(task);

  if (!unresolved) {
    return {
      detail: "terminal or routine",
      level: "clear",
      reasons: ["terminal"]
    };
  }

  const confidenceBucket = taskConfidenceBucketForTask(task);
  const ageBucket = taskAgeBucketForTask(task, referenceTime);
  const attentionReasons = [
    task.status === "needs_human" ? "human review" : null,
    ageBucket === "stale" ? "stale" : null,
    confidenceBucket === "low" ? "low confidence" : null
  ].filter((reason): reason is string => reason !== null);

  if (attentionReasons.length > 0) {
    return {
      detail: attentionReasons.join(" + "),
      level: "attention",
      reasons: attentionReasons
    };
  }

  const watchReasons = [
    ageBucket === "waiting" ? "waiting" : null,
    confidenceBucket === "medium" ? "medium confidence" : null
  ].filter((reason): reason is string => reason !== null);

  if (watchReasons.length > 0) {
    return {
      detail: watchReasons.join(" + "),
      level: "watch",
      reasons: watchReasons
    };
  }

  return {
    detail: "routine",
    level: "clear",
    reasons: ["routine"]
  };
}

export function taskAgeSummaries(
  tasks: Task[],
  referenceTime = new Date()
): TaskAgeSummary[] {
  return taskAgeBuckets.map((ageBucket) => {
    const bucketTasks = tasks.filter(
      (task) => taskAgeBucketForTask(task, referenceTime) === ageBucket
    );

    return {
      ageBucket,
      count: bucketTasks.length,
      detail: taskAgeBucketDetails[ageBucket],
      label: taskAgeBucketLabels[ageBucket],
      unresolvedCount: bucketTasks.filter(isUnresolvedTask).length
    };
  });
}

export function taskLastTouchSummaries(
  tasks: Task[],
  referenceTime = new Date()
): TaskLastTouchSummary[] {
  return taskLastTouchBuckets.map((lastTouchBucket) => {
    const bucketTasks = tasks.filter(
      (task) => taskLastTouchBucketForTask(task, referenceTime) === lastTouchBucket
    );

    return {
      count: bucketTasks.length,
      detail: taskLastTouchBucketDetails[lastTouchBucket],
      label: taskLastTouchBucketLabels[lastTouchBucket],
      lastTouchBucket,
      unresolvedCount: bucketTasks.filter(isUnresolvedTask).length
    };
  });
}

export function taskAttentionSummaries(
  tasks: Task[],
  referenceTime = new Date()
): TaskAttentionSummary[] {
  return taskAttentionLevels.map((level) => {
    const levelTasks = tasks.filter(
      (task) => taskAttentionProfileForTask(task, referenceTime).level === level
    );

    return {
      count: levelTasks.length,
      detail: taskAttentionLevelDetails[level],
      label: taskAttentionLevelLabels[level],
      level,
      unresolvedCount: levelTasks.filter(isUnresolvedTask).length
    };
  });
}

export function taskRequesterContactKindForTask(task: Task): TaskRequesterContactKind {
  const contact = task.requesterContact.trim();

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(contact)) {
    return "email";
  }

  const digitCount = (contact.match(/\d/gu) ?? []).length;
  const phoneShaped = /^[+()\-\s.\d]+$/u.test(contact);

  if (digitCount >= 7 && phoneShaped) {
    return "phone";
  }

  return "other";
}

export function taskRequesterContactSummaries(tasks: Task[]): TaskRequesterContactSummary[] {
  return taskRequesterContactKinds.map((contactKind) => {
    const contactTasks = tasks.filter(
      (task) => taskRequesterContactKindForTask(task) === contactKind
    );

    return {
      contactKind,
      count: contactTasks.length,
      detail: taskRequesterContactKindDetails[contactKind],
      label: taskRequesterContactKindLabels[contactKind],
      unresolvedCount: contactTasks.filter(isUnresolvedTask).length
    };
  });
}

export function taskFollowUpModeForTask(task: Task): TaskFollowUpMode {
  if (task.channel === "manual") {
    return "internal_follow_up";
  }

  const contactKind = taskRequesterContactKindForTask(task);

  if (task.channel === "phone" || contactKind === "phone") {
    return "phone_follow_up";
  }

  if (contactKind === "email") {
    return "email_follow_up";
  }

  return "contact_check";
}

export function taskFollowUpModeSummaries(tasks: Task[]): TaskFollowUpModeSummary[] {
  return taskFollowUpModes.map((mode) => {
    const modeTasks = tasks.filter((task) => taskFollowUpModeForTask(task) === mode);

    return {
      count: modeTasks.length,
      detail: taskFollowUpModeDetails[mode],
      label: taskFollowUpModeLabels[mode],
      mode,
      unresolvedCount: modeTasks.filter(isUnresolvedTask).length
    };
  });
}

function taskBoundaryText(task: Task) {
  return [task.intent, task.summary, task.suggestedNextStep]
    .join(" ")
    .trim()
    .toLowerCase();
}

export function taskMemberSystemBoundaryForTask(task: Task): TaskMemberSystemBoundary {
  if (!isUnresolvedTask(task)) {
    return "closed_no_member_write";
  }

  const boundaryText = taskBoundaryText(task);
  const touchesMemberSystem =
    /\b(billing|payment|payments|pos|access control|member ledger|ledger|membership|freeze|cancel|cancellation|account change|account changes|member account|door access|key fob|club automation)\b/u.test(
      boundaryText
    );

  return touchesMemberSystem ? "member_system_blocked" : "staff_follow_up_only";
}

export function taskMemberSystemBoundarySummaries(
  tasks: Task[]
): TaskMemberSystemBoundarySummary[] {
  return taskMemberSystemBoundaries.map((boundary) => {
    const boundaryTasks = tasks.filter(
      (task) => taskMemberSystemBoundaryForTask(task) === boundary
    );

    return {
      boundary,
      count: boundaryTasks.length,
      detail: taskMemberSystemBoundaryDetails[boundary],
      label: taskMemberSystemBoundaryLabels[boundary],
      unresolvedCount: boundaryTasks.filter(isUnresolvedTask).length
    };
  });
}

export function taskOwnerPolicyDependencyForTask(task: Task): TaskOwnerPolicyDependency {
  if (!isUnresolvedTask(task)) {
    return "closed_policy_done";
  }

  const boundaryText = taskBoundaryText(task);
  const needsOwnerPolicy =
    /\b(owner|approved|approval|policy|staffed[-\s]?hour|pricing|price|membership|freeze|cancel|cancellation)\b/u.test(
      boundaryText
    );

  return needsOwnerPolicy ? "owner_policy_needed" : "staff_ready";
}

export function taskOwnerPolicyDependencySummaries(
  tasks: Task[]
): TaskOwnerPolicyDependencySummary[] {
  return taskOwnerPolicyDependencies.map((dependency) => {
    const dependencyTasks = tasks.filter(
      (task) => taskOwnerPolicyDependencyForTask(task) === dependency
    );

    return {
      count: dependencyTasks.length,
      dependency,
      detail: taskOwnerPolicyDependencyDetails[dependency],
      label: taskOwnerPolicyDependencyLabels[dependency],
      unresolvedCount: dependencyTasks.filter(isUnresolvedTask).length
    };
  });
}

export function taskStaffActionLaneForTask(task: Task): TaskStaffActionLane {
  if (!isUnresolvedTask(task)) {
    return "closed";
  }

  if (taskMemberSystemBoundaryForTask(task) === "member_system_blocked") {
    return "member_system_hold";
  }

  if (taskOwnerPolicyDependencyForTask(task) === "owner_policy_needed") {
    return "owner_policy_review";
  }

  return "staff_reply_ready";
}

export function taskStaffActionLaneSummaries(tasks: Task[]): TaskStaffActionLaneSummary[] {
  return taskStaffActionLanes.map((lane) => {
    const laneTasks = tasks.filter((task) => taskStaffActionLaneForTask(task) === lane);

    return {
      count: laneTasks.length,
      detail: taskStaffActionLaneDetails[lane],
      label: taskStaffActionLaneLabels[lane],
      lane,
      unresolvedCount: laneTasks.filter(isUnresolvedTask).length
    };
  });
}

function taskActionLaneQueue(
  tasks: Task[],
  lane: TaskStaffActionLane,
  maxItems: number
): TaskActionLaneQueueItem[] {
  return sortTasksForInbox(tasks)
    .filter((task) => taskStaffActionLaneForTask(task) === lane)
    .slice(0, Math.max(0, maxItems))
    .map((task) => ({
      intent: task.intent,
      requesterName: task.requesterName,
      suggestedNextStep: task.suggestedNextStep,
      taskId: task.id
    }));
}

export function taskOwnerPolicyReviewQueue(
  tasks: Task[],
  maxItems = 4
): TaskOwnerPolicyReviewQueueItem[] {
  return taskActionLaneQueue(tasks, "owner_policy_review", maxItems);
}

export function taskMemberSystemHoldQueue(
  tasks: Task[],
  maxItems = 4
): TaskMemberSystemHoldQueueItem[] {
  return taskActionLaneQueue(tasks, "member_system_hold", maxItems);
}

export function taskStaffReplyReadyQueue(
  tasks: Task[],
  maxItems = 4
): TaskStaffReplyReadyQueueItem[] {
  return taskActionLaneQueue(tasks, "staff_reply_ready", maxItems);
}

export function taskActivityTrailKindForTask(
  task: Task,
  events: TaskEvent[]
): TaskActivityTrailKind {
  const taskEvents = taskEventsForTask(events, task.tenantId, task.id);

  if (taskEvents.length === 0) {
    return "no_trail";
  }

  if (
    taskEvents.some((event) =>
      ["assigned", "status_changed", "note_added", "reopened"].includes(event.eventType)
    )
  ) {
    return "staff_activity";
  }

  return "source_only";
}

export function taskActivityTrailSummaries(
  tasks: Task[],
  events: TaskEvent[]
): TaskActivityTrailSummary[] {
  return taskActivityTrailKinds.map((trailKind) => {
    const trailTasks = tasks.filter((task) => taskActivityTrailKindForTask(task, events) === trailKind);

    return {
      count: trailTasks.length,
      detail: taskActivityTrailKindDetails[trailKind],
      label: taskActivityTrailKindLabels[trailKind],
      trailKind,
      unresolvedCount: trailTasks.filter(isUnresolvedTask).length
    };
  });
}

export function taskConfidenceBucketForTask(task: Task): TaskConfidenceBucket {
  const confidence = normalizeTaskConfidence(task.confidence);

  if (confidence < 0.7) {
    return "low";
  }

  if (confidence < 0.85) {
    return "medium";
  }

  return "high";
}

export function taskConfidenceSummaries(tasks: Task[]): TaskConfidenceSummary[] {
  return taskConfidenceBuckets.map((confidenceBucket) => {
    const bucketTasks = tasks.filter(
      (task) => taskConfidenceBucketForTask(task) === confidenceBucket
    );

    return {
      confidenceBucket,
      count: bucketTasks.length,
      detail: taskConfidenceBucketDetails[confidenceBucket],
      label: taskConfidenceBucketLabels[confidenceBucket],
      unresolvedCount: bucketTasks.filter(isUnresolvedTask).length
    };
  });
}

export function taskIntentKeyForTask(task: Task): string {
  const intentKey = task.intent.trim().toLowerCase().replaceAll(/\s+/gu, " ");

  return intentKey ? `intent:${intentKey}` : unknownIntentKey;
}

function taskIntentLabel(intent: string): string {
  const label = taskIntentFullLabel(intent);

  if (!label) {
    return "Unknown intent";
  }

  if (label.length <= maxTaskIntentLabelLength) {
    return label;
  }

  return `${label.slice(0, maxTaskIntentLabelLength - 3).trimEnd()}...`;
}

function taskIntentFullLabel(intent: string): string {
  return intent.trim().replaceAll(/\s+/gu, " ");
}

function withTaskIntentLabelSuffix(label: string, suffix: string): string {
  if (label.length + suffix.length <= maxTaskIntentLabelLength) {
    return `${label}${suffix}`;
  }

  return `${label.slice(0, maxTaskIntentLabelLength - suffix.length).trimEnd()}${suffix}`;
}

function disambiguateTaskIntentLabels(summaries: TaskIntentSummary[]): TaskIntentSummary[] {
  const summariesByLabel = new Map<string, TaskIntentSummary[]>();

  for (const summary of summaries) {
    const matchingSummaries = summariesByLabel.get(summary.label);

    if (matchingSummaries) {
      matchingSummaries.push(summary);
    } else {
      summariesByLabel.set(summary.label, [summary]);
    }
  }

  const duplicateLabels = new Map<TaskIntentSummary, string>();

  for (const matchingSummaries of summariesByLabel.values()) {
    if (matchingSummaries.length < 2) {
      continue;
    }

    matchingSummaries
      .sort((left, right) => left.fullLabel.localeCompare(right.fullLabel))
      .forEach((summary, index) => {
        duplicateLabels.set(summary, withTaskIntentLabelSuffix(summary.label, ` #${index + 1}`));
      });
  }

  return summaries.map((summary) => ({
    ...summary,
    label: duplicateLabels.get(summary) ?? summary.label
  }));
}

export function taskIntentSummaries(tasks: Task[], maxSummaries = 6): TaskIntentSummary[] {
  const groupedTasks = new Map<string, Task[]>();
  const fullLabelsByKey = new Map<string, string>();
  const labelsByKey = new Map<string, string>();

  for (const task of tasks) {
    const intentKey = taskIntentKeyForTask(task);
    const intentTasks = groupedTasks.get(intentKey);

    if (intentTasks) {
      intentTasks.push(task);
    } else {
      groupedTasks.set(intentKey, [task]);
    }

    if (!labelsByKey.has(intentKey)) {
      fullLabelsByKey.set(intentKey, taskIntentFullLabel(task.intent) || "Unknown intent");
      labelsByKey.set(intentKey, taskIntentLabel(task.intent));
    }
  }

  const summaries = [...groupedTasks.entries()]
    .map(([intentKey, intentTasks]) => ({
      count: intentTasks.length,
      fullLabel: fullLabelsByKey.get(intentKey) ?? "Unknown intent",
      intentKey,
      intentKeys: [intentKey],
      label: labelsByKey.get(intentKey) ?? "Unknown intent",
      unresolvedCount: intentTasks.filter(isUnresolvedTask).length
    }))
    .sort((left, right) => {
      const unresolvedDelta = right.unresolvedCount - left.unresolvedCount;

      if (unresolvedDelta !== 0) {
        return unresolvedDelta;
      }

      const countDelta = right.count - left.count;

      if (countDelta !== 0) {
        return countDelta;
      }

      return left.label.localeCompare(right.label);
    });

  if (maxSummaries < 2 || summaries.length <= maxSummaries) {
    return disambiguateTaskIntentLabels(summaries);
  }

  const visibleSummaries = summaries.slice(0, maxSummaries - 1);
  const otherSummaries = summaries.slice(maxSummaries - 1);

  return disambiguateTaskIntentLabels([
    ...visibleSummaries,
    {
      count: otherSummaries.reduce((total, summary) => total + summary.count, 0),
      fullLabel: "Other intents",
      intentKey: otherIntentsKey,
      intentKeys: otherSummaries.flatMap((summary) => summary.intentKeys),
      label: "Other intents",
      unresolvedCount: otherSummaries.reduce(
        (total, summary) => total + summary.unresolvedCount,
        0
      )
    }
  ]);
}

export function taskNextStepKeyForTask(task: Task): string {
  const nextStepKey = task.suggestedNextStep.trim().toLowerCase().replaceAll(/\s+/gu, " ");

  return nextStepKey ? `next_step:${nextStepKey}` : unknownNextStepKey;
}

function taskNextStepFullLabel(nextStep: string): string {
  return nextStep.trim().replaceAll(/\s+/gu, " ");
}

function taskNextStepLabel(nextStep: string): string {
  const label = taskNextStepFullLabel(nextStep);

  if (!label) {
    return "Unknown next step";
  }

  if (label.length <= maxTaskNextStepLabelLength) {
    return label;
  }

  return `${label.slice(0, maxTaskNextStepLabelLength - 3).trimEnd()}...`;
}

function withTaskNextStepLabelSuffix(label: string, suffix: string): string {
  if (label.length + suffix.length <= maxTaskNextStepLabelLength) {
    return `${label}${suffix}`;
  }

  return `${label.slice(0, maxTaskNextStepLabelLength - suffix.length).trimEnd()}${suffix}`;
}

function disambiguateTaskNextStepLabels(
  summaries: TaskNextStepSummary[]
): TaskNextStepSummary[] {
  const summariesByLabel = new Map<string, TaskNextStepSummary[]>();

  for (const summary of summaries) {
    const matchingSummaries = summariesByLabel.get(summary.label);

    if (matchingSummaries) {
      matchingSummaries.push(summary);
    } else {
      summariesByLabel.set(summary.label, [summary]);
    }
  }

  const duplicateLabels = new Map<TaskNextStepSummary, string>();

  for (const matchingSummaries of summariesByLabel.values()) {
    if (matchingSummaries.length < 2) {
      continue;
    }

    matchingSummaries
      .sort((left, right) => left.fullLabel.localeCompare(right.fullLabel))
      .forEach((summary, index) => {
        duplicateLabels.set(
          summary,
          withTaskNextStepLabelSuffix(summary.label, ` #${index + 1}`)
        );
      });
  }

  return summaries.map((summary) => ({
    ...summary,
    label: duplicateLabels.get(summary) ?? summary.label
  }));
}

export function taskNextStepSummaries(tasks: Task[], maxSummaries = 6): TaskNextStepSummary[] {
  const groupedTasks = new Map<string, Task[]>();
  const fullLabelsByKey = new Map<string, string>();
  const labelsByKey = new Map<string, string>();

  for (const task of tasks) {
    const nextStepKey = taskNextStepKeyForTask(task);
    const nextStepTasks = groupedTasks.get(nextStepKey);

    if (nextStepTasks) {
      nextStepTasks.push(task);
    } else {
      groupedTasks.set(nextStepKey, [task]);
    }

    if (!labelsByKey.has(nextStepKey)) {
      fullLabelsByKey.set(
        nextStepKey,
        taskNextStepFullLabel(task.suggestedNextStep) || "Unknown next step"
      );
      labelsByKey.set(nextStepKey, taskNextStepLabel(task.suggestedNextStep));
    }
  }

  const summaries = [...groupedTasks.entries()]
    .map(([nextStepKey, nextStepTasks]) => ({
      count: nextStepTasks.length,
      fullLabel: fullLabelsByKey.get(nextStepKey) ?? "Unknown next step",
      label: labelsByKey.get(nextStepKey) ?? "Unknown next step",
      nextStepKey,
      nextStepKeys: [nextStepKey],
      unresolvedCount: nextStepTasks.filter(isUnresolvedTask).length
    }))
    .sort((left, right) => {
      const unresolvedDelta = right.unresolvedCount - left.unresolvedCount;

      if (unresolvedDelta !== 0) {
        return unresolvedDelta;
      }

      const countDelta = right.count - left.count;

      if (countDelta !== 0) {
        return countDelta;
      }

      return left.label.localeCompare(right.label);
    });

  if (maxSummaries < 2 || summaries.length <= maxSummaries) {
    return disambiguateTaskNextStepLabels(summaries);
  }

  const visibleSummaries = summaries.slice(0, maxSummaries - 1);
  const otherSummaries = summaries.slice(maxSummaries - 1);

  return disambiguateTaskNextStepLabels([
    ...visibleSummaries,
    {
      count: otherSummaries.reduce((total, summary) => total + summary.count, 0),
      fullLabel: "Other next steps",
      label: "Other next steps",
      nextStepKey: otherNextStepsKey,
      nextStepKeys: otherSummaries.flatMap((summary) => summary.nextStepKeys),
      unresolvedCount: otherSummaries.reduce(
        (total, summary) => total + summary.unresolvedCount,
        0
      )
    }
  ]);
}

export function taskProofOriginSummaries(
  tasks: Task[],
  taskEvents: TaskEvent[] = []
): TaskProofOriginSummary[] {
  const counts = new Map<TaskProofOrigin, number>(taskProofOrigins.map((origin) => [origin, 0]));
  const unresolvedCounts = new Map<TaskProofOrigin, number>(
    taskProofOrigins.map((origin) => [origin, 0])
  );

  for (const task of tasks) {
    const origin = taskProofSummary(task, taskEvents).origin;
    counts.set(origin, (counts.get(origin) ?? 0) + 1);
    if (isUnresolvedTask(task)) {
      unresolvedCounts.set(origin, (unresolvedCounts.get(origin) ?? 0) + 1);
    }
  }

  return taskProofOrigins.map((origin) => ({
    count: counts.get(origin) ?? 0,
    label: taskProofOriginLabels[origin],
    origin,
    unresolvedCount: unresolvedCounts.get(origin) ?? 0
  }));
}

export function taskProofCompletionStateForTask(
  task: Task,
  taskEvents: TaskEvent[] = []
): TaskProofCompletionState {
  return taskProofSummary(task, taskEvents).isComplete ? "complete" : "pending";
}

export function taskProofCompletionSummaries(
  tasks: Task[],
  taskEvents: TaskEvent[] = []
): TaskProofCompletionSummary[] {
  const counts = new Map<TaskProofCompletionState, number>(
    taskProofCompletionStates.map((state) => [state, 0])
  );
  const unresolvedCounts = new Map<TaskProofCompletionState, number>(
    taskProofCompletionStates.map((state) => [state, 0])
  );

  for (const task of tasks) {
    const completionState = taskProofCompletionStateForTask(task, taskEvents);
    counts.set(completionState, (counts.get(completionState) ?? 0) + 1);
    if (isUnresolvedTask(task)) {
      unresolvedCounts.set(completionState, (unresolvedCounts.get(completionState) ?? 0) + 1);
    }
  }

  return taskProofCompletionStates.map((state) => ({
    count: counts.get(state) ?? 0,
    detail: taskProofCompletionDetails[state],
    label: taskProofCompletionLabels[state],
    state,
    unresolvedCount: unresolvedCounts.get(state) ?? 0
  }));
}

export function taskWorkflowStageForTask(task: Task): TaskWorkflowStage {
  if (task.status === "done") {
    return "completed";
  }

  if (task.status === "ignored") {
    return "ignored";
  }

  if (task.status === "in_progress") {
    return "in_progress";
  }

  return task.assigneeUserId ? "ready_for_staff" : "unassigned_intake";
}

export function taskWorkflowStageSummaries(tasks: Task[]): TaskWorkflowStageSummary[] {
  return taskWorkflowStages.map((stage) => {
    const stageTasks = tasks.filter((task) => taskWorkflowStageForTask(task) === stage);

    return {
      count: stageTasks.length,
      detail: taskWorkflowStageDetails[stage],
      label: taskWorkflowStageLabels[stage],
      stage,
      unresolvedCount: stageTasks.filter(isUnresolvedTask).length
    };
  });
}

export function taskQueueStateSummary(tasks: Task[]): TaskQueueStateSummary {
  const openCount = tasks.filter(isUnresolvedTask).length;

  return {
    openCount,
    terminalCount: tasks.length - openCount,
    totalCount: tasks.length
  };
}

export function sortTasksForInbox(tasks: Task[]): Task[] {
  const priority: Record<TaskStatus, number> = {
    needs_human: 0,
    new: 1,
    in_progress: 2,
    done: 3,
    ignored: 4
  };

  return [...tasks].sort((left, right) => {
    const priorityDelta = priority[left.status] - priority[right.status];
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

export function resolveTaskSelectionId(
  tasks: Task[],
  requestedTaskId?: Id
): Id | undefined {
  if (requestedTaskId && tasks.some((task) => task.id === requestedTaskId)) {
    return requestedTaskId;
  }

  return sortTasksForInbox(tasks)[0]?.id;
}

export function taskQueuePosition(
  tasks: Task[],
  selectedTaskId: Id | undefined
): TaskQueuePosition {
  const selectedIndex = selectedTaskId
    ? tasks.findIndex((task) => task.id === selectedTaskId)
    : -1;

  return {
    current: selectedIndex >= 0 ? selectedIndex + 1 : 0,
    total: tasks.length
  };
}

function normalizeTaskClipboardField(value: string, fallback: string): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized || fallback;
}

export function taskStaffClipboardBrief(task: Task): string {
  return [
    `Requester: ${normalizeTaskClipboardField(task.requesterName, "Unknown requester")}`,
    `Contact: ${normalizeTaskClipboardField(task.requesterContact, "Not provided")}`,
    `Channel: ${displayLabel(task.channel)}`,
    `Intent: ${normalizeTaskClipboardField(task.intent, "Not provided")}`,
    `Summary: ${normalizeTaskClipboardField(task.summary, "Not provided")}`,
    `Next step: ${normalizeTaskClipboardField(task.suggestedNextStep, "Not provided")}`
  ].join("\n");
}

export function adjacentTaskId(
  tasks: Task[],
  selectedTaskId: Id | undefined,
  direction: TaskQueueDirection
): Id | undefined {
  const selectedIndex = selectedTaskId
    ? tasks.findIndex((task) => task.id === selectedTaskId)
    : -1;

  if (selectedIndex < 0) {
    return undefined;
  }

  const adjacentIndex = selectedIndex + (direction === "previous" ? -1 : 1);
  return tasks[adjacentIndex]?.id;
}

export const staffTaskPath = "/staff/tasks";
export const staffTaskIdSearchParam = "taskId";
export const maxStaffTaskIdSearchParamLength = 128;

export function staffTaskDeepLink(origin: string, taskId: Id): string {
  const url = new URL(staffTaskPath, origin);
  url.searchParams.set(staffTaskIdSearchParam, taskId);
  return url.toString();
}

export function canTransitionTaskStatus(fromStatus: TaskStatus, toStatus: TaskStatus): boolean {
  if (fromStatus === toStatus) {
    return true;
  }

  return allowedTaskTransitions[fromStatus].includes(toStatus);
}

export function allowedNextTaskStatuses(status: TaskStatus): TaskStatus[] {
  return allowedTaskTransitions[status];
}

export function canStaffStartTask(task: Task, staffUserId: Id | undefined): boolean {
  return (
    Boolean(staffUserId) &&
    task.assigneeUserId === staffUserId &&
    (task.status === "new" || task.status === "needs_human")
  );
}

export function canStaffMarkTaskNeedsHuman(task: Task, staffUserId: Id | undefined): boolean {
  return (
    Boolean(staffUserId) &&
    task.assigneeUserId === staffUserId &&
    task.status === "in_progress"
  );
}

export function canStaffMarkTaskDone(task: Task, staffUserId: Id | undefined): boolean {
  return Boolean(staffUserId) && task.assigneeUserId === staffUserId && task.status === "in_progress";
}

export function canStaffMarkTaskIgnored(task: Task, staffUserId: Id | undefined): boolean {
  return Boolean(staffUserId) && task.assigneeUserId === staffUserId && task.status === "in_progress";
}

export function canStaffReopenTask(task: Task): boolean {
  return task.status === "done" || task.status === "ignored";
}

export function normalizeTaskConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) {
    return 0;
  }

  return Math.min(1, Math.max(0, confidence));
}

export function taskProofSummary(task: Task, taskEvents: TaskEvent[] = []): TaskProofSummary {
  const matchingEvents = taskEventsForTask(taskEvents, task.tenantId, task.id);
  const answerSource = answerReviewSourceFromEvent(matchingEvents);
  const isAnswerReviewTask =
    answerSource.event !== undefined ||
    task.requesterName.toLowerCase() === "owner review" ||
    task.summary.toLowerCase().includes("owner requested staff follow-up for answer");
  const assigned = Boolean(task.assigneeUserId);
  const terminal = !isUnresolvedTask(task);

  if (isAnswerReviewTask) {
    return {
      checklist: [
        { done: true, label: "Owner review created this staff task" },
        { done: assigned, label: assigned ? "Task has an owner" : "Assign or take ownership" },
        { done: terminal, label: terminal ? "Task is terminal" : "Resolve or ignore after staff action" }
      ],
      detail:
        "Use this task to prove the owner answer-review path reaches staff work before any live answer or provider is enabled.",
      isComplete: terminal,
      label: terminal ? "Proof complete" : "Answer review proof",
      origin: "answer_review",
      sourceDetail: answerReviewSourceDetail(task, answerSource.answerId),
      title: "Owner answer review task"
    };
  }

  const isManualIntake =
    task.channel === "manual" ||
    matchingEvents.some(
      (event) => event.eventType === "created" && event.note === STAFF_MANUAL_TASK_CREATED_NOTE
    );

  if (isManualIntake) {
    return {
      checklist: [
        { done: true, label: "Manual task captured" },
        { done: assigned, label: assigned ? "Task has an owner" : "Assign or take ownership" },
        { done: terminal, label: terminal ? "Task is terminal" : "Resolve or ignore after staff action" }
      ],
      detail:
        "Human-entered staff work proves the task queue without connecting phone, email, or source providers.",
      isComplete: terminal,
      label: terminal ? "Manual proof complete" : "Manual task proof",
      origin: "manual_intake",
      sourceDetail: task.requesterContact,
      title: "Manual task proof"
    };
  }

  const providerSource = providerSourceFromEvent(matchingEvents);

  if (providerSource) {
    return {
      checklist: [
        { done: true, label: "Provider fixture normalized into this staff task" },
        { done: assigned, label: assigned ? "Task has an owner" : "Assign or take ownership" },
        { done: terminal, label: terminal ? "Task is terminal" : "Resolve or ignore after staff action" }
      ],
      detail:
        "Provider-ingested tasks come from sanitized hosted fixture replay only; live phone and email providers remain blocked.",
      isComplete: terminal,
      label: terminal ? "Provider proof complete" : "Provider replay proof",
      origin: "provider_ingested",
      sourceDetail: [providerSource.source, providerSource.reference].filter(Boolean).join(" · "),
      title: "Provider-normalized task"
    };
  }

  return {
    checklist: [
      { done: true, label: `${taskStatusLabel(task.status)} task loaded` },
      { done: assigned, label: assigned ? "Task has an owner" : "Assign or take ownership" },
      { done: terminal, label: terminal ? "Task is terminal" : "Resolve or ignore after staff action" }
    ],
    detail:
      "Provider-ingested tasks are still local seed data until hosted proof and provider setup are complete.",
    isComplete: terminal,
    label: terminal ? "Seed proof complete" : "Seed task proof",
    origin: "provider_stub",
    sourceDetail: task.requesterContact,
    title: "Seeded front-desk task"
  };
}

export function buildTaskStatusChangedEvent(
  task: Task,
  toStatus: TaskStatus,
  actorUserId: Id | undefined,
  now = new Date().toISOString()
): TaskEvent | undefined {
  if (!canTransitionTaskStatus(task.status, toStatus) || task.status === toStatus) {
    return undefined;
  }

  const reopened = (task.status === "done" || task.status === "ignored") && toStatus === "new";

  return {
    id: localEventId("task_event_status", task.id, now),
    tenantId: task.tenantId,
    locationId: task.locationId,
    taskId: task.id,
    actorUserId,
    eventType: reopened ? "reopened" : "status_changed",
    fromStatus: task.status,
    toStatus,
    note: reopened
      ? `Task reopened from ${taskStatusLabel(task.status)} to ${taskStatusLabel(toStatus)} locally.`
      : `Status changed from ${taskStatusLabel(task.status)} to ${taskStatusLabel(toStatus)} locally.`,
    createdAt: now
  };
}

export function transitionTaskStatus(
  task: Task,
  toStatus: TaskStatus,
  actorUserId: Id | undefined,
  now = new Date().toISOString()
): { task: Task; event?: TaskEvent; changed: boolean } {
  const event = buildTaskStatusChangedEvent(task, toStatus, actorUserId, now);

  if (!event) {
    return { task, changed: false };
  }

  return {
    task: {
      ...task,
      status: toStatus,
      updatedAt: now
    },
    event,
    changed: true
  };
}

export function buildTaskAssignedEvent(
  task: Task,
  actorUserId: Id | undefined,
  assigneeUserId: Id | undefined,
  now = new Date().toISOString(),
  note?: string
): TaskEvent {
  return {
    id: localEventId("task_event_assigned", task.id, now),
    tenantId: task.tenantId,
    locationId: task.locationId,
    taskId: task.id,
    actorUserId,
    eventType: "assigned",
    note: note ?? (assigneeUserId ? "Task assigned locally." : "Task unassigned locally."),
    createdAt: now
  };
}

export function buildTaskNoteAddedEvent(
  task: Task,
  actorUserId: Id | undefined,
  note: string,
  now = new Date().toISOString()
): TaskEvent {
  return {
    id: localEventId("task_event_note", task.id, now),
    tenantId: task.tenantId,
    locationId: task.locationId,
    taskId: task.id,
    actorUserId,
    eventType: "note_added",
    note,
    createdAt: now
  };
}
