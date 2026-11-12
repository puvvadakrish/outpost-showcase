import { describe, expect, it } from "vitest";
import {
  addDraftAnswer,
  addDraftHandoffRule,
  addDraftNotificationDestination,
  createOwnerSetupDraftState,
  ownerSetupStorageKey,
  reconcileOwnerSetupDraftState,
  removeDraftHandoffRule,
  removeDraftNotificationDestination,
  retireAnswer
} from "@/domain/owner-setup-draft";
import {
  answerBankEntries,
  handoffRules,
  notificationDestinations
} from "@/domain/seed";

const seed = {
  answerBankEntries,
  handoffRules,
  notificationDestinations
};

describe("owner setup local draft helpers", () => {
  it("uses a tenant-scoped browser storage key", () => {
    expect(ownerSetupStorageKey("tenant_acme_fitness")).toBe(
      "outpost:owner-setup:tenant_acme_fitness:slice2b"
    );
  });

  it("adds draft records with conservative defaults", () => {
    const initial = createOwnerSetupDraftState(seed, "2026-06-09T10:00:00.000Z");
    const withAnswer = addDraftAnswer(
      initial,
      "tenant_acme_fitness",
      "loc_acme_main",
      "2026-06-09T10:01:00.000Z"
    );
    const withRule = addDraftHandoffRule(
      withAnswer,
      "tenant_acme_fitness",
      "loc_acme_main",
      "2026-06-09T10:02:00.000Z"
    );
    const withDestination = addDraftNotificationDestination(
      withRule,
      "tenant_acme_fitness",
      "loc_acme_main",
      "2026-06-09T10:03:00.000Z"
    );

    expect(withDestination.answerBankEntries[0]).toMatchObject({
      approvalStatus: "draft",
      runtimeBehavior: "needs_owner_review",
      sourceLabel: "owner draft"
    });
    expect(withDestination.handoffRules.at(-1)).toMatchObject({
      action: "create_task",
      status: "draft"
    });
    expect(withDestination.notificationDestinations.at(-1)).toMatchObject({
      status: "draft",
      type: "staff_email"
    });
  });

  it("retires answers instead of deleting them", () => {
    const initial = createOwnerSetupDraftState(seed, "2026-06-09T10:00:00.000Z");
    const retired = retireAnswer(
      initial,
      "answer_amenities",
      "2026-06-09T10:05:00.000Z"
    );
    const entry = retired.answerBankEntries.find((answer) => answer.id === "answer_amenities");

    expect(retired.answerBankEntries).toHaveLength(initial.answerBankEntries.length);
    expect(entry).toMatchObject({
      approvalStatus: "retired",
      approvedAt: undefined,
      approvedByUserId: undefined,
      retiredAt: "2026-06-09T10:05:00.000Z",
      runtimeBehavior: "blocked_until_resolved"
    });
  });

  it("only removes draft rules and destinations", () => {
    const initial = createOwnerSetupDraftState(seed, "2026-06-09T10:00:00.000Z");
    const withDraftRule = addDraftHandoffRule(
      initial,
      "tenant_acme_fitness",
      "loc_acme_main",
      "2026-06-09T10:02:00.000Z"
    );
    const draftRuleId = withDraftRule.handoffRules.at(-1)?.id ?? "";
    const afterRuleRemoval = removeDraftHandoffRule(
      removeDraftHandoffRule(withDraftRule, "rule_cancellation_always_human"),
      draftRuleId
    );

    expect(afterRuleRemoval.handoffRules.map((rule) => rule.id)).toContain(
      "rule_cancellation_always_human"
    );
    expect(afterRuleRemoval.handoffRules.map((rule) => rule.id)).not.toContain(draftRuleId);

    const withDraftDestination = addDraftNotificationDestination(
      initial,
      "tenant_acme_fitness",
      "loc_acme_main",
      "2026-06-09T10:03:00.000Z"
    );
    const draftDestinationId = withDraftDestination.notificationDestinations.at(-1)?.id ?? "";
    const afterDestinationRemoval = removeDraftNotificationDestination(
      removeDraftNotificationDestination(withDraftDestination, "dest_acme_queue"),
      draftDestinationId
    );

    expect(afterDestinationRemoval.notificationDestinations.map((destination) => destination.id)).toContain(
      "dest_acme_queue"
    );
    expect(afterDestinationRemoval.notificationDestinations.map((destination) => destination.id)).not.toContain(
      draftDestinationId
    );
  });

  it("restores local drafts without hiding new or removing retired backend rows", () => {
    const stored = addDraftNotificationDestination(
      addDraftHandoffRule(
        createOwnerSetupDraftState(seed, "2026-07-13T05:00:00.000Z"),
        "tenant_acme_fitness",
        "loc_acme_main",
        "2026-07-13T05:01:00.000Z"
      ),
      "tenant_acme_fitness",
      "loc_acme_main",
      "2026-07-13T05:02:00.000Z"
    );
    stored.handoffRules.push({
      ...handoffRules[0],
      id: "stale_backend_rule"
    });
    const newBackendRule = {
      ...handoffRules[0],
      id: "server_created_rule",
      topic: "server created"
    };
    stored.handoffRules[0] = {
      ...stored.handoffRules[0],
      topic: "stale local edit"
    };

    const reconciled = reconcileOwnerSetupDraftState(
      {
        ...seed,
        handoffRules: [...handoffRules, newBackendRule]
      },
      stored,
      "2026-07-13T05:03:00.000Z"
    );

    expect(reconciled.handoffRules.map((rule) => rule.id)).toContain("server_created_rule");
    expect(reconciled.handoffRules.map((rule) => rule.id)).not.toContain("stale_backend_rule");
    expect(reconciled.handoffRules.some((rule) => rule.id.startsWith("rule_local_"))).toBe(true);
    expect(reconciled.handoffRules[0].topic).toBe(handoffRules[0].topic);
    expect(
      reconciled.notificationDestinations.some((destination) =>
        destination.id.startsWith("dest_local_")
      )
    ).toBe(true);
  });

  it("drops optimistic rows once an authoritative row carries their creation key", () => {
    const stored = addDraftNotificationDestination(
      addDraftHandoffRule(
        createOwnerSetupDraftState(seed, "2026-07-13T05:00:00.000Z"),
        "tenant_acme_fitness",
        "loc_acme_main",
        "2026-07-13T05:01:00.000Z"
      ),
      "tenant_acme_fitness",
      "loc_acme_main",
      "2026-07-13T05:02:00.000Z"
    );
    const localRule = stored.handoffRules.at(-1)!;
    const localDestination = stored.notificationDestinations.at(-1)!;

    const reconciled = reconcileOwnerSetupDraftState(
      {
        ...seed,
        handoffRules: [
          ...handoffRules,
          { ...localRule, id: "server_rule", creationKey: localRule.id }
        ],
        notificationDestinations: [
          ...notificationDestinations,
          {
            ...localDestination,
            id: "server_destination",
            creationKey: localDestination.id
          }
        ]
      },
      stored
    );

    expect(reconciled.handoffRules.map((rule) => rule.id)).toContain("server_rule");
    expect(reconciled.handoffRules.map((rule) => rule.id)).not.toContain(localRule.id);
    expect(reconciled.notificationDestinations.map((destination) => destination.id)).toContain(
      "server_destination"
    );
    expect(reconciled.notificationDestinations.map((destination) => destination.id)).not.toContain(
      localDestination.id
    );
  });
});
