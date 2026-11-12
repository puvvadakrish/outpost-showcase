import "server-only";

import type { AnswerBankEntry } from "@/domain/answer-bank";
import { unresolvedTaskStatuses, type TaskStatus } from "@/domain/models";
import type {
  ApproveAnswerTransactionResult,
  AnswerBankRepository,
  EditDraftAnswerTransactionResult,
  ProposeAnswersFromManualSourceTransactionResult,
  RetireAnswerTransactionResult,
  TransactionalApproveAnswerInput,
  TransactionalEditDraftAnswerInput,
  TransactionalProposeAnswersFromManualSourceInput,
  TransactionalRetireAnswerInput
} from "@/application/answer-bank/ports";
import type { OutpostNeonClient } from "@/server/neon/server-client";

interface AnswerBankEntryRow {
  id: string;
  tenant_id: string;
  location_id: string | null;
  topic: string;
  question: string;
  answer: string;
  approval_status: AnswerBankEntry["approvalStatus"];
  source_document_id: string | null;
  source_label: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  retired_at: string | null;
  owner_action: AnswerBankEntry["ownerAction"];
  runtime_behavior: AnswerBankEntry["runtimeBehavior"];
  review_note: string;
  updated_at: string;
}

interface AnswerProposalResultRow {
  proposed_count: number;
  conflict_count: number;
}

interface AnswerDerivedTaskRow {
  id: string;
  status: TaskStatus;
  created_at: string;
}

interface AuditEventTaskLinkRow {
  subject_id: string;
  metadata: {
    answer_bank_entry_id?: string;
  } | null;
}

function mapAnswerBankEntry(
  row: AnswerBankEntryRow,
  openTask?: AnswerDerivedTaskRow
): AnswerBankEntry {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    locationId: row.location_id ?? undefined,
    topic: row.topic,
    question: row.question,
    answer: row.answer,
    approvalStatus: row.approval_status,
    sourceDocumentId: row.source_document_id ?? undefined,
    sourceLabel: row.source_label ?? undefined,
    approvedByUserId: row.approved_by_user_id ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    retiredAt: row.retired_at ?? undefined,
    ownerAction: row.owner_action,
    runtimeBehavior: row.runtime_behavior,
    reviewNote: row.review_note,
    openTaskCreatedAt: openTask?.created_at,
    openTaskId: openTask?.id,
    openTaskStatus: openTask?.status,
    updatedAt: row.updated_at
  };
}

export class NeonAnswerBankRepository implements AnswerBankRepository {
  constructor(private readonly neon: OutpostNeonClient) {}

  async listForOwnerTenant(tenantId: string) {
    const { data, error } = await this.neon
      .from("answer_bank_entries")
      .select(
        "id, tenant_id, location_id, topic, question, answer, approval_status, source_document_id, source_label, approved_by_user_id, approved_at, retired_at, owner_action, runtime_behavior, review_note, updated_at"
      )
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to load owner answer bank: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as AnswerBankEntryRow[];
    const answerIds = rows.map((row) => row.id);
    const openTasksByAnswerId = new Map<string, AnswerDerivedTaskRow>();

    if (answerIds.length > 0) {
      const { data: linkData, error: linkError } = await this.neon
        .from("audit_events")
        .select("subject_id, metadata")
        .eq("tenant_id", tenantId)
        .eq("subject_type", "task")
        .eq("action", "task.created_from_answer")
        .in("metadata->>answer_bank_entry_id", answerIds);

      if (linkError) {
        throw new Error(`Unable to load answer task provenance: ${linkError.message}`);
      }

      const links = (linkData ?? []) as unknown as AuditEventTaskLinkRow[];
      const answerIdByTaskId = new Map(
        links
          .filter((link) => link.metadata?.answer_bank_entry_id)
          .map((link) => [link.subject_id, link.metadata?.answer_bank_entry_id as string])
      );
      const taskIds = [...new Set(links.map((link) => link.subject_id))];

      if (taskIds.length > 0) {
        const { data: taskData, error: taskError } = await this.neon
          .from("tasks")
          .select("id, status, created_at")
          .eq("tenant_id", tenantId)
          .in("id", taskIds)
          .in("status", [...unresolvedTaskStatuses])
          .order("created_at", { ascending: true });

        if (taskError) {
          throw new Error(`Unable to load answer task state: ${taskError.message}`);
        }

        for (const task of (taskData ?? []) as unknown as AnswerDerivedTaskRow[]) {
          const answerId = answerIdByTaskId.get(task.id);

          if (answerId && !openTasksByAnswerId.has(answerId)) {
            openTasksByAnswerId.set(answerId, task);
          }
        }
      }
    }

    return rows.map((row) => mapAnswerBankEntry(row, openTasksByAnswerId.get(row.id)));
  }

  async editDraftAnswerTransaction(
    input: TransactionalEditDraftAnswerInput
  ): Promise<EditDraftAnswerTransactionResult> {
    const { data, error } = await this.neon.rpc("edit_answer_bank_draft", {
      p_tenant_id: input.tenantId,
      p_answer_bank_entry_id: input.entryId,
      p_topic: input.topic,
      p_question: input.question,
      p_answer: input.answer,
      p_note: input.note
    });

    if (error) {
      throw new Error(`Unable to edit draft answer: ${error.message}`);
    }

    return { entry: mapAnswerBankEntry(data as unknown as AnswerBankEntryRow) };
  }

  async approveAnswerTransaction(
    input: TransactionalApproveAnswerInput
  ): Promise<ApproveAnswerTransactionResult> {
    const { data, error } = await this.neon.rpc("approve_answer_bank_entry", {
      p_tenant_id: input.tenantId,
      p_answer_bank_entry_id: input.entryId,
      p_note: input.note
    });

    if (error) {
      throw new Error(`Unable to approve answer: ${error.message}`);
    }

    return { entry: mapAnswerBankEntry(data as unknown as AnswerBankEntryRow) };
  }

  async retireAnswerTransaction(
    input: TransactionalRetireAnswerInput
  ): Promise<RetireAnswerTransactionResult> {
    const { data, error } = await this.neon.rpc("retire_answer_bank_entry", {
      p_tenant_id: input.tenantId,
      p_answer_bank_entry_id: input.entryId,
      p_note: input.note
    });

    if (error) {
      throw new Error(`Unable to retire answer: ${error.message}`);
    }

    return { entry: mapAnswerBankEntry(data as unknown as AnswerBankEntryRow) };
  }

  async proposeAnswersFromManualSourceTransaction(
    input: TransactionalProposeAnswersFromManualSourceInput
  ): Promise<ProposeAnswersFromManualSourceTransactionResult> {
    const { data, error } = await this.neon.rpc("propose_answers_from_manual_source", {
      p_tenant_id: input.tenantId,
      p_source_document_id: input.sourceDocumentId,
      p_note: input.note
    });

    if (error) {
      throw new Error(`Unable to stage answer proposals: ${error.message}`);
    }

    const result = Array.isArray(data)
      ? (data[0] as unknown as AnswerProposalResultRow | undefined)
      : (data as unknown as AnswerProposalResultRow | undefined);

    if (!result) {
      throw new Error("Unable to stage answer proposals: RPC returned no result.");
    }

    return {
      proposedCount: result.proposed_count,
      conflictCount: result.conflict_count
    };
  }
}
