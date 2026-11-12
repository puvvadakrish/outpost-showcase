import type { Id } from "./models";

export function taskActionTargetsSelection(
  actionTaskId: Id | undefined,
  selectedTaskId: Id | undefined
): boolean {
  return Boolean(actionTaskId && selectedTaskId && actionTaskId === selectedTaskId);
}
