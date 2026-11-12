import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { Webhook } from "standardwebhooks";

export const PROVIDER_WEBHOOK_REPLAY_WINDOW_MS = 5 * 60 * 1000;
export const MAX_PROVIDER_WEBHOOK_BYTES = 1024 * 1024;

export class ProviderWebhookConfigurationError extends Error {
  constructor() {
    super("Provider webhook verification is unavailable.");
    this.name = "ProviderWebhookConfigurationError";
  }
}

export class ProviderWebhookVerificationError extends Error {
  constructor() {
    super("Provider webhook verification failed.");
    this.name = "ProviderWebhookVerificationError";
  }
}

interface VerifyRetellWebhookArgs {
  rawBody: string;
  signature: string | null | undefined;
  signingSecret: string;
  nowMs?: number;
}

export function verifyRetellWebhook({
  rawBody,
  signature,
  signingSecret,
  nowMs = Date.now()
}: VerifyRetellWebhookArgs) {
  assertConfiguredSecret(signingSecret);
  assertBoundedRawBody(rawBody);

  if (!signature || signature.length > 128) {
    throw new ProviderWebhookVerificationError();
  }
  const match = signature.match(/^v=(\d{10,16}),d=([a-f0-9]{64})$/i);
  if (!match) {
    throw new ProviderWebhookVerificationError();
  }

  const [, timestampText, submittedDigest] = match;
  const timestampMs = Number(timestampText);
  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(nowMs - timestampMs) > PROVIDER_WEBHOOK_REPLAY_WINDOW_MS
  ) {
    throw new ProviderWebhookVerificationError();
  }

  const expectedDigest = createHmac("sha256", signingSecret)
    .update(rawBody + timestampText, "utf8")
    .digest();
  const submitted = Buffer.from(submittedDigest, "hex");

  if (submitted.length !== expectedDigest.length || !timingSafeEqual(submitted, expectedDigest)) {
    throw new ProviderWebhookVerificationError();
  }
}

interface ResendWebhookHeaders {
  id: string | null | undefined;
  signature: string | null | undefined;
  timestamp: string | null | undefined;
}

interface VerifyResendWebhookArgs {
  rawBody: string;
  headers: ResendWebhookHeaders;
  signingSecret: string;
  nowMs?: number;
}

export function verifyResendWebhook({
  rawBody,
  headers,
  signingSecret,
  nowMs = Date.now()
}: VerifyResendWebhookArgs): unknown {
  assertConfiguredSecret(signingSecret);
  assertBoundedRawBody(rawBody);

  if (
    !boundedHeader(headers.id, 256) ||
    !boundedHeader(headers.signature, 2048) ||
    !boundedHeader(headers.timestamp, 20) ||
    !/^\d{10,16}$/.test(headers.timestamp)
  ) {
    throw new ProviderWebhookVerificationError();
  }

  const timestampMs = Number(headers.timestamp) * 1000;
  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(nowMs - timestampMs) > PROVIDER_WEBHOOK_REPLAY_WINDOW_MS
  ) {
    throw new ProviderWebhookVerificationError();
  }

  try {
    return new Webhook(signingSecret).verify(rawBody, {
      "webhook-id": headers.id,
      "webhook-signature": headers.signature,
      "webhook-timestamp": headers.timestamp
    });
  } catch {
    throw new ProviderWebhookVerificationError();
  }
}

function assertConfiguredSecret(signingSecret: string) {
  if (!signingSecret?.trim()) {
    throw new ProviderWebhookConfigurationError();
  }
}

function assertBoundedRawBody(rawBody: string) {
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_PROVIDER_WEBHOOK_BYTES) {
    throw new ProviderWebhookVerificationError();
  }
}

function boundedHeader(value: string | null | undefined, maxLength: number): value is string {
  return Boolean(value && value.length <= maxLength);
}
