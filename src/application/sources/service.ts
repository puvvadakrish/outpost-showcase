import type {
  ManualSourceFactInput,
  SourceRepository,
  UpsertManualSourceDocumentCommand
} from "./ports";

const FACT_LIMIT = 20;
const LABEL_LIMIT = 160;
const TOPIC_LIMIT = 120;
const VALUE_LIMIT = 1200;
const CONFLICT_GROUP_LIMIT = 160;

function assertMaxLength(label: string, value: string, maxLength: number) {
  if (value.length > maxLength) {
    throw new Error(`${label} is too long.`);
  }
}

function normalizeFact(fact: ManualSourceFactInput): ManualSourceFactInput {
  const topic = fact.topic.trim();
  const value = fact.value.trim();
  const conflictGroup = fact.conflictGroup?.trim();

  if (!topic) {
    throw new Error("Source fact topic is required.");
  }

  if (!value) {
    throw new Error("Source fact value is required.");
  }

  if (!Number.isFinite(fact.confidence) || fact.confidence < 0 || fact.confidence > 1) {
    throw new Error("Source fact confidence must be between 0 and 1.");
  }

  assertMaxLength("Source fact topic", topic, TOPIC_LIMIT);
  assertMaxLength("Source fact value", value, VALUE_LIMIT);

  if (conflictGroup) {
    assertMaxLength("Source fact conflict group", conflictGroup, CONFLICT_GROUP_LIMIT);
  }

  return {
    topic,
    value,
    confidence: fact.confidence,
    conflictGroup: conflictGroup || undefined
  };
}

export class SourceApplicationService {
  constructor(private readonly repository: SourceRepository) {}

  async upsertManualSourceDocument(command: UpsertManualSourceDocumentCommand) {
    const tenantId = command.tenantId.trim();
    const locationId = command.locationId.trim();
    const sourceDocumentId = command.sourceDocumentId?.trim() || undefined;
    const label = command.label.trim();

    if (!tenantId) {
      throw new Error("Tenant identifier is required.");
    }

    if (!locationId) {
      throw new Error("Location identifier is required.");
    }

    if (!label) {
      throw new Error("Source label is required.");
    }

    assertMaxLength("Source label", label, LABEL_LIMIT);

    if (command.facts.length > FACT_LIMIT) {
      throw new Error(`Manual source intake accepts ${FACT_LIMIT} facts or fewer.`);
    }

    const facts = command.facts.map(normalizeFact);

    const result = await this.repository.upsertManualSourceDocumentTransaction({
      ...command,
      tenantId,
      locationId,
      sourceDocumentId,
      label,
      facts
    });

    return result.sourceDocument;
  }
}
