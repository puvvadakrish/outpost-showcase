import { describe, expect, it } from "vitest";
import { taskActionTargetsSelection } from "@/domain/task-action-feedback";

describe("staff task action feedback", () => {
  it("matches feedback only to the exact selected task", () => {
    expect(taskActionTargetsSelection("task_one", "task_one")).toBe(true);
    expect(taskActionTargetsSelection("task_one", "task_two")).toBe(false);
    expect(taskActionTargetsSelection(undefined, "task_one")).toBe(false);
    expect(taskActionTargetsSelection("task_one", undefined)).toBe(false);
  });
});
