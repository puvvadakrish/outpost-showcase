import { createHash, createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  handleProviderIngressRequest,
  MAX_PROVIDER_INGRESS_REQUEST_BYTES,
  type ProviderIngressHandlerDependencies
} from "@/server/providers/ingress-handler";
import { sanitizeRetellCallEndedWebhook } from "@/server/providers/ingress-sanitizers";
import { verifyRetellWebhook } from "@/server/providers/webhook-signatures";

const INGRESS_KEY = "d4ac846d-1886-4ea6-a842-2d2f727d10d8";
const RECEIVED_AT = "2026-07-13T16:00:00.000Z";
const REHEARSAL_TOKEN = "fixture-rehearsal-token-at-least-32-bytes";
const REHEARSAL_ENV = {
  VERCEL_ENV: "preview",
  OUTPOST_PROVIDER_INGRESS_ROUTE_MODE: "rehearsal",
  OUTPOST_PROVIDER_INGRESS_REHEARSAL_TOKEN: REHEARSAL_TOKEN
};
const retellRoute = readFileSync(
  "src/app/api/internal/provider-ingress/rehearsal/retell/route.ts",
  "utf8"
);
const resendRoute = readFileSync(
  "src/app/api/internal/provider-ingress/rehearsal/resend/route.ts",
  "utf8"
);

function dependencies(
  overrides: Partial<ProviderIngressHandlerDependencies> = {}
): ProviderIngressHandlerDependencies {
  return {
    getIngressDbClient: vi.fn(() => ({ query: vi.fn() })),
    assertIngressDbAuthority: vi.fn(async () => "outpost_ingress_preview_v1"),
    resolveProviderIngressConnection: vi.fn(async () => ({
      tenantId: "tenant_preview",
      locationId: "location_preview",
      providerConnectionId: "provider_preview",
      providerKey: "resend" as const,
      channel: "email" as const,
      secretRef: "outpost-secret://provider/provider_preview/webhook-signing/v1"
    })),
    resolveProviderSecret: vi.fn(() => "fixture-signing-secret"),
    verifyRetellWebhook: vi.fn(),
    verifyResendWebhook: vi.fn(() => ({
      type: "email.received",
      data: { email_id: "email_123", from: "member@example.test" }
    })),
    sanitizeRetellCallEndedWebhook: vi.fn(),
    sanitizeResendEmailReceivedWebhook: vi.fn(() => ({
      event: "email.received" as const,
      message_id: "email_123",
      body_available: false
    })),
    acceptProviderIngressEvent: vi.fn(async () => ({
      receiptId: "provider_receipt_1",
      jobId: "job_1",
      pauseGeneration: 2,
      replayed: false
    })),
    reportServerFailure: vi.fn(),
    now: () => new Date(RECEIVED_AT),
    ...overrides
  };
}

function request(rawBody: string, headers: Record<string, string> = {}) {
  return new Request("https://preview.example.test/api/internal/provider-ingress/rehearsal/resend", {
    method: "POST",
    headers: {
      authorization: `Bearer ${REHEARSAL_TOKEN}`,
      "content-type": "application/json",
      "svix-id": "svix_delivery_123",
      "svix-signature": "v1,fixture",
      "svix-timestamp": "1783958400",
      "x-outpost-ingress-key": INGRESS_KEY,
      ...headers
    },
    body: rawBody
  });
}

describe("provider ingress routes", () => {
  it("exposes only internal rehearsal wrappers with no provider-callable route shape", () => {
    expect(retellRoute).toContain('providerKey: "retell"');
    expect(resendRoute).toContain('providerKey: "resend"');
    expect(retellRoute).toContain('runtime = "nodejs"');
    expect(resendRoute).toContain('runtime = "nodejs"');
    expect(existsSync("src/app/api/provider-ingress/retell/[ingressKey]/route.ts")).toBe(false);
    expect(existsSync("src/app/api/provider-ingress/resend/[ingressKey]/route.ts")).toBe(false);
  });

  it("fails closed before reading authority when rehearsal routing is not explicitly enabled", async () => {
    const deps = dependencies();
    const response = await handleProviderIngressRequest({
      request: request("{}"),
      providerKey: "resend",
      env: {},
      dependencies: deps
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "not_found" });
    expect(deps.getIngressDbClient).not.toHaveBeenCalled();
  });

  it("refuses production and missing dedicated rehearsal authorization before body or database access", async () => {
    const deps = dependencies();
    const productionRequest = request("{}");
    const production = await handleProviderIngressRequest({
      request: productionRequest,
      providerKey: "resend",
      env: { ...REHEARSAL_ENV, VERCEL_ENV: "production" },
      dependencies: deps
    });
    const unauthorizedRequest = request("{}", {
      authorization: "Bearer wrong-token-that-is-still-long-enough-123"
    });
    const unauthorized = await handleProviderIngressRequest({
      request: unauthorizedRequest,
      providerKey: "resend",
      env: REHEARSAL_ENV,
      dependencies: deps
    });

    expect(production.status).toBe(404);
    expect(unauthorized.status).toBe(401);
    expect(productionRequest.bodyUsed).toBe(false);
    expect(unauthorizedRequest.bodyUsed).toBe(false);
    expect(deps.getIngressDbClient).not.toHaveBeenCalled();
  });

  it("rejects malformed routing and media type before database access", async () => {
    const deps = dependencies();
    const malformedKey = await handleProviderIngressRequest({
      request: request("{}", { "x-outpost-ingress-key": "provider_preview" }),
      providerKey: "resend",
      env: REHEARSAL_ENV,
      dependencies: deps
    });
    const wrongMedia = await handleProviderIngressRequest({
      request: new Request("https://preview.example.test/api/internal/provider-ingress/rehearsal/resend", {
        method: "POST",
        headers: {
          authorization: `Bearer ${REHEARSAL_TOKEN}`,
          "content-type": "text/plain",
          "svix-id": "svix_delivery_123",
          "svix-signature": "v1,fixture",
          "svix-timestamp": "1783958400",
          "x-outpost-ingress-key": INGRESS_KEY
        },
        body: "{}"
      }),
      providerKey: "resend",
      env: REHEARSAL_ENV,
      dependencies: deps
    });
    const compressed = await handleProviderIngressRequest({
      request: request("{}", { "content-encoding": "gzip" }),
      providerKey: "resend",
      env: REHEARSAL_ENV,
      dependencies: deps
    });

    expect(malformedKey.status).toBe(400);
    expect(wrongMedia.status).toBe(415);
    expect(compressed.status).toBe(415);
    expect(deps.getIngressDbClient).not.toHaveBeenCalled();
  });

  it("bounds streamed raw input before connection resolution", async () => {
    const deps = dependencies();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_PROVIDER_INGRESS_REQUEST_BYTES));
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      }
    });
    const response = await handleProviderIngressRequest({
      request: new Request("https://preview.example.test/api/internal/provider-ingress/rehearsal/resend", {
        method: "POST",
        headers: {
          authorization: `Bearer ${REHEARSAL_TOKEN}`,
          "content-type": "application/json",
          "svix-id": "svix_delivery_123",
          "svix-signature": "v1,fixture",
          "svix-timestamp": "1783958400",
          "x-outpost-ingress-key": INGRESS_KEY
        },
        body,
        // Node's Request requires duplex for a streaming request body.
        duplex: "half"
      } as RequestInit & { duplex: "half" }),
      providerKey: "resend",
      env: REHEARSAL_ENV,
      dependencies: deps
    });

    expect(response.status).toBe(413);
    expect(deps.resolveProviderIngressConnection).not.toHaveBeenCalled();
  });

  it("rejects declared oversize, empty, and invalid UTF-8 bodies before authority resolution", async () => {
    const deps = dependencies();
    const declaredOversize = await handleProviderIngressRequest({
      request: request("{}", {
        "content-length": String(MAX_PROVIDER_INGRESS_REQUEST_BYTES + 1)
      }),
      providerKey: "resend",
      env: REHEARSAL_ENV,
      dependencies: deps
    });
    const empty = await handleProviderIngressRequest({
      request: request(""),
      providerKey: "resend",
      env: REHEARSAL_ENV,
      dependencies: deps
    });
    const invalidUtf8 = await handleProviderIngressRequest({
      request: new Request("https://preview.example.test/api/internal/provider-ingress/rehearsal/resend", {
        method: "POST",
        headers: {
          authorization: `Bearer ${REHEARSAL_TOKEN}`,
          "content-type": "application/json",
          "svix-id": "svix_delivery_123",
          "svix-signature": "v1,fixture",
          "svix-timestamp": "1783958400",
          "x-outpost-ingress-key": INGRESS_KEY
        },
        body: new Uint8Array([0xc3, 0x28])
      }),
      providerKey: "resend",
      env: REHEARSAL_ENV,
      dependencies: deps
    });

    expect(declaredOversize.status).toBe(413);
    expect(empty.status).toBe(400);
    expect(invalidUtf8.status).toBe(400);
    expect(deps.getIngressDbClient).not.toHaveBeenCalled();
  });

  it("verifies Resend raw bytes before sanitizing and atomically accepts provider-native identity", async () => {
    const rawBody = '{\n  "type": "email.received", "data": {"email_id":"email_123"}\n}';
    const order: string[] = [];
    const deps = dependencies({
      verifyResendWebhook: vi.fn((input) => {
        order.push("verify");
        expect(input.rawBody).toBe(rawBody);
        return { type: "email.received", data: { email_id: "email_123" } };
      }),
      sanitizeResendEmailReceivedWebhook: vi.fn((payload) => {
        order.push("sanitize");
        expect(payload).toMatchObject({ type: "email.received" });
        return { event: "email.received" as const, message_id: "email_123", body_available: false };
      }),
      acceptProviderIngressEvent: vi.fn(async (_client, input) => {
        order.push("accept");
        expect(input).toEqual({
          ingressKey: INGRESS_KEY,
          providerKey: "resend",
          providerEventId: "svix_delivery_123",
          eventType: "email.received",
          payloadDigest: createHash("sha256").update(rawBody).digest("hex"),
          sanitizedPayload: {
            event: "email.received",
            message_id: "email_123",
            body_available: false
          },
          receivedAt: RECEIVED_AT
        });
        return { receiptId: "receipt", jobId: "job", pauseGeneration: 2, replayed: false };
      })
    });

    const response = await handleProviderIngressRequest({
      request: request(rawBody, {
        "svix-id": "svix_delivery_123",
        "svix-signature": "v1,fixture",
        "svix-timestamp": "1783958400"
      }),
      providerKey: "resend",
      env: REHEARSAL_ENV,
      dependencies: deps
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true, replayed: false });
    expect(order).toEqual(["verify", "sanitize", "accept"]);
  });

  it("verifies Retell before parsing and keys call-ended idempotency by call id", async () => {
    const rawBody = '{"event":"call_ended","call":{"call_id":"call_123","agent_id":"agent_1"}}';
    const order: string[] = [];
    const deps = dependencies({
      resolveProviderIngressConnection: vi.fn(async () => ({
        tenantId: "tenant_preview",
        locationId: "location_preview",
        providerConnectionId: "provider_retell_preview",
        providerKey: "retell" as const,
        channel: "phone" as const,
        secretRef: "outpost-secret://provider/provider_retell_preview/webhook-signing/v1"
      })),
      verifyRetellWebhook: vi.fn(({ rawBody: submitted }) => {
        order.push("verify");
        expect(submitted).toBe(rawBody);
      }),
      sanitizeRetellCallEndedWebhook: vi.fn(() => {
        order.push("sanitize");
        return {
          event: "call_ended" as const,
          agent_id: "agent_1",
          call_id: "call_123",
          transcript_present: false,
          caller_name: null,
          call_summary: null,
          intent: null,
          recommended_next_step: null,
          confidence: null
        };
      }),
      acceptProviderIngressEvent: vi.fn(async (_client, input) => {
        order.push("accept");
        expect(input.providerEventId).toBe("call_123");
        return { receiptId: "receipt", jobId: "job", pauseGeneration: 2, replayed: true };
      })
    });

    const response = await handleProviderIngressRequest({
      request: new Request("https://preview.example.test/api/internal/provider-ingress/rehearsal/retell", {
        method: "POST",
        headers: {
          authorization: `Bearer ${REHEARSAL_TOKEN}`,
          "content-type": "application/json",
          "x-outpost-ingress-key": INGRESS_KEY,
          "x-retell-signature": "v=1783958400000,d=fixture"
        },
        body: rawBody
      }),
      providerKey: "retell",
      env: REHEARSAL_ENV,
      dependencies: deps
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, replayed: true });
    expect(order).toEqual(["verify", "sanitize", "accept"]);
  });

  it("composes real Retell verification and sanitizer without enqueueing transcript text", async () => {
    const signingSecret = "retell-fixture-signing-secret";
    const rawBody = JSON.stringify({
      event: "call_ended",
      call: {
        agent_id: "agent_fixture",
        call_id: "call_fixture",
        transcript: "private transcript must not enter the job"
      }
    });
    const timestamp = String(new Date(RECEIVED_AT).getTime());
    const signature = `v=${timestamp},d=${createHmac("sha256", signingSecret)
      .update(rawBody + timestamp)
      .digest("hex")}`;
    const accept = vi.fn(async (_client, input) => {
      expect(JSON.stringify(input.sanitizedPayload)).not.toContain("private transcript");
      expect(input.sanitizedPayload).toMatchObject({
        call_id: "call_fixture",
        transcript_present: true,
        call_summary: null
      });
      return { receiptId: "receipt", jobId: "job", pauseGeneration: 2, replayed: false };
    });
    const deps = dependencies({
      resolveProviderIngressConnection: vi.fn(async () => ({
        tenantId: "tenant_preview",
        locationId: "location_preview",
        providerConnectionId: "provider_retell_preview",
        providerKey: "retell" as const,
        channel: "phone" as const,
        secretRef: "outpost-secret://provider/provider_retell_preview/webhook-signing/v1"
      })),
      resolveProviderSecret: vi.fn(() => signingSecret),
      verifyRetellWebhook,
      sanitizeRetellCallEndedWebhook,
      acceptProviderIngressEvent: accept
    });

    const response = await handleProviderIngressRequest({
      request: new Request("https://preview.example.test/api/internal/provider-ingress/rehearsal/retell", {
        method: "POST",
        headers: {
          authorization: `Bearer ${REHEARSAL_TOKEN}`,
          "content-type": "application/json",
          "x-outpost-ingress-key": INGRESS_KEY,
          "x-retell-signature": signature
        },
        body: rawBody
      }),
      providerKey: "retell",
      env: REHEARSAL_ENV,
      dependencies: deps
    });

    expect(response.status).toBe(200);
    expect(accept).toHaveBeenCalledOnce();
  });

  it("maps unavailable provenance, invalid signatures, invalid payloads, stops, and conflicts safely", async () => {
    const cases = [
      {
        override: { resolveProviderIngressConnection: vi.fn(async () => { throw Object.assign(new Error("hidden"), { code: "55000" }); }) },
        expected: 404
      },
      {
        override: { verifyResendWebhook: vi.fn(() => { throw Object.assign(new Error("bad signature"), { name: "ProviderWebhookVerificationError" }); }) },
        expected: 400
      },
      {
        override: { sanitizeResendEmailReceivedWebhook: vi.fn(() => { throw new Error("raw private body"); }) },
        expected: 400
      },
      {
        override: { acceptProviderIngressEvent: vi.fn(async () => { throw Object.assign(new Error("stopped"), { code: "OP001" }); }) },
        expected: 409
      },
      {
        override: { acceptProviderIngressEvent: vi.fn(async () => { throw Object.assign(new Error("conflict"), { code: "23505" }); }) },
        expected: 409
      }
    ];

    for (const testCase of cases) {
      const deps = dependencies(testCase.override as Partial<ProviderIngressHandlerDependencies>);
      const response = await handleProviderIngressRequest({
        request: request("{}", {
          "svix-id": "svix_delivery_123",
          "svix-signature": "v1,fixture",
          "svix-timestamp": "1783958400"
        }),
        providerKey: "resend",
        env: REHEARSAL_ENV,
        dependencies: deps
      });

      expect(response.status).toBe(testCase.expected);
      expect(JSON.stringify(await response.json())).not.toMatch(/hidden|signature|private|stopped|conflict/);
    }
  });

  it("reports infrastructure failures without returning exception content", async () => {
    const deps = dependencies({
      assertIngressDbAuthority: vi.fn(async () => { throw new Error("owner@example.test secret"); })
    });
    const response = await handleProviderIngressRequest({
      request: request("{}"),
      providerKey: "resend",
      env: REHEARSAL_ENV,
      dependencies: deps
    });

    expect(response.status).toBe(503);
    expect(deps.reportServerFailure).toHaveBeenCalledWith("provider.ingress.authority", expect.any(Error));
    expect(JSON.stringify(await response.json())).not.toContain("owner@example.test");
  });

  it("reports missing secret and transient acceptance failures only through static operations", async () => {
    const missingSecret = dependencies({
      resolveProviderSecret: vi.fn(() => { throw new Error("secret-value"); })
    });
    const transientAccept = dependencies({
      acceptProviderIngressEvent: vi.fn(async () => { throw new Error("database-url"); })
    });

    const secretResponse = await handleProviderIngressRequest({
      request: request("{}"),
      providerKey: "resend",
      env: REHEARSAL_ENV,
      dependencies: missingSecret
    });
    const acceptResponse = await handleProviderIngressRequest({
      request: request("{}", {
        "svix-id": "svix_delivery_123",
        "svix-signature": "v1,fixture",
        "svix-timestamp": "1783958400"
      }),
      providerKey: "resend",
      env: REHEARSAL_ENV,
      dependencies: transientAccept
    });

    expect(secretResponse.status).toBe(503);
    expect(acceptResponse.status).toBe(503);
    expect(missingSecret.reportServerFailure).toHaveBeenCalledWith(
      "provider.ingress.secret",
      expect.any(Error)
    );
    expect(transientAccept.reportServerFailure).toHaveBeenCalledWith(
      "provider.ingress.accept",
      expect.any(Error)
    );
    expect(JSON.stringify(await secretResponse.json())).not.toContain("secret-value");
    expect(JSON.stringify(await acceptResponse.json())).not.toContain("database-url");
  });
});
