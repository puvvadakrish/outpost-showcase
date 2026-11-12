import { describe, expect, it } from "vitest";

import fixture from "./fixtures/resend/inbound-gym-freeze-request.json";
import { normalizeResendInboundEmail } from "@/server/providers/resend/normalize";

const context = {
  tenantId: "tenant_acme_fitness",
  locationId: "loc_acme_fitness_main",
  providerConnectionId: "provider_resend_acme_fitness_preview"
};

describe("Resend inbound email normalization", () => {
  it("normalizes a fixture-only inbound email into provider domain records", () => {
    const result = normalizeResendInboundEmail({
      payload: fixture,
      context,
      payloadRef: "sha256/redacted-resend-inbound-gym-freeze-request",
      receivedAt: "2026-07-07T15:26:00.000Z"
    });

    expect(result.providerKey).toBe("resend");
    expect(result.warnings).toEqual([]);
    expect(result.conversation).toMatchObject({
      tenantId: context.tenantId,
      locationId: context.locationId,
      providerConnectionId: context.providerConnectionId,
      channel: "email",
      externalConversationId: "email_preview_001",
      requesterLabel: "Gym member",
      status: "needs_human",
      startedAt: "2026-07-07T15:25:00.000Z",
      lastEventAt: "2026-07-07T15:25:00.000Z"
    });
    expect(result.channelEvent).toMatchObject({
      tenantId: context.tenantId,
      channel: "email",
      providerEventId: "email_preview_001:email.received",
      eventType: "resend.email_received",
      processingStatus: "normalized",
      payloadRef: "sha256/redacted-resend-inbound-gym-freeze-request"
    });
    expect(result.channelEvent.payloadDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(result.proposedTask).toMatchObject({
      tenantId: context.tenantId,
      locationId: context.locationId,
      channel: "email",
      requesterName: "Gym member",
      requesterContact: "member@example.com",
      intent: "membership_freeze_question",
      summary: "Inbound email needs review: Question about freezing my membership",
      confidence: 0.78,
      status: "needs_human"
    });
    expect(result.usageEvents.map((event) => [event.meter, event.quantity])).toEqual([
      ["email_received", 1],
      ["task_created", 1]
    ]);
    expect(result.usageEvents.map((event) => event.id)).toEqual([
      expect.stringMatching(/^usage_resend_[0-9a-f]{24}$/u),
      expect.stringMatching(/^usage_resend_[0-9a-f]{24}$/u)
    ]);
  });

  it("keeps bodyless inbound email human-reviewable without claiming classification", () => {
    const result = normalizeResendInboundEmail({
      payload: {
        event: "email.received",
        message_id: "email_missing_body",
        subject: "Membership question",
        text_body: ""
      },
      context,
      receivedAt: "2026-07-07T15:26:00.000Z"
    });

    expect(result.warnings).toEqual(["resend_email_received_missing_body"]);
    expect(result.proposedTask?.summary).toBe(
      "Inbound email has a subject but no usable body: Membership question"
    );
    expect(result.proposedTask?.confidence).toBe(0.3);
  });

  it("tenant-scopes deterministic ids even when provider message ids repeat", () => {
    const left = normalizeResendInboundEmail({
      payload: fixture,
      context
    });
    const right = normalizeResendInboundEmail({
      payload: fixture,
      context: {
        ...context,
        tenantId: "tenant_other",
        providerConnectionId: "provider_resend_other"
      }
    });

    expect(left.conversation.id).not.toBe(right.conversation.id);
    expect(left.channelEvent.id).not.toBe(right.channelEvent.id);
    expect(left.proposedTask?.id).not.toBe(right.proposedTask?.id);
    expect(left.usageEvents.map((event) => event.id)).not.toEqual(
      right.usageEvents.map((event) => event.id)
    );
  });

  it("rejects non-inbound email events before they enter the domain", () => {
    expect(() =>
      normalizeResendInboundEmail({
        payload: {
          event: "email.sent",
          message_id: "email_preview_001"
        },
        context
      })
    ).toThrow("Resend payload event must be email.received.");
  });
});
