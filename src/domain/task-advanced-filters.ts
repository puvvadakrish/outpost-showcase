export function activeTaskAdvancedFilterCount(values: readonly string[]): number {
  return values.filter((value) => value !== "all").length;
}
