import type { HandoffAction, HandoffRuleStatus, HandoffTrigger, Id } from "./models";

export interface HandoffRule {
  id: Id;
  creationKey?: string;
  tenantId: Id;
  locationId?: Id;
  trigger: HandoffTrigger;
  topic: string;
  action: HandoffAction;
  destination: string;
  activeWindow: string;
  priority: number;
  status: HandoffRuleStatus;
  updatedAt?: string;
}

export interface HandoffRuleRevision {
  id: Id;
  tenantId: Id;
  locationId?: Id;
  handoffRuleId: Id;
  actorUserId?: Id;
  previousTrigger: HandoffTrigger;
  nextTrigger: HandoffTrigger;
  previousTopic: string;
  nextTopic: string;
  previousAction: HandoffAction;
  nextAction: HandoffAction;
  previousDestination: string;
  nextDestination: string;
  previousActiveWindow: string;
  nextActiveWindow: string;
  previousStatus: HandoffRuleStatus;
  nextStatus: HandoffRuleStatus;
  previousPriority: number;
  nextPriority: number;
  note: string;
  createdAt: string;
}
