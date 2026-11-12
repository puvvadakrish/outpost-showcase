import { describe, expect, it } from "vitest";
import {
  clearTaskNoteDraft,
  setTaskNoteDraft,
  taskNoteDraftCountLabel,
  taskNoteDraftTaskIds
} from "@/domain/task-note-drafts";

describe("staff task note drafts", () => {
  it("projects non-empty draft IDs only from tenant-loaded tasks", () => {
    const tasks = [
      { id: "task_one" },
      { id: "task_two" }
    ] as Parameters<typeof taskNoteDraftTaskIds>[1];

    expect(
      taskNoteDraftTaskIds(
        { task_one: "Draft", task_two: "", task_unknown: "Hidden" },
        tasks
      )
    ).toEqual(["task_one"]);
  });

  it("labels only non-empty selected text as an unsaved draft", () => {
    expect(taskNoteDraftCountLabel("")).toBe("0/1200");
    expect(taskNoteDraftCountLabel("Call back", 20)).toBe("Draft · 9/20");
  });

  it("sets drafts immutably without replacing other task text", () => {
    const original = { task_one: "First note" };
    const updated = setTaskNoteDraft(original, "task_two", "Second note");

    expect(updated).toEqual({ task_one: "First note", task_two: "Second note" });
    expect(original).toEqual({ task_one: "First note" });
    expect(setTaskNoteDraft(updated, "task_two", "Second note")).toBe(updated);
  });

  it("clears only the requested task draft", () => {
    const drafts = { task_one: "First note", task_two: "Second note" };

    expect(clearTaskNoteDraft(drafts, "task_one")).toEqual({ task_two: "Second note" });
    expect(clearTaskNoteDraft(drafts, "task_missing")).toBe(drafts);
  });
});
