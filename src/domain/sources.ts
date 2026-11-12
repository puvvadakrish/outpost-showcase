import type {
  Id,
  SourceDocumentStatus,
  SourceDocumentType,
  SourceFactStatus
} from "./models";

export interface SourceDocument {
  id: Id;
  tenantId: Id;
  locationId?: Id;
  type: SourceDocumentType;
  label: string;
  url?: string;
  status: SourceDocumentStatus;
  factsFound: number;
  conflictsFound: number;
  lastCheckedAt: string;
}

export interface SourceFact {
  id: Id;
  tenantId: Id;
  locationId?: Id;
  sourceDocumentId: Id;
  topic: string;
  value: string;
  confidence: number;
  conflictGroup?: string;
  proposedAnswerEntryId?: Id;
  reviewStatus: SourceFactStatus;
  createdAt: string;
}

export function manualSourceDocuments(sourceDocuments: SourceDocument[]) {
  return [...sourceDocuments]
    .filter((source) => source.type === "manual")
    .sort((left, right) => {
      const checkedAtDifference = Date.parse(right.lastCheckedAt) - Date.parse(left.lastCheckedAt);

      if (Number.isFinite(checkedAtDifference) && checkedAtDifference !== 0) {
        return checkedAtDifference;
      }

      return left.label.localeCompare(right.label);
    });
}

export function manualSourceDocumentsForLocation(
  sourceDocuments: SourceDocument[],
  locationId: string
) {
  return manualSourceDocuments(sourceDocuments).filter((source) => source.locationId === locationId);
}

export function sourceDocumentStatusLabel(status: SourceDocumentStatus) {
  if (status === "needs_review") {
    return "Needs review";
  }

  return status[0].toUpperCase() + status.slice(1);
}
