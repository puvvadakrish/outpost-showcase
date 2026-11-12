import { describe, expect, it } from "vitest";
import type { AnswerBankEntry } from "@/domain/answer-bank";
import type { HandoffRule } from "@/domain/handoff-rules";
import { ownerRuntimeGuardrailPreviews } from "@/domain/runtime-guardrails";
import type { Location } from "@/domain/tenancy";

const locations: Location[] = [
  {
    id: "location_a",
    tenantId: "tenant_a",
    name: "North",
    address: "North",
    timezone: "America/Chicago",
    status: "active"
  },
  {
    id: "location_b",
    tenantId: "tenant_a",
    name: "South",
    address: "South",
    timezone: "America/Chicago",
    status: "draft"
  },
  {
    id: "location_foreign",
    tenantId: "tenant_b",
    name: "Foreign",
    address: "Foreign",
    timezone: "America/Chicago",
    status: "active"
  }
];

function answer(
  id: string,
  topic: string,
  approvalStatus: AnswerBankEntry["approvalStatus"],
  runtimeBehavior: AnswerBankEntry["runtimeBehavior"],
  overrides: Partial<AnswerBankEntry> = {}
): AnswerBankEntry {
  return {
    id,
    tenantId: "tenant_a",
    topic,
    question: topic,
    answer: "Not projected",
    approvalStatus,
    ownerAction: "edit",
    runtimeBehavior,
    reviewNote: "Review",
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...overrides
  };
}

function rule(
  id: string,
  topic: string,
  status: HandoffRule["status"],
  priority: number,
  overrides: Partial<HandoffRule> = {}
): HandoffRule {
  return {
    id,
    tenantId: "tenant_a",
    trigger: "always_human",
    topic,
    action: "create_task",
    destination: "Not projected",
    activeWindow: "always",
    priority,
    status,
    ...overrides
  };
}

describe("ownerRuntimeGuardrailPreviews", () => {
  it("enforces tenant and location scope while applying global rows", () => {
    const previews = ownerRuntimeGuardrailPreviews({
      tenantId: "tenant_a",
      locations,
      answerBankEntries: [
        answer("global", "Amenities", "approved", "answer_live"),
        answer("north", "North hours", "approved", "answer_live", { locationId: "location_a" }),
        answer("foreign", "Foreign", "approved", "answer_live", { tenantId: "tenant_b" })
      ],
      handoffRules: [
        rule("global_rule", "Account changes", "active", 20),
        rule("north_rule", "North escalation", "active", 10, { locationId: "location_a" }),
        rule("foreign_rule", "Foreign rule", "active", 1, { tenantId: "tenant_b" })
      ]
    });

    expect(previews).toHaveLength(2);
    expect(previews[0]?.eligibleAnswerTopics.map((topic) => topic.id)).toEqual([
      "global",
      "north"
    ]);
    expect(previews[1]?.eligibleAnswerTopics.map((topic) => topic.id)).toEqual(["global"]);
    expect(previews[0]?.activeHandoffTopics.map((topic) => topic.id)).toEqual([
      "north_rule",
      "global_rule"
    ]);
    expect(JSON.stringify(previews)).not.toContain("Foreign");
    expect(JSON.stringify(previews)).not.toContain("Not projected");
  });

  it("classifies conservatively and excludes retired answers", () => {
    const [preview] = ownerRuntimeGuardrailPreviews({
      tenantId: "tenant_a",
      locations: [locations[0]!],
      answerBankEntries: [
        answer("eligible", "Eligible", "approved", "answer_live"),
        answer("routed_status", "Routed status", "routed", "answer_live"),
        answer("routed_behavior", "Routed behavior", "approved", "create_staff_task"),
        answer("draft", "Draft", "draft", "answer_live"),
        answer("conflict", "Conflict", "conflict", "blocked_until_resolved"),
        answer("retired", "Retired", "retired", "answer_live")
      ],
      handoffRules: []
    });

    expect(preview?.eligibleAnswerTopics.map((topic) => topic.id)).toEqual(["eligible"]);
    expect(preview?.staffRoutedAnswerTopics.map((topic) => topic.id)).toEqual([
      "routed_behavior",
      "routed_status"
    ]);
    expect(preview?.blockedAnswerTopics.map((topic) => topic.id)).toEqual([
      "conflict",
      "draft"
    ]);
    expect(preview?.retiredAnswerCount).toBe(1);
  });

  it("orders active handoffs by priority and counts inactive rules", () => {
    const [preview] = ownerRuntimeGuardrailPreviews({
      tenantId: "tenant_a",
      locations: [locations[0]!],
      answerBankEntries: [],
      handoffRules: [
        rule("second_b", "Beta", "active", 20),
        rule("first", "Zulu", "active", 10, { action: "transfer_when_live" }),
        rule("second_a", "Alpha", "active", 20),
        rule("draft", "Draft", "draft", 1),
        rule("disabled", "Disabled", "disabled", 2)
      ]
    });

    expect(preview?.activeHandoffTopics.map((topic) => topic.id)).toEqual([
      "first",
      "second_a",
      "second_b"
    ]);
    expect(preview?.activeHandoffTopics[0]?.action).toBe("transfer_when_live");
    expect(preview?.inactiveHandoffRuleCount).toBe(2);
  });

  it("flags normalized duplicate answers and eligible-answer handoff overlap", () => {
    const [preview] = ownerRuntimeGuardrailPreviews({
      tenantId: "tenant_a",
      locations: [locations[0]!],
      answerBankEntries: [
        answer("global_hours", "  Staffed   Hours ", "approved", "answer_live"),
        answer("north_hours", "staffed hours", "draft", "needs_owner_review", {
          locationId: "location_a"
        }),
        answer("routed_freeze", "Membership freeze", "routed", "create_staff_task")
      ],
      handoffRules: [
        rule("hours_handoff", "STAFFED HOURS", "active", 10),
        rule("freeze_handoff", "membership freeze", "active", 20)
      ]
    });

    expect(preview?.reviewTopics).toEqual([
      {
        key: "staffed hours",
        topic: "staffed hours",
        answerCount: 2,
        activeHandoffCount: 1,
        reasons: ["duplicate_answers", "eligible_answer_handoff_overlap"]
      }
    ]);
    expect(JSON.stringify(preview?.reviewTopics)).not.toContain("Membership freeze");
  });

  it("keeps ambiguity rows tenant-scoped", () => {
    const [preview] = ownerRuntimeGuardrailPreviews({
      tenantId: "tenant_a",
      locations: [locations[0]!],
      answerBankEntries: [
        answer("local", "Hours", "approved", "answer_live"),
        answer("foreign", "Hours", "approved", "answer_live", { tenantId: "tenant_b" })
      ],
      handoffRules: [rule("foreign_rule", "Hours", "active", 1, { tenantId: "tenant_b" })]
    });

    expect(preview?.reviewTopics).toEqual([]);
  });

  it("returns an empty preview when the tenant has no loaded locations", () => {
    expect(
      ownerRuntimeGuardrailPreviews({
        tenantId: "tenant_missing",
        locations,
        answerBankEntries: [],
        handoffRules: []
      })
    ).toEqual([]);
  });
});
