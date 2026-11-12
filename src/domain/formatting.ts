export function displayLabel(value: string): string {
  const normalized = value.replaceAll("_", " ").trim();

  if (!normalized) {
    return normalized;
  }

  return `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
}
