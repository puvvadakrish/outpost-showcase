import type { Id, TaskStatus } from "./models";

export type TaskPersonalWorkShortcut = "active" | "completed" | "ignored" | "needs_human" | "open" | "ready";

const statusByPersonalWorkShortcut = {
  active: "in_progress",
  completed: "done",
  ignored: "ignored",
  needs_human: "needs_human",
  ready: "new"
} as const satisfies Record<Exclude<TaskPersonalWorkShortcut, "open">, TaskStatus>;

const statusSpecificPersonalWorkShortcuts = ["ready", "active", "needs_human", "completed", "ignored"] as const;

export interface TaskPersonalWorkFilterState {
  assignee: Id | "all" | "unassigned";
  queueState: "all" | "open" | "terminal";
  status: TaskStatus | "all";
}

export function isTaskPersonalWorkShortcutSelected(
  filters: TaskPersonalWorkFilterState,
  shortcut: TaskPersonalWorkShortcut,
  staffUserId: Id
): boolean {
  if (shortcut !== "open") {
    return (
      filters.queueState === "all" &&
      filters.assignee === staffUserId &&
      filters.status === statusByPersonalWorkShortcut[shortcut]
    );
  }

  return filters.queueState === "open" && filters.assignee === staffUserId;
}

export function toggleTaskPersonalWorkShortcut(
  filters: TaskPersonalWorkFilterState,
  shortcut: TaskPersonalWorkShortcut,
  staffUserId: Id
): TaskPersonalWorkFilterState {
  const isSelected = isTaskPersonalWorkShortcutSelected(filters, shortcut, staffUserId);

  if (shortcut !== "open") {
    return isSelected
      ? { assignee: "all", queueState: "all", status: "all" }
      : {
          assignee: staffUserId,
          queueState: "all",
          status: statusByPersonalWorkShortcut[shortcut]
        };
  }

  if (isSelected) {
    return { ...filters, assignee: "all", queueState: "all" };
  }

  const switchingFromStatusShortcut = statusSpecificPersonalWorkShortcuts.some(
    (candidate) => isTaskPersonalWorkShortcutSelected(filters, candidate, staffUserId)
  );

  return {
    assignee: staffUserId,
    queueState: "open",
    status: switchingFromStatusShortcut ? "all" : filters.status
  };
}
