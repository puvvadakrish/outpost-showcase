import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import {
  acceptProviderIngressEvent,
  assertIngressDbAuthority,
  getIngressDbClient,
  resolveProviderIngressConnection,
  type IngressDbClient,
  type ProviderIngressConnection,
  type ProviderIngressReceipt
} from "@/server/ingress-db";
import { reportServerFailure } from "@/server/observability";
import {
  sanitizeResendEmailReceivedWebhook,
  sanitizeRetellCallEndedWebhook
} from "@/server/providers/ingress-sanitizers";
import { resolveProviderSecret } from "@/server/providers/secrets";
import {
  MAX_PROVIDER_WEBHOOK_BYTES,
  verifyResendWebhook,
  verifyRetellWebhook
} from "@/server/providers/webhook-signatures";

type ProviderKey = "retell" | "resend";
type SanitizedPayload = Record<string, unknown>;

export const MAX_PROVIDER_INGRESS_REQUEST_BYTES = MAX_PROVIDER_WEBHOOK_BYTES;

export interface ProviderIngressHandlerDependencies {
  getIngressDbClient(): IngressDbClient;
  assertIngressDbAuthority(client: IngressDbClient): Promise<string>;
  resolveProviderIngressConnection(
    client: IngressDbClient,
    ingressKey: string,
    providerKey: ProviderKey
  ): Promise<ProviderIngressConnection>;
  resolveProviderSecret(secretRef: string, env: Record<string, string | undefined>): string;
  verifyRetellWebhook: typeof verifyRetellWebhook;
  verifyResendWebhook: typeof verifyResendWebhook;
  sanitizeRetellCallEndedWebhook: typeof sanitizeRetellCallEndedWebhook;
  sanitizeResendEmailReceivedWebhook: typeof sanitizeResendEmailReceivedWebhook;
  acceptProviderIngressEvent(
    client: IngressDbClient,
    input: Parameters<typeof acceptProviderIngressEvent>[1]
  ): Promise<ProviderIngressReceipt>;
  reportServerFailure(operation: string, error: unknown): void;
  now(): Date;
}

const defaultDependencies: ProviderIngressHandlerDependencies = {
  getIngressDbClient,
  assertIngressDbAuthority,
  resolveProviderIngressConnection,
  resolveProviderSecret,
  verifyRetellWebhook,
  verifyResendWebhook,
  sanitizeRetellCallEndedWebhook,
  sanitizeResendEmailReceivedWebhook,
  acceptProviderIngressEvent,
  reportServerFailure,
  now: () => new Date()
};

interface HandleProviderIngressRequestInput {
  request: Request;
  providerKey: ProviderKey;
  env?: Record<string, string | undefined>;
  dependencies?: ProviderIngressHandlerDependencies;
}

class ProviderIngressRequestError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
    this.name = "ProviderIngressRequestError";
  }
}

export async function handleProviderIngressRequest({
  request,
  providerKey,
  env = process.env,
  dependencies = defaultDependencies
}: HandleProviderIngressRequestInput): Promise<Response> {
  const receivedAt = dependencies.now();
  if (
    env.VERCEL_ENV !== "preview" ||
    env.OUTPOST_PROVIDER_INGRESS_ROUTE_MODE !== "rehearsal"
  ) {
    return errorResponse(404, "not_found");
  }
  if (!isAuthorizedRehearsalRequest(request.headers, env)) {
    return errorResponse(401, "unauthorized");
  }
  const ingressKey = request.headers.get("x-outpost-ingress-key") ?? "";
  if (!isUuid(ingressKey)) {
    return errorResponse(400, "invalid_request");
  }
  if (!isJsonRequest(request.headers.get("content-type"))) {
    return errorResponse(415, "unsupported_media_type");
  }
  const contentEncoding = request.headers.get("content-encoding");
  if (contentEncoding && contentEncoding.toLowerCase() !== "identity") {
    return errorResponse(415, "unsupported_media_type");
  }

  let resendEventId: string | undefined;
  try {
    if (providerKey === "resend") {
      resendEventId = boundedProviderEventId(request.headers.get("svix-id"));
      assertBoundedHeader(request.headers.get("svix-signature"), 2048);
      assertBoundedHeader(request.headers.get("svix-timestamp"), 20);
    } else {
      assertBoundedHeader(request.headers.get("x-retell-signature"), 128);
    }
  } catch (error) {
    if (error instanceof ProviderIngressRequestError) {
      return errorResponse(error.status, error.code);
    }
    return errorResponse(400, "invalid_request");
  }

  let rawBody: string;
  try {
    rawBody = await readBoundedRawBody(request);
  } catch (error) {
    if (error instanceof ProviderIngressRequestError) {
      return errorResponse(error.status, error.code);
    }
    dependencies.reportServerFailure("provider.ingress.read", error);
    return errorResponse(503, "ingress_unavailable");
  }

  let client: IngressDbClient;
  try {
    client = dependencies.getIngressDbClient();
    await dependencies.assertIngressDbAuthority(client);
  } catch (error) {
    dependencies.reportServerFailure("provider.ingress.authority", error);
    return errorResponse(503, "ingress_unavailable");
  }

  let connection: ProviderIngressConnection;
  try {
    connection = await dependencies.resolveProviderIngressConnection(client, ingressKey, providerKey);
  } catch (error) {
    if (sqlState(error) === "55000") {
      return errorResponse(404, "not_found");
    }
    dependencies.reportServerFailure("provider.ingress.resolve", error);
    return errorResponse(503, "ingress_unavailable");
  }

  let signingSecret: string;
  try {
    signingSecret = dependencies.resolveProviderSecret(connection.secretRef, env);
  } catch (error) {
    dependencies.reportServerFailure("provider.ingress.secret", error);
    return errorResponse(503, "ingress_unavailable");
  }

  let sanitizedPayload: SanitizedPayload;
  let providerEventId: string;
  let eventType: "call_ended" | "email.received";
  try {
    if (providerKey === "retell") {
      dependencies.verifyRetellWebhook({
        rawBody,
        signature: request.headers.get("x-retell-signature"),
        signingSecret,
        nowMs: receivedAt.getTime()
      });
      const parsed: unknown = JSON.parse(rawBody);
      const sanitized = dependencies.sanitizeRetellCallEndedWebhook(parsed);
      sanitizedPayload = { ...sanitized };
      providerEventId = sanitized.call_id;
      eventType = "call_ended";
    } else {
      if (!resendEventId) {
        throw new ProviderIngressRequestError(400, "invalid_request");
      }
      const id = resendEventId;
      const verified = dependencies.verifyResendWebhook({
        rawBody,
        headers: {
          id,
          signature: request.headers.get("svix-signature"),
          timestamp: request.headers.get("svix-timestamp")
        },
        signingSecret,
        nowMs: receivedAt.getTime()
      });
      sanitizedPayload = { ...dependencies.sanitizeResendEmailReceivedWebhook(verified) };
      providerEventId = id;
      eventType = "email.received";
    }
  } catch (error) {
    if (error instanceof ProviderIngressRequestError) {
      return errorResponse(error.status, error.code);
    }
    return errorResponse(400, "invalid_request");
  }

  try {
    const receipt = await dependencies.acceptProviderIngressEvent(client, {
      ingressKey,
      providerKey,
      providerEventId,
      eventType,
      payloadDigest: createHash("sha256").update(rawBody, "utf8").digest("hex"),
      sanitizedPayload,
      receivedAt: receivedAt.toISOString()
    });
    return jsonResponse({ ok: true, replayed: receipt.replayed }, 200);
  } catch (error) {
    if (sqlState(error) === "OP001") {
      return errorResponse(409, "event_rejected");
    }
    if (sqlState(error) === "23505") {
      return errorResponse(409, "event_rejected");
    }
    dependencies.reportServerFailure("provider.ingress.accept", error);
    return errorResponse(503, "ingress_unavailable");
  }
}

async function readBoundedRawBody(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_PROVIDER_WEBHOOK_BYTES)) {
    throw new ProviderIngressRequestError(413, "payload_too_large");
  }
  if (!request.body) {
    throw new ProviderIngressRequestError(400, "invalid_request");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_PROVIDER_WEBHOOK_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new ProviderIngressRequestError(413, "payload_too_large");
    }
    chunks.push(value);
  }
  if (totalBytes === 0) {
    throw new ProviderIngressRequestError(400, "invalid_request");
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ProviderIngressRequestError(400, "invalid_request");
  }
}

function boundedProviderEventId(value: string | null) {
  if (!value || value.length > 200 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new ProviderIngressRequestError(400, "invalid_request");
  }
  return value;
}

function assertBoundedHeader(value: string | null, maxLength: number) {
  if (!value || value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new ProviderIngressRequestError(400, "invalid_request");
  }
}

function isJsonRequest(contentType: string | null) {
  return contentType?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function isAuthorizedRehearsalRequest(
  headers: Pick<Headers, "get">,
  env: Record<string, string | undefined>
) {
  const expected = env.OUTPOST_PROVIDER_INGRESS_REHEARSAL_TOKEN ?? "";
  const submitted = bearerToken(headers.get("authorization"));
  if (expected.length < 32 || submitted.length < 32 || submitted.length > 512) return false;
  return timingSafeEqual(
    createHash("sha256").update(submitted).digest(),
    createHash("sha256").update(expected).digest()
  );
}

function bearerToken(value: string | null) {
  if (!value) return "";
  const [scheme, token, extra] = value.trim().split(/\s+/u);
  return scheme?.toLowerCase() === "bearer" && token && !extra ? token : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function sqlState(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function errorResponse(status: number, error: string) {
  return jsonResponse({ ok: false, error }, status);
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" }
  });
}
