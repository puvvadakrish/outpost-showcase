import { taskChannels, unresolvedTaskStatuses, type TaskChannel } from "./models";
import type { Task } from "./tasks";

export interface ManualTaskIntakeInput {
  channel: TaskChannel;
  confidence: number;
  intent: string;
  requesterContact: string;
  requesterName: string;
  suggestedNextStep: string;
  summary: string;
}

function assertMaxLength(label: string, value: string, maxLength: number) {
  if (value.length > maxLength) {
    throw new Error(`${label} is too long.`);
  }
}

export function normalizeManualTaskIntake(input: ManualTaskIntakeInput): ManualTaskIntakeInput {
  if (!taskChannels.includes(input.channel)) {
    throw new Error("Task channel is invalid.");
  }

  const normalized = {
    ...input,
    intent: input.intent.trim(),
    requesterContact: input.requesterContact.trim(),
    requesterName: input.requesterName.trim(),
    suggestedNextStep: input.suggestedNextStep.trim(),
    summary: input.summary.trim()
  };

  if (!normalized.requesterName) throw new Error("Requester name is required.");
  if (!normalized.requesterContact) throw new Error("Requester contact is required.");
  if (!normalized.intent) throw new Error("Task intent is required.");
  if (!normalized.summary) throw new Error("Task summary is required.");
  if (!normalized.suggestedNextStep) throw new Error("Suggested next step is required.");
  if (!Number.isFinite(normalized.confidence) || normalized.confidence < 0 || normalized.confidence > 1) {
    throw new Error("Task confidence must be between 0 and 1.");
  }

  assertMaxLength("Requester name", normalized.requesterName, 160);
  assertMaxLength("Requester contact", normalized.requesterContact, 200);
  assertMaxLength("Task intent", normalized.intent, 120);
  assertMaxLength("Task summary", normalized.summary, 1200);
  assertMaxLength("Suggested next step", normalized.suggestedNextStep, 800);

  return normalized;
}

function normalizeIntentKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
}

function normalizeContactKey(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/gu, " ");
  if (!normalized) return "";
  if (normalized.includes("@")) return `email:${normalized}`;

  const digits = normalized.replace(/\D/gu, "");
  if (digits.length >= 7) return `phone:${digits}`;
  return `other:${normalized}`;
}

export interface ManualTaskDuplicateDraft {
  intent: string;
  locationId: string;
  requesterContact: string;
}

export function manualTaskIntakeDuplicateCandidates(
  tasks: Task[],
  tenantId: string,
  draft: ManualTaskDuplicateDraft
): Task[] {
  const contactKey = normalizeContactKey(draft.requesterContact);
  const intentKey = normalizeIntentKey(draft.intent);
  if (!draft.locationId || !contactKey || !intentKey) return [];

  return tasks.filter(
    (task) =>
      task.tenantId === tenantId &&
      task.locationId === draft.locationId &&
      unresolvedTaskStatuses.includes(task.status as (typeof unresolvedTaskStatuses)[number]) &&
      normalizeContactKey(task.requesterContact) === contactKey &&
      normalizeIntentKey(task.intent) === intentKey
  );
}
