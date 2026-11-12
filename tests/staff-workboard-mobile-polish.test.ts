import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const taskTable = readFileSync("src/components/TaskTable.tsx", "utf8");
const staffTasksPage = readFileSync("src/app/staff/tasks/page.tsx", "utf8");
const staffTaskActions = readFileSync("src/app/staff/tasks/actions.ts", "utf8");
const staffTaskActionResult = readFileSync(
  "src/application/tasks/action-result.ts",
  "utf8"
);
const staffTaskWorkspace = readFileSync("src/components/staff/StaffTaskWorkspaceClient.tsx", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");
const taskActionFeedbackHook = readFileSync(
  "src/components/staff/useExpiringTaskActionFeedback.ts",
  "utf8"
);

describe("staff workboard mobile polish", () => {
  it("expires selected-task backend status feedback", () => {
    expect(taskActionFeedbackHook).toContain("taskActionFeedbackDurationMs = 5_000");
    expect(taskActionFeedbackHook).toContain("feedback !== expiredFeedback");
    expect(taskActionFeedbackHook).toContain("window.clearTimeout(timeoutId)");
    expect(staffTaskWorkspace).toContain("useExpiringTaskActionFeedback(");
    expect(staffTaskWorkspace).toContain("statusActionState,");
    expect(staffTaskWorkspace).toContain("statusActionFeedbackVisible");
  });

  it("scopes backend status feedback to its selected task", () => {
    expect(staffTaskActionResult).toContain("taskId?: Id");
    expect(staffTaskWorkspace).toContain("statusActionFeedbackVisible");
  });

  it("scopes backend assignment feedback to its selected task", () => {
    expect(staffTaskWorkspace).toContain("assignmentActionFeedbackVisible");
    expect(staffTaskWorkspace).toContain("assignmentActionState,");
  });

  it("keeps handoff-note feedback and drafts owned by selection", () => {
    expect(staffTaskWorkspace).toContain("noteActionFeedbackVisible");
    expect(staffTaskWorkspace).toContain("noteActionState,");
    expect(staffTaskWorkspace).not.toContain("setSelectedTaskId(taskEvent.taskId)");
    expect(staffTaskWorkspace).toContain(
      'const note = selectedTask ? noteDrafts[selectedTask.id] ?? "" : ""'
    );
    expect(staffTaskWorkspace).toContain("setTaskNoteDraft(current, selectedTask.id");
    expect(staffTaskWorkspace).toContain("clearTaskNoteDraft(current");
    expect(staffTaskWorkspace).not.toContain("JSON.stringify(noteDrafts)");
    expect(staffTaskWorkspace).toContain("taskNoteDraftCountLabel(note)");
    expect(staffTaskWorkspace).toContain("Clear draft");
    expect(staffTaskWorkspace).toContain("disabled={note.length === 0}");
    expect(globals).toContain(".task-note-draft-actions");
    expect(staffTaskWorkspace).toContain("taskNoteDraftTaskIds(noteDrafts, state.tasks)");
    expect(staffTaskWorkspace).toContain("unsaved {noteDraftTaskIds.length === 1");
    expect(globals).toContain(".task-filter-results");
    expect(staffTaskWorkspace).toContain("draftTaskIds={noteDraftTaskIds}");
    expect(taskTable).toContain("draftTaskIdSet.has(task.id)");
    expect(taskTable).toContain("task-draft-pill");
    expect(globals).toContain(".task-draft-pill");
    expect(staffTaskWorkspace).toContain("taskDraftFilter && !noteDraftTaskIdSet.has(task.id)");
    expect(staffTaskWorkspace).toContain("aria-pressed={taskDraftFilter}");
    expect(staffTaskWorkspace).toContain("noteDraftTaskIds.length === 0 && !taskDraftFilter");
    expect(staffTaskWorkspace).toContain("setTaskDraftFilter(false)");
    expect(staffTaskWorkspace).toContain("taskRequesterContactFilter === \"all\" &&\n                !taskDraftFilter");
    expect(globals).toContain('.task-draft-filter[aria-pressed="true"]');
  });

  it("selects staff task deep links only through the tenant-loaded task set", () => {
    expect(staffTasksPage).toContain("searchParams");
    expect(staffTasksPage).toContain("taskIdSearchParam");
    expect(staffTasksPage).toContain("maxStaffTaskIdSearchParamLength");
    expect(staffTasksPage).toContain("staffTaskIdSearchParam");
    expect(staffTasksPage).toContain("initialTaskId={initialTaskId}");
    expect(staffTaskWorkspace).toContain("initialTaskId?: Id");
    expect(staffTaskWorkspace).toContain("resolveTaskSelectionId");
    expect(staffTaskWorkspace).toContain("parsed.tasks");
  });

  it("copies a privacy-minimal selected task link with an honest fallback", () => {
    expect(staffTaskWorkspace).toContain("staffTaskDeepLink(window.location.origin, taskId)");
    expect(staffTaskWorkspace).toContain("navigator.clipboard?.writeText");
    expect(staffTaskWorkspace).toContain('setTaskCopyStatus("copied")');
    expect(staffTaskWorkspace).toContain('setTaskCopyStatus("failed")');
    expect(staffTaskWorkspace).toContain("selectedTaskIdRef.current !== taskId");
    expect(staffTaskWorkspace).toContain("taskCopyFallbackRef.current?.select()");
    expect(staffTaskWorkspace).toContain("Copy task link");
    expect(staffTaskWorkspace).toContain("Clipboard unavailable. Select and copy the ${");
    expect(staffTaskWorkspace).toContain('task_link: "Task link"');
    expect(staffTaskWorkspace).not.toContain("selectedTask.requesterContact)}&");
    expect(globals).toContain(".task-detail-header-actions");
    expect(globals).toContain(".task-link-copy-fallback");
  });

  it("shares stale-safe clipboard behavior with requester contact copy", () => {
    expect(staffTaskWorkspace).toContain("type TaskCopyTarget");
    expect(staffTaskWorkspace).toContain("taskCopyRequestRef.current += 1");
    expect(staffTaskWorkspace).toContain("requestId !== taskCopyRequestRef.current");
    expect(staffTaskWorkspace).toContain("selectedTaskIdRef.current !== taskId");
    expect(staffTaskWorkspace).toContain('copySelectedTaskText("requester_contact"');
    expect(staffTaskWorkspace).toContain("selectedTask.requesterContact");
    expect(staffTaskWorkspace).toContain("Copy contact");
    expect(staffTaskWorkspace).toContain("Requester contact copied.");
    expect(staffTaskWorkspace).not.toContain("mailto:");
    expect(staffTaskWorkspace).not.toContain("tel:");
    expect(globals).toContain(".task-detail-requester-contact");
  });

  it("copies the visible suggested next step without starting delivery", () => {
    expect(staffTaskWorkspace).toContain('"suggested_next_step"');
    expect(staffTaskWorkspace).toContain(
      'copySelectedTaskText("suggested_next_step", selectedTask.suggestedNextStep)'
    );
    expect(staffTaskWorkspace).toContain("Copy next step");
    expect(staffTaskWorkspace).toContain("Suggested next step copied.");
    expect(staffTaskWorkspace).not.toContain("composeReply");
    expect(staffTaskWorkspace).not.toContain("sendReply");
    expect(globals).toContain(".task-detail-section-heading");
  });

  it("copies a privacy-bounded staff task brief", () => {
    expect(staffTaskWorkspace).toContain("taskStaffClipboardBrief(selectedTask)");
    expect(staffTaskWorkspace).toContain('"task_brief"');
    expect(staffTaskWorkspace).toContain("Copy task brief");
    expect(staffTaskWorkspace).toContain("Task brief copied.");
    expect(staffTaskWorkspace).not.toContain("selectedTask.tenantId,");
    expect(staffTaskWorkspace).not.toContain("selectedTask.confidence,");
    expect(staffTaskWorkspace).not.toContain("selectedTaskProof,");
  });


  it("surfaces answer-derived task provenance in the staff queue", () => {
    expect(taskTable).toContain("taskProofSummary(task, taskEvents)");
    expect(taskTable).toContain("task-card-proof");
    expect(taskTable).toContain("task-proof-${proof.origin}");
  });

  it("lets staff filter the task queue by visible proof source", () => {
    expect(staffTaskWorkspace).toContain("type TaskSourceFilter = TaskProofOrigin | \"all\"");
    expect(staffTaskWorkspace).toContain("const taskSourceFilters");
    expect(staffTaskWorkspace).toContain("taskProofOriginSummaries(state.tasks, state.taskEvents)");
    expect(staffTaskWorkspace).toContain("taskSourceFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("proof.origin !== taskSourceFilter");
    expect(staffTaskWorkspace).toContain("setTaskSourceFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("<span>Source</span>");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task source counts\"");
    expect(staffTaskWorkspace).toContain("summary.unresolvedCount");
    expect(staffTaskWorkspace).toContain("open · {summary.count} total");
    expect(globals).toContain(".task-source-summary");
    expect(globals).toContain(".task-source-summary-count");
  });

  it("lets staff filter the queue by open or terminal task state", () => {
    expect(staffTaskWorkspace).toContain("type TaskQueueStateFilter = \"all\" | \"open\" | \"terminal\"");
    expect(staffTaskWorkspace).toContain("const taskQueueStateFilters");
    expect(staffTaskWorkspace).toContain("const taskQueueStateChips");
    expect(staffTaskWorkspace).toContain("taskQueueStateSummary(state.tasks)");
    expect(staffTaskWorkspace).toContain("isUnresolvedTask(task)");
    expect(staffTaskWorkspace).toContain("taskQueueStateFilter === \"open\"");
    expect(staffTaskWorkspace).toContain("taskQueueStateFilter === \"terminal\"");
    expect(staffTaskWorkspace).toContain("setTaskQueueStateFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task queue state counts\"");
    expect(staffTaskWorkspace).toContain("setTaskQueueStateFilter(");
    expect(staffTaskWorkspace).toContain("taskQueueStateFilter === queueState.value ? \"all\" : queueState.value");
    expect(staffTaskWorkspace).toContain("<span>Queue state</span>");
    expect(globals).toContain(".task-queue-state-summary");
    expect(globals).toContain(".task-queue-state-summary-count");
  });

  it("keeps secondary queue insights behind a responsive native disclosure", () => {
    expect(staffTaskWorkspace).toContain('<details className="task-advanced-filter-disclosure">');
    expect(staffTaskWorkspace).toContain('<summary className="task-advanced-filter-summary">');
    expect(staffTaskWorkspace).toContain("Advanced filters");
    expect(staffTaskWorkspace).toContain("activeTaskAdvancedFilterCount([");
    expect(staffTaskWorkspace).toContain("{activeAdvancedFilterCount} active");
    expect(staffTaskWorkspace).toContain('className="task-advanced-filter-content"');
    expect(globals).toContain(".task-advanced-filter-disclosure");
    expect(globals).toContain(".task-advanced-filter-summary");
    expect(globals).toContain(".task-advanced-filter-summary-copy");
    expect(globals).toContain(".task-advanced-filter-content");
  });

  it("keeps selected-row return inside responsive task navigation", () => {
    expect(staffTaskWorkspace).toContain('selectedTaskAnchorId={selectedTaskRowAnchorId}');
    expect(staffTaskWorkspace).toContain('href={`#${selectedTaskRowAnchorId}`}');
    expect(staffTaskWorkspace).toContain("Back to selected row");
    expect(globals).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(globals).toContain(".task-return-to-selected-row");
  });

  it("clears only hidden advanced filter state", () => {
    const functionStart = staffTaskWorkspace.indexOf("function clearAdvancedTaskFilters()");
    const functionEnd = staffTaskWorkspace.indexOf("\n  function", functionStart + 1);
    const clearAdvancedSource = staffTaskWorkspace.slice(functionStart, functionEnd);

    expect(functionStart).toBeGreaterThan(-1);
    [
      "setTaskWorkflowStageFilter",
      "setTaskActivityTrailFilter",
      "setTaskAttentionFilter",
      "setTaskProofCompletionFilter",
      "setTaskAgeFilter",
      "setTaskLastTouchFilter",
      "setTaskConfidenceFilter",
      "setTaskIntentFilter",
      "setTaskNextStepFilter",
      "setTaskRequesterContactFilter",
      "setTaskFollowUpModeFilter",
      "setTaskMemberSystemBoundaryFilter",
      "setTaskOwnerPolicyDependencyFilter",
      "setTaskStaffActionLaneFilter"
    ].forEach((setter) => expect(clearAdvancedSource).toContain(`${setter}("all")`));
    [
      "setTaskQuery",
      "setTaskQueueStateFilter",
      "setTaskChannelFilter",
      "setTaskLocationFilter",
      "setTaskStatusFilter",
      "setTaskSourceFilter",
      "setTaskAssigneeFilter"
    ].forEach((setter) => expect(clearAdvancedSource).not.toContain(setter));
    expect(staffTaskWorkspace).toContain("disabled={activeAdvancedFilterCount === 0}");
    expect(staffTaskWorkspace).toContain("onClick={clearAdvancedTaskFilters}");
    expect(staffTaskWorkspace).toContain("Clear advanced");
    expect(globals).toContain(".task-advanced-filter-actions");
  });

  it("uses the authenticated internal member id for My open work", () => {
    expect(staffTasksPage).toContain("sessionResolution.session.memberUserId");
    expect(staffTasksPage).toContain("authenticatedStaffUserId={authenticatedStaffUserId}");
    expect(staffTaskWorkspace).toContain("authenticatedStaffUserId?: Id");
    expect(staffTaskWorkspace).toContain("taskPersonalWorkSummary(state.tasks, currentStaffUserId)");
    expect(staffTaskWorkspace).toContain("toggleTaskPersonalWorkShortcut(");
    expect(staffTaskWorkspace).toContain('"open",');
    expect(staffTaskWorkspace).toContain("My open work");
    expect(staffTaskWorkspace).toContain("aria-pressed={");
    expect(globals).toContain(".task-queue-state-summary-item.task-my-open-work");
  });

  it("focuses current staff in-progress work with existing filters", () => {
    expect(staffTaskWorkspace).toContain("personalWorkSummary.activeCount");
    expect(staffTaskWorkspace).toContain("isMyActiveWorkSelected");
    expect(staffTaskWorkspace).toContain("toggleTaskPersonalWorkShortcut(");
    expect(staffTaskWorkspace).toContain('"active",');
    expect(staffTaskWorkspace).toContain("setTaskQueueStateFilter(nextFilters.queueState)");
    expect(staffTaskWorkspace).toContain("setTaskAssigneeFilter(nextFilters.assignee)");
    expect(staffTaskWorkspace).toContain("setTaskStatusFilter(nextFilters.status)");
    expect(staffTaskWorkspace).toContain("My active work");
    expect(globals).toContain(".task-queue-state-summary-item.task-my-active-work");
    expect(globals).toContain("repeat(auto-fit, minmax(170px, 1fr))");
  });

  it("focuses current staff ready work with existing filters", () => {
    expect(staffTaskWorkspace).toContain("personalWorkSummary.readyCount");
    expect(staffTaskWorkspace).toContain("isMyReadyWorkSelected");
    expect(staffTaskWorkspace).toContain('"ready",');
    expect(staffTaskWorkspace).toContain("My ready work");
    expect(globals).toContain(".task-queue-state-summary-item.task-my-ready-work");
    expect(globals).toContain("repeat(auto-fit, minmax(170px, 1fr))");
  });

  it("focuses current staff needs-human work with existing filters", () => {
    expect(staffTaskWorkspace).toContain("personalWorkSummary.needsHumanCount");
    expect(staffTaskWorkspace).toContain("isMyNeedsHumanSelected");
    expect(staffTaskWorkspace).toContain('"needs_human",');
    expect(staffTaskWorkspace).toContain("My needs help");
    expect(globals).toContain(".task-queue-state-summary-item.task-my-needs-human");
    expect(globals).toContain("repeat(auto-fit, minmax(170px, 1fr))");
  });

  it("claims unassigned work through the existing assignment path", () => {
    expect(staffTaskWorkspace).toContain("function claimSelectedTask()");
    expect(staffTaskWorkspace).toContain("!selectedTask.assigneeUserId && currentStaffUserId");
    expect(staffTaskWorkspace).toContain('name="assignmentIntent" type="hidden" value="claim"');
    expect(staffTaskWorkspace).toContain("STAFF_TASK_CLAIM_NOTE");
    expect(staffTaskWorkspace).toContain("Claim task");
    expect(staffTaskActions).toContain('const isClaim = assignmentIntent === "claim"');
    expect(staffTaskActions).toContain("assigneeUserId = actorUserId");
    expect(staffTaskActions).toContain("assignmentNote = STAFF_TASK_CLAIM_NOTE");
  });

  it("releases current staff work through the existing assignment path", () => {
    expect(staffTaskWorkspace).toContain("function releaseSelectedTask()");
    expect(staffTaskWorkspace).toContain("selectedTask.assigneeUserId !== currentStaffUserId");
    expect(staffTaskWorkspace).toContain('name="assignmentIntent" type="hidden" value="release"');
    expect(staffTaskWorkspace).toContain("STAFF_TASK_RELEASE_NOTE");
    expect(staffTaskWorkspace).toContain("Release task");
    expect(staffTaskActions).toContain('const isRelease = assignmentIntent === "release"');
    expect(staffTaskActions).toContain("assignmentNote = STAFF_TASK_RELEASE_NOTE");
  });

  it("starts eligible current staff work through the existing status path", () => {
    expect(staffTaskWorkspace).toContain("canStaffStartTask(selectedTask, currentStaffUserId)");
    expect(staffTaskWorkspace).toContain("function startSelectedTask()");
    expect(staffTaskWorkspace).toContain('name="statusIntent" type="hidden" value="start"');
    expect(staffTaskWorkspace).toContain('"in_progress"');
    expect(staffTaskWorkspace).toContain("Start work");
    expect(staffTaskActions).toContain('const isStart = statusIntent === "start"');
    expect(staffTaskActions).toContain('toStatus = "in_progress"');
  });

  it("marks current staff active work needs human through the existing status path", () => {
    expect(staffTaskWorkspace).toContain("canStaffMarkTaskNeedsHuman(selectedTask, currentStaffUserId)");
    expect(staffTaskWorkspace).toContain("function markSelectedTaskNeedsHuman()");
    expect(staffTaskWorkspace).toContain('name="statusIntent" type="hidden" value="needs_human"');
    expect(staffTaskWorkspace).toContain("Mark needs human");
    expect(staffTaskActions).toContain('const isNeedsHuman = statusIntent === "needs_human"');
    expect(staffTaskWorkspace).toContain("canStaffReopenTask(selectedTask)");
    expect(staffTaskWorkspace).toContain('name="statusIntent" type="hidden" value="reopen"');
    expect(staffTaskActions).toContain('const isReopen = statusIntent === "reopen"');
    expect(staffTaskWorkspace).toContain("Reopen task");
    expect(staffTaskWorkspace).toContain("canStaffMarkTaskDone(selectedTask, currentStaffUserId)");
    expect(staffTaskWorkspace).toContain('name="statusIntent" type="hidden" value="done"');
    expect(staffTaskActions).toContain('const isDone = statusIntent === "done"');
    expect(staffTaskWorkspace).toContain("Mark done");
    expect(staffTaskWorkspace).toContain("canStaffMarkTaskIgnored(selectedTask, currentStaffUserId)");
    expect(staffTaskWorkspace).toContain('name="statusIntent" type="hidden" value="ignored"');
    expect(staffTaskActions).toContain('const isIgnored = statusIntent === "ignored"');
    expect(staffTaskWorkspace).toContain("Mark ignored");
    expect(staffTaskWorkspace).toContain('<span>Request channel</span>');
    expect(staffTaskWorkspace).toContain('<option value="phone">Phone</option>');
    expect(staffTaskWorkspace).toContain('<option value="email">Email</option>');
    expect(staffTaskActions).toContain('formData.get("channel") ?? "manual"');
    expect(staffTaskWorkspace).toContain("createDraftManualTask(");
    expect(staffTaskWorkspace).toContain("No hosted data or provider event was written.");
    expect(staffTaskWorkspace).toContain('persistenceMode === "local" ? "Browser local"');
    expect(staffTaskWorkspace).toContain("manualTaskIntakeDraftIsDirty(");
    expect(staffTaskWorkspace).toContain("setManualIntakeDraft(createManualTaskIntakeDraft(");
    expect(staffTaskWorkspace).not.toContain("JSON.stringify(manualIntakeDraft)");
    expect(staffTaskWorkspace).toContain('name="claimForActor"');
    expect(staffTaskWorkspace).toContain("<span>Assign to me</span>");
    expect(staffTaskActions).toContain('formData.get("claimForActor") === "on"');
    expect(staffTaskWorkspace).toContain("taskSubmittedWorkSummary(");
    expect(staffTaskWorkspace).toContain("taskSubmittedByMeFilter");
    expect(staffTaskWorkspace).toContain("My submitted work");
    expect(staffTaskWorkspace).toContain("manualTaskIntakeDuplicateCandidates(");
    expect(staffTaskWorkspace).toContain("Possible existing work");
    expect(staffTaskWorkspace).toContain("Review {task.requesterName}");
    expect(staffTaskActions).toContain('toStatus = "needs_human"');
    expect(staffTaskActions).not.toContain("notifyOwner");
  });

  it("lets staff filter the task queue by workflow stage", () => {
    expect(staffTaskWorkspace).toContain("type TaskWorkflowStageFilter");
    expect(staffTaskWorkspace).toContain("taskWorkflowStageForTask(task)");
    expect(staffTaskWorkspace).toContain("taskWorkflowStageSummaries(state.tasks)");
    expect(staffTaskWorkspace).toContain("taskWorkflowStageFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("setTaskWorkflowStageFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task workflow-stage counts\"");
    expect(staffTaskWorkspace).toContain(
      "taskWorkflowStageFilter === summary.stage ? \"all\" : summary.stage"
    );
    expect(globals).toContain(".task-workflow-stage-summary");
    expect(globals).toContain(".task-workflow-stage-summary-count");
    expect(globals).toContain(
      ".task-workflow-stage-summary-item.task-workflow-stage-unassigned_intake"
    );
    expect(globals).toContain(
      ".task-workflow-stage-summary-item.task-workflow-stage-completed"
    );
  });

  it("lets staff filter the task queue by activity trail", () => {
    expect(staffTaskWorkspace).toContain(
      "type TaskActivityTrailFilter = \"all\" | \"staff_activity\" | \"source_only\" | \"no_trail\""
    );
    expect(staffTaskWorkspace).toContain("taskActivityTrailKindForTask(task, state.taskEvents)");
    expect(staffTaskWorkspace).toContain("taskActivityTrailSummaries(state.tasks, state.taskEvents)");
    expect(staffTaskWorkspace).toContain("taskActivityTrailFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("setTaskActivityTrailFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task activity trail counts\"");
    expect(staffTaskWorkspace).toContain(
      "taskActivityTrailFilter === summary.trailKind ? \"all\" : summary.trailKind"
    );
    expect(globals).toContain(".task-activity-trail-summary");
    expect(globals).toContain(".task-activity-trail-summary-count");
    expect(globals).toContain(".task-activity-trail-summary-item.task-activity-trail-no_trail");
  });

  it("lets staff filter the task queue by age", () => {
    expect(staffTaskWorkspace).toContain("type TaskAgeFilter = \"all\" | \"fresh\" | \"waiting\" | \"stale\"");
    expect(staffTaskWorkspace).toContain("taskAgeBucketForTask(task, taskAgeReferenceTime)");
    expect(staffTaskWorkspace).toContain("taskAgeSummaries(state.tasks, taskAgeReferenceTime)");
    expect(staffTaskWorkspace).toContain("taskAgeFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("setTaskAgeFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task age counts\"");
    expect(staffTaskWorkspace).toContain("taskAgeFilter === summary.ageBucket ? \"all\" : summary.ageBucket");
    expect(globals).toContain(".task-age-summary");
    expect(globals).toContain(".task-age-summary-count");
  });

  it("lets staff filter the task queue by last touch", () => {
    expect(staffTaskWorkspace).toContain(
      "type TaskLastTouchFilter = \"all\" | \"fresh_touch\" | \"quiet\" | \"stalled\""
    );
    expect(staffTaskWorkspace).toContain("taskLastTouchBucketForTask(task, taskAgeReferenceTime)");
    expect(staffTaskWorkspace).toContain("taskLastTouchSummaries(state.tasks, taskAgeReferenceTime)");
    expect(staffTaskWorkspace).toContain("taskLastTouchFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("setTaskLastTouchFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task last-touch counts\"");
    expect(staffTaskWorkspace).toContain(
      "taskLastTouchFilter === summary.lastTouchBucket ? \"all\" : summary.lastTouchBucket"
    );
    expect(globals).toContain(".task-last-touch-summary");
    expect(globals).toContain(".task-last-touch-summary-count");
    expect(globals).toContain(".task-last-touch-summary-item.task-last-touch-stalled");
  });

  it("lets staff filter the task queue by attention level", () => {
    expect(staffTaskWorkspace).toContain("type TaskAttentionFilter = \"all\" | \"attention\" | \"watch\" | \"clear\"");
    expect(staffTaskWorkspace).toContain("taskAttentionProfileForTask(task, taskAgeReferenceTime)");
    expect(staffTaskWorkspace).toContain("taskAttentionSummaries(state.tasks, taskAgeReferenceTime)");
    expect(staffTaskWorkspace).toContain("taskAttentionFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("setTaskAttentionFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task attention counts\"");
    expect(staffTaskWorkspace).toContain("taskAttentionFilter === summary.level ? \"all\" : summary.level");
    expect(globals).toContain(".task-attention-summary");
    expect(globals).toContain(".task-attention-summary-count");
    expect(globals).toContain(".task-attention-summary-item.task-attention-attention");
  });

  it("lets staff filter the task queue by confidence", () => {
    expect(staffTaskWorkspace).toContain("type TaskConfidenceFilter = \"all\" | \"low\" | \"medium\" | \"high\"");
    expect(staffTaskWorkspace).toContain("taskConfidenceBucketForTask(task)");
    expect(staffTaskWorkspace).toContain("taskConfidenceSummaries(state.tasks)");
    expect(staffTaskWorkspace).toContain("taskConfidenceFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("setTaskConfidenceFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task confidence counts\"");
    expect(staffTaskWorkspace).toContain("taskConfidenceFilter === summary.confidenceBucket ? \"all\" : summary.confidenceBucket");
    expect(globals).toContain(".task-confidence-summary");
    expect(globals).toContain(".task-confidence-summary-count");
  });

  it("lets staff filter the task queue by intent", () => {
    expect(staffTaskWorkspace).toContain("type TaskIntentFilter");
    expect(staffTaskWorkspace).toContain("taskIntentKeyForTask(task)");
    expect(staffTaskWorkspace).toContain("taskIntentSummaries(state.tasks)");
    expect(staffTaskWorkspace).toContain("taskIntentFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("selectedIntentSummary?.intentKeys.includes(taskIntentKeyForTask(task))");
    expect(staffTaskWorkspace).toContain("summary.intentKeys.includes(taskIntentFilter)");
    expect(staffTaskWorkspace).toContain("setTaskIntentFilter(containingSummary?.intentKey ?? \"all\")");
    expect(staffTaskWorkspace).toContain("setTaskIntentFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task intent counts\"");
    expect(staffTaskWorkspace).toContain("taskIntentFilter === summary.intentKey ? \"all\" : summary.intentKey");
    expect(staffTaskWorkspace).toContain("title={summary.fullLabel}");
    expect(globals).toContain(".task-intent-summary");
    expect(globals).toContain(".task-intent-summary-count");
    expect(globals).toContain(".task-intent-summary-item > span:first-child");
  });

  it("lets staff filter the task queue by next step", () => {
    expect(staffTaskWorkspace).toContain("type TaskNextStepFilter");
    expect(staffTaskWorkspace).toContain("taskNextStepKeyForTask(task)");
    expect(staffTaskWorkspace).toContain("taskNextStepSummaries(state.tasks)");
    expect(staffTaskWorkspace).toContain("taskNextStepFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain(
      "selectedNextStepSummary?.nextStepKeys.includes(taskNextStepKeyForTask(task))"
    );
    expect(staffTaskWorkspace).toContain("summary.nextStepKeys.includes(taskNextStepFilter)");
    expect(staffTaskWorkspace).toContain(
      "setTaskNextStepFilter(containingSummary?.nextStepKey ?? \"all\")"
    );
    expect(staffTaskWorkspace).toContain("setTaskNextStepFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task next-step counts\"");
    expect(staffTaskWorkspace).toContain(
      "taskNextStepFilter === summary.nextStepKey ? \"all\" : summary.nextStepKey"
    );
    expect(staffTaskWorkspace).toContain("title={summary.fullLabel}");
    expect(globals).toContain(".task-next-step-summary");
    expect(globals).toContain(".task-next-step-summary-count");
    expect(globals).toContain(".task-next-step-summary-item > span:first-child");
  });

  it("lets staff filter the task queue by proof completion", () => {
    expect(staffTaskWorkspace).toContain(
      "type TaskProofCompletionFilter = \"all\" | \"pending\" | \"complete\""
    );
    expect(staffTaskWorkspace).toContain("taskProofCompletionStateForTask(task, state.taskEvents)");
    expect(staffTaskWorkspace).toContain(
      "taskProofCompletionSummaries(state.tasks, state.taskEvents)"
    );
    expect(staffTaskWorkspace).toContain("taskProofCompletionFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("setTaskProofCompletionFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task proof completion counts\"");
    expect(staffTaskWorkspace).toContain(
      "taskProofCompletionFilter === summary.state ? \"all\" : summary.state"
    );
    expect(globals).toContain(".task-proof-completion-summary");
    expect(globals).toContain(".task-proof-completion-summary-count");
    expect(globals).toContain(
      ".task-proof-completion-summary-item.task-proof-completion-pending"
    );
    expect(globals).toContain(
      ".task-proof-completion-summary-item.task-proof-completion-complete"
    );
  });

  it("lets staff filter the task queue by requester contact kind", () => {
    expect(staffTaskWorkspace).toContain(
      "type TaskRequesterContactFilter = \"all\" | \"email\" | \"phone\" | \"other\""
    );
    expect(staffTaskWorkspace).toContain("taskRequesterContactKindForTask(task)");
    expect(staffTaskWorkspace).toContain("taskRequesterContactSummaries(state.tasks)");
    expect(staffTaskWorkspace).toContain("taskRequesterContactFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("setTaskRequesterContactFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task requester contact counts\"");
    expect(staffTaskWorkspace).toContain(
      "taskRequesterContactFilter === summary.contactKind ? \"all\" : summary.contactKind"
    );
    expect(globals).toContain(".task-requester-contact-summary");
    expect(globals).toContain(".task-requester-contact-summary-count");
    expect(globals).toContain(
      ".task-requester-contact-summary-item.task-requester-contact-email"
    );
  });

  it("lets staff filter the task queue by follow-up mode", () => {
    expect(staffTaskWorkspace).toContain("type TaskFollowUpModeFilter");
    expect(staffTaskWorkspace).toContain("taskFollowUpModeForTask(task)");
    expect(staffTaskWorkspace).toContain("taskFollowUpModeSummaries(state.tasks)");
    expect(staffTaskWorkspace).toContain("taskFollowUpModeFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("setTaskFollowUpModeFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task follow-up mode counts\"");
    expect(staffTaskWorkspace).toContain(
      "taskFollowUpModeFilter === summary.mode ? \"all\" : summary.mode"
    );
    expect(globals).toContain(".task-follow-up-mode-summary");
    expect(globals).toContain(".task-follow-up-mode-summary-count");
    expect(globals).toContain(
      ".task-follow-up-mode-summary-item.task-follow-up-mode-phone_follow_up"
    );
    expect(globals).toContain(
      ".task-follow-up-mode-summary-item.task-follow-up-mode-contact_check"
    );
  });

  it("lets staff filter the task queue by member-system boundary", () => {
    expect(staffTaskWorkspace).toContain("type TaskMemberSystemBoundaryFilter");
    expect(staffTaskWorkspace).toContain("taskMemberSystemBoundaryForTask(task)");
    expect(staffTaskWorkspace).toContain("taskMemberSystemBoundarySummaries(state.tasks)");
    expect(staffTaskWorkspace).toContain("taskMemberSystemBoundaryFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("setTaskMemberSystemBoundaryFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task member-system boundary counts\"");
    expect(staffTaskWorkspace).toContain("taskMemberSystemBoundaryFilter === summary.boundary");
    expect(staffTaskWorkspace).toContain(": summary.boundary");
    expect(globals).toContain(".task-member-system-boundary-summary");
    expect(globals).toContain(".task-member-system-boundary-summary-count");
    expect(globals).toContain(
      ".task-member-system-boundary-summary-item.task-member-system-boundary-member_system_blocked"
    );
    expect(globals).toContain(
      ".task-member-system-boundary-summary-item.task-member-system-boundary-closed_no_member_write"
    );
  });

  it("lets staff filter the task queue by owner-policy dependency", () => {
    expect(staffTaskWorkspace).toContain("type TaskOwnerPolicyDependencyFilter");
    expect(staffTaskWorkspace).toContain("taskOwnerPolicyDependencyForTask(task)");
    expect(staffTaskWorkspace).toContain("taskOwnerPolicyDependencySummaries(state.tasks)");
    expect(staffTaskWorkspace).toContain("taskOwnerPolicyDependencyFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("setTaskOwnerPolicyDependencyFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task owner-policy dependency counts\"");
    expect(staffTaskWorkspace).toContain("taskOwnerPolicyDependencyFilter === summary.dependency");
    expect(staffTaskWorkspace).toContain(": summary.dependency");
    expect(globals).toContain(".task-owner-policy-dependency-summary");
    expect(globals).toContain(".task-owner-policy-dependency-summary-count");
    expect(globals).toContain(
      ".task-owner-policy-dependency-summary-item.task-owner-policy-dependency-owner_policy_needed"
    );
    expect(globals).toContain(
      ".task-owner-policy-dependency-summary-item.task-owner-policy-dependency-closed_policy_done"
    );
  });

  it("lets staff filter the task queue by synthesized action lane", () => {
    expect(staffTaskWorkspace).toContain("type TaskStaffActionLaneFilter");
    expect(staffTaskWorkspace).toContain("taskStaffActionLaneForTask(task)");
    expect(staffTaskWorkspace).toContain("taskStaffActionLaneSummaries(state.tasks)");
    expect(staffTaskWorkspace).toContain("taskStaffActionLaneFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("setTaskStaffActionLaneFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task staff action-lane counts\"");
    expect(staffTaskWorkspace).toContain("taskStaffActionLaneFilter === summary.lane");
    expect(staffTaskWorkspace).toContain(": summary.lane");
    expect(globals).toContain(".task-staff-action-lane-summary");
    expect(globals).toContain(".task-staff-action-lane-summary-count");
    expect(globals).toContain(
      ".task-staff-action-lane-summary-item.task-staff-action-lane-member_system_hold"
    );
    expect(globals).toContain(
      ".task-staff-action-lane-summary-item.task-staff-action-lane-staff_reply_ready"
    );
  });

  it("lets staff filter the task queue by channel", () => {
    expect(staffTaskWorkspace).toContain("type TaskChannelFilter = TaskChannel | \"all\"");
    expect(staffTaskWorkspace).toContain("const taskChannelFilters");
    expect(staffTaskWorkspace).toContain("taskChannelSummaries(state.tasks)");
    expect(staffTaskWorkspace).toContain("taskChannelFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("task.channel !== taskChannelFilter");
    expect(staffTaskWorkspace).toContain("setTaskChannelFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("<span>Channel</span>");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task channel counts\"");
    expect(staffTaskWorkspace).toContain("taskChannelFilter === summary.channel ? \"all\" : summary.channel");
    expect(globals).toContain(".task-channel-summary");
    expect(globals).toContain(".task-channel-summary-count");
  });

  it("lets staff filter the task queue by location", () => {
    expect(staffTaskWorkspace).toContain("type TaskLocationFilter = Id | \"all\"");
    expect(staffTaskWorkspace).toContain("taskLocationSummaries(state.tasks, locations)");
    expect(staffTaskWorkspace).toContain("taskLocationFilter !== \"all\"");
    expect(staffTaskWorkspace).toContain("task.locationId !== taskLocationFilter");
    expect(staffTaskWorkspace).toContain("setTaskLocationFilter(\"all\")");
    expect(staffTaskWorkspace).toContain("<span>Location</span>");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task location counts\"");
    expect(staffTaskWorkspace).toContain("taskLocationFilter === summary.locationId ? \"all\" : summary.locationId");
    expect(globals).toContain(".task-location-summary");
    expect(globals).toContain(".task-location-summary-count");
  });

  it("lets staff filter the task queue by assignee chips", () => {
    expect(staffTaskWorkspace).toContain("taskAssigneeSummaries(state.tasks, users)");
    expect(staffTaskWorkspace).toContain("aria-label=\"Task assignee counts\"");
    expect(staffTaskWorkspace).toContain("taskAssigneeFilter === summary.value ? \"all\" : summary.value");
    expect(staffTaskWorkspace).toContain("setTaskAssigneeFilter(");
    expect(staffTaskWorkspace).toContain("summary.unresolvedCount");
    expect(staffTaskWorkspace).toContain("open · {summary.count} total");
    expect(globals).toContain(".task-assignee-summary");
    expect(globals).toContain(".task-assignee-summary-count");
  });

  it("groups mobile staff controls as explicit task actions", () => {
    expect(staffTaskWorkspace).toContain("task-command-section");
    expect(staffTaskWorkspace).toContain("Move the selected task forward");
    expect(staffTaskWorkspace).toContain("Available next:");
    expect(staffTaskWorkspace).toContain("Leave context for the next staff member");
  });

  it("keeps the core workboard controls responsive without horizontal scroll", () => {
    expect(globals).toContain(".task-card-proof");
    expect(globals).toContain(".task-action-form");
    expect(globals).toContain(".task-command-heading");
    expect(globals).toContain(".task-note-form .button");
    expect(globals).toContain(".task-detail-panel");
    expect(globals).toContain("grid-template-columns: minmax(220px, 1fr) auto");
    expect(globals).toMatch(/\.task-filter-bar\s*\{[\s\S]*?grid-column: 1 \/ -1;/u);
    expect(globals).toMatch(/\.task-filter-results\s*\{[\s\S]*?justify-self: end;/u);
    expect(globals).toMatch(
      /@media \(max-width: 1320px\)[\s\S]*?\.task-filter-results\s*\{[\s\S]*?justify-self: start;/u
    );
  });
});
