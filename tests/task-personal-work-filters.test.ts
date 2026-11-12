import { describe, expect, it } from "vitest";
import {
  isTaskPersonalWorkShortcutSelected,
  toggleTaskPersonalWorkShortcut,
  type TaskPersonalWorkFilterState
} from "@/domain/task-personal-work-filters";

describe("task personal-work filter transitions", () => {
  const allFilters: TaskPersonalWorkFilterState = {
    assignee: "all",
    queueState: "all",
    status: "all"
  };

  it("activates and clears My active work", () => {
    const active = toggleTaskPersonalWorkShortcut(allFilters, "active", "user_staff_acme");

    expect(active).toEqual({
      assignee: "user_staff_acme",
      queueState: "all",
      status: "in_progress"
    });
    expect(isTaskPersonalWorkShortcutSelected(active, "active", "user_staff_acme")).toBe(true);
    expect(toggleTaskPersonalWorkShortcut(active, "active", "user_staff_acme")).toEqual(allFilters);
  });

  it("activates and clears My ready work", () => {
    const ready = toggleTaskPersonalWorkShortcut(allFilters, "ready", "user_staff_acme");

    expect(ready).toEqual({
      assignee: "user_staff_acme",
      queueState: "all",
      status: "new"
    });
    expect(isTaskPersonalWorkShortcutSelected(ready, "ready", "user_staff_acme")).toBe(true);
    expect(toggleTaskPersonalWorkShortcut(ready, "ready", "user_staff_acme")).toEqual(allFilters);
  });

  it("activates and clears My completed work", () => {
    const completed = toggleTaskPersonalWorkShortcut(allFilters, "completed", "user_staff_acme");

    expect(completed).toEqual({
      assignee: "user_staff_acme",
      queueState: "all",
      status: "done"
    });
    expect(isTaskPersonalWorkShortcutSelected(completed, "completed", "user_staff_acme")).toBe(true);
    expect(toggleTaskPersonalWorkShortcut(completed, "completed", "user_staff_acme")).toEqual(allFilters);
  });

  it("activates and clears My ignored work", () => {
    const ignored = toggleTaskPersonalWorkShortcut(allFilters, "ignored", "user_staff_acme");

    expect(ignored).toEqual({
      assignee: "user_staff_acme",
      queueState: "all",
      status: "ignored"
    });
    expect(isTaskPersonalWorkShortcutSelected(ignored, "ignored", "user_staff_acme")).toBe(true);
    expect(toggleTaskPersonalWorkShortcut(ignored, "ignored", "user_staff_acme")).toEqual(allFilters);
  });

  it("activates and clears the personal needs-human shortcut", () => {
    const needsHuman = toggleTaskPersonalWorkShortcut(
      allFilters,
      "needs_human",
      "user_staff_acme"
    );

    expect(needsHuman).toEqual({
      assignee: "user_staff_acme",
      queueState: "all",
      status: "needs_human"
    });
    expect(
      isTaskPersonalWorkShortcutSelected(needsHuman, "needs_human", "user_staff_acme")
    ).toBe(true);
    expect(
      toggleTaskPersonalWorkShortcut(needsHuman, "needs_human", "user_staff_acme")
    ).toEqual(allFilters);
  });

  it("switches directly between status-specific personal shortcuts", () => {
    const ready = toggleTaskPersonalWorkShortcut(allFilters, "ready", "user_staff_acme");
    const active = toggleTaskPersonalWorkShortcut(ready, "active", "user_staff_acme");
    const needsHuman = toggleTaskPersonalWorkShortcut(
      active,
      "needs_human",
      "user_staff_acme"
    );
    const completed = toggleTaskPersonalWorkShortcut(
      needsHuman,
      "completed",
      "user_staff_acme"
    );
    const ignored = toggleTaskPersonalWorkShortcut(
      completed,
      "ignored",
      "user_staff_acme"
    );

    expect(ignored).toEqual({
      assignee: "user_staff_acme",
      queueState: "all",
      status: "ignored"
    });
    expect(toggleTaskPersonalWorkShortcut(ignored, "completed", "user_staff_acme")).toEqual({
      assignee: "user_staff_acme",
      queueState: "all",
      status: "done"
    });
  });

  it("clears the ready-owned status when switching directly to My open work", () => {
    const ready = toggleTaskPersonalWorkShortcut(allFilters, "ready", "user_staff_acme");

    expect(toggleTaskPersonalWorkShortcut(ready, "open", "user_staff_acme")).toEqual({
      assignee: "user_staff_acme",
      queueState: "open",
      status: "all"
    });
  });

  it("clears the active-owned status when switching directly to My open work", () => {
    const active = toggleTaskPersonalWorkShortcut(allFilters, "active", "user_staff_acme");

    expect(toggleTaskPersonalWorkShortcut(active, "open", "user_staff_acme")).toEqual({
      assignee: "user_staff_acme",
      queueState: "open",
      status: "all"
    });
  });

  it("clears the needs-human-owned status when switching directly to My open work", () => {
    const needsHuman = toggleTaskPersonalWorkShortcut(
      allFilters,
      "needs_human",
      "user_staff_acme"
    );

    expect(toggleTaskPersonalWorkShortcut(needsHuman, "open", "user_staff_acme")).toEqual({
      assignee: "user_staff_acme",
      queueState: "open",
      status: "all"
    });
  });

  it("clears the completed-owned status when switching directly to My open work", () => {
    const completed = toggleTaskPersonalWorkShortcut(allFilters, "completed", "user_staff_acme");

    expect(toggleTaskPersonalWorkShortcut(completed, "open", "user_staff_acme")).toEqual({
      assignee: "user_staff_acme",
      queueState: "open",
      status: "all"
    });
  });

  it("clears the ignored-owned status when switching directly to My open work", () => {
    const ignored = toggleTaskPersonalWorkShortcut(allFilters, "ignored", "user_staff_acme");

    expect(toggleTaskPersonalWorkShortcut(ignored, "open", "user_staff_acme")).toEqual({
      assignee: "user_staff_acme",
      queueState: "open",
      status: "all"
    });
  });

  it("preserves an unrelated manual status filter when opening personal work", () => {
    expect(
      toggleTaskPersonalWorkShortcut(
        { assignee: "all", queueState: "all", status: "new" },
        "open",
        "user_staff_acme"
      )
    ).toEqual({
      assignee: "user_staff_acme",
      queueState: "open",
      status: "new"
    });
  });
});
