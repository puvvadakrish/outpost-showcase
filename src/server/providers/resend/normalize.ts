import type { ChannelEvent, Conversation } from "@/domain/channels";
import { normalizeTaskConfidence, type Task } from "@/domain/tasks";
import type {
  NormalizedProviderEvent,
  NormalizedUsageEvent,
  ProviderTenantContext
} from "@/server/providers/normalized";
import { digestJson, periodKey, stableProviderId } from "@/server/providers/stable";

type UnknownRecord = Record<string, unknown>;

export interface ResendInboundEmailPayload {
  event?: "email.received";
  message_id: string;
  received_at?: string;
  from_label?: string | null;
  from_email?: string | null;
  subject?: string | null;
  text_body?: string | null;
  html_body?: string | null;
  body_available?: boolean;
  mailbox_label?: string | null;
  suggested_intent?: string | null;
  suggested_next_step?: string | null;
  confidence?: number | null;
}

export interface NormalizeResendInboundEmailArgs {
  payload: unknown;
  context: ProviderTenantContext;
  payloadRef?: string;
  receivedAt?: string;
}

export function normalizeResendInboundEmail({
  payload,
  context,
  payloadRef,
  receivedAt = new Date().toISOString()
}: NormalizeResendInboundEmailArgs): NormalizedProviderEvent {
  const parsedPayload = parseResendInboundEmailPayload(payload);
  const occurredAt = parsedPayload.received_at ?? receivedAt;
  const conversationId = stableProviderId(
    "conv_resend",
    `${context.tenantId}:${context.providerConnectionId}:${parsedPayload.message_id}`
  );
  const channelEventId = stableProviderId(
    "evt_resend",
    `${context.tenantId}:${context.providerConnectionId}:${parsedPayload.message_id}:email.received`
  );
  const taskId = stableProviderId(
    "task_resend",
    `${context.tenantId}:${context.providerConnectionId}:${parsedPayload.message_id}:staff_follow_up`
  );
  const hasBody =
    parsedPayload.body_available ??
    Boolean(parsedPayload.text_body?.trim() || parsedPayload.html_body?.trim());
  const hasSubject = Boolean(parsedPayload.subject?.trim());

  const conversation: Conversation = {
    id: conversationId,
    tenantId: context.tenantId,
    locationId: context.locationId,
    channel: "email",
    providerConnectionId: context.providerConnectionId,
    externalConversationId: parsedPayload.message_id,
    requesterLabel: requesterLabel(parsedPayload),
    status: "needs_human",
    startedAt: occurredAt,
    lastEventAt: occurredAt
  };

  const channelEvent: ChannelEvent = {
    id: channelEventId,
    tenantId: context.tenantId,
    locationId: context.locationId,
    providerConnectionId: context.providerConnectionId,
    conversationId,
    channel: "email",
    providerEventId: `${parsedPayload.message_id}:email.received`,
    eventType: "resend.email_received",
    payloadDigest: digestJson(parsedPayload),
    payloadRef,
    processingStatus: "normalized",
    receivedAt
  };

  const proposedTask: Task = {
    id: taskId,
    tenantId: context.tenantId,
    locationId: context.locationId,
    channel: "email",
    requesterName: parsedPayload.from_label?.trim() || "Email sender",
    requesterContact: parsedPayload.from_email?.trim() || parsedPayload.message_id,
    intent: parsedPayload.suggested_intent?.trim() || "email_follow_up",
    summary: taskSummary(parsedPayload, hasBody, hasSubject),
    confidence: normalizeTaskConfidence(
      typeof parsedPayload.confidence === "number" ? parsedPayload.confidence : hasBody ? 0.65 : 0.3
    ),
    suggestedNextStep:
      parsedPayload.suggested_next_step?.trim() ||
      "Review the inbound email and decide the staff follow-up before any reply is sent.",
    status: "needs_human",
    createdAt: receivedAt,
    updatedAt: receivedAt
  };

  const usageEvents: NormalizedUsageEvent[] = [
    {
      id: stableProviderId(
        "usage_resend",
        `${context.tenantId}:${context.providerConnectionId}:${parsedPayload.message_id}:email_received`
      ),
      tenantId: context.tenantId,
      locationId: context.locationId,
      meter: "email_received",
      quantity: 1,
      sourceType: "channel_event",
      sourceId: channelEventId,
      periodKey: periodKey(occurredAt),
      occurredAt
    },
    {
      id: stableProviderId(
        "usage_resend",
        `${context.tenantId}:${context.providerConnectionId}:${parsedPayload.message_id}:task_created`
      ),
      tenantId: context.tenantId,
      locationId: context.locationId,
      meter: "task_created",
      quantity: 1,
      sourceType: "task",
      sourceId: taskId,
      periodKey: periodKey(receivedAt),
      occurredAt: receivedAt
    }
  ];

  return {
    providerKey: "resend",
    conversation,
    channelEvent,
    proposedTask,
    usageEvents,
    warnings: hasBody ? [] : ["resend_email_received_missing_body"]
  };
}

function parseResendInboundEmailPayload(payload: unknown): ResendInboundEmailPayload {
  if (!isRecord(payload)) {
    throw new Error("Resend inbound email payload must be an object.");
  }

  const event = payload.event;
  if (event !== undefined && event !== "email.received") {
    throw new Error("Resend payload event must be email.received.");
  }

  return {
    event: event as "email.received" | undefined,
    message_id: requiredString(payload.message_id, "message_id"),
    received_at: optionalIsoString(payload.received_at, "received_at"),
    from_label: optionalStringOrNull(payload.from_label, "from_label"),
    from_email: optionalStringOrNull(payload.from_email, "from_email"),
    subject: optionalStringOrNull(payload.subject, "subject"),
    text_body: optionalStringOrNull(payload.text_body, "text_body"),
    html_body: optionalStringOrNull(payload.html_body, "html_body"),
    body_available: optionalBoolean(payload.body_available, "body_available"),
    mailbox_label: optionalStringOrNull(payload.mailbox_label, "mailbox_label"),
    suggested_intent: optionalStringOrNull(payload.suggested_intent, "suggested_intent"),
    suggested_next_step: optionalStringOrNull(payload.suggested_next_step, "suggested_next_step"),
    confidence: optionalNonNegativeNumber(payload.confidence, "confidence")
  };
}

function taskSummary(payload: ResendInboundEmailPayload, hasBody: boolean, hasSubject: boolean) {
  const subject = payload.subject?.trim();

  if (hasSubject && hasBody) {
    return `Inbound email needs review: ${subject}`;
  }

  if (hasSubject) {
    return `Inbound email has a subject but no usable body: ${subject}`;
  }

  return "Inbound email needs staff review before any reply or notification is sent.";
}

function requesterLabel(payload: ResendInboundEmailPayload) {
  return payload.from_label?.trim() || payload.from_email?.trim() || "Email sender";
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Resend inbound email payload requires ${fieldName}.`);
  }

  return value;
}

function optionalStringOrNull(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return value as undefined | null;
  }

  if (typeof value !== "string") {
    throw new Error(`Resend inbound email payload ${fieldName} must be a string or null.`);
  }

  return value;
}

function optionalIsoString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`Resend inbound email payload ${fieldName} must be an ISO timestamp.`);
  }

  return new Date(value).toISOString();
}

function optionalNonNegativeNumber(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return value as undefined | null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Resend inbound email payload ${fieldName} must be a non-negative number.`);
  }

  return value;
}

function optionalBoolean(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`Resend inbound email payload ${fieldName} must be a boolean.`);
  }

  return value;
}
