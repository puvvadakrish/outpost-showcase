import "server-only";

import type { HandoffRule } from "@/domain/handoff-rules";
import type {
  CreateHandoffRuleDraftTransactionResult,
  HandoffRuleRepository,
  TransactionalCreateHandoffRuleDraftInput,
  TransactionalUpdateHandoffRuleInput,
  UpdateHandoffRuleTransactionResult
} from "@/application/handoff-rules/ports";
import type { OutpostNeonClient } from "@/server/neon/server-client";

interface HandoffRuleRow {
  id: string;
  creation_key: string | null;
  tenant_id: string;
  location_id: string | null;
  trigger: HandoffRule["trigger"];
  topic: string;
  action: HandoffRule["action"];
  destination: string;
  active_window: string;
  priority: number;
  status: HandoffRule["status"];
  updated_at: string;
}

function mapHandoffRule(row: HandoffRuleRow): HandoffRule {
  return {
    id: row.id,
    creationKey: row.creation_key ?? undefined,
    tenantId: row.tenant_id,
    locationId: row.location_id ?? undefined,
    trigger: row.trigger,
    topic: row.topic,
    action: row.action,
    destination: row.destination,
    activeWindow: row.active_window,
    priority: row.priority,
    status: row.status,
    updatedAt: row.updated_at
  };
}

export class NeonHandoffRuleRepository implements HandoffRuleRepository {
  constructor(private readonly neon: OutpostNeonClient) {}

  async listForOwnerTenant(tenantId: string) {
    const { data, error } = await this.neon
      .from("handoff_rules")
      .select("id, tenant_id, location_id, trigger, topic, action, destination, active_window, priority, status, creation_key, updated_at")
      .eq("tenant_id", tenantId)
      .order("priority", { ascending: true });

    if (error) {
      throw new Error(`Unable to load owner handoff rules: ${error.message}`);
    }

    return ((data ?? []) as unknown as HandoffRuleRow[]).map(mapHandoffRule);
  }

  async createHandoffRuleDraftTransaction(
    input: TransactionalCreateHandoffRuleDraftInput
  ): Promise<CreateHandoffRuleDraftTransactionResult> {
    const { data, error } = await this.neon.rpc("create_handoff_rule_draft", {
      p_tenant_id: input.tenantId,
      p_location_id: input.locationId ?? null,
      p_creation_key: input.creationKey,
      p_trigger: input.trigger,
      p_topic: input.topic,
      p_action: input.action,
      p_destination: input.destination,
      p_active_window: input.activeWindow,
      p_priority: input.priority,
      p_note: input.note
    });

    if (error) {
      throw new Error(`Unable to create handoff rule draft: ${error.message}`);
    }

    return { rule: mapHandoffRule(data as unknown as HandoffRuleRow) };
  }

  async updateHandoffRuleTransaction(
    input: TransactionalUpdateHandoffRuleInput
  ): Promise<UpdateHandoffRuleTransactionResult> {
    const { data, error } = await this.neon.rpc("update_handoff_rule", {
      p_tenant_id: input.tenantId,
      p_handoff_rule_id: input.ruleId,
      p_trigger: input.trigger,
      p_topic: input.topic,
      p_action: input.action,
      p_destination: input.destination,
      p_active_window: input.activeWindow,
      p_priority: input.priority,
      p_status: input.status,
      p_note: input.note
    });

    if (error) {
      throw new Error(`Unable to update handoff rule: ${error.message}`);
    }

    return { rule: mapHandoffRule(data as unknown as HandoffRuleRow) };
  }
}
