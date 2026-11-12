import { handoffActions, handoffRuleStatuses, handoffTriggers } from "@/domain/models";
import type {
  CreateHandoffRuleDraftCommand,
  HandoffRuleRepository,
  UpdateHandoffRuleCommand
} from "./ports";

const DEFAULT_CREATE_NOTE = "Created as a draft through backend-backed owner handoff-rule persistence.";
const DEFAULT_UPDATE_NOTE = "Updated through backend-backed owner handoff-rule persistence.";
const TOPIC_LIMIT = 160;
const DESTINATION_LIMIT = 240;
const ACTIVE_WINDOW_LIMIT = 120;
const CREATION_KEY_LIMIT = 200;

function includesValue<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

function validateFields(command: {
  trigger: string;
  topic: string;
  action: string;
  destination: string;
  activeWindow: string;
  priority: number;
}) {
  if (!command.topic) {
    throw new Error("Handoff rule topic is required.");
  }

  if (!command.destination) {
    throw new Error("Handoff rule destination is required.");
  }

  if (!command.activeWindow) {
    throw new Error("Handoff rule active window is required.");
  }

  if (!includesValue(handoffTriggers, command.trigger)) {
    throw new Error("Handoff rule trigger is invalid.");
  }

  if (!includesValue(handoffActions, command.action)) {
    throw new Error("Handoff rule action is invalid.");
  }

  if (command.topic.length > TOPIC_LIMIT) {
    throw new Error(`Handoff rule topic must be ${TOPIC_LIMIT} characters or fewer.`);
  }

  if (command.destination.length > DESTINATION_LIMIT) {
    throw new Error(`Handoff rule destination must be ${DESTINATION_LIMIT} characters or fewer.`);
  }

  if (command.activeWindow.length > ACTIVE_WINDOW_LIMIT) {
    throw new Error(`Handoff rule active window must be ${ACTIVE_WINDOW_LIMIT} characters or fewer.`);
  }

  if (!Number.isInteger(command.priority) || command.priority < 1 || command.priority > 1000) {
    throw new Error("Handoff rule priority must be a whole number from 1 to 1000.");
  }
}

export class HandoffRuleApplicationService {
  constructor(private readonly repository: HandoffRuleRepository) {}

  async loadOwnerHandoffRules(tenantId: string) {
    if (!tenantId.trim()) {
      throw new Error("Tenant identifier is required.");
    }

    return this.repository.listForOwnerTenant(tenantId.trim());
  }

  async createHandoffRuleDraft(command: CreateHandoffRuleDraftCommand) {
    const tenantId = command.tenantId.trim();
    const locationId = normalizeOptional(command.locationId);
    const creationKey = command.creationKey.trim();
    const topic = command.topic.trim();
    const destination = command.destination.trim();
    const activeWindow = command.activeWindow.trim();
    const note = command.note?.trim() || DEFAULT_CREATE_NOTE;

    if (!tenantId) {
      throw new Error("Tenant identifier is required.");
    }

    if (!creationKey || creationKey.length > CREATION_KEY_LIMIT) {
      throw new Error(
        `Handoff rule creation key is required and must be ${CREATION_KEY_LIMIT} characters or fewer.`
      );
    }

    validateFields({ ...command, topic, destination, activeWindow });

    const result = await this.repository.createHandoffRuleDraftTransaction({
      ...command,
      tenantId,
      locationId,
      creationKey,
      topic,
      destination,
      activeWindow,
      note
    });

    return result.rule;
  }

  async updateHandoffRule(command: UpdateHandoffRuleCommand) {
    const topic = command.topic.trim();
    const destination = command.destination.trim();
    const activeWindow = command.activeWindow.trim();
    const note = command.note?.trim() || DEFAULT_UPDATE_NOTE;

    if (!command.tenantId.trim()) {
      throw new Error("Tenant identifier is required.");
    }

    if (!command.ruleId.trim()) {
      throw new Error("Handoff rule identifier is required.");
    }

    if (!includesValue(handoffRuleStatuses, command.status)) {
      throw new Error("Handoff rule status is invalid.");
    }

    validateFields({ ...command, topic, destination, activeWindow });

    const result = await this.repository.updateHandoffRuleTransaction({
      ...command,
      tenantId: command.tenantId.trim(),
      ruleId: command.ruleId.trim(),
      topic,
      destination,
      activeWindow,
      note
    });

    return result.rule;
  }
}
