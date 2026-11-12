import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  sanitizeResendEmailReceivedWebhook,
  sanitizeRetellCallEndedWebhook
} from "@/server/providers/ingress-sanitizers";
import { normalizeResendInboundEmail } from "@/server/providers/resend/normalize";
import { normalizeRetellCallEnded } from "@/server/providers/retell/normalize";

const context = {
  tenantId: "tenant_ingress_test",
  locationId: "location_ingress_test",
  providerConnectionId: "provider_ingress_test"
};

describe("provider ingress sanitizers", () => {
  it("reduces an official Retell call_ended event to bounded metadata", () => {
    const sanitized = sanitizeRetellCallEndedWebhook({
      event: "call_ended",
      call: {
        call_id: "call_123",
        agent_id: "agent_123",
        from_number: "+13125550100",
        start_timestamp: 1_800_000_000_000,
        end_timestamp: 1_800_000_060_000,
        transcript: "Sensitive caller transcript that must not enter the job.",
        transcript_object: [{ role: "agent", content: "Sensitive" }],
        recording_url: "https://provider.example/recording-secret"
      }
    });

    expect(sanitized).toEqual({
      event: "call_ended",
      agent_id: "agent_123",
      call_id: "call_123",
      start_timestamp: 1_800_000_000_000,
      end_timestamp: 1_800_000_060_000,
      transcript_present: true,
      duration_ms: 60_000,
      caller_phone: "+13125550100",
      caller_name: null,
      call_summary: null,
      intent: null,
      recommended_next_step: null,
      confidence: null
    });
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("Sensitive caller transcript");
    expect(serialized).not.toContain("recording-secret");
    expect(serialized).not.toContain("transcript_object");

    const normalized = normalizeRetellCallEnded({
      payload: sanitized,
      context,
      receivedAt: "2027-01-15T08:00:00.000Z"
    });
    expect(normalized.proposedTask?.summary).toContain("transcript available");
  });

  it("reduces an official Resend email.received event without fetching body data", () => {
    const sanitized = sanitizeResendEmailReceivedWebhook({
      type: "email.received",
      created_at: "2027-01-15T08:00:00.000Z",
      data: {
        email_id: "email_123",
        message_id: "<message@example.com>",
        from: "member@example.com",
        to: ["frontdesk@example.com"],
        subject: "Question about a membership freeze",
        attachments: [{ filename: "private.pdf" }],
        html: "<p>Sensitive body</p>"
      }
    });

    expect(sanitized).toEqual({
      event: "email.received",
      message_id: "email_123",
      received_at: "2027-01-15T08:00:00.000Z",
      from_label: null,
      from_email: "member@example.com",
      subject: "Question about a membership freeze",
      body_available: false,
      mailbox_label: "frontdesk@example.com",
      suggested_intent: null,
      suggested_next_step: null,
      confidence: null
    });
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("Sensitive body");
    expect(serialized).not.toContain("private.pdf");
    expect(serialized).not.toContain("attachments");

    const normalized = normalizeResendInboundEmail({
      payload: sanitized,
      context,
      receivedAt: "2027-01-15T08:00:01.000Z"
    });
    expect(normalized.proposedTask?.summary).toContain("no usable body");
  });

  it.each([
    [{ event: "call_started", call: {} }, "Retell webhook event must be call_ended."],
    [{ event: "call_ended", call: { call_id: "call_1" } }, "agent_id"],
    [{ type: "email.sent", data: {} }, "Resend webhook event must be email.received."],
    [{ type: "email.received", data: { email_id: "x".repeat(201) } }, "email_id"]
  ])("rejects unsupported or unbounded payload %#", (payload, message) => {
    const action = () =>
      "event" in payload
        ? sanitizeRetellCallEndedWebhook(payload)
        : sanitizeResendEmailReceivedWebhook(payload);
    expect(action).toThrow(message);
  });

  it("rejects invalid timestamps and oversized recipient lists", () => {
    expect(() =>
      sanitizeRetellCallEndedWebhook({
        event: "call_ended",
        call: { call_id: "call_1", agent_id: "agent_1", start_timestamp: -1 }
      })
    ).toThrow("start_timestamp");
    expect(() =>
      sanitizeResendEmailReceivedWebhook({
        type: "email.received",
        data: { email_id: "email_1", to: Array.from({ length: 101 }, () => "a@example.com") }
      })
    ).toThrow("Provider metadata list is invalid.");
    expect(() =>
      sanitizeRetellCallEndedWebhook({
        event: "call_ended",
        call: {
          call_id: "call_1",
          agent_id: "agent_1",
          start_timestamp: 0,
          end_timestamp: 86_400_001
        }
      })
    ).toThrow("Retell call duration exceeds the supported bound.");
  });

  it("normalizes display metadata and rejects control characters in IDs", () => {
    const email = sanitizeResendEmailReceivedWebhook({
      type: "email.received",
      data: {
        email_id: "email_1",
        from: "member@example.com",
        subject: "Question\nabout\tmembership"
      }
    });
    expect(email.subject).toBe("Question about membership");

    expect(() =>
      sanitizeRetellCallEndedWebhook({
        event: "call_ended",
        call: { call_id: "call\n1", agent_id: "agent_1" }
      })
    ).toThrow("call_id");
  });
});
