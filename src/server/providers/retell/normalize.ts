import type { ChannelEvent, Conversation } from "@/domain/channels";
import { normalizeTaskConfidence, type Task } from "@/domain/tasks";
import type {
  NormalizedProviderEvent,
  NormalizedUsageEvent,
  ProviderTenantContext
} from "@/server/providers/normalized";
import { digestJson, periodKey, stableProviderId } from "@/server/providers/stable";

export interface RetellCallEndedPayload {
  event?: "call_ended";
  agent_id: string;
  call_id: string;
  start_timestamp?: number;
  end_timestamp?: number;
  transcript?: string | null;
  transcript_present?: boolean;
  duration_ms?: number;
  inbound_minutes?: number | null;
  outbound_transfer_minutes?: number | null;
  caller_name?: string | null;
  caller_phone?: string | null;
  call_summary?: string | null;
  intent?: string | null;
  recommended_next_step?: string | null;
  confidence?: number | null;
}

export interface NormalizeRetellCallEndedArgs {
  payload: unknown;
  context: ProviderTenantContext;
  payloadRef?: string;
  receivedAt?: string;
}

export function normalizeRetellCallEnded({
  payload,
  context,
  payloadRef,
  receivedAt = new Date().toISOString()
}: NormalizeRetellCallEndedArgs): NormalizedProviderEvent {
  const parsedPayload = parseRetellCallEndedPayload(payload);
  const startedAt = timestampToIso(parsedPayload.start_timestamp) ?? receivedAt;
  const endedAt = timestampToIso(parsedPayload.end_timestamp) ?? receivedAt;
  const payloadDigest = digestJson(parsedPayload);
  const conversationId = stableProviderId(
    "conv_retell",
    `${context.tenantId}:${context.providerConnectionId}:${parsedPayload.call_id}`
  );
  const channelEventId = stableProviderId(
    "evt_retell",
    `${context.tenantId}:${context.providerConnectionId}:${parsedPayload.call_id}:call_ended`
  );
  const taskId = stableProviderId(
    "task_retell",
    `${context.tenantId}:${context.providerConnectionId}:${parsedPayload.call_id}:staff_follow_up`
  );
  const hasTranscript =
    parsedPayload.transcript_present ?? Boolean(parsedPayload.transcript?.trim());
  const durationSeconds =
    parsedPayload.duration_ms === undefined ? 0 : Math.round(parsedPayload.duration_ms / 1000);

  const conversation: Conversation = {
    id: conversationId,
    tenantId: context.tenantId,
    locationId: context.locationId,
    channel: "phone",
    providerConnectionId: context.providerConnectionId,
    externalConversationId: parsedPayload.call_id,
    requesterLabel: requesterLabel(parsedPayload),
    status: "needs_human",
    startedAt,
    lastEventAt: endedAt
  };

  const channelEvent: ChannelEvent = {
    id: channelEventId,
    tenantId: context.tenantId,
    locationId: context.locationId,
    providerConnectionId: context.providerConnectionId,
    conversationId,
    channel: "phone",
    providerEventId: `${parsedPayload.call_id}:call_ended`,
    eventType: "retell.call_ended",
    payloadDigest,
    payloadRef,
    processingStatus: "normalized",
    receivedAt
  };

  const proposedTask: Task = {
    id: taskId,
    tenantId: context.tenantId,
    locationId: context.locationId,
    channel: "phone",
    requesterName: parsedPayload.caller_name?.trim() || "Phone caller",
    requesterContact: parsedPayload.caller_phone?.trim() || parsedPayload.call_id,
    intent: parsedPayload.intent?.trim() || "phone_call_follow_up",
    summary: taskSummary(parsedPayload, hasTranscript),
    confidence: normalizeTaskConfidence(
      typeof parsedPayload.confidence === "number" ? parsedPayload.confidence : hasTranscript ? 0.7 : 0.35
    ),
    suggestedNextStep:
      parsedPayload.recommended_next_step?.trim() ||
      (hasTranscript
        ? "Review the Retell call summary and decide the staff follow-up."
        : "Open the Retell call record and review why no transcript was captured."),
    status: "needs_human",
    createdAt: receivedAt,
    updatedAt: receivedAt
  };

  const usageEvents: NormalizedUsageEvent[] = [
    {
      id: stableProviderId(
        "usage_retell",
        `${context.tenantId}:${context.providerConnectionId}:${parsedPayload.call_id}:call_completed`
      ),
      tenantId: context.tenantId,
      locationId: context.locationId,
      meter: "call_completed",
      quantity: 1,
      sourceType: "channel_event",
      sourceId: channelEventId,
      periodKey: periodKey(endedAt),
      occurredAt: endedAt
    },
    {
      id: stableProviderId(
        "usage_retell",
        `${context.tenantId}:${context.providerConnectionId}:${parsedPayload.call_id}:task_created`
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

  if (durationSeconds > 0) {
    usageEvents.push({
      id: stableProviderId(
        "usage_retell",
        `${context.tenantId}:${context.providerConnectionId}:${parsedPayload.call_id}:voice_seconds`
      ),
      tenantId: context.tenantId,
      locationId: context.locationId,
      meter: "voice_seconds",
      quantity: durationSeconds,
      sourceType: "conversation",
      sourceId: conversationId,
      periodKey: periodKey(endedAt),
      occurredAt: endedAt
    });
  }

  return {
    providerKey: "retell",
    conversation,
    channelEvent,
    proposedTask,
    usageEvents,
    warnings: hasTranscript ? [] : ["retell_call_ended_missing_transcript"]
  };
}

function parseRetellCallEndedPayload(payload: unknown): RetellCallEndedPayload {
  if (!isRecord(payload)) {
    throw new Error("Retell call_ended payload must be an object.");
  }

  const event = payload.event;
  if (event !== undefined && event !== "call_ended") {
    throw new Error("Retell payload event must be call_ended.");
  }

  const agentId = requiredString(payload.agent_id, "agent_id");
  const callId = requiredString(payload.call_id, "call_id");

  return {
    event: event as "call_ended" | undefined,
    agent_id: agentId,
    call_id: callId,
    start_timestamp: optionalNonNegativeInteger(payload.start_timestamp, "start_timestamp"),
    end_timestamp: optionalNonNegativeInteger(payload.end_timestamp, "end_timestamp"),
    transcript: optionalStringOrNull(payload.transcript, "transcript"),
    transcript_present: optionalBoolean(payload.transcript_present, "transcript_present"),
    duration_ms: optionalNonNegativeInteger(payload.duration_ms, "duration_ms"),
    inbound_minutes: optionalNonNegativeNumber(payload.inbound_minutes, "inbound_minutes"),
    outbound_transfer_minutes: optionalNonNegativeNumber(
      payload.outbound_transfer_minutes,
      "outbound_transfer_minutes"
    ),
    caller_name: optionalStringOrNull(payload.caller_name, "caller_name"),
    caller_phone: optionalStringOrNull(payload.caller_phone, "caller_phone"),
    call_summary: optionalStringOrNull(payload.call_summary, "call_summary"),
    intent: optionalStringOrNull(payload.intent, "intent"),
    recommended_next_step: optionalStringOrNull(
      payload.recommended_next_step,
      "recommended_next_step"
    ),
    confidence: optionalNonNegativeNumber(payload.confidence, "confidence")
  };
}

function taskSummary(payload: RetellCallEndedPayload, hasTranscript: boolean) {
  const summary = payload.call_summary?.trim();
  if (summary) {
    return summary;
  }

  if (!hasTranscript) {
    return "Retell call ended without an available transcript; staff should review the provider record.";
  }

  return "Retell call ended with a transcript available in the provider record; staff should review follow-up.";
}

function requesterLabel(payload: RetellCallEndedPayload) {
  return payload.caller_name?.trim() || payload.caller_phone?.trim() || "Phone caller";
}

function timestampToIso(timestamp: number | undefined) {
  if (timestamp === undefined) {
    return undefined;
  }

  return new Date(timestamp).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Retell call_ended payload requires ${fieldName}.`);
  }

  return value;
}

function optionalStringOrNull(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return value as undefined | null;
  }

  if (typeof value !== "string") {
    throw new Error(`Retell call_ended payload ${fieldName} must be a string or null.`);
  }

  return value;
}

function optionalNonNegativeInteger(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`Retell call_ended payload ${fieldName} must be a non-negative integer.`);
  }

  return value as number;
}

function optionalNonNegativeNumber(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return value as undefined | null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Retell call_ended payload ${fieldName} must be a non-negative number.`);
  }

  return value;
}

function optionalBoolean(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`Retell call_ended payload ${fieldName} must be a boolean.`);
  }

  return value;
}
