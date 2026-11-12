import type {
  RuntimePolicyAnswerTopic,
  RuntimePolicyCandidate,
  RuntimePolicyHandoff,
} from "./runtime-policy";

export type RuntimePolicyCandidateBody = Pick<
  RuntimePolicyCandidate,
  "answerTopics" | "defaultPolicy" | "handoffs" | "warnings"
>;

export type RuntimePolicyReviewDecision = "accepted" | "rejected";

export type RuntimePolicyReviewCurrentnessOutcome =
  | "matches_current_source"
  | "review_required"
  | "check_unavailable";

export type RuntimePolicyReviewCurrentnessReason =
  | "accepted_exact"
  | "not_accepted"
  | "compiler_blocked"
  | "source_or_candidate_changed"
  | "verification_unavailable";

export interface RuntimePolicyReviewCurrentnessRecord {
  candidateId: string;
  checkedAt: string;
  locationId: string;
  outcome: RuntimePolicyReviewCurrentnessOutcome;
  reason: RuntimePolicyReviewCurrentnessReason;
}

export interface RuntimePolicyReviewDecisionRecord {
  candidateId: string;
  createdAt: string;
  decision: RuntimePolicyReviewDecision;
  decisionCount: number;
  decisionSequence: number;
  id: string;
  locationId: string;
  snapshotVersion: number;
  tenantId: string;
}

export interface RuntimePolicyReviewHistoryEntry {
  createdAt: string;
  decision: RuntimePolicyReviewDecision;
  decisionSequence: number;
}

export interface RuntimePolicyReviewHistoryRecord {
  candidateId: string;
  entries: readonly RuntimePolicyReviewHistoryEntry[];
  hasMore: boolean;
  locationId: string;
  snapshotVersion: number;
  totalDecisionCount: number;
}

export type RuntimePolicyReviewHistoryView =
  | (RuntimePolicyReviewHistoryRecord & { status: "available" })
  | { candidateId: string; status: "unavailable" };

export interface RuntimePolicyCandidateLineageEntry {
  compilerRevision: number;
  createdAt: string;
  snapshotVersion: number;
}

export interface RuntimePolicyCandidateLineageRecord {
  anchorCandidateId: string;
  anchorSnapshotVersion: number;
  entries: readonly RuntimePolicyCandidateLineageEntry[];
  hasMore: boolean;
  locationId: string;
}

export type RuntimePolicyCandidateLineageView =
  | (RuntimePolicyCandidateLineageRecord & { status: "available" })
  | { anchorCandidateId: string; status: "unavailable" };

export type RuntimePolicyCandidateReviewManifestAnswerBehavior =
  RuntimePolicyAnswerTopic["kind"];

export interface RuntimePolicyCandidateReviewManifestAnswer {
  readonly behavior: RuntimePolicyCandidateReviewManifestAnswerBehavior;
  readonly topic: string;
}

export type RuntimePolicyCandidateReviewManifestHandoff = Pick<
  RuntimePolicyHandoff,
  "action" | "priority" | "topic" | "trigger"
>;

export interface RuntimePolicyCandidateReviewManifestRecord {
  readonly answerTopicCount: number;
  readonly answerTopics: readonly RuntimePolicyCandidateReviewManifestAnswer[];
  readonly answerTopicsHasMore: boolean;
  readonly candidateId: string;
  readonly defaultBehavior: RuntimePolicyCandidateBody["defaultPolicy"]["kind"];
  readonly handoffCount: number;
  readonly handoffs: readonly RuntimePolicyCandidateReviewManifestHandoff[];
  readonly handoffsHasMore: boolean;
  readonly locationId: string;
  readonly snapshotVersion: number;
}

export type RuntimePolicyCandidateReviewManifestView =
  | (RuntimePolicyCandidateReviewManifestRecord & { status: "available" })
  | { candidateId: string; status: "unavailable" };

export interface RuntimePolicySnapshotRecord {
  answerTopicCount: number;
  candidateCount: number;
  compilerRevision: number;
  createdAt: string;
  decisionCount: number;
  handoffCount: number;
  id: string;
  latestDecision: RuntimePolicyReviewDecision | null;
  latestDecisionAt: string | null;
  locationId: string;
  policyDigest: string;
  schemaVersion: number;
  snapshotVersion: number;
  sourceDigest: string;
  tenantId: string;
  warningCount: number;
}

export function runtimePolicyCandidateBody(
  candidate: RuntimePolicyCandidate,
): RuntimePolicyCandidateBody {
  return {
    answerTopics: candidate.answerTopics,
    defaultPolicy: candidate.defaultPolicy,
    handoffs: candidate.handoffs,
    warnings: candidate.warnings,
  };
}
