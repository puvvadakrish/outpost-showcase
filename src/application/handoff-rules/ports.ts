import type { HandoffAction, HandoffRuleStatus, HandoffTrigger, Id } from "@/domain/models";
import type { HandoffRule } from "@/domain/handoff-rules";

export interface CreateHandoffRuleDraftCommand {
  tenantId: Id;
  locationId?: Id;
  creationKey: string;
  actorUserId: Id;
  trigger: HandoffTrigger;
  topic: string;
  action: HandoffAction;
  destination: string;
  activeWindow: string;
  priority: number;
  note?: string;
}

export interface TransactionalCreateHandoffRuleDraftInput
  extends CreateHandoffRuleDraftCommand {
  note: string;
}

export interface CreateHandoffRuleDraftTransactionResult {
  rule: HandoffRule;
}

export interface UpdateHandoffRuleCommand {
  tenantId: Id;
  ruleId: Id;
  actorUserId: Id;
  trigger: HandoffTrigger;
  topic: string;
  action: HandoffAction;
  destination: string;
  activeWindow: string;
  priority: number;
  status: HandoffRuleStatus;
  note?: string;
}

export interface TransactionalUpdateHandoffRuleInput extends UpdateHandoffRuleCommand {
  note: string;
}

export interface UpdateHandoffRuleTransactionResult {
  rule: HandoffRule;
}

export interface HandoffRuleRepository {
  listForOwnerTenant(tenantId: Id): Promise<HandoffRule[]>;
  createHandoffRuleDraftTransaction(
    input: TransactionalCreateHandoffRuleDraftInput
  ): Promise<CreateHandoffRuleDraftTransactionResult>;
  updateHandoffRuleTransaction(
    input: TransactionalUpdateHandoffRuleInput
  ): Promise<UpdateHandoffRuleTransactionResult>;
}
