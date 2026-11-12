import type { ChannelEvent, Conversation } from "@/domain/channels";
import type { Id } from "@/domain/models";
import type { Task } from "@/domain/tasks";

export type NormalizedProviderKey = "retell" | "resend";

export interface ProviderTenantContext {
  tenantId: Id;
  locationId: Id;
  providerConnectionId: Id;
}

export interface NormalizedUsageEvent {
  id: Id;
  tenantId: Id;
  locationId?: Id;
  meter:
    | "voice_seconds"
    | "call_completed"
    | "email_received"
    | "task_created";
  quantity: number;
  sourceType: "channel_event" | "conversation" | "task";
  sourceId: Id;
  periodKey: string;
  occurredAt: string;
}

export interface NormalizedProviderEvent {
  providerKey: NormalizedProviderKey;
  conversation: Conversation;
  channelEvent: ChannelEvent;
  proposedTask?: Task;
  usageEvents: NormalizedUsageEvent[];
  warnings: string[];
}
