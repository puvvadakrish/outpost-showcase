import type { Channel, Id } from "./models";

export interface ProviderConnection {
  id: Id;
  tenantId: Id;
  locationId?: Id;
  channel: Channel;
  providerKey: "retell" | "resend" | "gmail" | "manual_stub" | "meta";
  status: "not_configured" | "disabled" | "pending_review";
  externalAccountLabel?: string;
  credentialReferenceConfigured: boolean;
  disabledReason: string;
  createdAt: string;
}

export interface Conversation {
  id: Id;
  tenantId: Id;
  locationId?: Id;
  channel: Channel;
  providerConnectionId?: Id;
  externalConversationId?: string;
  requesterLabel: string;
  status: "open" | "resolved" | "needs_human" | "archived";
  startedAt: string;
  lastEventAt: string;
}

export interface ChannelEvent {
  id: Id;
  tenantId: Id;
  locationId?: Id;
  providerConnectionId?: Id;
  conversationId?: Id;
  channel: Channel;
  providerEventId?: string;
  eventType: string;
  payloadDigest?: string;
  payloadRef?: string;
  processingStatus: "received" | "normalized" | "ignored" | "failed";
  receivedAt: string;
}

export function providerConnectionReadiness(connections: ProviderConnection[]) {
  return {
    configured: connections.filter((connection) => connection.status === "pending_review").length,
    disabled: connections.filter((connection) => connection.status === "disabled").length,
    notConfigured: connections.filter((connection) => connection.status === "not_configured").length,
    readyForLivePhone: false,
    readyForLiveEmail: false
  };
}
