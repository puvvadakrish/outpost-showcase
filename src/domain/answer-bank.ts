import {
  answerApprovalStatuses,
  type AnswerApprovalStatus,
  type Id,
  type TaskStatus
} from "./models";
import type { HandoffRule } from "./handoff-rules";
import type { NotificationDestination } from "./notifications";
import type { SourceDocument } from "./sources";
import type { Location } from "./tenancy";

export interface AnswerBankEntry {
  id: Id;
  tenantId: Id;
  locationId?: Id;
  topic: string;
  question: string;
  answer: string;
  approvalStatus: AnswerApprovalStatus;
  sourceDocumentId?: Id;
  sourceLabel?: string;
  approvedByUserId?: Id;
  approvedAt?: string;
  retiredAt?: string;
  ownerAction: "approve" | "edit" | "keep_routed" | "retire";
  runtimeBehavior: "answer_live" | "needs_owner_review" | "create_staff_task" | "blocked_until_resolved";
  reviewNote: string;
  openTaskCreatedAt?: string;
  openTaskId?: Id;
  openTaskStatus?: TaskStatus;
  updatedAt: string;
}

export interface AnswerBankRevision {
  id: Id;
  tenantId: Id;
  locationId?: Id;
  answerBankEntryId: Id;
  actorUserId?: Id;
  revisionIntent: "import_proposal" | "edit" | "approval" | "route" | "retirement" | "conflict_resolution";
  previousStatus?: AnswerApprovalStatus;
  nextStatus: AnswerApprovalStatus;
  sourceDocumentId?: Id;
  sourceLabel?: string;
  note: string;
  createdAt: string;
}

export interface AnswerApprovalSummary {
  status: AnswerApprovalStatus;
  count: number;
}

export interface AnswerReviewQueueSummary {
  approved: number;
  conflict: number;
  draft: number;
  needsReview: number;
  nextAction: string;
}

export function answerApprovalSummaries(entries: AnswerBankEntry[]): AnswerApprovalSummary[] {
  return answerApprovalStatuses.map((status) => ({
    status,
    count: entries.filter((entry) => entry.approvalStatus === status).length
  }));
}

export function answerBankReadiness(entries: AnswerBankEntry[]) {
  const approved = entries.filter((entry) => entry.approvalStatus === "approved").length;
  const draft = entries.filter((entry) => entry.approvalStatus === "draft").length;
  const routed = entries.filter((entry) => entry.approvalStatus === "routed").length;
  const conflict = entries.filter((entry) => entry.approvalStatus === "conflict").length;
  const retired = entries.filter((entry) => entry.approvalStatus === "retired").length;
  const reviewQueue = entries.filter((entry) =>
    ["draft", "conflict"].includes(entry.approvalStatus)
  );

  return {
    approved,
    draft,
    conflict,
    needsReview: draft + conflict,
    routed,
    retired,
    reviewQueue,
    liveAnswerCoverage:
      entries.length > 0 ? Math.round((approved / entries.length) * 100) : 0,
    readyForLiveAnswers: approved > 0 && draft === 0 && conflict === 0
  };
}

export function answerReviewQueue(entries: AnswerBankEntry[]): AnswerBankEntry[] {
  const priority: Record<"conflict" | "draft", number> = {
    conflict: 0,
    draft: 1
  };
  const isReviewEntry = (entry: AnswerBankEntry): entry is AnswerBankEntry & {
    approvalStatus: "conflict" | "draft";
  } => entry.approvalStatus === "conflict" || entry.approvalStatus === "draft";

  return [...entries]
    .filter(isReviewEntry)
    .sort((left, right) => {
      const priorityDelta = priority[left.approvalStatus] - priority[right.approvalStatus];

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });
}

export function answerReviewQueueSummary(entries: AnswerBankEntry[]): AnswerReviewQueueSummary {
  const readiness = answerBankReadiness(entries);
  const nextAction =
    readiness.conflict > 0
      ? "Resolve conflicting source facts first."
      : readiness.draft > 0
        ? "Review draft answers and approve the safe ones."
        : "No staged answer proposals need owner review.";

  return {
    approved: readiness.approved,
    conflict: readiness.conflict,
    draft: readiness.draft,
    needsReview: readiness.needsReview,
    nextAction
  };
}

export function answerReviewSourceLabel(entry: AnswerBankEntry) {
  return entry.sourceLabel ?? entry.sourceDocumentId ?? "source pending";
}

export function answerReviewRuntimeCopy(entry: AnswerBankEntry) {
  if (entry.approvalStatus === "conflict" || entry.runtimeBehavior === "blocked_until_resolved") {
    return "Blocked from live answering until the owner resolves the conflict.";
  }

  if (entry.approvalStatus === "draft" || entry.runtimeBehavior === "needs_owner_review") {
    return "Draft answer waiting for owner approval before any live use.";
  }

  if (entry.runtimeBehavior === "create_staff_task") {
    return "Routed to staff instead of answered automatically.";
  }

  return "Approved answer can be used only after live providers are explicitly connected.";
}

export function revisionIntentForAnswerAction(
  action: AnswerBankEntry["ownerAction"]
): AnswerBankRevision["revisionIntent"] {
  if (action === "approve") {
    return "approval";
  }

  if (action === "keep_routed") {
    return "route";
  }

  if (action === "retire") {
    return "retirement";
  }

  return "edit";
}

export function sourceDocumentReadiness(sourceDocuments: SourceDocument[]) {
  const ready = sourceDocuments.filter((source) => source.status === "ready").length;
  const needsReview = sourceDocuments.filter((source) => source.status === "needs_review").length;
  const conflict = sourceDocuments.filter((source) => source.status === "conflict").length;
  const missing = sourceDocuments.filter((source) => source.status === "missing").length;

  return {
    ready,
    needsReview,
    conflict,
    missing,
    factsFound: sourceDocuments.reduce((total, source) => total + source.factsFound, 0),
    conflictsFound: sourceDocuments.reduce((total, source) => total + source.conflictsFound, 0),
    readyForReview: sourceDocuments.length > 0 && missing === 0
  };
}

export function notificationDestinationReadiness(destinations: NotificationDestination[]) {
  const ready = destinations.filter((destination) => destination.status === "ready").length;
  const draft = destinations.filter((destination) => destination.status === "draft").length;
  const disabled = destinations.filter((destination) => destination.status === "disabled").length;

  return {
    ready,
    draft,
    disabled,
    readyForTasks: destinations.some(
      (destination) => destination.type === "task_queue" && destination.status === "ready"
    ),
    readyForNotifications: destinations.some(
      (destination) =>
        ["staff_email", "owner_email"].includes(destination.type) && destination.status === "ready"
    )
  };
}

export interface OwnerSetupStep {
  id: string;
  label: string;
  detail: string;
  href: string;
  state: "done" | "active" | "blocked";
}

export function ownerSetupSteps({
  locations,
  answerBankEntries,
  handoffRules,
  sourceDocuments,
  notificationDestinations
}: {
  locations: Location[];
  answerBankEntries: AnswerBankEntry[];
  handoffRules: HandoffRule[];
  sourceDocuments: SourceDocument[];
  notificationDestinations: NotificationDestination[];
}): OwnerSetupStep[] {
  const answerReadiness = answerBankReadiness(answerBankEntries);
  const sourceReadiness = sourceDocumentReadiness(sourceDocuments);
  const destinationReadiness = notificationDestinationReadiness(notificationDestinations);

  return [
    {
      id: "locations",
      label: "Add location context",
      detail: `${locations.length} location ${locations.length === 1 ? "record" : "records"} ready for review.`,
      href: "/owner/locations",
      state: locations.length > 0 ? "done" : "active"
    },
    {
      id: "sources",
      label: "Stage source facts",
      detail: `${sourceReadiness.factsFound} facts staged with ${sourceReadiness.conflictsFound} conflict ${
        sourceReadiness.conflictsFound === 1 ? "flag" : "flags"
      }.`,
      href: "/owner#manual-source-intake",
      state: sourceReadiness.conflict > 0 || sourceReadiness.needsReview > 0 ? "active" : "done"
    },
    {
      id: "answers",
      label: "Approve answer bank",
      detail:
        answerReadiness.needsReview > 0
          ? `${answerReadiness.needsReview} answer ${
              answerReadiness.needsReview === 1 ? "needs" : "need"
            } owner review.`
          : "No draft or conflicting answers remain.",
      href: "/owner#answers",
      state: answerReadiness.needsReview > 0 ? "active" : "done"
    },
    {
      id: "handoff",
      label: "Confirm human handoff topics",
      detail: `${handoffRules.length} rule ${
        handoffRules.length === 1 ? "routes" : "route"
      } sensitive or uncertain work to staff.`,
      href: "/owner#handoff-rules",
      state: handoffRules.length > 0 ? "done" : "active"
    },
    {
      id: "notifications",
      label: "Confirm notification destinations",
      detail: destinationReadiness.readyForTasks
        ? `${destinationReadiness.ready} destination ${
            destinationReadiness.ready === 1 ? "is" : "are"
          } ready; email notifications remain draft.`
        : "Task queue destination is not ready.",
      href: "/owner#notifications",
      state: destinationReadiness.readyForTasks ? "active" : "blocked"
    },
    {
      id: "channels",
      label: "Connect phone and email",
      detail: "Provider configuration, test calls, and email automation stay disconnected.",
      href: "/owner#channels",
      state: "blocked"
    }
  ];
}
