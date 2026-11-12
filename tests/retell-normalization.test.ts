import { describe, expect, it } from "vitest";

import fixture from "./fixtures/retell/call-ended-gym-follow-up.json";
import { normalizeRetellCallEnded } from "@/server/providers/retell/normalize";

const context = {
  tenantId: "tenant_acme_fitness",
  locationId: "loc_acme_fitness_main",
  providerConnectionId: "provider_retell_acme_fitness_preview"
};

describe("Retell call-ended normalization", () => {
  it("normalizes a fixture-only completed call into provider domain records", () => {
    const result = normalizeRetellCallEnded({
      payload: fixture,
      context,
      payloadRef: "sha256/redacted-retell-call-ended-gym-follow-up",
      receivedAt: "2026-07-07T12:00:00.000Z"
    });

    expect(result.providerKey).toBe("retell");
    expect(result.warnings).toEqual([]);
    expect(result.conversation).toMatchObject({
      tenantId: context.tenantId,
      locationId: context.locationId,
      providerConnectionId: context.providerConnectionId,
      channel: "phone",
      externalConversationId: "retell_call_preview_001",
      requesterLabel: "Prospective member",
      status: "needs_human",
      startedAt: "2026-07-05T18:00:00.000Z",
      lastEventAt: "2026-07-05T18:04:00.000Z"
    });
    expect(result.channelEvent).toMatchObject({
      tenantId: context.tenantId,
      channel: "phone",
      providerEventId: "retell_call_preview_001:call_ended",
      eventType: "retell.call_ended",
      processingStatus: "normalized",
      payloadRef: "sha256/redacted-retell-call-ended-gym-follow-up"
    });
    expect(result.channelEvent.payloadDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(result.proposedTask).toMatchObject({
      tenantId: context.tenantId,
      locationId: context.locationId,
      channel: "phone",
      requesterName: "Prospective member",
      requesterContact: "+15550101010",
      intent: "membership_options",
      status: "needs_human",
      confidence: 0.82
    });
    expect(result.usageEvents.map((event) => [event.meter, event.quantity])).toEqual([
      ["call_completed", 1],
      ["task_created", 1],
      ["voice_seconds", 240]
    ]);
    expect(result.usageEvents.map((event) => event.id)).toEqual([
      expect.stringMatching(/^usage_retell_[0-9a-f]{24}$/u),
      expect.stringMatching(/^usage_retell_[0-9a-f]{24}$/u),
      expect.stringMatching(/^usage_retell_[0-9a-f]{24}$/u)
    ]);
  });

  it("keeps missing transcripts human-reviewable without fabricating task detail", () => {
    const result = normalizeRetellCallEnded({
      payload: {
        event: "call_ended",
        agent_id: "agent_acme_fitness_preview",
        call_id: "retell_call_missing_transcript",
        duration_ms: 30000,
        transcript: ""
      },
      context,
      receivedAt: "2026-07-07T12:00:00.000Z"
    });

    expect(result.warnings).toEqual(["retell_call_ended_missing_transcript"]);
    expect(result.proposedTask?.summary).toBe(
      "Retell call ended without an available transcript; staff should review the provider record."
    );
    expect(result.proposedTask?.confidence).toBe(0.35);
  });

  it("tenant-scopes deterministic ids even when provider call ids repeat", () => {
    const left = normalizeRetellCallEnded({
      payload: fixture,
      context
    });
    const right = normalizeRetellCallEnded({
      payload: fixture,
      context: {
        ...context,
        tenantId: "tenant_other",
        providerConnectionId: "provider_retell_other"
      }
    });

    expect(left.conversation.id).not.toBe(right.conversation.id);
    expect(left.channelEvent.id).not.toBe(right.channelEvent.id);
    expect(left.proposedTask?.id).not.toBe(right.proposedTask?.id);
    expect(left.usageEvents.map((event) => event.id)).not.toEqual(
      right.usageEvents.map((event) => event.id)
    );
  });

  it("rejects non-call-ended Retell events before they enter the domain", () => {
    expect(() =>
      normalizeRetellCallEnded({
        payload: {
          event: "call_started",
          agent_id: "agent_acme_fitness_preview",
          call_id: "retell_call_preview_001"
        },
        context
      })
    ).toThrow("Retell payload event must be call_ended.");
  });
});
