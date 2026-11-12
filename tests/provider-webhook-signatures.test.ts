import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_PROVIDER_WEBHOOK_BYTES,
  ProviderWebhookConfigurationError,
  ProviderWebhookVerificationError,
  verifyResendWebhook,
  verifyRetellWebhook
} from "@/server/providers/webhook-signatures";

const NOW_MS = 1_800_000_000_000;
const RAW_BODY = '{ "event": "call_ended", "id": "provider-event-1" }';

function retellSignature(rawBody: string, secret: string, timestampMs = NOW_MS) {
  const timestamp = String(timestampMs);
  const digest = createHmac("sha256", secret)
    .update(rawBody + timestamp, "utf8")
    .digest("hex");
  return `v=${timestamp},d=${digest}`;
}

function resendFixture(rawBody = RAW_BODY, timestampMs = NOW_MS) {
  const secretBytes = Buffer.from("outpost-resend-webhook-test-key-32");
  const signingSecret = `whsec_${secretBytes.toString("base64")}`;
  const id = "msg_provider_event_1";
  const timestamp = String(Math.floor(timestampMs / 1000));
  const signature = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${rawBody}`, "utf8")
    .digest("base64");

  return {
    rawBody,
    signingSecret,
    headers: { id, timestamp, signature: `v1,${signature}` }
  };
}

describe("provider webhook signatures", () => {
  it("verifies an exact Retell raw body within the replay window", () => {
    const signingSecret = "retell-webhook-test-secret";
    const signature = retellSignature(RAW_BODY, signingSecret);

    expect(() =>
      verifyRetellWebhook({ rawBody: RAW_BODY, signature, signingSecret, nowMs: NOW_MS })
    ).not.toThrow();
  });

  it.each([
    ["tampered body", RAW_BODY + " ", NOW_MS],
    ["stale timestamp", RAW_BODY, NOW_MS - 300_001],
    ["future timestamp", RAW_BODY, NOW_MS + 300_001]
  ])("rejects a Retell %s", (_label, rawBody, timestampMs) => {
    const signingSecret = "retell-webhook-test-secret";
    const signature = retellSignature(RAW_BODY, signingSecret, timestampMs);

    expect(() =>
      verifyRetellWebhook({ rawBody, signature, signingSecret, nowMs: NOW_MS })
    ).toThrow(ProviderWebhookVerificationError);
  });

  it.each([null, "", "v=not-a-time,d=nope", "v=1800000000000,d=00"])(
    "rejects a malformed Retell signature: %s",
    (signature) => {
      expect(() =>
        verifyRetellWebhook({
          rawBody: RAW_BODY,
          signature,
          signingSecret: "retell-webhook-test-secret",
          nowMs: NOW_MS
        })
      ).toThrow(ProviderWebhookVerificationError);
    }
  );

  it("verifies Resend through the official SDK without reserializing the body", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    const fixture = resendFixture();

    expect(verifyResendWebhook({ ...fixture, nowMs: NOW_MS })).toEqual({
      event: "call_ended",
      id: "provider-event-1"
    });
    expect(() =>
      verifyResendWebhook({
        ...fixture,
        rawBody: JSON.stringify(JSON.parse(fixture.rawBody)),
        nowMs: NOW_MS
      })
    ).toThrow(ProviderWebhookVerificationError);
    vi.useRealTimers();
  });

  it.each([-301_000, 301_000])("rejects a Resend timestamp offset of %i ms", (offset) => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    const fixture = resendFixture(RAW_BODY, NOW_MS + offset);

    expect(() => verifyResendWebhook({ ...fixture, nowMs: NOW_MS })).toThrow(
      ProviderWebhookVerificationError
    );
    vi.useRealTimers();
  });

  it("rejects missing Resend headers and oversized input with generic errors", () => {
    const fixture = resendFixture();

    expect(() =>
      verifyResendWebhook({ ...fixture, headers: { ...fixture.headers, id: null }, nowMs: NOW_MS })
    ).toThrow("Provider webhook verification failed.");
    expect(() =>
      verifyRetellWebhook({
        rawBody: "x".repeat(MAX_PROVIDER_WEBHOOK_BYTES + 1),
        signature: retellSignature(RAW_BODY, "retell-webhook-test-secret"),
        signingSecret: "retell-webhook-test-secret",
        nowMs: NOW_MS
      })
    ).toThrow("Provider webhook verification failed.");
  });

  it("distinguishes unavailable secret configuration without disclosing inputs", () => {
    const action = () =>
      verifyRetellWebhook({
        rawBody: RAW_BODY,
        signature: retellSignature(RAW_BODY, "unused"),
        signingSecret: "",
        nowMs: NOW_MS
      });

    expect(action).toThrow(ProviderWebhookConfigurationError);
    expect(action).toThrow("Provider webhook verification is unavailable.");
  });
});
