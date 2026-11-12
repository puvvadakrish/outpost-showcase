import { normalizeResendInboundEmail } from "@/server/providers/resend/normalize";
import { normalizeRetellCallEnded } from "@/server/providers/retell/normalize";
import type { NormalizedProviderEvent, ProviderTenantContext } from "@/server/providers/normalized";
import { persistNormalizedProviderEvent } from "@/server/providers/persistence";
import type { JobHandler, JobHandlerContext, JobHandlerResult, JobRow } from "@/server/jobs/types";

export const RETELL_CALL_ENDED_NORMALIZATION_JOB = "provider.retell.call_ended.normalize";
export const RESEND_EMAIL_RECEIVED_NORMALIZATION_JOB = "provider.resend.email_received.normalize";

export const handleRetellCallEndedNormalizationJob: JobHandler = async (job, context) => {
  const args = parseProviderNormalizationPayload(job, RETELL_CALL_ENDED_NORMALIZATION_JOB);
  return jobResult(
    normalizeRetellCallEnded({
      payload: args.providerPayload,
      context: args.context,
      payloadRef: args.payloadRef,
      receivedAt: args.receivedAt
    }),
    job,
    context
  );
};

export const handleResendEmailReceivedNormalizationJob: JobHandler = async (job, context) => {
  const args = parseProviderNormalizationPayload(job, RESEND_EMAIL_RECEIVED_NORMALIZATION_JOB);
  return jobResult(
    normalizeResendInboundEmail({
      payload: args.providerPayload,
      context: args.context,
      payloadRef: args.payloadRef,
      receivedAt: args.receivedAt
    }),
    job,
    context
  );
};

function parseProviderNormalizationPayload(job: JobRow, kind: string) {
  if (job.payload_version !== 1) {
    throw new Error(`${kind} only supports payload_version 1.`);
  }

  const context = parseContext(job);
  const providerPayload = job.payload.provider_payload;

  if (providerPayload === undefined) {
    throw new Error(`${kind} requires provider_payload.`);
  }

  const payloadRef = optionalString(job.payload.payload_ref, "payload_ref");
  const receivedAt = optionalIsoString(job.payload.received_at, "received_at");

  return {
    context,
    providerPayload,
    payloadRef,
    receivedAt
  };
}

function parseContext(job: JobRow): ProviderTenantContext {
  const rawContext = job.payload.context;
  if (!isRecord(rawContext)) {
    throw new Error(`${job.kind} requires context.`);
  }

  const tenantId = requiredString(rawContext.tenant_id, "context.tenant_id");
  if (job.tenant_id && job.tenant_id !== tenantId) {
    throw new Error(`${job.kind} tenant_id does not match context.tenant_id.`);
  }

  return {
    tenantId,
    locationId: requiredString(rawContext.location_id, "context.location_id"),
    providerConnectionId: requiredString(
      rawContext.provider_connection_id,
      "context.provider_connection_id"
    )
  };
}

async function jobResult(
  event: NormalizedProviderEvent,
  job: JobRow,
  context?: JobHandlerContext
): Promise<JobHandlerResult> {
  const persisted = context?.db
    ? await persistNormalizedProviderEvent(context.db, event, {
        jobId: job.id,
        workerId: context.workerId ?? ""
      })
    : undefined;

  return {
    ok: true,
    message: `${event.providerKey} provider payload normalized for human review.`,
    details: {
      providerKey: event.providerKey,
      conversationId: event.conversation.id,
      channelEventId: event.channelEvent.id,
      proposedTaskId: event.proposedTask?.id,
      persisted,
      usageEventMeters: event.usageEvents.map((usageEvent) => usageEvent.meter),
      warnings: event.warnings
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} required.`);
  }

  return value;
}

function optionalString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string when present.`);
  }

  return value;
}

function optionalIsoString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${fieldName} must be an ISO timestamp when present.`);
  }

  return new Date(value).toISOString();
}
