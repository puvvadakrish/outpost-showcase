import type { AuditEvent } from "@/domain/audit";
import type { AnswerBankEntry, AnswerBankRevision } from "@/domain/answer-bank";
import type { Id } from "@/domain/models";
import type {
  ApproveAnswerTransactionResult,
  AnswerBankPersistenceState,
  AnswerBankRepository,
  EditDraftAnswerTransactionResult,
  ProposeAnswersFromManualSourceTransactionResult,
  RetireAnswerTransactionResult,
  TransactionalApproveAnswerInput,
  TransactionalEditDraftAnswerInput,
  TransactionalProposeAnswersFromManualSourceInput,
  TransactionalRetireAnswerInput
} from "./ports";

export class InMemoryAnswerBankRepository implements AnswerBankRepository {
  private failAfterAnswerUpdate = false;
  private failAfterProposalAnswerInsert = false;
  private state: Required<AnswerBankPersistenceState>;

  constructor(seed: AnswerBankPersistenceState) {
    this.state = {
      entries: seed.entries.map((entry) => ({ ...entry })),
      revisions: seed.revisions.map((revision) => ({ ...revision })),
      auditEvents: seed.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      sourceDocuments: (seed.sourceDocuments ?? []).map((document) => ({ ...document })),
      sourceFacts: (seed.sourceFacts ?? []).map((fact) => ({ ...fact }))
    };
  }

  requestFailureAfterAnswerUpdate() {
    this.failAfterAnswerUpdate = true;
  }

  requestFailureAfterProposalAnswerInsert() {
    this.failAfterProposalAnswerInsert = true;
  }

  snapshot() {
    return {
      entries: this.state.entries.map((entry) => ({ ...entry })),
      revisions: this.state.revisions.map((revision) => ({ ...revision })),
      auditEvents: this.state.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      sourceDocuments: this.state.sourceDocuments.map((document) => ({ ...document })),
      sourceFacts: this.state.sourceFacts.map((fact) => ({ ...fact }))
    };
  }

  async listForOwnerTenant(tenantId: Id) {
    return this.state.entries.filter((entry) => entry.tenantId === tenantId).map((entry) => ({ ...entry }));
  }

  async editDraftAnswerTransaction(
    input: TransactionalEditDraftAnswerInput
  ): Promise<EditDraftAnswerTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const entryIndex = this.state.entries.findIndex(
      (entry) => entry.tenantId === input.tenantId && entry.id === input.entryId
    );

    try {
      if (entryIndex === -1) {
        throw new Error("Answer bank entry not found.");
      }

      const existing = this.state.entries[entryIndex];

      if (!["draft", "conflict"].includes(existing.approvalStatus)) {
        throw new Error("Only draft or conflict answers can be edited.");
      }

      const updated: AnswerBankEntry = {
        ...existing,
        topic: input.topic,
        question: input.question,
        answer: input.answer,
        approvalStatus: "draft",
        approvedByUserId: undefined,
        approvedAt: undefined,
        retiredAt: undefined,
        ownerAction: "edit",
        runtimeBehavior: "needs_owner_review",
        reviewNote: input.note,
        updatedAt: now
      };

      this.state.entries[entryIndex] = updated;

      if (this.failAfterAnswerUpdate) {
        throw new Error("Injected failure after answer update.");
      }

      const revision: AnswerBankRevision = {
        id: `answer_revision_${this.state.revisions.length + 1}`,
        tenantId: input.tenantId,
        locationId: updated.locationId,
        answerBankEntryId: updated.id,
        actorUserId: input.actorUserId,
        revisionIntent: existing.approvalStatus === "conflict" ? "conflict_resolution" : "edit",
        previousStatus: existing.approvalStatus,
        nextStatus: updated.approvalStatus,
        sourceDocumentId: updated.sourceDocumentId,
        sourceLabel: updated.sourceLabel,
        note: input.note,
        createdAt: now
      };

      const auditEvent: AuditEvent = {
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "answer_bank_entry",
        subjectId: updated.id,
        action:
          existing.approvalStatus === "conflict"
            ? "answer_bank_entry.conflict_resolved"
            : "answer_bank_entry.draft_edited",
        metadata: {
          previous_status: existing.approvalStatus,
          next_status: updated.approvalStatus,
          revision_id: revision.id
        },
        occurredAt: now
      };

      this.state.revisions.push(revision);
      this.state.auditEvents.push(auditEvent);

      return { entry: { ...updated } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterAnswerUpdate = false;
    }
  }

  async approveAnswerTransaction(
    input: TransactionalApproveAnswerInput
  ): Promise<ApproveAnswerTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const entryIndex = this.state.entries.findIndex(
      (entry) => entry.tenantId === input.tenantId && entry.id === input.entryId
    );

    try {
      if (entryIndex === -1) {
        throw new Error("Answer bank entry not found.");
      }

      const existing = this.state.entries[entryIndex];

      if (!["draft", "conflict"].includes(existing.approvalStatus)) {
        throw new Error("Only draft or conflict answers can be approved.");
      }

      const updated: AnswerBankEntry = {
        ...existing,
        approvalStatus: "approved",
        approvedByUserId: input.actorUserId,
        approvedAt: now,
        retiredAt: undefined,
        ownerAction: "approve",
        runtimeBehavior: "answer_live",
        reviewNote: input.note,
        updatedAt: now
      };

      this.state.entries[entryIndex] = updated;

      if (this.failAfterAnswerUpdate) {
        throw new Error("Injected failure after answer update.");
      }

      const revision: AnswerBankRevision = {
        id: `answer_revision_${this.state.revisions.length + 1}`,
        tenantId: input.tenantId,
        locationId: updated.locationId,
        answerBankEntryId: updated.id,
        actorUserId: input.actorUserId,
        revisionIntent: "approval",
        previousStatus: existing.approvalStatus,
        nextStatus: updated.approvalStatus,
        sourceDocumentId: updated.sourceDocumentId,
        sourceLabel: updated.sourceLabel,
        note: input.note,
        createdAt: now
      };

      const auditEvent: AuditEvent = {
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "answer_bank_entry",
        subjectId: updated.id,
        action: "answer_bank_entry.approved",
        metadata: {
          previous_status: existing.approvalStatus,
          next_status: updated.approvalStatus,
          revision_id: revision.id
        },
        occurredAt: now
      };

      this.state.revisions.push(revision);
      this.state.auditEvents.push(auditEvent);

      return { entry: { ...updated } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterAnswerUpdate = false;
    }
  }

  async retireAnswerTransaction(
    input: TransactionalRetireAnswerInput
  ): Promise<RetireAnswerTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const entryIndex = this.state.entries.findIndex(
      (entry) => entry.tenantId === input.tenantId && entry.id === input.entryId
    );

    try {
      if (entryIndex === -1) {
        throw new Error("Answer bank entry not found.");
      }

      const existing = this.state.entries[entryIndex];

      if (!["draft", "conflict"].includes(existing.approvalStatus)) {
        throw new Error("Only draft or conflict answers can be retired in owner review.");
      }

      const updated: AnswerBankEntry = {
        ...existing,
        approvalStatus: "retired",
        approvedByUserId: undefined,
        approvedAt: undefined,
        retiredAt: now,
        ownerAction: "retire",
        runtimeBehavior: "blocked_until_resolved",
        reviewNote: input.note,
        updatedAt: now
      };

      this.state.entries[entryIndex] = updated;

      if (this.failAfterAnswerUpdate) {
        throw new Error("Injected failure after answer update.");
      }

      const revision: AnswerBankRevision = {
        id: `answer_revision_${this.state.revisions.length + 1}`,
        tenantId: input.tenantId,
        locationId: updated.locationId,
        answerBankEntryId: updated.id,
        actorUserId: input.actorUserId,
        revisionIntent: "retirement",
        previousStatus: existing.approvalStatus,
        nextStatus: updated.approvalStatus,
        sourceDocumentId: updated.sourceDocumentId,
        sourceLabel: updated.sourceLabel,
        note: input.note,
        createdAt: now
      };

      const auditEvent: AuditEvent = {
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "answer_bank_entry",
        subjectId: updated.id,
        action: "answer_bank_entry.retired",
        metadata: {
          previous_status: existing.approvalStatus,
          next_status: updated.approvalStatus,
          revision_id: revision.id
        },
        occurredAt: now
      };

      this.state.revisions.push(revision);
      this.state.auditEvents.push(auditEvent);

      return { entry: { ...updated } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterAnswerUpdate = false;
    }
  }

  async proposeAnswersFromManualSourceTransaction(
    input: TransactionalProposeAnswersFromManualSourceInput
  ): Promise<ProposeAnswersFromManualSourceTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();

    try {
      const sourceDocumentIndex = this.state.sourceDocuments.findIndex(
        (document) =>
          document.tenantId === input.tenantId &&
          document.id === input.sourceDocumentId &&
          document.type === "manual"
      );

      if (sourceDocumentIndex === -1) {
        throw new Error("Manual source document not found.");
      }

      const sourceDocument = this.state.sourceDocuments[sourceDocumentIndex];
      const eligibleFacts = this.state.sourceFacts.filter(
        (fact) =>
          fact.tenantId === input.tenantId &&
          fact.sourceDocumentId === input.sourceDocumentId &&
          fact.reviewStatus === "proposed" &&
          !fact.proposedAnswerEntryId
      );

      if (eligibleFacts.length === 0) {
        throw new Error("No proposed manual source facts are available.");
      }

      let conflictCount = 0;
      const createdEntries: AnswerBankEntry[] = [];
      const firstProposalIndex = this.state.entries.length + 1;

      eligibleFacts.forEach((fact, index) => {
        const hasConflict = Boolean(fact.conflictGroup);
        const existingProposalIndex = this.state.entries.findIndex(
          (entry) =>
            entry.tenantId === input.tenantId &&
            entry.sourceDocumentId === sourceDocument.id &&
            ["draft", "conflict"].includes(entry.approvalStatus) &&
            entry.topic.trim().toLowerCase() === fact.topic.trim().toLowerCase()
        );
        const existingProposal =
          existingProposalIndex === -1 ? undefined : this.state.entries[existingProposalIndex];
        const entry: AnswerBankEntry = {
          ...(existingProposal ?? {}),
          id: existingProposal?.id ?? `answer_proposal_${firstProposalIndex + index}`,
          tenantId: input.tenantId,
          locationId: fact.locationId ?? sourceDocument.locationId,
          topic: fact.topic,
          question: `What should staff say about ${fact.topic}?`,
          answer: fact.value,
          approvalStatus: hasConflict ? "conflict" : "draft",
          sourceDocumentId: sourceDocument.id,
          sourceLabel: sourceDocument.label,
          ownerAction: "edit",
          runtimeBehavior: hasConflict ? "blocked_until_resolved" : "needs_owner_review",
          reviewNote: input.note,
          updatedAt: now
        };

        if (hasConflict) {
          conflictCount += 1;
        }

        if (existingProposalIndex === -1) {
          this.state.entries.push(entry);
        } else {
          this.state.entries[existingProposalIndex] = entry;
        }
        createdEntries.push(entry);

        if (this.failAfterProposalAnswerInsert) {
          throw new Error("Injected failure after proposal answer insert.");
        }

        const revision: AnswerBankRevision = {
          id: `answer_revision_${this.state.revisions.length + 1}`,
          tenantId: input.tenantId,
          locationId: entry.locationId,
          answerBankEntryId: entry.id,
          actorUserId: input.actorUserId,
          revisionIntent:
            existingProposal?.approvalStatus === "conflict" && entry.approvalStatus === "draft"
              ? "conflict_resolution"
              : "import_proposal",
          previousStatus: existingProposal?.approvalStatus,
          nextStatus: entry.approvalStatus,
          sourceDocumentId: sourceDocument.id,
          sourceLabel: sourceDocument.label,
          note: input.note,
          createdAt: now
        };

        this.state.revisions.push(revision);
        const sourceFactIndex = this.state.sourceFacts.findIndex((candidate) => candidate.id === fact.id);
        this.state.sourceFacts[sourceFactIndex] = {
          ...fact,
          proposedAnswerEntryId: entry.id,
          reviewStatus: hasConflict ? "conflict" : "needs_review"
        };
      });

      this.state.sourceDocuments[sourceDocumentIndex] = {
        ...sourceDocument,
        status: conflictCount > 0 ? "conflict" : "needs_review"
      };

      this.state.auditEvents.push({
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "source_document",
        subjectId: sourceDocument.id,
        action: "source_document.answer_proposals_staged",
        metadata: {
          source_type: "manual",
          proposed_count: createdEntries.length,
          conflict_count: conflictCount
        },
        occurredAt: now
      });

      return {
        proposedCount: createdEntries.length,
        conflictCount
      };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterProposalAnswerInsert = false;
    }
  }
}
