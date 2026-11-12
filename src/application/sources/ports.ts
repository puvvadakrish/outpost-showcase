import type { AuditEvent } from "@/domain/audit";
import type { Id } from "@/domain/models";
import type { SourceDocument, SourceFact } from "@/domain/sources";

export interface ManualSourceFactInput {
  topic: string;
  value: string;
  confidence: number;
  conflictGroup?: string;
}

export interface UpsertManualSourceDocumentCommand {
  tenantId: Id;
  locationId: Id;
  actorUserId: Id;
  sourceDocumentId?: Id;
  label: string;
  facts: ManualSourceFactInput[];
}

export interface TransactionalUpsertManualSourceDocumentInput
  extends UpsertManualSourceDocumentCommand {}

export interface UpsertManualSourceDocumentTransactionResult {
  sourceDocument: SourceDocument;
}

export interface SourceRepository {
  upsertManualSourceDocumentTransaction(
    input: TransactionalUpsertManualSourceDocumentInput
  ): Promise<UpsertManualSourceDocumentTransactionResult>;
}

export interface SourcePersistenceState {
  auditEvents: AuditEvent[];
  sourceDocuments: SourceDocument[];
  sourceFacts: SourceFact[];
}
