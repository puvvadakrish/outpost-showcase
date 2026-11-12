import { describe, expect, it } from "vitest";
import {
  answerApprovalSummaries,
  answerBankReadiness,
  answerReviewQueue,
  answerReviewQueueSummary,
  answerReviewRuntimeCopy,
  answerReviewSourceLabel,
  notificationDestinationReadiness,
  ownerSetupSteps,
  revisionIntentForAnswerAction,
  sourceDocumentReadiness
} from "@/domain/answer-bank";
import {
  answerBankEntries,
  handoffRules,
  locations,
  notificationDestinations,
  sourceDocuments
} from "@/domain/seed";

describe("answer bank domain helpers", () => {
  it("summarizes every answer approval state", () => {
    expect(answerApprovalSummaries(answerBankEntries)).toEqual([
      { status: "draft", count: 1 },
      { status: "approved", count: 1 },
      { status: "conflict", count: 1 },
      { status: "routed", count: 2 },
      { status: "retired", count: 0 }
    ]);
  });

  it("keeps draft and conflicting answers out of live readiness", () => {
    expect(answerBankReadiness(answerBankEntries)).toMatchObject({
      draft: 1,
      conflict: 1,
      approved: 1,
      needsReview: 2,
      routed: 2,
      retired: 0,
      liveAnswerCoverage: 20,
      readyForLiveAnswers: false
    });
  });

  it("orders the owner answer review queue with conflicts before drafts", () => {
    expect(answerReviewQueue(answerBankEntries).map((entry) => entry.id)).toEqual([
      "answer_pricing",
      "answer_hours"
    ]);
  });

  it("summarizes the owner answer review queue with the next owner action", () => {
    expect(answerReviewQueueSummary(answerBankEntries)).toEqual({
      approved: 1,
      conflict: 1,
      draft: 1,
      needsReview: 2,
      nextAction: "Resolve conflicting source facts first."
    });
  });

  it("builds owner-facing review source and runtime copy", () => {
    const conflict = answerBankEntries.find((entry) => entry.id === "answer_pricing");
    const draft = answerBankEntries.find((entry) => entry.id === "answer_hours");
    const approved = answerBankEntries.find((entry) => entry.id === "answer_amenities");

    expect(conflict).toBeDefined();
    expect(draft).toBeDefined();
    expect(approved).toBeDefined();

    expect(answerReviewSourceLabel(conflict!)).toBe("website + Google profile");
    expect(answerReviewRuntimeCopy(conflict!)).toBe(
      "Blocked from live answering until the owner resolves the conflict."
    );
    expect(answerReviewRuntimeCopy(draft!)).toBe(
      "Draft answer waiting for owner approval before any live use."
    );
    expect(answerReviewRuntimeCopy(approved!)).toBe(
      "Approved answer can be used only after live providers are explicitly connected."
    );
  });

  it("summarizes source document import readiness", () => {
    expect(sourceDocumentReadiness(sourceDocuments)).toEqual({
      ready: 1,
      needsReview: 1,
      conflict: 1,
      missing: 0,
      factsFound: 18,
      conflictsFound: 2,
      readyForReview: true
    });
  });

  it("keeps draft email destinations out of notification readiness", () => {
    expect(notificationDestinationReadiness(notificationDestinations)).toEqual({
      ready: 1,
      draft: 2,
      disabled: 0,
      readyForTasks: true,
      readyForNotifications: false
    });
  });

  it("builds setup steps without marking disconnected channels ready", () => {
    expect(
      ownerSetupSteps({
        locations,
        answerBankEntries,
        handoffRules,
        sourceDocuments,
        notificationDestinations
      }).map((step) => [step.id, step.state])
    ).toEqual([
      ["locations", "done"],
      ["sources", "active"],
      ["answers", "active"],
      ["handoff", "done"],
      ["notifications", "active"],
      ["channels", "blocked"]
    ]);
  });

  it("links setup blockers to explicit owner setup destinations", () => {
    expect(
      ownerSetupSteps({
        locations,
        answerBankEntries,
        handoffRules,
        sourceDocuments,
        notificationDestinations
      }).map((step) => [step.id, step.href])
    ).toEqual([
      ["locations", "/owner/locations"],
      ["sources", "/owner#manual-source-intake"],
      ["answers", "/owner#answers"],
      ["handoff", "/owner#handoff-rules"],
      ["notifications", "/owner#notifications"],
      ["channels", "/owner#channels"]
    ]);
  });

  it("maps local answer actions to future revision intents", () => {
    expect(revisionIntentForAnswerAction("approve")).toBe("approval");
    expect(revisionIntentForAnswerAction("edit")).toBe("edit");
    expect(revisionIntentForAnswerAction("keep_routed")).toBe("route");
    expect(revisionIntentForAnswerAction("retire")).toBe("retirement");
  });
});
