import type { Id } from "./models";
import type { Task } from "./tasks";

export type TaskNoteDrafts = Record<Id, string>;

export function taskNoteDraftCountLabel(value: string, maxLength = 1200): string {
  return value.length > 0 ? `Draft · ${value.length}/${maxLength}` : `0/${maxLength}`;
}

export function taskNoteDraftTaskIds(drafts: TaskNoteDrafts, tasks: Task[]): Id[] {
  return tasks.filter((task) => (drafts[task.id]?.length ?? 0) > 0).map((task) => task.id);
}

export function setTaskNoteDraft(
  drafts: TaskNoteDrafts,
  taskId: Id,
  value: string
): TaskNoteDrafts {
  if (drafts[taskId] === value) {
    return drafts;
  }

  return { ...drafts, [taskId]: value };
}

export function clearTaskNoteDraft(drafts: TaskNoteDrafts, taskId: Id): TaskNoteDrafts {
  if (!(taskId in drafts)) {
    return drafts;
  }

  const nextDrafts = { ...drafts };
  delete nextDrafts[taskId];
  return nextDrafts;
}
