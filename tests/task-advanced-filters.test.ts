import { describe, expect, it } from "vitest";
import { activeTaskAdvancedFilterCount } from "@/domain/task-advanced-filters";

describe("task advanced filter state", () => {
  it("counts only non-default advanced filter values", () => {
    expect(activeTaskAdvancedFilterCount([])).toBe(0);
    expect(activeTaskAdvancedFilterCount(["all", "all"])).toBe(0);
    expect(activeTaskAdvancedFilterCount(["all", "attention", "all"])).toBe(1);
    expect(
      activeTaskAdvancedFilterCount(["attention", "stale", "membership freeze"])
    ).toBe(3);
  });
});
