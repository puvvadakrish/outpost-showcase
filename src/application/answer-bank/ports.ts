import type { AnswerBankEntry } from "@/domain/answer-bank";
import type { Id } from "@/domain/models";
import type { SourceDocument, SourceFact } from "@/domain/sources";

export interface EditDraftAnswerCommand {
  tenantId: Id;
  entryId: Id;
  actorUserId: Id;
  topic: string;
  question: string;
  answer: string;
  note?: string;
}

export interface TransactionalEditDraftAnswerInput extends EditDraftAnswerCommand {
  note: string;
}

export interface EditDraftAnswerTransactionResult {
  entry: AnswerBankEntry;
}

export interface ApproveAnswerCommand {
  tenantId: Id;
  entryId: Id;
  // Hosted Neon approval re-derives the actor from the JWT; this keeps the in-memory port explicit.
  actorUserId: Id;
  note?: string;
}

export interface TransactionalApproveAnswerInput extends ApproveAnswerCommand {
  note: string;
}

export interface ApproveAnswerTransactionResult {
  entry: AnswerBankEntry;
}

export interface RetireAnswerCommand {
  tenantId: Id;
  entryId: Id;
  // Hosted Neon retirement re-derives the actor from the JWT; this keeps the in-memory port explicit.
  actorUserId: Id;
  note?: string;
}

export interface TransactionalRetireAnswerInput extends RetireAnswerCommand {
  note: string;
}

export interface RetireAnswerTransactionResult {
  entry: AnswerBankEntry;
}

export interface ProposeAnswersFromManualSourceCommand {
  tenantId: Id;
  sourceDocumentId: Id;
  // Hosted Neon proposal staging re-derives the actor from the JWT; this keeps the in-memory port explicit.
  actorUserId: Id;
  note?: string;
}

export interface TransactionalProposeAnswersFromManualSourceInput
  extends ProposeAnswersFromManualSourceCommand {
  note: string;
}

export interface ProposeAnswersFromManualSourceTransactionResult {
  proposedCount: number;
  conflictCount: number;
}

export interface AnswerBankRepository {
  listForOwnerTenant(tenantId: Id): Promise<AnswerBankEntry[]>;
  editDraftAnswerTransaction(
    input: TransactionalEditDraftAnswerInput
  ): Promise<EditDraftAnswerTransactionResult>;
  approveAnswerTransaction(
    input: TransactionalApproveAnswerInput
  ): Promise<ApproveAnswerTransactionResult>;
  retireAnswerTransaction(
    input: TransactionalRetireAnswerInput
  ): Promise<RetireAnswerTransactionResult>;
  proposeAnswersFromManualSourceTransaction(
    input: TransactionalProposeAnswersFromManualSourceInput
  ): Promise<ProposeAnswersFromManualSourceTransactionResult>;
}

export interface AnswerBankPersistenceState {
  entries: AnswerBankEntry[];
  revisions: import("@/domain/answer-bank").AnswerBankRevision[];
  auditEvents: import("@/domain/audit").AuditEvent[];
  sourceDocuments?: SourceDocument[];
  sourceFacts?: SourceFact[];
}
