import type { Id } from "./models";

export interface UsageEvent {
  id: Id;
  tenantId: Id;
  locationId?: Id;
  meter:
    | "voice_seconds"
    | "call_started"
    | "call_completed"
    | "call_transferred"
    | "email_received"
    | "email_classified"
    | "email_replied"
    | "task_created"
    | "notification_attempted"
    | "notification_delivered"
    | "social_message_processed";
  quantity: number;
  sourceType: string;
  sourceId: Id;
  periodKey: string;
  occurredAt: string;
}

export function usagePlaceholderSummary(events: UsageEvent[]) {
  return {
    events: events.length,
    quantity: events.reduce((total, event) => total + event.quantity, 0),
    computesBilling: false,
    computesOverage: false
  };
}
