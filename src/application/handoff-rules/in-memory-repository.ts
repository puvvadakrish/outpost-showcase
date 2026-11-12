import type { AuditEvent } from "@/domain/audit";
import type { HandoffRule, HandoffRuleRevision } from "@/domain/handoff-rules";
import type {
  CreateHandoffRuleDraftTransactionResult,
  HandoffRuleRepository,
  TransactionalCreateHandoffRuleDraftInput,
  TransactionalUpdateHandoffRuleInput,
  UpdateHandoffRuleTransactionResult
} from "./ports";

interface InMemoryHandoffRuleState {
  auditEvents: AuditEvent[];
  revisions: HandoffRuleRevision[];
  rules: HandoffRule[];
}

export class InMemoryHandoffRuleRepository implements HandoffRuleRepository {
  private failAfterRuleCreation = false;
  private failAfterInitialRevisionCreation = false;
  private failAfterRuleUpdate = false;
  private state: InMemoryHandoffRuleState;

  constructor(seed: InMemoryHandoffRuleState) {
    this.state = {
      auditEvents: seed.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      revisions: seed.revisions.map((revision) => ({ ...revision })),
      rules: seed.rules.map((rule) => ({ ...rule }))
    };
  }

  requestFailureAfterRuleUpdate() {
    this.failAfterRuleUpdate = true;
  }

  requestFailureAfterRuleCreation() {
    this.failAfterRuleCreation = true;
  }

  requestFailureAfterInitialRevisionCreation() {
    this.failAfterInitialRevisionCreation = true;
  }

  snapshot(): InMemoryHandoffRuleState {
    return {
      auditEvents: this.state.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      revisions: this.state.revisions.map((revision) => ({ ...revision })),
      rules: this.state.rules.map((rule) => ({ ...rule }))
    };
  }

  async listForOwnerTenant(tenantId: string) {
    return this.state.rules.filter((rule) => rule.tenantId === tenantId).map((rule) => ({ ...rule }));
  }

  async createHandoffRuleDraftTransaction(
    input: TransactionalCreateHandoffRuleDraftInput
  ): Promise<CreateHandoffRuleDraftTransactionResult> {
    const existingAudit = this.state.auditEvents.find(
      (event) =>
        event.tenantId === input.tenantId &&
        event.action === "handoff_rule.created" &&
        event.metadata.creation_key === input.creationKey
    );
    if (existingAudit) {
      const existingRule = this.state.rules.find((rule) => rule.id === existingAudit.subjectId);
      if (!existingRule) throw new Error("Handoff rule creation state is inconsistent.");
      if (
        existingRule.locationId !== input.locationId ||
        existingRule.trigger !== input.trigger ||
        existingRule.topic !== input.topic ||
        existingRule.action !== input.action ||
        existingRule.destination !== input.destination ||
        existingRule.activeWindow !== input.activeWindow ||
        existingRule.priority !== input.priority
      ) {
        throw new Error("Handoff rule creation key conflicts with different work.");
      }
      return { rule: { ...existingRule } };
    }
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const ruleId = `handoff_rule_${this.state.rules.length + 1}`;
    const rule: HandoffRule = {
      id: ruleId,
      creationKey: input.creationKey,
      tenantId: input.tenantId,
      locationId: input.locationId,
      trigger: input.trigger,
      topic: input.topic,
      action: input.action,
      destination: input.destination,
      activeWindow: input.activeWindow,
      priority: input.priority,
      status: "draft",
      updatedAt: now
    };

    try {
      this.state.rules.push(rule);

      if (this.failAfterRuleCreation) {
        throw new Error("Injected failure after handoff rule creation.");
      }

      const revision: HandoffRuleRevision = {
        id: `handoff_rule_revision_${this.state.revisions.length + 1}`,
        tenantId: input.tenantId,
        locationId: input.locationId,
        handoffRuleId: ruleId,
        actorUserId: input.actorUserId,
        previousTrigger: rule.trigger,
        nextTrigger: rule.trigger,
        previousTopic: rule.topic,
        nextTopic: rule.topic,
        previousAction: rule.action,
        nextAction: rule.action,
        previousDestination: rule.destination,
        nextDestination: rule.destination,
        previousActiveWindow: rule.activeWindow,
        nextActiveWindow: rule.activeWindow,
        previousStatus: "draft",
        nextStatus: "draft",
        previousPriority: rule.priority,
        nextPriority: rule.priority,
        note: input.note,
        createdAt: now
      };

      this.state.revisions.push(revision);

      if (this.failAfterInitialRevisionCreation) {
        throw new Error("Injected failure after initial handoff rule revision creation.");
      }

      const auditEvent: AuditEvent = {
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "handoff_rule",
        subjectId: ruleId,
        action: "handoff_rule.created",
        metadata: {
          location_id: input.locationId ?? null,
          status: "draft",
          revision_id: revision.id,
          creation_key: input.creationKey
        },
        occurredAt: now
      };

      this.state.auditEvents.push(auditEvent);

      return { rule: { ...rule } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterRuleCreation = false;
      this.failAfterInitialRevisionCreation = false;
    }
  }

  async updateHandoffRuleTransaction(
    input: TransactionalUpdateHandoffRuleInput
  ): Promise<UpdateHandoffRuleTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const ruleIndex = this.state.rules.findIndex(
      (rule) => rule.tenantId === input.tenantId && rule.id === input.ruleId
    );

    try {
      if (ruleIndex === -1) {
        throw new Error("Handoff rule not found.");
      }

      const existing = this.state.rules[ruleIndex];
      const updated: HandoffRule = {
        ...existing,
        trigger: input.trigger,
        topic: input.topic,
        action: input.action,
        destination: input.destination,
        activeWindow: input.activeWindow,
        priority: input.priority,
        status: input.status,
        updatedAt: now
      };

      this.state.rules[ruleIndex] = updated;

      if (this.failAfterRuleUpdate) {
        throw new Error("Injected failure after handoff rule update.");
      }

      const revision: HandoffRuleRevision = {
        id: `handoff_rule_revision_${this.state.revisions.length + 1}`,
        tenantId: input.tenantId,
        locationId: updated.locationId,
        handoffRuleId: updated.id,
        actorUserId: input.actorUserId,
        previousTrigger: existing.trigger,
        nextTrigger: updated.trigger,
        previousTopic: existing.topic,
        nextTopic: updated.topic,
        previousAction: existing.action,
        nextAction: updated.action,
        previousDestination: existing.destination,
        nextDestination: updated.destination,
        previousActiveWindow: existing.activeWindow,
        nextActiveWindow: updated.activeWindow,
        previousStatus: existing.status,
        nextStatus: updated.status,
        previousPriority: existing.priority,
        nextPriority: updated.priority,
        note: input.note,
        createdAt: now
      };

      const auditEvent: AuditEvent = {
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "handoff_rule",
        subjectId: updated.id,
        action: "handoff_rule.updated",
        metadata: {
          previous_trigger: existing.trigger,
          next_trigger: updated.trigger,
          previous_topic: existing.topic,
          next_topic: updated.topic,
          previous_action: existing.action,
          next_action: updated.action,
          previous_destination: existing.destination,
          next_destination: updated.destination,
          previous_active_window: existing.activeWindow,
          next_active_window: updated.activeWindow,
          previous_status: existing.status,
          next_status: updated.status,
          previous_priority: existing.priority,
          next_priority: updated.priority,
          revision_id: revision.id
        },
        occurredAt: now
      };

      this.state.revisions.push(revision);
      this.state.auditEvents.push(auditEvent);

      return { rule: { ...updated } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterRuleUpdate = false;
    }
  }
}
