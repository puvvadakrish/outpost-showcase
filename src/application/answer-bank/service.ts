import type {
  AnswerBankRepository,
  ApproveAnswerCommand,
  EditDraftAnswerCommand,
  ProposeAnswersFromManualSourceCommand,
  RetireAnswerCommand
} from "./ports";

const DEFAULT_EDIT_NOTE = "Edited through backend-backed owner answer-bank tracer bullet.";
const DEFAULT_APPROVAL_NOTE = "Approved through backend-backed owner answer-bank approval.";
const DEFAULT_PROPOSAL_NOTE = "Staged from manual source facts for owner review.";
const DEFAULT_RETIRE_NOTE = "Retired through backend-backed owner answer review.";
const ANSWER_LIMIT = 4000;
const QUESTION_LIMIT = 600;
const TOPIC_LIMIT = 120;

export class AnswerBankApplicationService {
  constructor(private readonly repository: AnswerBankRepository) {}

  async loadOwnerAnswerBank(tenantId: string) {
    return this.repository.listForOwnerTenant(tenantId);
  }

  async editDraftAnswer(command: EditDraftAnswerCommand) {
    const topic = command.topic.trim();
    const question = command.question.trim();
    const answer = command.answer.trim();
    const note = command.note?.trim() || DEFAULT_EDIT_NOTE;

    if (!topic) {
      throw new Error("Answer topic is required.");
    }

    if (!question) {
      throw new Error("Answer question is required.");
    }

    if (!answer) {
      throw new Error("Answer text is required.");
    }

    if (topic.length > TOPIC_LIMIT) {
      throw new Error(`Answer topic must be ${TOPIC_LIMIT} characters or fewer.`);
    }

    if (question.length > QUESTION_LIMIT) {
      throw new Error(`Answer question must be ${QUESTION_LIMIT} characters or fewer.`);
    }

    if (answer.length > ANSWER_LIMIT) {
      throw new Error(`Answer text must be ${ANSWER_LIMIT} characters or fewer.`);
    }

    const result = await this.repository.editDraftAnswerTransaction({
      ...command,
      topic,
      question,
      answer,
      note
    });

    return result.entry;
  }

  async approveAnswer(command: ApproveAnswerCommand) {
    const note = command.note?.trim() || DEFAULT_APPROVAL_NOTE;

    if (!command.tenantId.trim()) {
      throw new Error("Tenant identifier is required.");
    }

    if (!command.entryId.trim()) {
      throw new Error("Answer identifier is required.");
    }

    const result = await this.repository.approveAnswerTransaction({
      ...command,
      tenantId: command.tenantId.trim(),
      entryId: command.entryId.trim(),
      note
    });

    return result.entry;
  }

  async retireAnswer(command: RetireAnswerCommand) {
    const note = command.note?.trim() || DEFAULT_RETIRE_NOTE;

    if (!command.tenantId.trim()) {
      throw new Error("Tenant identifier is required.");
    }

    if (!command.entryId.trim()) {
      throw new Error("Answer identifier is required.");
    }

    const result = await this.repository.retireAnswerTransaction({
      ...command,
      tenantId: command.tenantId.trim(),
      entryId: command.entryId.trim(),
      note
    });

    return result.entry;
  }

  async proposeAnswersFromManualSource(command: ProposeAnswersFromManualSourceCommand) {
    const tenantId = command.tenantId.trim();
    const sourceDocumentId = command.sourceDocumentId.trim();
    const note = command.note?.trim() || DEFAULT_PROPOSAL_NOTE;

    if (!tenantId) {
      throw new Error("Tenant identifier is required.");
    }

    if (!sourceDocumentId) {
      throw new Error("Source document identifier is required.");
    }

    return this.repository.proposeAnswersFromManualSourceTransaction({
      ...command,
      tenantId,
      sourceDocumentId,
      note
    });
  }
}
