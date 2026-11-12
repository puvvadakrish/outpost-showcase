import type { AnswerBankEntry } from "./answer-bank";
import type { HandoffRule } from "./handoff-rules";
import type { Id } from "./models";
import type { NotificationDestination } from "./notifications";

export interface OwnerSetupDraftSeed {
  answerBankEntries: AnswerBankEntry[];
  handoffRules: HandoffRule[];
  notificationDestinations: NotificationDestination[];
}

export interface OwnerSetupDraftState extends OwnerSetupDraftSeed {
  updatedAt: string;
}

export function ownerSetupStorageKey(tenantId: Id) {
  return `outpost:owner-setup:${tenantId}:slice2b`;
}

export function createOwnerSetupDraftState(
  seed: OwnerSetupDraftSeed,
  updatedAt = new Date().toISOString()
): OwnerSetupDraftState {
  return {
    answerBankEntries: seed.answerBankEntries.map((entry) => ({ ...entry })),
    handoffRules: seed.handoffRules.map((rule) => ({ ...rule })),
    notificationDestinations: seed.notificationDestinations.map((destination) => ({ ...destination })),
    updatedAt
  };
}

function reconcileRows<T extends { creationKey?: string; id: Id }>(
  authoritative: T[],
  stored: T[],
  isLocal: (id: Id) => boolean
) {
  const authoritativeIds = new Set(authoritative.map((row) => row.id));
  const authoritativeCreationKeys = new Set(
    authoritative.flatMap((row) => (row.creationKey ? [row.creationKey] : []))
  );

  return [
    ...authoritative.map((row) => ({ ...row })),
    ...stored
      .filter(
        (row) =>
          isLocal(row.id) &&
          !authoritativeIds.has(row.id) &&
          !authoritativeCreationKeys.has(row.id)
      )
      .map((row) => ({ ...row }))
  ];
}

export function reconcileOwnerSetupDraftState(
  seed: OwnerSetupDraftSeed,
  stored: OwnerSetupDraftState | null,
  updatedAt = new Date().toISOString()
): OwnerSetupDraftState {
  if (!stored) return createOwnerSetupDraftState(seed, updatedAt);

  return {
    answerBankEntries: seed.answerBankEntries.map((entry) => ({ ...entry })),
    handoffRules: reconcileRows(
      seed.handoffRules,
      stored.handoffRules,
      (id) => id.startsWith("rule_local_")
    ),
    notificationDestinations: reconcileRows(
      seed.notificationDestinations,
      stored.notificationDestinations,
      (id) => id.startsWith("dest_local_")
    ),
    updatedAt: stored.updatedAt
  };
}

export function addDraftAnswer(
  state: OwnerSetupDraftState,
  tenantId: Id,
  locationId: Id | undefined,
  now = new Date().toISOString()
): OwnerSetupDraftState {
  const nextNumber = state.answerBankEntries.length + 1;

  return {
    ...state,
    answerBankEntries: [
      {
        id: `answer_local_${nextNumber}_${now.replaceAll(/[^0-9]/g, "")}`,
        tenantId,
        locationId,
        topic: "new owner question",
        question: "What should staff be able to answer?",
        answer: "Draft answer pending owner approval.",
        approvalStatus: "draft",
        sourceLabel: "owner draft",
        ownerAction: "edit",
        runtimeBehavior: "needs_owner_review",
        reviewNote: "New local draft. Owner approval is required before future live use.",
        updatedAt: now
      },
      ...state.answerBankEntries
    ],
    updatedAt: now
  };
}

export function retireAnswer(
  state: OwnerSetupDraftState,
  answerId: Id,
  now = new Date().toISOString()
): OwnerSetupDraftState {
  return {
    ...state,
    answerBankEntries: state.answerBankEntries.map((entry) =>
      entry.id === answerId
        ? {
            ...entry,
            approvedByUserId: undefined,
            approvedAt: undefined,
            approvalStatus: "retired",
            retiredAt: now,
            ownerAction: "retire",
            runtimeBehavior: "blocked_until_resolved",
            reviewNote: "Retired locally and retained as an audited future state.",
            updatedAt: now
          }
        : entry
    ),
    updatedAt: now
  };
}

export function addDraftHandoffRule(
  state: OwnerSetupDraftState,
  tenantId: Id,
  locationId: Id | undefined,
  now = new Date().toISOString()
): OwnerSetupDraftState {
  const nextNumber = state.handoffRules.length + 1;

  return {
    ...state,
    handoffRules: [
      ...state.handoffRules,
      {
        id: `rule_local_${nextNumber}_${now.replaceAll(/[^0-9]/g, "")}`,
        tenantId,
        locationId,
        trigger: "topic",
        topic: "new always-human topic",
        action: "create_task",
        destination: "front desk queue",
        activeWindow: "always",
        priority: 100 + nextNumber,
        status: "draft"
      }
    ],
    updatedAt: now
  };
}

export function removeDraftHandoffRule(
  state: OwnerSetupDraftState,
  ruleId: Id,
  now = new Date().toISOString()
): OwnerSetupDraftState {
  return {
    ...state,
    handoffRules: state.handoffRules.filter((rule) => rule.id !== ruleId || rule.status !== "draft"),
    updatedAt: now
  };
}

export function addDraftNotificationDestination(
  state: OwnerSetupDraftState,
  tenantId: Id,
  locationId: Id | undefined,
  now = new Date().toISOString()
): OwnerSetupDraftState {
  const nextNumber = state.notificationDestinations.length + 1;

  return {
    ...state,
    notificationDestinations: [
      ...state.notificationDestinations,
      {
        id: `dest_local_${nextNumber}_${now.replaceAll(/[^0-9]/g, "")}`,
        tenantId,
        locationId,
        type: "staff_email",
        label: "New staff destination",
        destination: "frontdesk@example.com",
        status: "draft"
      }
    ],
    updatedAt: now
  };
}

export function removeDraftNotificationDestination(
  state: OwnerSetupDraftState,
  destinationId: Id,
  now = new Date().toISOString()
): OwnerSetupDraftState {
  return {
    ...state,
    notificationDestinations: state.notificationDestinations.filter(
      (destination) => destination.id !== destinationId || destination.status !== "draft"
    ),
    updatedAt: now
  };
}
