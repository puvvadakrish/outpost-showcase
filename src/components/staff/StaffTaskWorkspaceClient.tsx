"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { StaffTaskActionState } from "@/application/tasks/action-result";
import { AppShell, type AppShellAccount } from "@/components/AppShell";
import { TaskStatusPill } from "@/components/TaskStatusPill";
import { TaskTable } from "@/components/TaskTable";
import { useExpiringTaskActionFeedback } from "@/components/staff/useExpiringTaskActionFeedback";
import { staffBetaProofWalkthrough } from "@/domain/beta-loop";
import { displayLabel } from "@/domain/formatting";
import {
  createManualTaskIntakeDraft,
  manualTaskIntakeDraftIsDirty,
  setManualTaskIntakeDraftField,
  type ManualTaskIntakeDraft,
  type ManualTaskIntakeDraftField
} from "@/domain/manual-task-intake-draft";
import { manualTaskIntakeDuplicateCandidates } from "@/domain/manual-task-intake";
import type { Id, TaskChannel, TaskStatus } from "@/domain/models";
import { taskChannels, taskStatuses } from "@/domain/models";
import { activeTaskAdvancedFilterCount } from "@/domain/task-advanced-filters";
import {
  clearTaskNoteDraft,
  setTaskNoteDraft,
  taskNoteDraftCountLabel,
  taskNoteDraftTaskIds,
  type TaskNoteDrafts
} from "@/domain/task-note-drafts";
import {
  isTaskPersonalWorkShortcutSelected,
  toggleTaskPersonalWorkShortcut
} from "@/domain/task-personal-work-filters";
import {
  addDraftTaskNote,
  assignDraftTask,
  changeDraftTaskStatus,
  createDraftManualTask,
  createStaffTaskDraftState,
  staffTaskStorageKey,
  type StaffTaskDraftSeed,
  type StaffTaskDraftState
} from "@/domain/staff-task-draft";
import type { Task, TaskProofOrigin } from "@/domain/tasks";
import {
  adjacentTaskId,
  STAFF_TASK_CLAIM_NOTE,
  STAFF_TASK_RELEASE_NOTE,
  allowedNextTaskStatuses,
  canStaffMarkTaskNeedsHuman,
  canStaffMarkTaskDone,
  canStaffMarkTaskIgnored,
  canStaffReopenTask,
  canStaffStartTask,
  taskActivityTrailKindForTask,
  taskActivityTrailSummaries,
  isUnresolvedTask,
  normalizeTaskConfidence,
  resolveTaskSelectionId,
  sortTasksForInbox,
  staffTaskDeepLink,
  taskActivityItemsForTask,
  taskAgeBucketForTask,
  taskAgeSummaries,
  taskAttentionProfileForTask,
  taskAttentionSummaries,
  taskAssigneeSummaries,
  taskChannelSummaries,
  taskConfidenceBucketForTask,
  taskConfidenceSummaries,
  taskFollowUpModeForTask,
  taskFollowUpModeSummaries,
  taskIntentKeyForTask,
  taskIntentSummaries,
  taskLastTouchBucketForTask,
  taskLastTouchSummaries,
  taskLocationSummaries,
  taskMemberSystemBoundaryForTask,
  taskMemberSystemBoundarySummaries,
  taskOwnerPolicyDependencyForTask,
  taskOwnerPolicyDependencySummaries,
  taskNextStepKeyForTask,
  taskNextStepSummaries,
  taskPersonalWorkSummary,
  taskSubmittedWorkSummary,
  taskProofCompletionStateForTask,
  taskProofCompletionSummaries,
  taskRequesterContactKindForTask,
  taskRequesterContactSummaries,
  taskQueuePosition,
  taskQueueStateSummary,
  taskProofOriginSummaries,
  taskProofSummary,
  taskStaffActionLaneForTask,
  taskStaffActionLaneSummaries,
  taskStaffClipboardBrief,
  taskStatusSummaries,
  taskWorkflowStageForTask,
  taskWorkflowStageSummaries
} from "@/domain/tasks";
import type { Location, Tenant, User } from "@/domain/tenancy";

interface StaffTaskWorkspaceClientProps {
  account?: AppShellAccount;
  authenticatedStaffUserId?: Id;
  initialTaskId?: Id;
  locations: Location[];
  onCreateManualTask: (
    previousState: StaffTaskActionState,
    formData: FormData
  ) => Promise<StaffTaskActionState>;
  onAddTaskNote: (
    previousState: StaffTaskActionState,
    formData: FormData
  ) => Promise<StaffTaskActionState>;
  onAssignTask: (
    previousState: StaffTaskActionState,
    formData: FormData
  ) => Promise<StaffTaskActionState>;
  onUpdateTaskStatus: (
    previousState: StaffTaskActionState,
    formData: FormData
  ) => Promise<StaffTaskActionState>;
  persistenceMode:
    | "local"
    | "backend"
    | "backend_unavailable"
    | "setup_required"
    | "sign_in_required";
  seed: StaffTaskDraftSeed;
  tenant: Tenant;
  users: User[];
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "America/Chicago",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function taskMetric(tasks: Task[], status: TaskStatus) {
  return tasks.filter((task) => task.status === status).length;
}

const initialStaffTaskActionState: StaffTaskActionState = { ok: false, message: "" };
const selectedTaskRowAnchorId = "selected-workboard-task";

type TaskSourceFilter = TaskProofOrigin | "all";
type TaskProofCompletionFilter = "all" | "pending" | "complete";
type TaskWorkflowStageFilter =
  | "all"
  | "unassigned_intake"
  | "ready_for_staff"
  | "in_progress"
  | "completed"
  | "ignored";
type TaskQueueStateFilter = "all" | "open" | "terminal";
type TaskActivityTrailFilter = "all" | "staff_activity" | "source_only" | "no_trail";
type TaskAttentionFilter = "all" | "attention" | "watch" | "clear";
type TaskChannelFilter = TaskChannel | "all";
type TaskLocationFilter = Id | "all";
type TaskAgeFilter = "all" | "fresh" | "waiting" | "stale";
type TaskLastTouchFilter = "all" | "fresh_touch" | "quiet" | "stalled";
type TaskConfidenceFilter = "all" | "low" | "medium" | "high";
type TaskFollowUpModeFilter =
  | "all"
  | "phone_follow_up"
  | "email_follow_up"
  | "internal_follow_up"
  | "contact_check";
type TaskMemberSystemBoundaryFilter =
  | "all"
  | "member_system_blocked"
  | "staff_follow_up_only"
  | "closed_no_member_write";
type TaskOwnerPolicyDependencyFilter =
  | "all"
  | "owner_policy_needed"
  | "staff_ready"
  | "closed_policy_done";
type TaskStaffActionLaneFilter =
  | "all"
  | "member_system_hold"
  | "owner_policy_review"
  | "staff_reply_ready"
  | "closed";
type TaskIntentFilter = string | "all";
type TaskNextStepFilter = string | "all";
type TaskRequesterContactFilter = "all" | "email" | "phone" | "other";
type TaskCopyStatus = "idle" | "copied" | "failed";
type TaskCopyTarget = "task_link" | "requester_contact" | "suggested_next_step" | "task_brief";

const taskCopySuccessMessages: Record<TaskCopyTarget, string> = {
  requester_contact: "Requester contact copied.",
  suggested_next_step: "Suggested next step copied.",
  task_brief: "Task brief copied.",
  task_link: "Task link copied."
};

const taskCopyFallbackLabels: Record<TaskCopyTarget, string> = {
  requester_contact: "Requester contact",
  suggested_next_step: "Suggested next step",
  task_brief: "Task brief",
  task_link: "Task link"
};

const taskSourceFilters: Array<{ label: string; value: TaskSourceFilter }> = [
  { label: "All sources", value: "all" },
  { label: "Needs owner review", value: "answer_review" },
  { label: "Manual intake", value: "manual_intake" },
  { label: "Provider replay", value: "provider_ingested" },
  { label: "Seed tasks", value: "provider_stub" }
];

const taskQueueStateFilters: Array<{ label: string; value: TaskQueueStateFilter }> = [
  { label: "All work", value: "all" },
  { label: "Open work", value: "open" },
  { label: "Terminal work", value: "terminal" }
];

const taskQueueStateChips: Array<{
  detail: string;
  label: string;
  value: TaskQueueStateFilter;
}> = [
  { detail: "needs staff action", label: "Open", value: "open" },
  { detail: "done or ignored", label: "Terminal", value: "terminal" },
  { detail: "current queue", label: "All", value: "all" }
];

const taskChannelFilters: Array<{ label: string; value: TaskChannelFilter }> = [
  { label: "All channels", value: "all" },
  ...taskChannels.map((channel) => ({ label: displayLabel(channel), value: channel }))
];

export function StaffTaskWorkspaceClient({
  account,
  authenticatedStaffUserId,
  initialTaskId,
  locations,
  onAddTaskNote,
  onAssignTask,
  onCreateManualTask,
  onUpdateTaskStatus,
  persistenceMode,
  seed,
  tenant,
  users
}: StaffTaskWorkspaceClientProps) {
  const [statusActionState, statusFormAction, statusPending] = useActionState(
    onUpdateTaskStatus,
    initialStaffTaskActionState
  );
  const [assignmentActionState, assignmentFormAction, assignmentPending] = useActionState(
    onAssignTask,
    initialStaffTaskActionState
  );
  const [noteActionState, noteFormAction, notePending] = useActionState(
    onAddTaskNote,
    initialStaffTaskActionState
  );
  const [createActionState, createFormAction, createPending] = useActionState(
    onCreateManualTask,
    initialStaffTaskActionState
  );
  const initialSelectedTaskId = resolveTaskSelectionId(seed.tasks, initialTaskId);
  const initialSelectedTask =
    seed.tasks.find((task) => task.id === initialSelectedTaskId) ?? seed.tasks[0];
  const storageKey = useMemo(() => staffTaskStorageKey(tenant.id), [tenant.id]);
  const [state, setState] = useState<StaffTaskDraftState>(() => createStaffTaskDraftState(seed));
  const [selectedTaskId, setSelectedTaskId] = useState<Id | undefined>(
    () => initialSelectedTaskId
  );
  const [hydrated, setHydrated] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<TaskNoteDrafts>({});
  const [localCreateMessage, setLocalCreateMessage] = useState("");
  const defaultManualIntakeLocationId = locations[0]?.id ?? "";
  const [manualIntakeDraft, setManualIntakeDraft] = useState(() =>
    createManualTaskIntakeDraft(defaultManualIntakeLocationId)
  );
  const [taskCopyStatus, setTaskCopyStatus] = useState<TaskCopyStatus>("idle");
  const [taskCopyTarget, setTaskCopyTarget] = useState<TaskCopyTarget>("task_link");
  const [taskCopyFallback, setTaskCopyFallback] = useState("");
  const selectedTaskIdRef = useRef<Id | undefined>(initialSelectedTaskId);
  const taskCopyRequestRef = useRef(0);
  const taskCopyFallbackRef = useRef<HTMLInputElement>(null);
  const [assigneeDraft, setAssigneeDraft] = useState(() => initialSelectedTask?.assigneeUserId ?? "");
  const [taskQuery, setTaskQuery] = useState("");
  const [taskQueueStateFilter, setTaskQueueStateFilter] =
    useState<TaskQueueStateFilter>("all");
  const [taskActivityTrailFilter, setTaskActivityTrailFilter] =
    useState<TaskActivityTrailFilter>("all");
  const [taskAttentionFilter, setTaskAttentionFilter] = useState<TaskAttentionFilter>("all");
  const [taskChannelFilter, setTaskChannelFilter] = useState<TaskChannelFilter>("all");
  const [taskLocationFilter, setTaskLocationFilter] = useState<TaskLocationFilter>("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatus | "all">("all");
  const [taskSourceFilter, setTaskSourceFilter] = useState<TaskSourceFilter>("all");
  const [taskProofCompletionFilter, setTaskProofCompletionFilter] =
    useState<TaskProofCompletionFilter>("all");
  const [taskWorkflowStageFilter, setTaskWorkflowStageFilter] =
    useState<TaskWorkflowStageFilter>("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<Id | "all" | "unassigned">("all");
  const [taskAgeFilter, setTaskAgeFilter] = useState<TaskAgeFilter>("all");
  const [taskLastTouchFilter, setTaskLastTouchFilter] = useState<TaskLastTouchFilter>("all");
  const [taskConfidenceFilter, setTaskConfidenceFilter] = useState<TaskConfidenceFilter>("all");
  const [taskFollowUpModeFilter, setTaskFollowUpModeFilter] =
    useState<TaskFollowUpModeFilter>("all");
  const [taskMemberSystemBoundaryFilter, setTaskMemberSystemBoundaryFilter] =
    useState<TaskMemberSystemBoundaryFilter>("all");
  const [taskOwnerPolicyDependencyFilter, setTaskOwnerPolicyDependencyFilter] =
    useState<TaskOwnerPolicyDependencyFilter>("all");
  const [taskStaffActionLaneFilter, setTaskStaffActionLaneFilter] =
    useState<TaskStaffActionLaneFilter>("all");
  const [taskIntentFilter, setTaskIntentFilter] = useState<TaskIntentFilter>("all");
  const [taskNextStepFilter, setTaskNextStepFilter] = useState<TaskNextStepFilter>("all");
  const [taskRequesterContactFilter, setTaskRequesterContactFilter] =
    useState<TaskRequesterContactFilter>("all");
  const [taskDraftFilter, setTaskDraftFilter] = useState(false);
  const [taskSubmittedByMeFilter, setTaskSubmittedByMeFilter] = useState(false);
  const [taskAgeReferenceTime] = useState(() => new Date());
  const [statusDraft, setStatusDraft] = useState<TaskStatus | "">(
    () => initialSelectedTask?.status ?? ""
  );

  const userNames = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);
  const localDraftActorUserId =
    users.find((user) => user.id === "user_staff_acme")?.id ?? users[0]?.id;
  const currentStaffUserId =
    persistenceMode === "backend" ? authenticatedStaffUserId : localDraftActorUserId;
  const actorUserId = currentStaffUserId;
  const sortedTasks = useMemo(() => sortTasksForInbox(state.tasks), [state.tasks]);
  const intentSummaries = useMemo(() => taskIntentSummaries(state.tasks), [state.tasks]);
  const nextStepSummaries = useMemo(() => taskNextStepSummaries(state.tasks), [state.tasks]);
  const noteDraftTaskIds = useMemo(
    () => taskNoteDraftTaskIds(noteDrafts, state.tasks),
    [noteDrafts, state.tasks]
  );
  const noteDraftTaskIdSet = useMemo(() => new Set(noteDraftTaskIds), [noteDraftTaskIds]);
  const submittedWorkSummary = useMemo(
    () => taskSubmittedWorkSummary(state.tasks, state.taskEvents, currentStaffUserId),
    [currentStaffUserId, state.taskEvents, state.tasks]
  );
  const submittedWorkTaskIdSet = useMemo(
    () => new Set(submittedWorkSummary.taskIds),
    [submittedWorkSummary.taskIds]
  );
  const visibleTasks = useMemo(() => {
    const normalizedQuery = taskQuery.trim().toLowerCase();
    const selectedIntentSummary = intentSummaries.find(
      (summary) =>
        summary.intentKey === taskIntentFilter || summary.intentKeys.includes(taskIntentFilter)
    );
    const selectedNextStepSummary = nextStepSummaries.find(
      (summary) =>
        summary.nextStepKey === taskNextStepFilter ||
        summary.nextStepKeys.includes(taskNextStepFilter)
    );

    return sortedTasks.filter((task) => {
      const unresolved = isUnresolvedTask(task);

      if (taskDraftFilter && !noteDraftTaskIdSet.has(task.id)) {
        return false;
      }

      if (taskSubmittedByMeFilter && !submittedWorkTaskIdSet.has(task.id)) {
        return false;
      }

      if (taskQueueStateFilter === "open" && !unresolved) {
        return false;
      }

      if (taskQueueStateFilter === "terminal" && unresolved) {
        return false;
      }

      if (taskStatusFilter !== "all" && task.status !== taskStatusFilter) {
        return false;
      }

      if (
        taskWorkflowStageFilter !== "all" &&
        taskWorkflowStageForTask(task) !== taskWorkflowStageFilter
      ) {
        return false;
      }

      if (
        taskActivityTrailFilter !== "all" &&
        taskActivityTrailKindForTask(task, state.taskEvents) !== taskActivityTrailFilter
      ) {
        return false;
      }

      if (
        taskAttentionFilter !== "all" &&
        taskAttentionProfileForTask(task, taskAgeReferenceTime).level !== taskAttentionFilter
      ) {
        return false;
      }

      if (taskChannelFilter !== "all" && task.channel !== taskChannelFilter) {
        return false;
      }

      if (taskLocationFilter !== "all" && task.locationId !== taskLocationFilter) {
        return false;
      }

      if (taskAssigneeFilter === "unassigned" && task.assigneeUserId) {
        return false;
      }

      if (
        taskAssigneeFilter !== "all" &&
        taskAssigneeFilter !== "unassigned" &&
        task.assigneeUserId !== taskAssigneeFilter
      ) {
        return false;
      }

      if (
        taskAgeFilter !== "all" &&
        taskAgeBucketForTask(task, taskAgeReferenceTime) !== taskAgeFilter
      ) {
        return false;
      }

      if (
        taskLastTouchFilter !== "all" &&
        taskLastTouchBucketForTask(task, taskAgeReferenceTime) !== taskLastTouchFilter
      ) {
        return false;
      }

      if (
        taskConfidenceFilter !== "all" &&
        taskConfidenceBucketForTask(task) !== taskConfidenceFilter
      ) {
        return false;
      }

      if (
        taskIntentFilter !== "all" &&
        !selectedIntentSummary?.intentKeys.includes(taskIntentKeyForTask(task))
      ) {
        return false;
      }

      if (
        taskNextStepFilter !== "all" &&
        !selectedNextStepSummary?.nextStepKeys.includes(taskNextStepKeyForTask(task))
      ) {
        return false;
      }

      if (
        taskRequesterContactFilter !== "all" &&
        taskRequesterContactKindForTask(task) !== taskRequesterContactFilter
      ) {
        return false;
      }

      if (
        taskFollowUpModeFilter !== "all" &&
        taskFollowUpModeForTask(task) !== taskFollowUpModeFilter
      ) {
        return false;
      }

      if (
        taskMemberSystemBoundaryFilter !== "all" &&
        taskMemberSystemBoundaryForTask(task) !== taskMemberSystemBoundaryFilter
      ) {
        return false;
      }

      if (
        taskOwnerPolicyDependencyFilter !== "all" &&
        taskOwnerPolicyDependencyForTask(task) !== taskOwnerPolicyDependencyFilter
      ) {
        return false;
      }

      if (
        taskStaffActionLaneFilter !== "all" &&
        taskStaffActionLaneForTask(task) !== taskStaffActionLaneFilter
      ) {
        return false;
      }

      const proof = taskProofSummary(task, state.taskEvents);

      if (taskSourceFilter !== "all" && proof.origin !== taskSourceFilter) {
        return false;
      }

      if (
        taskProofCompletionFilter !== "all" &&
        taskProofCompletionStateForTask(task, state.taskEvents) !== taskProofCompletionFilter
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const assigneeName = task.assigneeUserId ? userNames.get(task.assigneeUserId) : "unassigned";
      const searchable = [
        task.requesterName,
        task.requesterContact,
        task.intent,
        task.summary,
        task.suggestedNextStep,
        displayLabel(task.channel),
        displayLabel(task.status),
        assigneeName,
        proof.label,
        proof.sourceDetail
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [
    sortedTasks,
    state.taskEvents,
    taskActivityTrailFilter,
    taskAssigneeFilter,
    taskAgeFilter,
    taskAgeReferenceTime,
    taskAttentionFilter,
    taskChannelFilter,
    taskConfidenceFilter,
    intentSummaries,
    nextStepSummaries,
    taskFollowUpModeFilter,
    taskIntentFilter,
    taskMemberSystemBoundaryFilter,
    taskNextStepFilter,
    taskOwnerPolicyDependencyFilter,
    taskStaffActionLaneFilter,
    taskLastTouchFilter,
    taskRequesterContactFilter,
    taskLocationFilter,
    taskQueueStateFilter,
    taskQuery,
    taskProofCompletionFilter,
    taskSourceFilter,
    taskStatusFilter,
    taskDraftFilter,
    taskWorkflowStageFilter,
    noteDraftTaskIdSet,
    submittedWorkTaskIdSet,
    taskSubmittedByMeFilter,
    userNames
  ]);
  const selectedTask = selectedTaskId
    ? state.tasks.find((task) => task.id === selectedTaskId)
    : visibleTasks[0];
  const note = selectedTask ? noteDrafts[selectedTask.id] ?? "" : "";
  const statusActionFeedbackVisible = useExpiringTaskActionFeedback(
    statusActionState,
    selectedTask?.id
  );
  const assignmentActionFeedbackVisible = useExpiringTaskActionFeedback(
    assignmentActionState,
    selectedTask?.id
  );
  const noteActionFeedbackVisible = useExpiringTaskActionFeedback(
    noteActionState,
    selectedTask?.id
  );
  const selectedTaskQueuePosition = taskQueuePosition(visibleTasks, selectedTask?.id);
  const previousTaskId = adjacentTaskId(visibleTasks, selectedTask?.id, "previous");
  const nextTaskId = adjacentTaskId(visibleTasks, selectedTask?.id, "next");
  const selectedTaskActivity = selectedTask
    ? taskActivityItemsForTask(state.taskEvents, tenant.id, selectedTask.id)
    : [];
  const selectedTaskProof = selectedTask ? taskProofSummary(selectedTask, state.taskEvents) : undefined;
  const betaProofWalkthrough = staffBetaProofWalkthrough(selectedTaskProof);
  const allowedStatuses = selectedTask ? allowedNextTaskStatuses(selectedTask.status) : [];
  const canStartSelectedTask = selectedTask
    ? canStaffStartTask(selectedTask, currentStaffUserId)
    : false;
  const canMarkSelectedTaskNeedsHuman = selectedTask
    ? canStaffMarkTaskNeedsHuman(selectedTask, currentStaffUserId)
    : false;
  const canMarkSelectedTaskDone = selectedTask
    ? canStaffMarkTaskDone(selectedTask, currentStaffUserId)
    : false;
  const canMarkSelectedTaskIgnored = selectedTask
    ? canStaffMarkTaskIgnored(selectedTask, currentStaffUserId)
    : false;
  const canReopenSelectedTask = selectedTask ? canStaffReopenTask(selectedTask) : false;
  const confidence = selectedTask ? normalizeTaskConfidence(selectedTask.confidence) : 0;
  const confidencePercentage = Math.round(confidence * 100);
  const statusSummaries = taskStatusSummaries(state.tasks);
  const activityTrailSummaries = useMemo(
    () => taskActivityTrailSummaries(state.tasks, state.taskEvents),
    [state.taskEvents, state.tasks]
  );
  const attentionSummaries = useMemo(
    () => taskAttentionSummaries(state.tasks, taskAgeReferenceTime),
    [state.tasks, taskAgeReferenceTime]
  );
  const channelSummaries = useMemo(() => taskChannelSummaries(state.tasks), [state.tasks]);
  const assigneeSummaries = useMemo(() => taskAssigneeSummaries(state.tasks, users), [state.tasks, users]);
  const ageSummaries = useMemo(
    () => taskAgeSummaries(state.tasks, taskAgeReferenceTime),
    [state.tasks, taskAgeReferenceTime]
  );
  const lastTouchSummaries = useMemo(
    () => taskLastTouchSummaries(state.tasks, taskAgeReferenceTime),
    [state.tasks, taskAgeReferenceTime]
  );
  const confidenceSummaries = useMemo(
    () => taskConfidenceSummaries(state.tasks),
    [state.tasks]
  );
  const locationSummaries = useMemo(
    () => taskLocationSummaries(state.tasks, locations),
    [locations, state.tasks]
  );
  const queueStateSummary = useMemo(() => taskQueueStateSummary(state.tasks), [state.tasks]);
  const personalWorkSummary = useMemo(
    () => taskPersonalWorkSummary(state.tasks, currentStaffUserId),
    [currentStaffUserId, state.tasks]
  );
  const activeAdvancedFilterCount = activeTaskAdvancedFilterCount([
    taskWorkflowStageFilter,
    taskActivityTrailFilter,
    taskAttentionFilter,
    taskProofCompletionFilter,
    taskAgeFilter,
    taskLastTouchFilter,
    taskConfidenceFilter,
    taskIntentFilter,
    taskNextStepFilter,
    taskRequesterContactFilter,
    taskFollowUpModeFilter,
    taskMemberSystemBoundaryFilter,
    taskOwnerPolicyDependencyFilter,
    taskStaffActionLaneFilter
  ]);
  const personalWorkFilterState = {
    assignee: taskAssigneeFilter,
    queueState: taskQueueStateFilter,
    status: taskStatusFilter
  };
  const isMyOpenWorkSelected = Boolean(
    currentStaffUserId &&
    isTaskPersonalWorkShortcutSelected(
      personalWorkFilterState,
      "open",
      currentStaffUserId
    )
  );
  const isMyReadyWorkSelected = Boolean(
    currentStaffUserId &&
    isTaskPersonalWorkShortcutSelected(
      personalWorkFilterState,
      "ready",
      currentStaffUserId
    )
  );
  const isMyActiveWorkSelected = Boolean(
    currentStaffUserId &&
    isTaskPersonalWorkShortcutSelected(
      personalWorkFilterState,
      "active",
      currentStaffUserId
    )
  );
  const isMyNeedsHumanSelected = Boolean(
    currentStaffUserId &&
    isTaskPersonalWorkShortcutSelected(
      personalWorkFilterState,
      "needs_human",
      currentStaffUserId
    )
  );
  const isMyCompletedWorkSelected = Boolean(
    currentStaffUserId &&
    isTaskPersonalWorkShortcutSelected(
      personalWorkFilterState,
      "completed",
      currentStaffUserId
    )
  );
  const isMyIgnoredWorkSelected = Boolean(
    currentStaffUserId &&
    isTaskPersonalWorkShortcutSelected(
      personalWorkFilterState,
      "ignored",
      currentStaffUserId
    )
  );
  const workflowStageSummaries = useMemo(
    () => taskWorkflowStageSummaries(state.tasks),
    [state.tasks]
  );
  const sourceSummaries = useMemo(
    () => taskProofOriginSummaries(state.tasks, state.taskEvents),
    [state.taskEvents, state.tasks]
  );
  const proofCompletionSummaries = useMemo(
    () => taskProofCompletionSummaries(state.tasks, state.taskEvents),
    [state.taskEvents, state.tasks]
  );
  const requesterContactSummaries = useMemo(
    () => taskRequesterContactSummaries(state.tasks),
    [state.tasks]
  );
  const followUpModeSummaries = useMemo(
    () => taskFollowUpModeSummaries(state.tasks),
    [state.tasks]
  );
  const memberSystemBoundarySummaries = useMemo(
    () => taskMemberSystemBoundarySummaries(state.tasks),
    [state.tasks]
  );
  const ownerPolicyDependencySummaries = useMemo(
    () => taskOwnerPolicyDependencySummaries(state.tasks),
    [state.tasks]
  );
  const staffActionLaneSummaries = useMemo(
    () => taskStaffActionLaneSummaries(state.tasks),
    [state.tasks]
  );
  const isBackendMode = persistenceMode === "backend";
  const isManualIntakeEnabled = isBackendMode || persistenceMode === "local";
  const manualIntakeDraftIsDirty = manualTaskIntakeDraftIsDirty(
    manualIntakeDraft,
    defaultManualIntakeLocationId
  );
  const manualIntakeDuplicateCandidates = useMemo(
    () => manualTaskIntakeDuplicateCandidates(state.tasks, tenant.id, manualIntakeDraft),
    [manualIntakeDraft, state.tasks, tenant.id]
  );

  useEffect(() => {
    if (persistenceMode !== "local") {
      setHydrated(true);
      return;
    }

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as StaffTaskDraftState;
        if (Array.isArray(parsed.tasks) && Array.isArray(parsed.taskEvents)) {
          setState(parsed);
          setSelectedTaskId(resolveTaskSelectionId(parsed.tasks, initialTaskId));
        }
      }
    } finally {
      setHydrated(true);
    }
  }, [initialTaskId, persistenceMode, storageKey]);

  useEffect(() => {
    if (taskIntentFilter === "all") {
      return;
    }

    if (intentSummaries.some((summary) => summary.intentKey === taskIntentFilter)) {
      return;
    }

    const containingSummary = intentSummaries.find((summary) =>
      summary.intentKeys.includes(taskIntentFilter)
    );

    setTaskIntentFilter(containingSummary?.intentKey ?? "all");
  }, [intentSummaries, taskIntentFilter]);

  useEffect(() => {
    if (taskNextStepFilter === "all") {
      return;
    }

    if (nextStepSummaries.some((summary) => summary.nextStepKey === taskNextStepFilter)) {
      return;
    }

    const containingSummary = nextStepSummaries.find((summary) =>
      summary.nextStepKeys.includes(taskNextStepFilter)
    );

    setTaskNextStepFilter(containingSummary?.nextStepKey ?? "all");
  }, [nextStepSummaries, taskNextStepFilter]);

  useEffect(() => {
    if (persistenceMode === "local") {
      return;
    }

    setState(createStaffTaskDraftState(seed));
    setSelectedTaskId((currentSelectedTaskId) => {
      if (currentSelectedTaskId && seed.tasks.some((task) => task.id === currentSelectedTaskId)) {
        return currentSelectedTaskId;
      }

      return sortTasksForInbox(seed.tasks)[0]?.id;
    });
  }, [persistenceMode, seed]);

  useEffect(() => {
    setAssigneeDraft(selectedTask?.assigneeUserId ?? "");
    setStatusDraft(selectedTask?.status ?? "");
  }, [selectedTask?.assigneeUserId, selectedTask?.id, selectedTask?.status]);

  useEffect(() => {
    selectedTaskIdRef.current = selectedTask?.id;
    taskCopyRequestRef.current += 1;
    setTaskCopyStatus("idle");
    setTaskCopyFallback("");
  }, [selectedTask?.id]);

  useEffect(() => {
    if (taskCopyStatus !== "copied") {
      return;
    }

    const timeoutId = window.setTimeout(() => setTaskCopyStatus("idle"), 5_000);
    return () => window.clearTimeout(timeoutId);
  }, [taskCopyStatus]);

  useEffect(() => {
    if (taskCopyStatus !== "failed") {
      return;
    }

    taskCopyFallbackRef.current?.focus();
    taskCopyFallbackRef.current?.select();
  }, [taskCopyStatus]);

  useEffect(() => {
    if (visibleTasks.length === 0) {
      if (selectedTaskId) {
        setSelectedTaskId(undefined);
      }
      return;
    }

    if (!selectedTaskId || !visibleTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(visibleTasks[0]?.id);
    }
  }, [selectedTaskId, visibleTasks]);

  function commitDraft(next: StaffTaskDraftState) {
    if (next === state) {
      return;
    }

    setState(next);

    if (hydrated && persistenceMode === "local") {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
  }

  function resetDraft() {
    const nextState = createStaffTaskDraftState(seed);
    setState(nextState);
    setSelectedTaskId(resolveTaskSelectionId(nextState.tasks, initialTaskId));
    setNoteDrafts({});
    setLocalCreateMessage("");
    setManualIntakeDraft(createManualTaskIntakeDraft(defaultManualIntakeLocationId));
    if (persistenceMode === "local") {
      window.localStorage.removeItem(storageKey);
    }
  }

  function updateManualIntakeDraft<K extends ManualTaskIntakeDraftField>(
    field: K,
    value: ManualTaskIntakeDraft[K]
  ) {
    setManualIntakeDraft((current) =>
      setManualTaskIntakeDraftField(current, field, value)
    );
    setLocalCreateMessage("");
  }

  function clearManualIntakeDraft() {
    setManualIntakeDraft(createManualTaskIntakeDraft(defaultManualIntakeLocationId));
    setLocalCreateMessage("");
  }

  function createLocalManualTask(event: FormEvent<HTMLFormElement>) {
    if (persistenceMode !== "local") return;
    event.preventDefault();
    const now = new Date().toISOString();
    const taskId = `task_local_${crypto.randomUUID()}`;

    try {
      const next = createDraftManualTask(
        state,
        {
          actorUserId,
          channel: manualIntakeDraft.channel,
          claimForActor: manualIntakeDraft.claimForActor,
          confidence: Number(manualIntakeDraft.confidence),
          intent: manualIntakeDraft.intent,
          locationId: manualIntakeDraft.locationId,
          requesterContact: manualIntakeDraft.requesterContact,
          requesterName: manualIntakeDraft.requesterName,
          suggestedNextStep: manualIntakeDraft.suggestedNextStep,
          summary: manualIntakeDraft.summary,
          taskId,
          tenantId: tenant.id
        },
        now
      );
      commitDraft(next);
      setSelectedTaskId(taskId);
      setLocalCreateMessage("Local rehearsal task created. No hosted data or provider event was written.");
      setManualIntakeDraft(createManualTaskIntakeDraft(defaultManualIntakeLocationId));
    } catch (error) {
      setLocalCreateMessage(error instanceof Error ? error.message : "Unable to create local rehearsal task.");
    }
  }

  function clearAdvancedTaskFilters() {
    setTaskWorkflowStageFilter("all");
    setTaskActivityTrailFilter("all");
    setTaskAttentionFilter("all");
    setTaskProofCompletionFilter("all");
    setTaskAgeFilter("all");
    setTaskLastTouchFilter("all");
    setTaskConfidenceFilter("all");
    setTaskIntentFilter("all");
    setTaskNextStepFilter("all");
    setTaskRequesterContactFilter("all");
    setTaskFollowUpModeFilter("all");
    setTaskMemberSystemBoundaryFilter("all");
    setTaskOwnerPolicyDependencyFilter("all");
    setTaskStaffActionLaneFilter("all");
  }

  function reconcileTask(task: Task, selectTask = false) {
    setState((current) => {
      const taskExists = current.tasks.some((candidate) => candidate.id === task.id);

      return {
        ...current,
        tasks: taskExists
          ? current.tasks.map((candidate) => (candidate.id === task.id ? task : candidate))
          : [task, ...current.tasks],
        updatedAt: task.updatedAt
      };
    });

    if (selectTask) {
      setSelectedTaskId(task.id);
    }
  }

  function reconcileTaskEvent(taskEvent: NonNullable<StaffTaskActionState["taskEvent"]>) {
    setState((current) => {
      if (current.taskEvents.some((event) => event.id === taskEvent.id)) {
        return current;
      }

      return {
        ...current,
        taskEvents: [taskEvent, ...current.taskEvents],
        tasks: current.tasks.map((task) =>
          task.tenantId === taskEvent.tenantId && task.id === taskEvent.taskId
            ? {
                ...task,
                updatedAt: taskEvent.createdAt
              }
            : task
        ),
        updatedAt: taskEvent.createdAt
      };
    });
  }

  useEffect(() => {
    if (statusActionState.ok && statusActionState.task) {
      reconcileTask(statusActionState.task);
    }
  }, [statusActionState.ok, statusActionState.task?.id, statusActionState.task?.updatedAt]);

  useEffect(() => {
    if (assignmentActionState.ok && assignmentActionState.task) {
      reconcileTask(assignmentActionState.task);
    }
  }, [assignmentActionState.ok, assignmentActionState.task?.id, assignmentActionState.task?.updatedAt]);

  useEffect(() => {
    if (createActionState.ok && createActionState.task) {
      reconcileTask(createActionState.task, true);
      setManualIntakeDraft(createManualTaskIntakeDraft(defaultManualIntakeLocationId));
    }
  }, [createActionState.ok, createActionState.task?.id, createActionState.task?.updatedAt, defaultManualIntakeLocationId]);

  useEffect(() => {
    if (noteActionState.ok && noteActionState.taskEvent) {
      reconcileTaskEvent(noteActionState.taskEvent);
      setNoteDrafts((current) => clearTaskNoteDraft(current, noteActionState.taskEvent!.taskId));
    }
  }, [noteActionState.ok, noteActionState.taskEvent?.id, noteActionState.taskId]);

  function changeStatus(toStatus: TaskStatus) {
    if (!selectedTask) {
      return;
    }

    if (isBackendMode) {
      setStatusDraft(toStatus);
      return;
    }

    const now = new Date().toISOString();
    commitDraft(changeDraftTaskStatus(state, tenant.id, selectedTask.id, toStatus, actorUserId, now));
  }

  function startSelectedTask() {
    if (!selectedTask || !canStartSelectedTask || isBackendMode) {
      return;
    }

    const now = new Date().toISOString();
    commitDraft(
      changeDraftTaskStatus(
        state,
        tenant.id,
        selectedTask.id,
        "in_progress",
        currentStaffUserId,
        now
      )
    );
  }

  function markSelectedTaskNeedsHuman() {
    if (!selectedTask || !canMarkSelectedTaskNeedsHuman || isBackendMode) {
      return;
    }

    const now = new Date().toISOString();
    commitDraft(
      changeDraftTaskStatus(
        state,
        tenant.id,
        selectedTask.id,
        "needs_human",
        currentStaffUserId,
        now
      )
    );
  }

  function markSelectedTaskDone() {
    if (!selectedTask || !canMarkSelectedTaskDone || isBackendMode) {
      return;
    }

    const now = new Date().toISOString();
    commitDraft(changeDraftTaskStatus(state, tenant.id, selectedTask.id, "done", currentStaffUserId, now));
  }

  function markSelectedTaskIgnored() {
    if (!selectedTask || !canMarkSelectedTaskIgnored || isBackendMode) return;
    const now = new Date().toISOString();
    commitDraft(changeDraftTaskStatus(state, tenant.id, selectedTask.id, "ignored", currentStaffUserId, now));
  }

  function reopenSelectedTask() {
    if (!selectedTask || !canReopenSelectedTask || isBackendMode) {
      return;
    }

    const now = new Date().toISOString();
    commitDraft(changeDraftTaskStatus(state, tenant.id, selectedTask.id, "new", currentStaffUserId, now));
  }

  async function copySelectedTaskText(target: TaskCopyTarget, value: string) {
    if (!selectedTask) {
      return;
    }

    const taskId = selectedTask.id;
    taskCopyRequestRef.current += 1;
    const requestId = taskCopyRequestRef.current;
    setTaskCopyTarget(target);
    setTaskCopyFallback("");

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(value);
      if (
        selectedTaskIdRef.current !== taskId ||
        requestId !== taskCopyRequestRef.current
      ) {
        return;
      }
      setTaskCopyStatus("copied");
    } catch {
      if (
        selectedTaskIdRef.current !== taskId ||
        requestId !== taskCopyRequestRef.current
      ) {
        return;
      }
      setTaskCopyFallback(value);
      setTaskCopyStatus("failed");
    }
  }

  function copySelectedTaskLink() {
    if (!selectedTask) {
      return;
    }

    const taskId = selectedTask.id;
    void copySelectedTaskText(
      "task_link",
      staffTaskDeepLink(window.location.origin, taskId)
    );
  }

  function changeAssignee(assigneeUserId: string) {
    if (!selectedTask) {
      return;
    }

    if (isBackendMode) {
      setAssigneeDraft(assigneeUserId);
      return;
    }

    const now = new Date().toISOString();
    commitDraft(
      assignDraftTask(
        state,
        tenant.id,
        selectedTask.id,
        assigneeUserId || undefined,
        actorUserId,
        now
      )
    );
  }

  function claimSelectedTask() {
    if (!selectedTask || selectedTask.assigneeUserId || !currentStaffUserId || isBackendMode) {
      return;
    }

    const now = new Date().toISOString();
    commitDraft(
      assignDraftTask(
        state,
        tenant.id,
        selectedTask.id,
        currentStaffUserId,
        currentStaffUserId,
        now,
        STAFF_TASK_CLAIM_NOTE
      )
    );
  }

  function releaseSelectedTask() {
    if (
      !selectedTask ||
      selectedTask.assigneeUserId !== currentStaffUserId ||
      !currentStaffUserId ||
      isBackendMode
    ) {
      return;
    }

    const now = new Date().toISOString();
    commitDraft(
      assignDraftTask(
        state,
        tenant.id,
        selectedTask.id,
        undefined,
        currentStaffUserId,
        now,
        STAFF_TASK_RELEASE_NOTE
      )
    );
  }

  function addNote() {
    if (!selectedTask || note.trim().length === 0) {
      return;
    }

    if (isBackendMode) {
      return;
    }

    const now = new Date().toISOString();
    commitDraft(addDraftTaskNote(state, tenant.id, selectedTask.id, note, actorUserId, now));
    setNoteDrafts((current) => clearTaskNoteDraft(current, selectedTask.id));
  }

  return (
    <AppShell
      account={account}
      activeNav="tasks"
      metrics={[
        { attention: true, label: "Needs human", value: taskMetric(state.tasks, "needs_human") },
        { label: "New", value: taskMetric(state.tasks, "new") },
        { label: "In progress", value: taskMetric(state.tasks, "in_progress") }
      ]}
      tenantName={tenant.name}
      subtitle="Staff task inbox"
    >
      <section className="page-header staff-page-header">
        <div>
          <h1>Front-desk workboard</h1>
          <p>
            Needs action, human-routed work, and next steps for each phone or email task.
          </p>
        </div>
        <div className="page-actions">
          <a className="button" href={persistenceMode === "sign_in_required" ? "/staff/sign-in" : "#workboard"}>
            {persistenceMode === "backend"
              ? "Backend-backed tasks"
              : persistenceMode === "backend_unavailable"
                ? "Backend unavailable"
              : persistenceMode === "sign_in_required"
                ? "Sign in for backend tasks"
              : "Local task workflow"}
          </a>
          <a className="button" href="#manual-task-intake">
            Manual intake
          </a>
          {persistenceMode === "local" ? (
            <button className="button utility-action" onClick={resetDraft} type="button">
              Reset local
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel staff-beta-proof-strip" aria-label="Staff local beta proof route">
        <div className="staff-beta-proof-copy">
          <span className="rail-title">Local beta handoff</span>
          <h2>{betaProofWalkthrough.heading}</h2>
          <p>{betaProofWalkthrough.note}</p>
        </div>
        <div className="beta-walkthrough-route compact" aria-label="Selected task proof route">
          {betaProofWalkthrough.steps.map((step, index) => (
            <a className={`beta-walkthrough-step ${step.state}`} href={step.href} key={step.label}>
              <span className="beta-loop-index">{index + 1}</span>
              <span className="beta-walkthrough-copy">
                <strong>{step.label}</strong>
                <span>{step.detail}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <div className="command-layout staff-task-layout">
        <section className="panel task-filter-panel" aria-label="Task filters">
          <div className="task-filter-copy">
            <span className="rail-title">Queue controls</span>
            <strong>Find the work that needs the next staff touch</strong>
          </div>
          <div className="task-filter-bar">
            <label>
              <span>Search tasks</span>
              <input
                onChange={(event) => setTaskQuery(event.target.value)}
                placeholder="Member, intent, source, assignee"
                type="search"
                value={taskQuery}
              />
            </label>
            <label>
              <span>Queue state</span>
              <select
                onChange={(event) =>
                  setTaskQueueStateFilter(event.target.value as TaskQueueStateFilter)
                }
                value={taskQueueStateFilter}
              >
                {taskQueueStateFilters.map((queueStateFilter) => (
                  <option key={queueStateFilter.value} value={queueStateFilter.value}>
                    {queueStateFilter.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Channel</span>
              <select
                onChange={(event) => setTaskChannelFilter(event.target.value as TaskChannelFilter)}
                value={taskChannelFilter}
              >
                {taskChannelFilters.map((channelFilter) => (
                  <option key={channelFilter.value} value={channelFilter.value}>
                    {channelFilter.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Location</span>
              <select
                onChange={(event) => setTaskLocationFilter(event.target.value as TaskLocationFilter)}
                value={taskLocationFilter}
              >
                <option value="all">All locations</option>
                {locationSummaries.map((summary) => (
                  <option key={summary.locationId} value={summary.locationId}>
                    {summary.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                onChange={(event) => setTaskStatusFilter(event.target.value as TaskStatus | "all")}
                value={taskStatusFilter}
              >
                <option value="all">All statuses</option>
                {taskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {displayLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Source</span>
              <select
                onChange={(event) => setTaskSourceFilter(event.target.value as TaskSourceFilter)}
                value={taskSourceFilter}
              >
                {taskSourceFilters.map((sourceFilter) => (
                  <option key={sourceFilter.value} value={sourceFilter.value}>
                    {sourceFilter.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Assignee</span>
              <select
                onChange={(event) =>
                  setTaskAssigneeFilter(event.target.value as Id | "all" | "unassigned")
                }
                value={taskAssigneeFilter}
              >
                <option value="all">All assignees</option>
                <option value="unassigned">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="mini-button quiet"
              disabled={
                taskQuery.trim().length === 0 &&
                taskQueueStateFilter === "all" &&
                taskWorkflowStageFilter === "all" &&
                taskActivityTrailFilter === "all" &&
                taskAttentionFilter === "all" &&
                taskChannelFilter === "all" &&
                taskLocationFilter === "all" &&
                taskStatusFilter === "all" &&
                taskSourceFilter === "all" &&
                taskProofCompletionFilter === "all" &&
                taskAssigneeFilter === "all" &&
                taskAgeFilter === "all" &&
                taskLastTouchFilter === "all" &&
                taskConfidenceFilter === "all" &&
                taskFollowUpModeFilter === "all" &&
                taskMemberSystemBoundaryFilter === "all" &&
                taskOwnerPolicyDependencyFilter === "all" &&
                taskStaffActionLaneFilter === "all" &&
                taskIntentFilter === "all" &&
                taskNextStepFilter === "all" &&
                taskRequesterContactFilter === "all" &&
                !taskDraftFilter &&
                !taskSubmittedByMeFilter
              }
              onClick={() => {
                setTaskQuery("");
                setTaskQueueStateFilter("all");
                setTaskWorkflowStageFilter("all");
                setTaskActivityTrailFilter("all");
                setTaskAttentionFilter("all");
                setTaskChannelFilter("all");
                setTaskLocationFilter("all");
                setTaskStatusFilter("all");
                setTaskSourceFilter("all");
                setTaskProofCompletionFilter("all");
                setTaskAssigneeFilter("all");
                setTaskAgeFilter("all");
                setTaskLastTouchFilter("all");
                setTaskConfidenceFilter("all");
                setTaskFollowUpModeFilter("all");
                setTaskMemberSystemBoundaryFilter("all");
                setTaskOwnerPolicyDependencyFilter("all");
                setTaskStaffActionLaneFilter("all");
                setTaskIntentFilter("all");
                setTaskNextStepFilter("all");
                setTaskRequesterContactFilter("all");
                setTaskDraftFilter(false);
                setTaskSubmittedByMeFilter(false);
              }}
              type="button"
            >
              Clear filters
            </button>
          </div>
          <div className="task-filter-results">
            <span className="task-filter-result">
              Showing {visibleTasks.length} of {state.tasks.length} tasks
            </span>
            <button
              aria-pressed={taskDraftFilter}
              className="mini-button quiet task-draft-filter"
              disabled={noteDraftTaskIds.length === 0 && !taskDraftFilter}
              onClick={() => setTaskDraftFilter((current) => !current)}
              type="button"
            >
              {noteDraftTaskIds.length} unsaved {noteDraftTaskIds.length === 1 ? "draft" : "drafts"}
            </button>
          </div>
          <div className="task-queue-state-summary" aria-label="Task queue state counts">
            {taskQueueStateChips.map((queueState) => {
              const count =
                queueState.value === "open"
                  ? queueStateSummary.openCount
                  : queueState.value === "terminal"
                    ? queueStateSummary.terminalCount
                    : queueStateSummary.totalCount;

              return (
                <button
                  aria-pressed={taskQueueStateFilter === queueState.value}
                  className={`task-queue-state-summary-item${
                    taskQueueStateFilter === queueState.value ? " active" : ""
                  }`}
                  disabled={count === 0 && taskQueueStateFilter !== queueState.value}
                  key={queueState.value}
                  onClick={() =>
                    setTaskQueueStateFilter(
                      taskQueueStateFilter === queueState.value ? "all" : queueState.value
                    )
                  }
                  type="button"
                >
                  <span>{queueState.label}</span>
                  <span className="task-queue-state-summary-count">
                    <strong>{count}</strong>
                    <small>{queueState.detail}</small>
                  </span>
                </button>
              );
            })}
            {currentStaffUserId ? (
              <button
                aria-pressed={isMyOpenWorkSelected}
                className={[
                  "task-queue-state-summary-item task-my-open-work",
                  isMyOpenWorkSelected ? "active" : ""
                ].filter(Boolean).join(" ")}
                disabled={
                  personalWorkSummary.openCount === 0 &&
                  !isMyOpenWorkSelected
                }
                onClick={() => {
                  const nextFilters = toggleTaskPersonalWorkShortcut(
                    personalWorkFilterState,
                    "open",
                    currentStaffUserId
                  );
                  setTaskQueueStateFilter(nextFilters.queueState);
                  setTaskAssigneeFilter(nextFilters.assignee);
                  setTaskStatusFilter(nextFilters.status);
                }}
                type="button"
              >
                <span>My open work</span>
                <span className="task-queue-state-summary-count">
                  <strong>{personalWorkSummary.openCount}</strong>
                  <small>{personalWorkSummary.totalCount} total</small>
                </span>
              </button>
            ) : null}
            {currentStaffUserId ? (
              <button
                aria-pressed={isMyReadyWorkSelected}
                className={[
                  "task-queue-state-summary-item task-my-ready-work",
                  isMyReadyWorkSelected ? "active" : ""
                ].filter(Boolean).join(" ")}
                disabled={
                  personalWorkSummary.readyCount === 0 &&
                  !isMyReadyWorkSelected
                }
                onClick={() => {
                  const nextFilters = toggleTaskPersonalWorkShortcut(
                    personalWorkFilterState,
                    "ready",
                    currentStaffUserId
                  );
                  setTaskQueueStateFilter(nextFilters.queueState);
                  setTaskAssigneeFilter(nextFilters.assignee);
                  setTaskStatusFilter(nextFilters.status);
                }}
                type="button"
              >
                <span>My ready work</span>
                <span className="task-queue-state-summary-count">
                  <strong>{personalWorkSummary.readyCount}</strong>
                  <small>{personalWorkSummary.openCount} open</small>
                </span>
              </button>
            ) : null}
            {currentStaffUserId ? (
              <button
                aria-pressed={isMyActiveWorkSelected}
                className={[
                  "task-queue-state-summary-item task-my-active-work",
                  isMyActiveWorkSelected ? "active" : ""
                ].filter(Boolean).join(" ")}
                disabled={
                  personalWorkSummary.activeCount === 0 &&
                  !isMyActiveWorkSelected
                }
                onClick={() => {
                  const nextFilters = toggleTaskPersonalWorkShortcut(
                    personalWorkFilterState,
                    "active",
                    currentStaffUserId
                  );
                  setTaskQueueStateFilter(nextFilters.queueState);
                  setTaskAssigneeFilter(nextFilters.assignee);
                  setTaskStatusFilter(nextFilters.status);
                }}
                type="button"
              >
                <span>My active work</span>
                <span className="task-queue-state-summary-count">
                  <strong>{personalWorkSummary.activeCount}</strong>
                  <small>{personalWorkSummary.openCount} open</small>
                </span>
              </button>
            ) : null}
            {currentStaffUserId ? (
              <button
                aria-pressed={isMyNeedsHumanSelected}
                className={[
                  "task-queue-state-summary-item task-my-needs-human",
                  isMyNeedsHumanSelected ? "active" : ""
                ].filter(Boolean).join(" ")}
                disabled={
                  personalWorkSummary.needsHumanCount === 0 &&
                  !isMyNeedsHumanSelected
                }
                onClick={() => {
                  const nextFilters = toggleTaskPersonalWorkShortcut(
                    personalWorkFilterState,
                    "needs_human",
                    currentStaffUserId
                  );
                  setTaskQueueStateFilter(nextFilters.queueState);
                  setTaskAssigneeFilter(nextFilters.assignee);
                  setTaskStatusFilter(nextFilters.status);
                }}
                type="button"
              >
                <span>My needs help</span>
                <span className="task-queue-state-summary-count">
                  <strong>{personalWorkSummary.needsHumanCount}</strong>
                  <small>{personalWorkSummary.openCount} open</small>
                </span>
              </button>
            ) : null}
            {currentStaffUserId ? (
              <button
                aria-pressed={isMyCompletedWorkSelected}
                className={[
                  "task-queue-state-summary-item task-my-completed-work",
                  isMyCompletedWorkSelected ? "active" : ""
                ].filter(Boolean).join(" ")}
                disabled={
                  personalWorkSummary.completedCount === 0 &&
                  !isMyCompletedWorkSelected
                }
                onClick={() => {
                  const nextFilters = toggleTaskPersonalWorkShortcut(
                    personalWorkFilterState,
                    "completed",
                    currentStaffUserId
                  );
                  setTaskQueueStateFilter(nextFilters.queueState);
                  setTaskAssigneeFilter(nextFilters.assignee);
                  setTaskStatusFilter(nextFilters.status);
                }}
                type="button"
              >
                <span>My completed work</span>
                <span className="task-queue-state-summary-count">
                  <strong>{personalWorkSummary.completedCount}</strong>
                  <small>{personalWorkSummary.totalCount} total</small>
                </span>
              </button>
            ) : null}
            {currentStaffUserId ? (
              <button
                aria-pressed={isMyIgnoredWorkSelected}
                className={[
                  "task-queue-state-summary-item task-my-ignored-work",
                  isMyIgnoredWorkSelected ? "active" : ""
                ].filter(Boolean).join(" ")}
                disabled={
                  personalWorkSummary.ignoredCount === 0 &&
                  !isMyIgnoredWorkSelected
                }
                onClick={() => {
                  const nextFilters = toggleTaskPersonalWorkShortcut(
                    personalWorkFilterState,
                    "ignored",
                    currentStaffUserId
                  );
                  setTaskQueueStateFilter(nextFilters.queueState);
                  setTaskAssigneeFilter(nextFilters.assignee);
                  setTaskStatusFilter(nextFilters.status);
                }}
                type="button"
              >
                <span>My ignored work</span>
                <span className="task-queue-state-summary-count">
                  <strong>{personalWorkSummary.ignoredCount}</strong>
                  <small>{personalWorkSummary.totalCount} total</small>
                </span>
              </button>
            ) : null}
            {currentStaffUserId ? (
              <button
                aria-pressed={taskSubmittedByMeFilter}
                className={[
                  "task-queue-state-summary-item task-my-submitted-work",
                  taskSubmittedByMeFilter ? "active" : ""
                ].filter(Boolean).join(" ")}
                disabled={
                  submittedWorkSummary.totalCount === 0 &&
                  !taskSubmittedByMeFilter
                }
                onClick={() => setTaskSubmittedByMeFilter((current) => !current)}
                type="button"
              >
                <span>My submitted work</span>
                <span className="task-queue-state-summary-count">
                  <strong>{submittedWorkSummary.unresolvedCount}</strong>
                  <small>{submittedWorkSummary.totalCount} total</small>
                </span>
              </button>
            ) : null}
          </div>
          <details className="task-advanced-filter-disclosure">
            <summary className="task-advanced-filter-summary">
              <span className="task-advanced-filter-summary-copy">
                <span>Advanced filters</span>
                <small>{activeAdvancedFilterCount} active</small>
              </span>
              <span aria-hidden="true" className="task-advanced-filter-caret" />
            </summary>
            <div className="task-advanced-filter-content">
              <div className="task-advanced-filter-actions">
                <button
                  className="mini-button quiet"
                  disabled={activeAdvancedFilterCount === 0}
                  onClick={clearAdvancedTaskFilters}
                  type="button"
                >
                  Clear advanced
                </button>
              </div>
          <div className="task-workflow-stage-summary" aria-label="Task workflow-stage counts">
            {workflowStageSummaries.map((summary) => (
              <button
                aria-pressed={taskWorkflowStageFilter === summary.stage}
                className={`task-workflow-stage-summary-item task-workflow-stage-${summary.stage}${
                  taskWorkflowStageFilter === summary.stage ? " active" : ""
                }`}
                disabled={summary.count === 0 && taskWorkflowStageFilter !== summary.stage}
                key={summary.stage}
                onClick={() =>
                  setTaskWorkflowStageFilter(
                    taskWorkflowStageFilter === summary.stage ? "all" : summary.stage
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-workflow-stage-summary-count">
                  <strong>{summary.count}</strong>
                  <small>{summary.unresolvedCount} open · {summary.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-activity-trail-summary" aria-label="Task activity trail counts">
            {activityTrailSummaries.map((summary) => (
              <button
                aria-pressed={taskActivityTrailFilter === summary.trailKind}
                className={`task-activity-trail-summary-item task-activity-trail-${summary.trailKind}${
                  taskActivityTrailFilter === summary.trailKind ? " active" : ""
                }`}
                disabled={summary.count === 0 && taskActivityTrailFilter !== summary.trailKind}
                key={summary.trailKind}
                onClick={() =>
                  setTaskActivityTrailFilter(
                    taskActivityTrailFilter === summary.trailKind ? "all" : summary.trailKind
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-activity-trail-summary-count">
                  <strong>{summary.unresolvedCount}</strong>
                  <small>open · {summary.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-attention-summary" aria-label="Task attention counts">
            {attentionSummaries.map((summary) => (
              <button
                aria-pressed={taskAttentionFilter === summary.level}
                className={`task-attention-summary-item task-attention-${summary.level}${
                  taskAttentionFilter === summary.level ? " active" : ""
                }`}
                disabled={summary.count === 0 && taskAttentionFilter !== summary.level}
                key={summary.level}
                onClick={() =>
                  setTaskAttentionFilter(
                    taskAttentionFilter === summary.level ? "all" : summary.level
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-attention-summary-count">
                  <strong>{summary.count}</strong>
                  <small>{summary.unresolvedCount} open · {summary.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-source-summary" aria-label="Task source counts">
            {sourceSummaries.map((summary) => (
              <button
                aria-pressed={taskSourceFilter === summary.origin}
                className={`task-source-summary-item task-proof-${summary.origin}${
                  taskSourceFilter === summary.origin ? " active" : ""
                }`}
                disabled={summary.count === 0 && taskSourceFilter !== summary.origin}
                key={summary.origin}
                onClick={() =>
                  setTaskSourceFilter(taskSourceFilter === summary.origin ? "all" : summary.origin)
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-source-summary-count">
                  <strong>{summary.unresolvedCount}</strong>
                  <small>open · {summary.count} total</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-proof-completion-summary" aria-label="Task proof completion counts">
            {proofCompletionSummaries.map((summary) => (
              <button
                aria-pressed={taskProofCompletionFilter === summary.state}
                className={`task-proof-completion-summary-item task-proof-completion-${summary.state}${
                  taskProofCompletionFilter === summary.state ? " active" : ""
                }`}
                disabled={summary.count === 0 && taskProofCompletionFilter !== summary.state}
                key={summary.state}
                onClick={() =>
                  setTaskProofCompletionFilter(
                    taskProofCompletionFilter === summary.state ? "all" : summary.state
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-proof-completion-summary-count">
                  <strong>{summary.count}</strong>
                  <small>{summary.unresolvedCount} open · {summary.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-age-summary" aria-label="Task age counts">
            {ageSummaries.map((summary) => (
              <button
                aria-pressed={taskAgeFilter === summary.ageBucket}
                className={`task-age-summary-item task-age-${summary.ageBucket}${
                  taskAgeFilter === summary.ageBucket ? " active" : ""
                }`}
                disabled={summary.count === 0 && taskAgeFilter !== summary.ageBucket}
                key={summary.ageBucket}
                onClick={() =>
                  setTaskAgeFilter(
                    taskAgeFilter === summary.ageBucket ? "all" : summary.ageBucket
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-age-summary-count">
                  <strong>{summary.count}</strong>
                  <small>{summary.unresolvedCount} open · {summary.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-last-touch-summary" aria-label="Task last-touch counts">
            {lastTouchSummaries.map((summary) => (
              <button
                aria-pressed={taskLastTouchFilter === summary.lastTouchBucket}
                className={`task-last-touch-summary-item task-last-touch-${summary.lastTouchBucket}${
                  taskLastTouchFilter === summary.lastTouchBucket ? " active" : ""
                }`}
                disabled={summary.count === 0 && taskLastTouchFilter !== summary.lastTouchBucket}
                key={summary.lastTouchBucket}
                onClick={() =>
                  setTaskLastTouchFilter(
                    taskLastTouchFilter === summary.lastTouchBucket ? "all" : summary.lastTouchBucket
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-last-touch-summary-count">
                  <strong>{summary.count}</strong>
                  <small>{summary.unresolvedCount} open · {summary.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-confidence-summary" aria-label="Task confidence counts">
            {confidenceSummaries.map((summary) => (
              <button
                aria-pressed={taskConfidenceFilter === summary.confidenceBucket}
                className={`task-confidence-summary-item task-confidence-${summary.confidenceBucket}${
                  taskConfidenceFilter === summary.confidenceBucket ? " active" : ""
                }`}
                disabled={summary.count === 0 && taskConfidenceFilter !== summary.confidenceBucket}
                key={summary.confidenceBucket}
                onClick={() =>
                  setTaskConfidenceFilter(
                    taskConfidenceFilter === summary.confidenceBucket ? "all" : summary.confidenceBucket
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-confidence-summary-count">
                  <strong>{summary.count}</strong>
                  <small>{summary.unresolvedCount} open · {summary.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-intent-summary" aria-label="Task intent counts">
            {intentSummaries.map((summary) => (
              <button
                aria-pressed={
                  taskIntentFilter === summary.intentKey ||
                  summary.intentKeys.includes(taskIntentFilter)
                }
                className={`task-intent-summary-item${
                  taskIntentFilter === summary.intentKey ||
                  summary.intentKeys.includes(taskIntentFilter)
                    ? " active"
                    : ""
                }`}
                key={summary.intentKey}
                onClick={() =>
                  setTaskIntentFilter(
                    taskIntentFilter === summary.intentKey ? "all" : summary.intentKey
                  )
                }
                type="button"
              >
                <span title={summary.fullLabel}>{summary.label}</span>
                <span className="task-intent-summary-count">
                  <strong>{summary.unresolvedCount}</strong>
                  <small>open · {summary.count} total</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-next-step-summary" aria-label="Task next-step counts">
            {nextStepSummaries.map((summary) => (
              <button
                aria-pressed={
                  taskNextStepFilter === summary.nextStepKey ||
                  summary.nextStepKeys.includes(taskNextStepFilter)
                }
                className={`task-next-step-summary-item${
                  taskNextStepFilter === summary.nextStepKey ||
                  summary.nextStepKeys.includes(taskNextStepFilter)
                    ? " active"
                    : ""
                }`}
                key={summary.nextStepKey}
                onClick={() =>
                  setTaskNextStepFilter(
                    taskNextStepFilter === summary.nextStepKey ? "all" : summary.nextStepKey
                  )
                }
                type="button"
              >
                <span title={summary.fullLabel}>{summary.label}</span>
                <span className="task-next-step-summary-count">
                  <strong>{summary.unresolvedCount}</strong>
                  <small>open · {summary.count} total</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-requester-contact-summary" aria-label="Task requester contact counts">
            {requesterContactSummaries.map((summary) => (
              <button
                aria-pressed={taskRequesterContactFilter === summary.contactKind}
                className={`task-requester-contact-summary-item task-requester-contact-${summary.contactKind}${
                  taskRequesterContactFilter === summary.contactKind ? " active" : ""
                }`}
                disabled={
                  summary.count === 0 && taskRequesterContactFilter !== summary.contactKind
                }
                key={summary.contactKind}
                onClick={() =>
                  setTaskRequesterContactFilter(
                    taskRequesterContactFilter === summary.contactKind ? "all" : summary.contactKind
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-requester-contact-summary-count">
                  <strong>{summary.unresolvedCount}</strong>
                  <small>open · {summary.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-follow-up-mode-summary" aria-label="Task follow-up mode counts">
            {followUpModeSummaries.map((summary) => (
              <button
                aria-pressed={taskFollowUpModeFilter === summary.mode}
                className={`task-follow-up-mode-summary-item task-follow-up-mode-${summary.mode}${
                  taskFollowUpModeFilter === summary.mode ? " active" : ""
                }`}
                disabled={summary.count === 0 && taskFollowUpModeFilter !== summary.mode}
                key={summary.mode}
                onClick={() =>
                  setTaskFollowUpModeFilter(
                    taskFollowUpModeFilter === summary.mode ? "all" : summary.mode
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-follow-up-mode-summary-count">
                  <strong>{summary.unresolvedCount}</strong>
                  <small>open · {summary.count} total · {summary.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-member-system-boundary-summary" aria-label="Task member-system boundary counts">
            {memberSystemBoundarySummaries.map((summary) => (
              <button
                aria-pressed={taskMemberSystemBoundaryFilter === summary.boundary}
                className={`task-member-system-boundary-summary-item task-member-system-boundary-${summary.boundary}${
                  taskMemberSystemBoundaryFilter === summary.boundary ? " active" : ""
                }`}
                disabled={
                  summary.count === 0 && taskMemberSystemBoundaryFilter !== summary.boundary
                }
                key={summary.boundary}
                onClick={() =>
                  setTaskMemberSystemBoundaryFilter(
                    taskMemberSystemBoundaryFilter === summary.boundary
                      ? "all"
                      : summary.boundary
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-member-system-boundary-summary-count">
                  <strong>{summary.count}</strong>
                  <small>{summary.unresolvedCount} open · {summary.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-owner-policy-dependency-summary" aria-label="Task owner-policy dependency counts">
            {ownerPolicyDependencySummaries.map((summary) => (
              <button
                aria-pressed={taskOwnerPolicyDependencyFilter === summary.dependency}
                className={`task-owner-policy-dependency-summary-item task-owner-policy-dependency-${summary.dependency}${
                  taskOwnerPolicyDependencyFilter === summary.dependency ? " active" : ""
                }`}
                disabled={
                  summary.count === 0 && taskOwnerPolicyDependencyFilter !== summary.dependency
                }
                key={summary.dependency}
                onClick={() =>
                  setTaskOwnerPolicyDependencyFilter(
                    taskOwnerPolicyDependencyFilter === summary.dependency
                      ? "all"
                      : summary.dependency
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-owner-policy-dependency-summary-count">
                  <strong>{summary.count}</strong>
                  <small>{summary.unresolvedCount} open · {summary.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-staff-action-lane-summary" aria-label="Task staff action-lane counts">
            {staffActionLaneSummaries.map((summary) => (
              <button
                aria-pressed={taskStaffActionLaneFilter === summary.lane}
                className={`task-staff-action-lane-summary-item task-staff-action-lane-${summary.lane}${
                  taskStaffActionLaneFilter === summary.lane ? " active" : ""
                }`}
                disabled={summary.count === 0 && taskStaffActionLaneFilter !== summary.lane}
                key={summary.lane}
                onClick={() =>
                  setTaskStaffActionLaneFilter(
                    taskStaffActionLaneFilter === summary.lane ? "all" : summary.lane
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-staff-action-lane-summary-count">
                  <strong>{summary.count}</strong>
                  <small>{summary.unresolvedCount} open · {summary.detail}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-channel-summary" aria-label="Task channel counts">
            {channelSummaries.map((summary) => (
              <button
                aria-pressed={taskChannelFilter === summary.channel}
                className={`task-channel-summary-item task-channel-${summary.channel}${
                  taskChannelFilter === summary.channel ? " active" : ""
                }`}
                disabled={summary.count === 0 && taskChannelFilter !== summary.channel}
                key={summary.channel}
                onClick={() =>
                  setTaskChannelFilter(
                    taskChannelFilter === summary.channel ? "all" : summary.channel
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-channel-summary-count">
                  <strong>{summary.unresolvedCount}</strong>
                  <small>open · {summary.count} total</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-location-summary" aria-label="Task location counts">
            {locationSummaries.map((summary) => (
              <button
                aria-pressed={taskLocationFilter === summary.locationId}
                className={`task-location-summary-item${
                  taskLocationFilter === summary.locationId ? " active" : ""
                }`}
                disabled={summary.count === 0 && taskLocationFilter !== summary.locationId}
                key={summary.locationId}
                onClick={() =>
                  setTaskLocationFilter(
                    taskLocationFilter === summary.locationId ? "all" : summary.locationId
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-location-summary-count">
                  <strong>{summary.unresolvedCount}</strong>
                  <small>open · {summary.count} total</small>
                </span>
              </button>
            ))}
          </div>
          <div className="task-assignee-summary" aria-label="Task assignee counts">
            {assigneeSummaries.map((summary) => (
              <button
                aria-pressed={taskAssigneeFilter === summary.value}
                className={`task-assignee-summary-item${
                  taskAssigneeFilter === summary.value ? " active" : ""
                }`}
                key={summary.value}
                onClick={() =>
                  setTaskAssigneeFilter(
                    taskAssigneeFilter === summary.value ? "all" : summary.value
                  )
                }
                type="button"
              >
                <span>{summary.label}</span>
                <span className="task-assignee-summary-count">
                  <strong>{summary.unresolvedCount}</strong>
                  <small>open · {summary.count} total</small>
                </span>
              </button>
            ))}
          </div>
            </div>
          </details>
        </section>

        <TaskTable
          draftTaskIds={noteDraftTaskIds}
          emptyDetail="Clear the queue controls, change status or assignee, or create a manual task."
          emptyTitle="No staff tasks match those filters"
          onSelectTask={setSelectedTaskId}
          selectedTaskAnchorId={selectedTaskRowAnchorId}
          selectedTaskId={selectedTask?.id}
          tasks={visibleTasks}
          taskEvents={state.taskEvents}
          users={users}
        />

        {selectedTask ? (
          <aside className="panel task-detail-panel" aria-label="Selected task detail">
            <div className="panel-header">
              <div>
                <span className="task-detail-selection-context">
                  <span className="rail-title">Selected task</span>
                  <span className="task-detail-queue-position">
                    {selectedTaskQueuePosition.current} of {selectedTaskQueuePosition.total} in view
                  </span>
                </span>
                <h2>{selectedTask.requesterName}</h2>
                <div className="task-detail-requester-contact">
                  <p>{selectedTask.requesterContact}</p>
                  <button
                    className="mini-button quiet task-contact-copy-button"
                    onClick={() =>
                      void copySelectedTaskText("requester_contact", selectedTask.requesterContact)
                    }
                    type="button"
                  >
                    {taskCopyStatus === "copied" && taskCopyTarget === "requester_contact"
                      ? "Copied"
                      : "Copy contact"}
                  </button>
                </div>
              </div>
              <div className="task-detail-header-actions">
                <button
                  className="mini-button quiet task-link-copy-button"
                  onClick={copySelectedTaskLink}
                  type="button"
                >
                  {taskCopyStatus === "copied" && taskCopyTarget === "task_link"
                    ? "Copied"
                    : "Copy task link"}
                </button>
                <TaskStatusPill status={selectedTask.status} />
              </div>
            </div>

            <nav aria-label="Visible task navigation" className="task-detail-queue-navigation">
              <a
                className="mini-button quiet task-return-to-selected-row"
                href={`#${selectedTaskRowAnchorId}`}
              >
                Back to selected row
              </a>
              <button
                className="mini-button quiet"
                disabled={!previousTaskId}
                onClick={() => previousTaskId && setSelectedTaskId(previousTaskId)}
                type="button"
              >
                Previous task
              </button>
              <button
                className="mini-button quiet"
                disabled={!nextTaskId}
                onClick={() => nextTaskId && setSelectedTaskId(nextTaskId)}
                type="button"
              >
                Next task
              </button>
            </nav>

            <div
              aria-live="polite"
              className="task-link-copy-feedback task-copy-feedback"
              role="status"
            >
              {taskCopyStatus === "copied" ? taskCopySuccessMessages[taskCopyTarget] : null}
              {taskCopyStatus === "failed"
                ? `Clipboard unavailable. Select and copy the ${taskCopyFallbackLabels[
                    taskCopyTarget
                  ].toLowerCase()} below.`
                : null}
            </div>
            {taskCopyStatus === "failed" ? (
              <label className="task-link-copy-fallback" htmlFor="selected-task-copy-fallback">
                <span>{taskCopyFallbackLabels[taskCopyTarget]}</span>
                <input
                  id="selected-task-copy-fallback"
                  readOnly
                  ref={taskCopyFallbackRef}
                  type="text"
                  value={taskCopyFallback}
                />
              </label>
            ) : null}

            <div className="task-detail-body">
              <section className="task-detail-section">
                <dl className="task-detail-grid task-detail-facts">
                  <div>
                    <dt>Channel</dt>
                    <dd>{displayLabel(selectedTask.channel)}</dd>
                  </div>
                  <div>
                    <dt>Intent</dt>
                    <dd>{selectedTask.intent}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatTimestamp(selectedTask.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatTimestamp(selectedTask.updatedAt)}</dd>
                  </div>
                </dl>
              </section>

              {selectedTaskProof ? (
                <section className={`task-detail-section task-proof-panel task-proof-${selectedTaskProof.origin}`}>
                  <div className="task-proof-header">
                    <div>
                      <span className="rail-title">Local beta proof</span>
                      <strong>{selectedTaskProof.title}</strong>
                    </div>
                    <span className="task-proof-pill">{selectedTaskProof.label}</span>
                  </div>
                  <p>{selectedTaskProof.detail}</p>
                  <div className="task-proof-source">
                    <span>Source</span>
                    <strong>{selectedTaskProof.sourceDetail}</strong>
                  </div>
                  <ol className="task-proof-checklist" aria-label="Task proof checklist">
                    {selectedTaskProof.checklist.map((item, index) => (
                      <li className={item.done ? "done" : "active"} key={index}>
                        <span aria-hidden="true" />
                        <strong>
                          <span className="task-proof-step-state">
                            {item.done ? "Done: " : "To do: "}
                          </span>
                          {item.label}
                        </strong>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              <section className="task-detail-section">
                <div className="task-detail-section-heading">
                  <span className="rail-title">Summary</span>
                  <button
                    className="mini-button quiet"
                    onClick={() =>
                      void copySelectedTaskText("task_brief", taskStaffClipboardBrief(selectedTask))
                    }
                    type="button"
                  >
                    {taskCopyStatus === "copied" && taskCopyTarget === "task_brief"
                      ? "Copied"
                      : "Copy task brief"}
                  </button>
                </div>
                <p>{selectedTask.summary}</p>
              </section>

              <section className="task-detail-section">
                <div className="task-detail-section-heading">
                  <span className="rail-title">Suggested next step</span>
                  <button
                    className="mini-button quiet"
                    onClick={() =>
                      void copySelectedTaskText("suggested_next_step", selectedTask.suggestedNextStep)
                    }
                    type="button"
                  >
                    {taskCopyStatus === "copied" && taskCopyTarget === "suggested_next_step"
                      ? "Copied"
                      : "Copy next step"}
                  </button>
                </div>
                <div className="quiet-strip">
                  <strong>{selectedTask.suggestedNextStep}</strong>
                  <span className="muted">
                    Human review stays required for low confidence, account changes, and policy calls.
                  </span>
                </div>
              </section>

              <section className="task-detail-section">
                <span className="rail-title">Confidence</span>
                <span className="confidence detail-confidence">
                  <span className="mono">{confidencePercentage}%</span>
                  <span aria-hidden="true" className="confidence-track">
                    <span
                      className={`confidence-fill${confidence < 0.7 ? " low" : ""}`}
                      style={{ width: `${confidencePercentage}%` }}
                    />
                  </span>
                </span>
              </section>

              <section className="task-detail-section task-detail-controls task-command-section">
                <div className="task-command-heading">
                  <div>
                    <span className="rail-title">Staff actions</span>
                    <strong>Move the selected task forward</strong>
                  </div>
                  <span className="task-command-mode">
                    {isBackendMode ? "Backend save" : "Local draft"}
                  </span>
                </div>
                {canStartSelectedTask ? (
                  isBackendMode ? (
                    <form action={statusFormAction} className="task-action-form">
                      <input name="tenantId" type="hidden" value={tenant.id} />
                      <input name="locationId" type="hidden" value={selectedTask.locationId} />
                      <input name="taskId" type="hidden" value={selectedTask.id} />
                      <input name="statusIntent" type="hidden" value="start" />
                      <button
                        className="button button-primary"
                        disabled={statusPending}
                        type="submit"
                      >
                        Start work
                      </button>
                    </form>
                  ) : (
                    <button
                      className="button button-primary"
                      onClick={startSelectedTask}
                      type="button"
                    >
                      Start work
                    </button>
                  )
                ) : null}
                {canMarkSelectedTaskNeedsHuman ? (
                  isBackendMode ? (
                    <form action={statusFormAction} className="task-action-form">
                      <input name="tenantId" type="hidden" value={tenant.id} />
                      <input name="locationId" type="hidden" value={selectedTask.locationId} />
                      <input name="taskId" type="hidden" value={selectedTask.id} />
                      <input name="statusIntent" type="hidden" value="needs_human" />
                      <button
                        className="button button-secondary"
                        disabled={statusPending}
                        type="submit"
                      >
                        Mark needs human
                      </button>
                    </form>
                  ) : (
                    <button
                      className="button button-secondary"
                      onClick={markSelectedTaskNeedsHuman}
                      type="button"
                    >
                      Mark needs human
                    </button>
                  )
                ) : null}
                {canMarkSelectedTaskDone ? (
                  isBackendMode ? (
                    <form action={statusFormAction} className="task-action-form">
                      <input name="tenantId" type="hidden" value={tenant.id} />
                      <input name="locationId" type="hidden" value={selectedTask.locationId} />
                      <input name="taskId" type="hidden" value={selectedTask.id} />
                      <input name="statusIntent" type="hidden" value="done" />
                      <button className="button button-primary" disabled={statusPending} type="submit">
                        Mark done
                      </button>
                    </form>
                  ) : (
                    <button className="button button-primary" onClick={markSelectedTaskDone} type="button">
                      Mark done
                    </button>
                  )
                ) : null}
                {canMarkSelectedTaskIgnored ? (
                  isBackendMode ? (
                    <form action={statusFormAction} className="task-action-form">
                      <input name="tenantId" type="hidden" value={tenant.id} />
                      <input name="locationId" type="hidden" value={selectedTask.locationId} />
                      <input name="taskId" type="hidden" value={selectedTask.id} />
                      <input name="statusIntent" type="hidden" value="ignored" />
                      <button className="button button-secondary" disabled={statusPending} type="submit">Mark ignored</button>
                    </form>
                  ) : (
                    <button className="button button-secondary" onClick={markSelectedTaskIgnored} type="button">Mark ignored</button>
                  )
                ) : null}
                {canReopenSelectedTask ? (
                  isBackendMode ? (
                    <form action={statusFormAction} className="task-action-form">
                      <input name="tenantId" type="hidden" value={tenant.id} />
                      <input name="locationId" type="hidden" value={selectedTask.locationId} />
                      <input name="taskId" type="hidden" value={selectedTask.id} />
                      <input name="statusIntent" type="hidden" value="reopen" />
                      <button className="button button-secondary" disabled={statusPending} type="submit">
                        Reopen task
                      </button>
                    </form>
                  ) : (
                    <button className="button button-secondary" onClick={reopenSelectedTask} type="button">
                      Reopen task
                    </button>
                  )
                ) : null}
                <form action={statusFormAction} className="task-action-form">
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <input name="locationId" type="hidden" value={selectedTask.locationId} />
                  <input name="taskId" type="hidden" value={selectedTask.id} />
                  <label htmlFor="task-status-control">
                    <span>Status</span>
                    <select
                      id="task-status-control"
                      name="toStatus"
                      onChange={(event) => changeStatus(event.target.value as TaskStatus)}
                      value={isBackendMode ? statusDraft : selectedTask.status}
                    >
                      {taskStatuses.map((status) => {
                        const enabled = status === selectedTask.status || allowedStatuses.includes(status);
                        return (
                          <option disabled={!enabled} key={status} value={status}>
                            {displayLabel(status)}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <span className="task-control-help">
                    {allowedStatuses.length > 0
                      ? `Available next: ${allowedStatuses.map(displayLabel).join(", ")}.`
                      : "No further status changes are available."}
                  </span>
                  {isBackendMode ? (
                    <button
                      className="button button-primary"
                      disabled={
                        statusPending ||
                        !statusDraft ||
                        statusDraft === selectedTask.status ||
                        !allowedStatuses.includes(statusDraft as TaskStatus)
                      }
                      type="submit"
                    >
                      {statusPending ? "Saving..." : "Save status"}
                    </button>
                  ) : null}
                </form>

                {!selectedTask.assigneeUserId && currentStaffUserId ? (
                  isBackendMode ? (
                    <form action={assignmentFormAction} className="task-action-form">
                      <input name="tenantId" type="hidden" value={tenant.id} />
                      <input name="locationId" type="hidden" value={selectedTask.locationId} />
                      <input name="taskId" type="hidden" value={selectedTask.id} />
                      <input name="assignmentIntent" type="hidden" value="claim" />
                      <button
                        className="button button-primary"
                        disabled={assignmentPending}
                        type="submit"
                      >
                        Claim task
                      </button>
                    </form>
                  ) : (
                    <button
                      className="button button-primary"
                      onClick={claimSelectedTask}
                      type="button"
                    >
                      Claim task
                    </button>
                  )
                ) : null}

                {selectedTask.assigneeUserId === currentStaffUserId && currentStaffUserId ? (
                  isBackendMode ? (
                    <form action={assignmentFormAction} className="task-action-form">
                      <input name="tenantId" type="hidden" value={tenant.id} />
                      <input name="locationId" type="hidden" value={selectedTask.locationId} />
                      <input name="taskId" type="hidden" value={selectedTask.id} />
                      <input name="assignmentIntent" type="hidden" value="release" />
                      <button
                        className="button button-secondary"
                        disabled={assignmentPending}
                        type="submit"
                      >
                        Release task
                      </button>
                    </form>
                  ) : (
                    <button
                      className="button button-secondary"
                      onClick={releaseSelectedTask}
                      type="button"
                    >
                      Release task
                    </button>
                  )
                ) : null}

                <form action={assignmentFormAction} className="task-action-form">
                  <input name="tenantId" type="hidden" value={tenant.id} />
                  <input name="locationId" type="hidden" value={selectedTask.locationId} />
                  <input name="taskId" type="hidden" value={selectedTask.id} />
                  <label htmlFor="task-assignee-control">
                    <span>Assignee</span>
                    <select
                      disabled={assignmentPending}
                      id="task-assignee-control"
                      name="assigneeUserId"
                      onChange={(event) => changeAssignee(event.target.value)}
                      value={isBackendMode ? assigneeDraft : selectedTask.assigneeUserId ?? ""}
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="task-control-help">
                    Assign ownership before resolving answer-review or needs-human work.
                  </span>
                  {isBackendMode ? (
                    <button
                      className="button button-primary"
                      disabled={assignmentPending || assigneeDraft === (selectedTask.assigneeUserId ?? "")}
                      type="submit"
                    >
                      {assignmentPending ? "Saving..." : "Save assignee"}
                    </button>
                  ) : null}
                </form>

                {allowedStatuses.length === 0 ? (
                  <span className="inline-warning">
                    Done and ignored tasks are terminal in this workflow.
                  </span>
                ) : null}
                {statusActionFeedbackVisible ? (
                  <span
                    className={statusActionState.ok ? "inline-success" : "inline-warning"}
                    role="status"
                  >
                    {statusActionState.message}
                  </span>
                ) : null}
                {assignmentActionFeedbackVisible ? (
                  <span
                    className={assignmentActionState.ok ? "inline-success" : "inline-warning"}
                    role="status"
                  >
                    {assignmentActionState.message}
                  </span>
                ) : null}
              </section>

              <form
                action={isBackendMode ? noteFormAction : undefined}
                className="task-detail-section task-note-form task-command-section"
              >
                <input name="tenantId" type="hidden" value={tenant.id} />
                <input name="locationId" type="hidden" value={selectedTask.locationId} />
                <input name="taskId" type="hidden" value={selectedTask.id} />
                <div className="task-command-heading">
                  <div>
                    <span className="rail-title">Handoff note</span>
                    <strong>Leave context for the next staff member</strong>
                  </div>
                  <div className="task-note-draft-actions">
                    <span className="task-command-mode">{taskNoteDraftCountLabel(note)}</span>
                    <button
                      className="mini-button quiet"
                      disabled={note.length === 0}
                      onClick={() =>
                        setNoteDrafts((current) => clearTaskNoteDraft(current, selectedTask.id))
                      }
                      type="button"
                    >
                      Clear draft
                    </button>
                  </div>
                </div>
                <label htmlFor="task-note-control">
                  <span>Staff handoff note</span>
                  <textarea
                    disabled={notePending}
                    id="task-note-control"
                    maxLength={1200}
                    name="note"
                    onChange={(event) =>
                      setNoteDrafts((current) =>
                        setTaskNoteDraft(current, selectedTask.id, event.target.value)
                      )
                    }
                    placeholder="Add context for the next staff handoff."
                    value={note}
                  />
                </label>
                <button
                  className="button"
                  disabled={notePending || note.trim().length === 0}
                  onClick={isBackendMode ? undefined : addNote}
                  type={isBackendMode ? "submit" : "button"}
                >
                  {notePending ? "Adding..." : "Add note"}
                </button>
                {noteActionFeedbackVisible ? (
                  <span
                    className={noteActionState.ok ? "inline-success" : "inline-warning"}
                    role="status"
                  >
                    {noteActionState.message}
                  </span>
                ) : null}
              </form>

              <section className="task-detail-section">
                <div className="activity-header">
                  <span className="rail-title">{isBackendMode ? "Backend activity" : "Local activity"}</span>
                  <span className="activity-count">
                    {selectedTaskActivity.length} {selectedTaskActivity.length === 1 ? "event" : "events"}
                  </span>
                </div>
                <div className="task-activity-list">
                  {selectedTaskActivity.length > 0 ? (
                    selectedTaskActivity.map((activity) => (
                      <article className={`task-activity task-activity-${activity.kind}`} key={activity.id}>
                        <div className="activity-marker" aria-hidden="true" />
                        <div className="activity-content">
                          <div className="activity-topline">
                            <span className="activity-kind">{displayLabel(activity.kind)}</span>
                            <span className="muted mono">{formatTimestamp(activity.createdAt)}</span>
                          </div>
                          <div className="activity-title-row">
                            <strong>{activity.title}</strong>
                            {activity.actorUserId ? (
                              <span className="task-event-actor">
                                {userNames.get(activity.actorUserId) ?? "Local user"}
                              </span>
                            ) : null}
                          </div>
                          {activity.detail ? <p>{activity.detail}</p> : null}
                          {activity.note ? <p className="activity-note">{activity.note}</p> : null}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="quiet-strip">
                      <strong>No activity yet</strong>
                      <span className="muted">Select a status, assignee, or note to append one.</span>
                    </div>
                  )}
                </div>
              </section>

              <section className="task-detail-section">
                <span className="rail-title">Go-live guardrails</span>
                <div className="readiness-row">
                  <span>Live calls</span>
                  <strong>Off</strong>
                </div>
                <div className="readiness-row">
                  <span>Email automation</span>
                  <strong>Off</strong>
                </div>
                <div className="readiness-row">
                  <span>Persistence</span>
                  <strong>
                    {isBackendMode
                      ? "Backend task workflow"
                      : persistenceMode === "backend_unavailable"
                        ? "Unavailable"
                        : "Browser local"}
                  </strong>
                </div>
              </section>

              <section className="task-detail-section">
                <span className="rail-title">Shift report</span>
                {statusSummaries.map((summary) => (
                  <div className={`readiness-row${summary.status === "needs_human" ? " attention" : ""}`} key={summary.status}>
                    <span>{displayLabel(summary.status)}</span>
                    <strong>{summary.count}</strong>
                  </div>
                ))}
              </section>
            </div>
          </aside>
        ) : null}
      </div>

      <details
        className="panel manual-task-panel staff-intake-disclosure"
        aria-label="Create manual task"
        id="manual-task-intake"
      >
        <summary className="manual-task-summary">
          <div>
            <span className="rail-title">Manual intake</span>
            <h2>Create staff task</h2>
            <p>Human-entered work item. No phone, email, or source provider is connected by this form.</p>
          </div>
          <span className="manual-task-summary-action">
            <span className="mini-button quiet">
              {isBackendMode ? "Backend RPC" : persistenceMode === "local" ? "Browser local" : "Backend required"}
            </span>
            <span aria-hidden="true" className="manual-task-summary-caret" />
          </span>
        </summary>
        <form action={isBackendMode ? createFormAction : undefined} className="manual-task-form" onSubmit={createLocalManualTask}>
          <input name="tenantId" type="hidden" value={tenant.id} />
          <label>
            <span>Location</span>
            <select
              disabled={!isManualIntakeEnabled || createPending}
              name="locationId"
              onChange={(event) => updateManualIntakeDraft("locationId", event.target.value)}
              required
              value={manualIntakeDraft.locationId}
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Request channel</span>
            <select
              disabled={!isManualIntakeEnabled || createPending}
              name="channel"
              onChange={(event) => updateManualIntakeDraft("channel", event.target.value as TaskChannel)}
              required
              value={manualIntakeDraft.channel}
            >
              <option value="manual">Manual / front desk</option>
              <option value="phone">Phone</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label>
            <span className="manual-task-label-row"><span>Requester</span><small>{manualIntakeDraft.requesterName.length}/160</small></span>
            <input
              disabled={!isManualIntakeEnabled || createPending}
              maxLength={160}
              name="requesterName"
              onChange={(event) => updateManualIntakeDraft("requesterName", event.target.value)}
              placeholder="Member or prospect name"
              required
              value={manualIntakeDraft.requesterName}
            />
          </label>
          <label>
            <span className="manual-task-label-row"><span>Contact</span><small>{manualIntakeDraft.requesterContact.length}/200</small></span>
            <input
              disabled={!isManualIntakeEnabled || createPending}
              maxLength={200}
              name="requesterContact"
              onChange={(event) => updateManualIntakeDraft("requesterContact", event.target.value)}
              placeholder="Phone, email, or front-desk note"
              required
              value={manualIntakeDraft.requesterContact}
            />
          </label>
          <label>
            <span className="manual-task-label-row"><span>Intent</span><small>{manualIntakeDraft.intent.length}/120</small></span>
            <input
              disabled={!isManualIntakeEnabled || createPending}
              maxLength={120}
              name="intent"
              onChange={(event) => updateManualIntakeDraft("intent", event.target.value)}
              placeholder="Tour, billing question, freeze policy"
              required
              value={manualIntakeDraft.intent}
            />
          </label>
          <label className="manual-task-wide">
            <span className="manual-task-label-row"><span>Summary</span><small>{manualIntakeDraft.summary.length}/1200</small></span>
            <textarea
              disabled={!isManualIntakeEnabled || createPending}
              maxLength={1200}
              name="summary"
              onChange={(event) => updateManualIntakeDraft("summary", event.target.value)}
              placeholder="What happened, what the person needs, and any context staff should see."
              required
              value={manualIntakeDraft.summary}
            />
          </label>
          <label className="manual-task-wide">
            <span className="manual-task-label-row"><span>Suggested next step</span><small>{manualIntakeDraft.suggestedNextStep.length}/800</small></span>
            <textarea
              disabled={!isManualIntakeEnabled || createPending}
              maxLength={800}
              name="suggestedNextStep"
              onChange={(event) => updateManualIntakeDraft("suggestedNextStep", event.target.value)}
              placeholder="Concrete next action for staff."
              required
              value={manualIntakeDraft.suggestedNextStep}
            />
          </label>
          <label>
            <span>Confidence</span>
            <select
              disabled={!isManualIntakeEnabled || createPending}
              name="confidence"
              onChange={(event) => updateManualIntakeDraft("confidence", event.target.value)}
              value={manualIntakeDraft.confidence}
            >
              <option value="0.9">90% manual</option>
              <option value="0.75">75% needs check</option>
              <option value="0.5">50% owner review</option>
            </select>
          </label>
          <label className="manual-task-claim">
            <input
              checked={manualIntakeDraft.claimForActor}
              disabled={!isManualIntakeEnabled || createPending}
              name="claimForActor"
              onChange={(event) => updateManualIntakeDraft("claimForActor", event.target.checked)}
              type="checkbox"
            />
            <span>Assign to me</span>
          </label>
          {manualIntakeDuplicateCandidates.length > 0 ? (
            <div className="manual-task-duplicate-panel">
              <div>
                <strong>Possible existing work</strong>
                <small>{manualIntakeDuplicateCandidates.length} unresolved match</small>
              </div>
              <div className="manual-task-duplicate-list">
                {manualIntakeDuplicateCandidates.map((task) => (
                  <button
                    className="mini-button quiet"
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    type="button"
                  >
                    Review {task.requesterName}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="manual-task-actions">
            <button className="button button-primary" disabled={!isManualIntakeEnabled || createPending} type="submit">
              {createPending ? "Creating..." : "Create task"}
            </button>
            <button
              className="mini-button quiet"
              disabled={!manualIntakeDraftIsDirty || createPending}
              onClick={clearManualIntakeDraft}
              type="button"
            >
              Clear draft
            </button>
            {createActionState.message ? (
              <span className={createActionState.ok ? "inline-success" : "inline-warning"} role="status">
                {createActionState.message}
              </span>
            ) : null}
            {localCreateMessage ? (
              <span className="inline-success" role="status">{localCreateMessage}</span>
            ) : null}
            {persistenceMode === "backend_unavailable" ? (
              <span className="inline-warning">
                Sign in with local Neon to create backend-backed manual tasks.
              </span>
            ) : null}
          </div>
        </form>
      </details>
    </AppShell>
  );
}
