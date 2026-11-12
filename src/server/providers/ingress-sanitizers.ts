import "server-only";

import type { ResendInboundEmailPayload } from "@/server/providers/resend/normalize";
import type { RetellCallEndedPayload } from "@/server/providers/retell/normalize";

type UnknownRecord = Record<string, unknown>;

const MAX_PROVIDER_ID_LENGTH = 200;
const MAX_CONTACT_LENGTH = 320;
const MAX_SUBJECT_LENGTH = 300;
const MAX_CALL_DURATION_MS = 24 * 60 * 60 * 1000;

export function sanitizeRetellCallEndedWebhook(payload: unknown): RetellCallEndedPayload {
  const event = requiredRecord(payload, "Retell webhook");
  if (event.event !== "call_ended") {
    throw new Error("Retell webhook event must be call_ended.");
  }

  const call = requiredRecord(event.call, "Retell webhook call");
  const startTimestamp = optionalTimestamp(call.start_timestamp, "start_timestamp");
  const endTimestamp = optionalTimestamp(call.end_timestamp, "end_timestamp");
  const durationMs = boundedDuration(startTimestamp, endTimestamp);

  return {
    event: "call_ended",
    agent_id: boundedRequiredString(call.agent_id, "agent_id", MAX_PROVIDER_ID_LENGTH),
    call_id: boundedRequiredString(call.call_id, "call_id", MAX_PROVIDER_ID_LENGTH),
    start_timestamp: startTimestamp,
    end_timestamp: endTimestamp,
    transcript_present: nonEmptyString(call.transcript),
    duration_ms: durationMs,
    caller_phone: boundedOptionalString(call.from_number, MAX_CONTACT_LENGTH),
    caller_name: null,
    call_summary: null,
    intent: null,
    recommended_next_step: null,
    confidence: null
  };
}

export function sanitizeResendEmailReceivedWebhook(payload: unknown): ResendInboundEmailPayload {
  const event = requiredRecord(payload, "Resend webhook");
  if (event.type !== "email.received") {
    throw new Error("Resend webhook event must be email.received.");
  }

  const data = requiredRecord(event.data, "Resend webhook data");
  const receivedAt = optionalIsoString(data.created_at ?? event.created_at, "created_at");

  return {
    event: "email.received",
    message_id: boundedRequiredString(data.email_id, "email_id", MAX_PROVIDER_ID_LENGTH),
    received_at: receivedAt,
    from_label: null,
    from_email: boundedOptionalString(data.from, MAX_CONTACT_LENGTH),
    subject: boundedOptionalString(data.subject, MAX_SUBJECT_LENGTH),
    body_available: false,
    mailbox_label: firstBoundedString(data.to, MAX_CONTACT_LENGTH),
    suggested_intent: null,
    suggested_next_step: null,
    confidence: null
  };
}

function requiredRecord(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as UnknownRecord;
}

function boundedRequiredString(value: unknown, field: string, maxLength: number) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > maxLength ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error(`${field} must be a bounded non-empty string.`);
  }
  return value.trim();
}

function boundedOptionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length > maxLength || value.includes("\u0000")) {
    throw new Error("Provider metadata string is invalid.");
  }
  return value.replace(/[\u0001-\u001f\u007f\s]+/g, " ").trim() || null;
}

function firstBoundedString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error("Provider metadata list is invalid.");
  }
  return boundedOptionalString(value[0], maxLength);
}

function optionalTimestamp(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${field} must be a non-negative integer timestamp.`);
  }
  return value as number;
}

function optionalIsoString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.length > 64 || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be a bounded ISO timestamp.`);
  }
  return new Date(value).toISOString();
}

function boundedDuration(startTimestamp?: number, endTimestamp?: number) {
  if (startTimestamp === undefined || endTimestamp === undefined) {
    return undefined;
  }
  if (endTimestamp < startTimestamp) {
    throw new Error("Retell call timestamps are invalid.");
  }
  const duration = endTimestamp - startTimestamp;
  if (duration > MAX_CALL_DURATION_MS) {
    throw new Error("Retell call duration exceeds the supported bound.");
  }
  return duration;
}

function nonEmptyString(value: unknown) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value !== "string") {
    throw new Error("Retell transcript presence is invalid.");
  }
  return Boolean(value.trim());
}
