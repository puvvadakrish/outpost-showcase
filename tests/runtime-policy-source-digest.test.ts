import { describe, expect, it } from "vitest";
import type { AnswerBankEntry } from "@/domain/answer-bank";
import type { HandoffRule } from "@/domain/handoff-rules";
import type { Location } from "@/domain/tenancy";
import { runtimePolicySourceDigest } from "@/server/runtime-policy-source-digest";

const location: Location = {
  address: "North",
  id: "location_a",
  name: "North",
  status: "active",
  tenantId: "tenant_a",
  timezone: "America/Chicago"
};

function answer(id: string, overrides: Partial<AnswerBankEntry> = {}): AnswerBankEntry {
  return {
    answer: "Open weekdays",
    approvalStatus: "approved",
    id,
    ownerAction: "approve",
    question: "When are you open?",
    reviewNote: "Not fingerprinted",
    runtimeBehavior: "answer_live",
    tenantId: "tenant_a",
    topic: "Hours",
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...overrides
  };
}

function handoff(id: string, overrides: Partial<HandoffRule> = {}): HandoffRule {
  return {
    action: "create_task",
    activeWindow: "always",
    destination: "front desk queue",
    id,
    priority: 10,
    status: "active",
    tenantId: "tenant_a",
    topic: "Freeze",
    trigger: "topic",
    ...overrides
  };
}

describe("runtimePolicySourceDigest", () => {
  it("is stable across source order and ignores fields the compiler does not consume", () => {
    const answers = [answer("answer_b"), answer("answer_a")];
    const handoffs = [handoff("rule_b", { priority: 20 }), handoff("rule_a")];
    const first = runtimePolicySourceDigest({
      answerBankEntries: answers,
      handoffRules: handoffs,
      location,
      tenantId: "tenant_a"
    });
    const reordered = runtimePolicySourceDigest({
      answerBankEntries: [...answers].reverse().map((entry) => ({
        ...entry,
        reviewNote: "Changed owner-only note",
        updatedAt: "2026-07-14T00:00:00.000Z"
      })),
      handoffRules: [...handoffs].reverse(),
      location: { ...location, name: "Renamed display label" },
      tenantId: "tenant_a"
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(reordered).toBe(first);
  });

  it("changes when a compiler-consumed answer, handoff, or location field changes", () => {
    const input = {
      answerBankEntries: [answer("answer_a")],
      handoffRules: [handoff("rule_a")],
      location,
      tenantId: "tenant_a"
    };
    const baseline = runtimePolicySourceDigest(input);

    expect(runtimePolicySourceDigest({
      ...input,
      answerBankEntries: [answer("answer_a", { answer: "Changed answer" })]
    })).not.toBe(baseline);
    expect(runtimePolicySourceDigest({
      ...input,
      handoffRules: [handoff("rule_a", { priority: 11 })]
    })).not.toBe(baseline);
    expect(runtimePolicySourceDigest({
      ...input,
      location: { ...location, status: "paused" }
    })).not.toBe(baseline);
  });

  it("excludes foreign, other-location, retired-answer, and inactive-handoff rows", () => {
    const baseline = runtimePolicySourceDigest({
      answerBankEntries: [answer("answer_a")],
      handoffRules: [handoff("rule_a")],
      location,
      tenantId: "tenant_a"
    });
    const withExcludedRows = runtimePolicySourceDigest({
      answerBankEntries: [
        answer("answer_a"),
        answer("foreign", { tenantId: "tenant_b" }),
        answer("other", { locationId: "location_b" }),
        answer("retired", { approvalStatus: "retired" })
      ],
      handoffRules: [
        handoff("rule_a"),
        handoff("foreign_rule", { tenantId: "tenant_b" }),
        handoff("other_rule", { locationId: "location_b" }),
        handoff("draft_rule", { status: "draft" })
      ],
      location,
      tenantId: "tenant_a"
    });

    expect(withExcludedRows).toBe(baseline);
  });
});
