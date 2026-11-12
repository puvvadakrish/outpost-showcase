import type { TaskChannel } from "./models";

export interface ManualTaskIntakeDraft {
  channel: TaskChannel;
  claimForActor: boolean;
  confidence: string;
  intent: string;
  locationId: string;
  requesterContact: string;
  requesterName: string;
  suggestedNextStep: string;
  summary: string;
}

export type ManualTaskIntakeDraftField = keyof ManualTaskIntakeDraft;

export function createManualTaskIntakeDraft(locationId = ""): ManualTaskIntakeDraft {
  return {
    channel: "manual",
    claimForActor: false,
    confidence: "0.9",
    intent: "",
    locationId,
    requesterContact: "",
    requesterName: "",
    suggestedNextStep: "",
    summary: ""
  };
}

export function setManualTaskIntakeDraftField<K extends ManualTaskIntakeDraftField>(
  draft: ManualTaskIntakeDraft,
  field: K,
  value: ManualTaskIntakeDraft[K]
): ManualTaskIntakeDraft {
  return { ...draft, [field]: value };
}

export function manualTaskIntakeDraftIsDirty(
  draft: ManualTaskIntakeDraft,
  defaultLocationId = ""
): boolean {
  return JSON.stringify(draft) !== JSON.stringify(createManualTaskIntakeDraft(defaultLocationId));
}
