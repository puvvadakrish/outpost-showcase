import { describe, expect, it } from "vitest";
import type { AnswerBankEntry } from "@/domain/answer-bank";
import type { HandoffRule } from "@/domain/handoff-rules";
import {
  compileRuntimePolicyCandidate,
  compileRuntimePolicySnapshot
} from "@/domain/runtime-policy";
import type { Location } from "@/domain/tenancy";

const location: Location = {
  address: "North",
  id: "location_a",
  name: "North",
  status: "active",
  tenantId: "tenant_a",
  timezone: "America/Chicago"
};

function answer(
  id: string,
  topic: string,
  approvalStatus: AnswerBankEntry["approvalStatus"],
  runtimeBehavior: AnswerBankEntry["runtimeBehavior"],
  overrides: Partial<AnswerBankEntry> = {}
): AnswerBankEntry {
  return {
    answer: `Answer for ${topic}`,
    approvalStatus,
    id,
    ownerAction: "edit",
    question: topic,
    reviewNote: "Owner-only review note",
    runtimeBehavior,
    sourceLabel: "Owner-only source label",
    tenantId: "tenant_a",
    topic,
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...overrides
  };
}

function handoff(
  id: string,
  priority: number,
  overrides: Partial<HandoffRule> = {}
): HandoffRule {
  return {
    action: "create_task",
    activeWindow: "always",
    destination: "front desk queue",
    id,
    priority,
    status: "active",
    tenantId: "tenant_a",
    topic: id,
    trigger: "low_confidence",
    ...overrides
  };
}

function compile(overrides: Partial<Parameters<typeof compileRuntimePolicySnapshot>[0]> = {}) {
  return compileRuntimePolicySnapshot({
    answerBankEntries: [],
    handoffRules: [],
    location,
    snapshotVersion: 1,
    tenantId: "tenant_a",
    ...overrides
  });
}

function successful(result: ReturnType<typeof compileRuntimePolicySnapshot>) {
  if (!result.ok) throw new Error("Expected runtime policy compilation to succeed");
  return result;
}

describe("compileRuntimePolicySnapshot", () => {
  it("compiles a versionless candidate for persistence-owned version allocation", () => {
    const result = compileRuntimePolicyCandidate({
      answerBankEntries: [answer("answer_live", "Hours", "approved", "answer_live")],
      handoffRules: [],
      location,
      tenantId: "tenant_a"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate).toMatchObject({
      locationId: "location_a",
      schemaVersion: 1,
      tenantId: "tenant_a"
    });
    expect(result.candidate).not.toHaveProperty("snapshotVersion");
    expect(Object.isFrozen(result.candidate)).toBe(true);
  });

  it("produces the same canonical snapshot regardless of source order", () => {
    const answers = [
      answer("answer_z", "  Zeta   topic ", "approved", "answer_live"),
      answer("answer_a", "Account change", "routed", "create_staff_task"),
      answer("answer_blocked", "Blocked", "draft", "needs_owner_review")
    ];
    const handoffs = [
      handoff("handoff_second", 20, { trigger: "low_confidence" }),
      handoff("handoff_first", 10, { trigger: "always_human" })
    ];

    const first = successful(compile({ answerBankEntries: answers, handoffRules: handoffs }));
    const reordered = successful(
      compile({ answerBankEntries: [...answers].reverse(), handoffRules: [...handoffs].reverse() })
    );

    expect(reordered.snapshot).toEqual(first.snapshot);
    expect(first.snapshot).toMatchObject({
      schemaVersion: 1,
      snapshotVersion: 1,
      tenantId: "tenant_a",
      locationId: "location_a",
      defaultPolicy: { kind: "create_staff_task" }
    });
    expect(first.snapshot.handoffs.map((policy) => policy.sourceRuleId)).toEqual([
      "handoff_first",
      "handoff_second"
    ]);
    expect(first.snapshot.answerTopics).toEqual([
      {
        kind: "create_staff_task",
        sourceAnswerId: "answer_a",
        topic: "Account change",
        topicKey: "account change"
      },
      {
        answer: "Answer for   Zeta   topic",
        kind: "answer",
        sourceAnswerId: "answer_z",
        topic: "Zeta topic",
        topicKey: "zeta topic"
      }
    ]);
  });

  it("puts active topic handoffs ahead of eligible answers and records the overlap", () => {
    const result = successful(
      compile({
        answerBankEntries: [answer("answer_hours", " Staffed Hours ", "approved", "answer_live")],
        handoffRules: [
          handoff("handoff_hours", 10, {
            action: "transfer_when_live",
            destination: "configured staff number",
            topic: "staffed   hours",
            trigger: "topic"
          })
        ]
      })
    );

    expect(result.snapshot.answerTopics).toEqual([]);
    expect(result.snapshot.handoffs[0]).toMatchObject({
      sourceRuleId: "handoff_hours",
      topic: "staffed hours",
      trigger: "topic"
    });
    expect(result.diagnostics).toEqual([
      {
        code: "answer_handoff_overlap",
        severity: "warning",
        sourceIds: ["answer_hours", "handoff_hours"],
        topicKey: "staffed hours"
      }
    ]);
  });

  it("does not validate unused answer text after a topic handoff safely shadows it", () => {
    const result = successful(
      compile({
        answerBankEntries: [
          answer("shadowed_blank", "Hours", "approved", "answer_live", { answer: " " })
        ],
        handoffRules: [handoff("handoff_hours", 10, { topic: "hours", trigger: "topic" })]
      })
    );

    expect(result.snapshot.answerTopics).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "answer_handoff_overlap"
    ]);
  });

  it("blocks equal active handoff priorities instead of using source order or IDs", () => {
    const result = compile({
      handoffRules: [handoff("handoff_b", 10), handoff("handoff_a", 10)]
    });

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("snapshot");
    expect(result.diagnostics).toContainEqual({
      code: "handoff_priority_tie",
      priority: 10,
      severity: "error",
      sourceIds: ["handoff_a", "handoff_b"]
    });
  });

  it("blocks duplicate answer topics unless an active topic handoff takes precedence", () => {
    const answers = [
      answer("answer_global", "Amenities", "approved", "answer_live"),
      answer("answer_local", " amenities ", "routed", "create_staff_task", {
        locationId: "location_a"
      })
    ];
    const blocked = compile({ answerBankEntries: answers });

    expect(blocked.ok).toBe(false);
    expect(blocked.diagnostics).toContainEqual({
      code: "duplicate_answers",
      severity: "error",
      sourceIds: ["answer_global", "answer_local"],
      topicKey: "amenities"
    });

    const safelyShadowed = successful(
      compile({
        answerBankEntries: answers,
        handoffRules: [handoff("handoff_amenities", 10, { topic: "Amenities", trigger: "topic" })]
      })
    );
    expect(safelyShadowed.snapshot.answerTopics).toEqual([]);
  });

  it("excludes foreign tenant and other-location rows from policies and diagnostics", () => {
    const result = successful(
      compile({
        answerBankEntries: [
          answer("answer_local", "Local", "approved", "answer_live"),
          answer("answer_foreign", "", "approved", "answer_live", { tenantId: "tenant_b" }),
          answer("answer_other_location", "", "approved", "answer_live", {
            locationId: "location_b"
          })
        ],
        handoffRules: [
          handoff("handoff_foreign", 10, { tenantId: "tenant_b", topic: "" }),
          handoff("handoff_other_location", 10, { locationId: "location_b", topic: "" })
        ]
      })
    );

    expect(result.snapshot.answerTopics.map((policy) => policy.sourceAnswerId)).toEqual([
      "answer_local"
    ]);
    expect(result.snapshot.handoffs).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("foreign");
    expect(JSON.stringify(result)).not.toContain("other_location");
  });

  it("allowlists selected runtime fields and omits routed answer text", () => {
    const result = successful(
      compile({
        answerBankEntries: [
          answer("answer_live", "Hours", "approved", "answer_live", {
            approvedByUserId: "owner_secret",
            reviewNote: "private review note",
            sourceLabel: "private source label"
          }),
          answer("answer_routed", "Freeze", "routed", "create_staff_task", {
            answer: "must not enter routed policy"
          })
        ]
      })
    );
    const serialized = JSON.stringify(result.snapshot);

    expect(serialized).toContain("Answer for Hours");
    expect(serialized).not.toContain("must not enter routed policy");
    expect(serialized).not.toContain("owner_secret");
    expect(serialized).not.toContain("private review note");
    expect(serialized).not.toContain("private source label");
  });

  it("fails closed for invalid versions, inactive locations, blank topics, and duplicate IDs", () => {
    const duplicate = answer("duplicate", "First", "approved", "answer_live");
    const result = compile({
      answerBankEntries: [duplicate, { ...duplicate, topic: "Second" }, answer("blank", "  ", "draft", "needs_owner_review")],
      handoffRules: [handoff("blank_handoff", 20, { topic: "" })],
      location: { ...location, status: "paused" },
      snapshotVersion: 0
    });

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("snapshot");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "blank_topic",
      "blank_topic",
      "duplicate_source_id",
      "invalid_snapshot_version",
      "location_not_active"
    ]);
  });

  it("rejects malformed runtime fields even when a loaded row bypassed write validation", () => {
    const result = compile({
      answerBankEntries: [
        answer("blank_answer", "Hours", "approved", "answer_live", { answer: "  " })
      ],
      handoffRules: [
        handoff("invalid_handoff", 0, {
          action: "unknown_action" as HandoffRule["action"],
          activeWindow: " ",
          destination: " ",
          trigger: "unknown_trigger" as HandoffRule["trigger"]
        })
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "blank_answer",
      "blank_handoff_active_window",
      "blank_handoff_destination",
      "invalid_handoff_action",
      "invalid_handoff_priority",
      "invalid_handoff_trigger"
    ]);
  });

  it("rejects a foreign location before inspecting source rows", () => {
    const result = compile({
      answerBankEntries: [answer("would_leak", "", "approved", "answer_live")],
      location: { ...location, tenantId: "tenant_b" }
    });

    expect(result).toEqual({
      diagnostics: [
        {
          code: "location_tenant_mismatch",
          severity: "error",
          sourceIds: []
        }
      ],
      ok: false
    });
    expect(JSON.stringify(result)).not.toContain("would_leak");
  });

  it("rejects blank scope and selected source identifiers", () => {
    const result = compile({
      answerBankEntries: [answer(" ", "Hours", "approved", "answer_live", { tenantId: " " })],
      handoffRules: [handoff("", 10, { tenantId: " ", topic: "Escalation" })],
      location: { ...location, id: " ", tenantId: " " },
      tenantId: " "
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "blank_location_id",
      "blank_source_id",
      "blank_source_id",
      "blank_tenant_id"
    ]);
  });

  it("deeply freezes successful snapshots and failed diagnostics", () => {
    const success = successful(
      compile({ answerBankEntries: [answer("answer_live", "Hours", "approved", "answer_live")] })
    );
    const failure = compile({ snapshotVersion: -1 });

    expect(Object.isFrozen(success)).toBe(true);
    expect(Object.isFrozen(success.snapshot)).toBe(true);
    expect(Object.isFrozen(success.snapshot.answerTopics)).toBe(true);
    expect(Object.isFrozen(success.snapshot.answerTopics[0])).toBe(true);
    expect(Object.isFrozen(failure)).toBe(true);
    expect(Object.isFrozen(failure.diagnostics)).toBe(true);
    expect(() => {
      (success.snapshot.answerTopics as unknown as RuntimePolicyMutableArray).push({});
    }).toThrow(TypeError);
  });
});

type RuntimePolicyMutableArray = Array<Record<string, unknown>>;
