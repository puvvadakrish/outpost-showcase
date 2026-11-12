import type { Task, TaskEvent } from "@/domain/tasks";
import type { User } from "@/domain/tenancy";
import type { Id, TaskStatus } from "@/domain/models";
import { displayLabel } from "@/domain/formatting";
import { normalizeTaskConfidence, sortTasksForInbox, taskProofSummary } from "@/domain/tasks";
import { TaskStatusPill } from "./TaskStatusPill";

const inboxStatusOrder: TaskStatus[] = [
  "needs_human",
  "new",
  "in_progress",
  "done",
  "ignored"
];

interface TaskTableProps {
  draftTaskIds?: Id[];
  emptyDetail?: string;
  emptyTitle?: string;
  tasks: Task[];
  taskEvents?: TaskEvent[];
  users: User[];
  selectedTaskId?: string;
  selectedTaskAnchorId?: string;
  onSelectTask?: (taskId: string) => void;
}

export function TaskTable({
  draftTaskIds = [],
  emptyDetail = "Clear filters or create a manual task to add work here.",
  emptyTitle = "No tasks match this view",
  tasks,
  users,
  selectedTaskId,
  selectedTaskAnchorId,
  taskEvents = [],
  onSelectTask
}: TaskTableProps) {
  const inboxTasks = sortTasksForInbox(tasks);
  const userNames = new Map(users.map((user) => [user.id, user.name]));
  const draftTaskIdSet = new Set(draftTaskIds);

  return (
    <div className="panel table-wrap workboard" id="workboard">
      <div className="panel-header">
        <div>
          <h2>Front-desk workboard</h2>
          <p>Every row shows what Outpost captured and what staff should do next.</p>
        </div>
        <span className="channel-pill">{inboxTasks.length} tasks</span>
      </div>
      <div className="workboard-tabs" aria-label="Task status counts">
        {inboxStatusOrder.map((status) => (
          <span className={`workboard-tab${status === "needs_human" ? " active" : ""}`} key={status}>
            {displayLabel(status)}
            <span className="workboard-tab-count">
              {inboxTasks.filter((task) => task.status === status).length}
            </span>
          </span>
        ))}
      </div>
      <div className="task-list">
        {inboxTasks.length > 0 ? (
          inboxTasks.map((task) => {
            const normalizedConfidence = normalizeTaskConfidence(task.confidence);
            const confidencePercentage = Math.round(normalizedConfidence * 100);
            const proof = taskProofSummary(task, taskEvents);

            return (
              <button
                aria-pressed={task.id === selectedTaskId}
                className={`task-card status-row-${task.status}${task.id === selectedTaskId ? " selected" : ""}`}
                id={task.id === selectedTaskId ? selectedTaskAnchorId : undefined}
                key={task.id}
                onClick={() => onSelectTask?.(task.id)}
                type="button"
              >
                <div className="task-card-top">
                  <span className="task-card-state">
                    <TaskStatusPill status={task.status} />
                    <span className="task-channel-text">{displayLabel(task.channel)}</span>
                    {draftTaskIdSet.has(task.id) ? (
                      <span className="task-draft-pill">Draft</span>
                    ) : null}
                  </span>
                  <span className="task-assignee">
                    {task.assigneeUserId ? userNames.get(task.assigneeUserId) : "Unassigned"}
                  </span>
                </div>
                <span className={`task-proof-pill task-card-proof task-proof-${proof.origin}`}>
                  {proof.label}
                </span>
                <span className="task-requester">
                  <strong>{task.requesterName}</strong>
                  <span className="muted">{task.requesterContact}</span>
                </span>
                <div className="task-card-main">
                  <div>
                    <span className="rail-title">Intent</span>
                    <strong>{task.intent}</strong>
                  </div>
                  <div className="task-summary">
                    <span className="rail-title">Summary</span>
                    <p>{task.summary}</p>
                  </div>
                  <div className="task-summary task-next-step">
                    <span className="rail-title">Suggested next step</span>
                    <p>{task.suggestedNextStep}</p>
                  </div>
                  <span className="confidence">
                    <span className="mono">{confidencePercentage}%</span>
                    <span aria-hidden="true" className="confidence-track">
                      <span
                        className={`confidence-fill${normalizedConfidence < 0.7 ? " low" : ""}`}
                        style={{ width: `${confidencePercentage}%` }}
                      />
                    </span>
                  </span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="operational-empty-state task-empty-state">
            <strong>{emptyTitle}</strong>
            <p>{emptyDetail}</p>
          </div>
        )}
      </div>
    </div>
  );
}
