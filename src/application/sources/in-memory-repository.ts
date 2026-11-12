import type { AuditEvent } from "@/domain/audit";
import type { SourceDocument, SourceFact } from "@/domain/sources";
import type {
  SourcePersistenceState,
  SourceRepository,
  TransactionalUpsertManualSourceDocumentInput,
  UpsertManualSourceDocumentTransactionResult
} from "./ports";

export class InMemorySourceRepository implements SourceRepository {
  private failAfterSourceDocumentUpsert = false;
  private state: SourcePersistenceState;

  constructor(seed: SourcePersistenceState) {
    this.state = {
      auditEvents: seed.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      sourceDocuments: seed.sourceDocuments.map((document) => ({ ...document })),
      sourceFacts: seed.sourceFacts.map((fact) => ({ ...fact }))
    };
  }

  requestFailureAfterSourceDocumentUpsert() {
    this.failAfterSourceDocumentUpsert = true;
  }

  snapshot(): SourcePersistenceState {
    return {
      auditEvents: this.state.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      sourceDocuments: this.state.sourceDocuments.map((document) => ({ ...document })),
      sourceFacts: this.state.sourceFacts.map((fact) => ({ ...fact }))
    };
  }

  async upsertManualSourceDocumentTransaction(
    input: TransactionalUpsertManualSourceDocumentInput
  ): Promise<UpsertManualSourceDocumentTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const sourceDocumentId =
      input.sourceDocumentId ?? `source_manual_${this.state.sourceDocuments.length + 1}`;
    const existingIndex = this.state.sourceDocuments.findIndex(
      (document) => document.tenantId === input.tenantId && document.id === sourceDocumentId
    );
    const document: SourceDocument = {
      id: sourceDocumentId,
      tenantId: input.tenantId,
      locationId: input.locationId,
      type: "manual",
      label: input.label,
      status: input.facts.length > 0 ? "needs_review" : "missing",
      factsFound: input.facts.length,
      conflictsFound: input.facts.filter((fact) => Boolean(fact.conflictGroup)).length,
      lastCheckedAt: now
    };

    try {
      if (existingIndex === -1) {
        this.state.sourceDocuments.push(document);
      } else {
        this.state.sourceDocuments[existingIndex] = document;
      }

      if (this.failAfterSourceDocumentUpsert) {
        throw new Error("Injected failure after source document upsert.");
      }

      this.state.sourceFacts = this.state.sourceFacts.filter(
        (fact) => !(fact.tenantId === input.tenantId && fact.sourceDocumentId === sourceDocumentId)
      );

      const sourceFacts: SourceFact[] = input.facts.map((fact, index) => ({
        id: `source_fact_${this.state.sourceFacts.length + index + 1}`,
        tenantId: input.tenantId,
        locationId: input.locationId,
        sourceDocumentId,
        topic: fact.topic,
        value: fact.value,
        confidence: fact.confidence,
        conflictGroup: fact.conflictGroup,
        reviewStatus: "proposed",
        createdAt: now
      }));

      this.state.sourceFacts.push(...sourceFacts);

      const auditEvent: AuditEvent = {
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "source_document",
        subjectId: sourceDocumentId,
        action: "source_document.manual_intake_upserted",
        metadata: {
          location_id: input.locationId,
          source_type: "manual",
          facts_found: document.factsFound,
          conflicts_found: document.conflictsFound,
          fact_count: sourceFacts.length
        },
        occurredAt: now
      };

      this.state.auditEvents.push(auditEvent);

      return { sourceDocument: { ...document } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterSourceDocumentUpsert = false;
    }
  }
}
