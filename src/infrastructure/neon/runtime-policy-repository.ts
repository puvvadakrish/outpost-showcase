import "server-only";

import type {
  CheckRuntimePolicyReviewCurrentnessInput,
  IssueRuntimePolicyCandidateIntentInput,
  RecordRuntimePolicyAcceptanceInput,
  RecordRuntimePolicyRejectionInput,
  RuntimePolicyAcceptanceWriter,
  RuntimePolicyCandidateLineageReader,
  RuntimePolicyCandidateReader,
  RuntimePolicyCandidateReviewManifestReader,
  RuntimePolicyIntentIssuer,
  RuntimePolicyRejectionWriter,
  RuntimePolicyReviewCurrentnessChecker,
  RuntimePolicyReviewHistoryReader,
  RuntimePolicySummaryRepository,
} from "@/application/runtime-policy/ports";
import type {
  RuntimePolicyCandidateLineageRecord,
  RuntimePolicyCandidateReviewManifestRecord,
  RuntimePolicyReviewCurrentnessOutcome,
  RuntimePolicyReviewCurrentnessReason,
  RuntimePolicyReviewCurrentnessRecord,
  RuntimePolicyReviewDecisionRecord,
  RuntimePolicyReviewDecision,
  RuntimePolicyReviewHistoryRecord,
  RuntimePolicySnapshotRecord,
} from "@/domain/runtime-policy-records";
import { handoffActions, handoffTriggers } from "@/domain/models";
import {
  runtimeTopicDisplay,
  runtimeTopicKey,
} from "@/domain/runtime-guardrails";
import type { OutpostNeonClient } from "@/server/neon/server-client";

interface RuntimePolicySnapshotRow {
  answer_topic_count: number;
  candidate_count: number;
  compiler_revision: number;
  created_at: string;
  decision_count: number;
  handoff_count: number;
  id: string;
  latest_decision: RuntimePolicyReviewDecision | null;
  latest_decision_at: string | null;
  location_id: string;
  policy_digest: string;
  schema_version: number;
  snapshot_version: number;
  source_digest: string;
  tenant_id: string;
  warning_count: number;
}

function mapRecord(row: RuntimePolicySnapshotRow): RuntimePolicySnapshotRecord {
  return {
    answerTopicCount: Number(row.answer_topic_count),
    candidateCount: Number(row.candidate_count),
    compilerRevision: Number(row.compiler_revision),
    createdAt: row.created_at,
    decisionCount: Number(row.decision_count),
    handoffCount: Number(row.handoff_count),
    id: row.id,
    latestDecision: row.latest_decision,
    latestDecisionAt: row.latest_decision_at,
    locationId: row.location_id,
    policyDigest: row.policy_digest,
    schemaVersion: Number(row.schema_version),
    snapshotVersion: Number(row.snapshot_version),
    sourceDigest: row.source_digest,
    tenantId: row.tenant_id,
    warningCount: Number(row.warning_count),
  };
}

interface RuntimePolicyReviewDecisionRow {
  candidate_id: string;
  created_at: string;
  decision: RuntimePolicyReviewDecision;
  decision_count: number;
  decision_sequence: number;
  id: string;
  location_id: string;
  snapshot_version: number;
  tenant_id: string;
}

function mapDecision(
  row: RuntimePolicyReviewDecisionRow,
): RuntimePolicyReviewDecisionRecord {
  return {
    candidateId: row.candidate_id,
    createdAt: row.created_at,
    decision: row.decision,
    decisionCount: Number(row.decision_count),
    decisionSequence: Number(row.decision_sequence),
    id: row.id,
    locationId: row.location_id,
    snapshotVersion: Number(row.snapshot_version),
    tenantId: row.tenant_id,
  };
}

interface RuntimePolicyReviewHistoryRow {
  candidate_id: string;
  entries: unknown;
  has_more: boolean;
  location_id: string;
  snapshot_version: unknown;
  total_decision_count: unknown;
}

interface RuntimePolicyCandidateLineageRow {
  anchor_candidate_id: string;
  anchor_snapshot_version: unknown;
  entries: unknown;
  has_more: boolean;
  location_id: string;
}

interface RuntimePolicyCandidateReviewManifestRow {
  answer_topic_count: unknown;
  answer_topics: unknown;
  answer_topics_has_more: unknown;
  candidate_id: unknown;
  default_behavior: unknown;
  handoff_count: unknown;
  handoffs: unknown;
  handoffs_has_more: unknown;
  location_id: unknown;
  snapshot_version: unknown;
}

const OWNER_CANDIDATE_LINEAGE_TIMEOUT_MS = 2_000;
const OWNER_CANDIDATE_REVIEW_MANIFEST_TIMEOUT_MS = 2_000;
const utf8Encoder = new TextEncoder();

function parseSafeInteger(value: unknown, minimum: number) {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^(0|[1-9]\d*)$/u.test(value))
  ) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && !Object.is(parsed, -0)
    ? parsed
    : null;
}

function mapHistory(
  row: RuntimePolicyReviewHistoryRow,
): RuntimePolicyReviewHistoryRecord {
  const totalDecisionCount = parseSafeInteger(row.total_decision_count, 0);
  const snapshotVersion = parseSafeInteger(row.snapshot_version, 1);
  if (
    !row.candidate_id ||
    !row.location_id ||
    snapshotVersion === null ||
    totalDecisionCount === null ||
    typeof row.has_more !== "boolean" ||
    !Array.isArray(row.entries) ||
    row.entries.length > 5 ||
    row.entries.length !== Math.min(totalDecisionCount, 5) ||
    row.has_more !== (totalDecisionCount > 5)
  ) {
    throw new Error("Runtime policy review history returned an invalid result.");
  }

  let previousSequence = Number.POSITIVE_INFINITY;
  const entries = row.entries.map(
    (value): RuntimePolicyReviewHistoryRecord["entries"][number] => {
      if (!value || typeof value !== "object") {
        throw new Error(
          "Runtime policy review history returned an invalid result.",
        );
      }
      const entry = value as {
        created_at?: unknown;
        decision?: unknown;
        decision_sequence?: unknown;
      };
      const createdAt = entry.created_at;
      const decision = entry.decision;
      const decisionSequence = parseSafeInteger(entry.decision_sequence, 1);
      if (
        (decision !== "accepted" && decision !== "rejected") ||
        typeof createdAt !== "string" ||
        Number.isNaN(Date.parse(createdAt)) ||
        decisionSequence === null ||
        decisionSequence >= previousSequence
      ) {
        throw new Error(
          "Runtime policy review history returned an invalid result.",
        );
      }
      previousSequence = decisionSequence;
      return {
        createdAt,
        decision,
        decisionSequence,
      };
    },
  );

  return {
    candidateId: row.candidate_id,
    entries,
    hasMore: row.has_more,
    locationId: row.location_id,
    snapshotVersion,
    totalDecisionCount,
  };
}

function mapCandidateLineage(
  row: RuntimePolicyCandidateLineageRow,
): RuntimePolicyCandidateLineageRecord {
  const anchorSnapshotVersion = parseSafeInteger(
    row.anchor_snapshot_version,
    1,
  );
  const expectedEntryCount =
    anchorSnapshotVersion === null
      ? null
      : Math.min(anchorSnapshotVersion - 1, 5);
  if (
    !row.anchor_candidate_id ||
    !row.location_id ||
    anchorSnapshotVersion === null ||
    typeof row.has_more !== "boolean" ||
    !Array.isArray(row.entries) ||
    row.entries.length !== expectedEntryCount ||
    row.has_more !== (anchorSnapshotVersion > 6)
  ) {
    throw new Error("Runtime policy candidate lineage returned an invalid result.");
  }

  let previousVersion = anchorSnapshotVersion;
  const entries = row.entries.map(
    (value): RuntimePolicyCandidateLineageRecord["entries"][number] => {
      if (!value || typeof value !== "object") {
        throw new Error(
          "Runtime policy candidate lineage returned an invalid result.",
        );
      }
      const entry = value as {
        compiler_revision?: unknown;
        created_at?: unknown;
        snapshot_version?: unknown;
      };
      const compilerRevision = parseSafeInteger(entry.compiler_revision, 1);
      const snapshotVersion = parseSafeInteger(entry.snapshot_version, 1);
      if (
        compilerRevision === null ||
        snapshotVersion === null ||
        snapshotVersion !== previousVersion - 1 ||
        typeof entry.created_at !== "string" ||
        Number.isNaN(Date.parse(entry.created_at))
      ) {
        throw new Error(
          "Runtime policy candidate lineage returned an invalid result.",
        );
      }
      previousVersion = snapshotVersion;
      return {
        compilerRevision,
        createdAt: entry.created_at,
        snapshotVersion,
      };
    },
  );

  return {
    anchorCandidateId: row.anchor_candidate_id,
    anchorSnapshotVersion,
    entries,
    hasMore: row.has_more,
    locationId: row.location_id,
  };
}

function includesValue<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function boundedDisplayTopic(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = runtimeTopicDisplay(value);
  return normalized === value && Array.from(normalized).length <= 160
    ? normalized
    : null;
}

function compareUtf8Bytes(left: string, right: string) {
  const leftBytes = utf8Encoder.encode(left);
  const rightBytes = utf8Encoder.encode(right);
  const sharedLength = Math.min(leftBytes.length, rightBytes.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftBytes[index] - rightBytes[index];
    if (difference !== 0) return difference;
  }

  return leftBytes.length - rightBytes.length;
}

function mapCandidateReviewManifest(
  row: RuntimePolicyCandidateReviewManifestRow,
): RuntimePolicyCandidateReviewManifestRecord {
  const answerTopicCount = parseSafeInteger(row.answer_topic_count, 0);
  const handoffCount = parseSafeInteger(row.handoff_count, 0);
  const snapshotVersion = parseSafeInteger(row.snapshot_version, 1);
  if (
    typeof row.candidate_id !== "string" ||
    !row.candidate_id.trim() ||
    typeof row.location_id !== "string" ||
    !row.location_id.trim() ||
    snapshotVersion === null ||
    answerTopicCount === null ||
    answerTopicCount > 1_000 ||
    handoffCount === null ||
    handoffCount > 1_000 ||
    row.default_behavior !== "create_staff_task" ||
    typeof row.answer_topics_has_more !== "boolean" ||
    typeof row.handoffs_has_more !== "boolean" ||
    !Array.isArray(row.answer_topics) ||
    row.answer_topics.length !== Math.min(answerTopicCount, 10) ||
    row.answer_topics_has_more !== (answerTopicCount > 10) ||
    !Array.isArray(row.handoffs) ||
    row.handoffs.length !== Math.min(handoffCount, 10) ||
    row.handoffs_has_more !== (handoffCount > 10)
  ) {
    throw new Error(
      "Runtime policy candidate review manifest returned an invalid result.",
    );
  }

  let previousTopicKey = "";
  const answerTopics = row.answer_topics.map(
    (value): RuntimePolicyCandidateReviewManifestRecord["answerTopics"][number] => {
      if (!value || typeof value !== "object") {
        throw new Error(
          "Runtime policy candidate review manifest returned an invalid result.",
        );
      }
      const entry = value as { behavior?: unknown; topic?: unknown };
      const topic = boundedDisplayTopic(entry.topic);
      const topicKey = topic ? runtimeTopicKey(topic) : null;
      if (
        (entry.behavior !== "answer" &&
          entry.behavior !== "create_staff_task") ||
        !topic ||
        !topicKey ||
        compareUtf8Bytes(topicKey, previousTopicKey) <= 0
      ) {
        throw new Error(
          "Runtime policy candidate review manifest returned an invalid result.",
        );
      }
      previousTopicKey = topicKey;
      return { behavior: entry.behavior, topic };
    },
  );

  let previousPriority = 0;
  const handoffs = row.handoffs.map(
    (value): RuntimePolicyCandidateReviewManifestRecord["handoffs"][number] => {
      if (!value || typeof value !== "object") {
        throw new Error(
          "Runtime policy candidate review manifest returned an invalid result.",
        );
      }
      const entry = value as {
        action?: unknown;
        priority?: unknown;
        topic?: unknown;
        trigger?: unknown;
      };
      const priority = parseSafeInteger(entry.priority, 1);
      const topic = boundedDisplayTopic(entry.topic);
      if (
        !includesValue(handoffActions, entry.action) ||
        priority === null ||
        priority > 1_000 ||
        priority <= previousPriority ||
        !topic ||
        !includesValue(handoffTriggers, entry.trigger)
      ) {
        throw new Error(
          "Runtime policy candidate review manifest returned an invalid result.",
        );
      }
      previousPriority = priority;
      return {
        action: entry.action,
        priority,
        topic,
        trigger: entry.trigger,
      };
    },
  );

  return {
    answerTopicCount,
    answerTopics,
    answerTopicsHasMore: row.answer_topics_has_more,
    candidateId: row.candidate_id,
    defaultBehavior: "create_staff_task",
    handoffCount,
    handoffs,
    handoffsHasMore: row.handoffs_has_more,
    locationId: row.location_id,
    snapshotVersion,
  };
}

interface RuntimePolicyReviewCurrentnessRow {
  candidate_id: string;
  checked_at: string;
  location_id: string;
  outcome: RuntimePolicyReviewCurrentnessOutcome;
  reason: RuntimePolicyReviewCurrentnessReason;
}

const currentnessOutcomes = new Set<RuntimePolicyReviewCurrentnessOutcome>([
  "matches_current_source",
  "review_required",
  "check_unavailable",
]);
const currentnessReasons = new Set<RuntimePolicyReviewCurrentnessReason>([
  "accepted_exact",
  "not_accepted",
  "compiler_blocked",
  "source_or_candidate_changed",
  "verification_unavailable",
]);

function mapCurrentness(
  row: RuntimePolicyReviewCurrentnessRow,
): RuntimePolicyReviewCurrentnessRecord {
  const pairIsValid =
    (row.outcome === "matches_current_source" &&
      row.reason === "accepted_exact") ||
    (row.outcome === "review_required" &&
      (row.reason === "not_accepted" ||
        row.reason === "compiler_blocked" ||
        row.reason === "source_or_candidate_changed")) ||
    (row.outcome === "check_unavailable" &&
      row.reason === "verification_unavailable");
  if (
    !currentnessOutcomes.has(row.outcome) ||
    !currentnessReasons.has(row.reason) ||
    !pairIsValid
  ) {
    throw new Error("Runtime policy currentness returned an invalid result.");
  }
  return {
    candidateId: row.candidate_id,
    checkedAt: row.checked_at,
    locationId: row.location_id,
    outcome: row.outcome,
    reason: row.reason,
  };
}

export class NeonRuntimePolicyRepository
  implements
    RuntimePolicySummaryRepository,
    RuntimePolicyCandidateReader,
    RuntimePolicyCandidateLineageReader,
    RuntimePolicyCandidateReviewManifestReader,
    RuntimePolicyIntentIssuer,
    RuntimePolicyAcceptanceWriter,
    RuntimePolicyRejectionWriter,
    RuntimePolicyReviewCurrentnessChecker,
    RuntimePolicyReviewHistoryReader
{
  constructor(private readonly neon: OutpostNeonClient) {}

  async listOwnerCandidateSummaries(tenantId: string) {
    const { data, error } = await this.neon.rpc(
      "list_runtime_policy_candidate_summaries",
      { p_tenant_id: tenantId },
    );

    if (error)
      throw new Error(
        `Unable to load runtime policy candidates: ${error.message}`,
      );
    return ((data ?? []) as unknown as RuntimePolicySnapshotRow[]).map(
      mapRecord,
    );
  }

  async getOwnerCandidateSummary(candidateId: string) {
    const { data, error } = await this.neon.rpc(
      "get_runtime_policy_candidate_summary",
      { p_candidate_id: candidateId },
    );
    if (error)
      throw new Error(`Unable to load runtime policy candidate: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    return row ? mapRecord(row as unknown as RuntimePolicySnapshotRow) : null;
  }

  async checkReviewCurrentness(
    input: CheckRuntimePolicyReviewCurrentnessInput,
  ) {
    const { data, error } = await this.neon.rpc(
      "check_runtime_policy_review_currentness",
      {
        p_candidate_id: input.candidateId,
        p_policy_body: input.policyBody,
        p_source_state: input.sourceState,
      },
    );
    if (error)
      throw new Error(`Runtime policy currentness failed: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Runtime policy currentness returned no result.");
    return mapCurrentness(row as unknown as RuntimePolicyReviewCurrentnessRow);
  }

  async getOwnerReviewHistory(candidateId: string) {
    const { data, error } = await this.neon.rpc(
      "get_runtime_policy_review_history",
      { p_candidate_id: candidateId },
    );
    if (error)
      throw new Error(
        `Unable to load runtime policy review history: ${error.message}`,
      );
    const row = Array.isArray(data) ? data[0] : data;
    if (!row)
      throw new Error("Runtime policy review history returned no result.");
    return mapHistory(row as unknown as RuntimePolicyReviewHistoryRow);
  }

  async getOwnerCandidateLineage(anchorCandidateId: string) {
    const { data, error } = await this.neon
      .rpc("get_runtime_policy_candidate_lineage", {
        p_anchor_candidate_id: anchorCandidateId,
      })
      .abortSignal(AbortSignal.timeout(OWNER_CANDIDATE_LINEAGE_TIMEOUT_MS));
    if (error)
      throw new Error(
        `Unable to load runtime policy candidate lineage: ${error.message}`,
      );
    const row = Array.isArray(data) ? data[0] : data;
    if (!row)
      throw new Error("Runtime policy candidate lineage returned no result.");
    return mapCandidateLineage(row as unknown as RuntimePolicyCandidateLineageRow);
  }

  async getOwnerCandidateReviewManifest(candidateId: string) {
    const { data, error } = await this.neon
      .rpc("get_runtime_policy_candidate_review_manifest", {
        p_candidate_id: candidateId,
      })
      .abortSignal(
        AbortSignal.timeout(OWNER_CANDIDATE_REVIEW_MANIFEST_TIMEOUT_MS),
      );
    if (error)
      throw new Error(
        `Unable to load runtime policy candidate review manifest: ${error.message}`,
      );
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error(
        "Runtime policy candidate review manifest returned no result.",
      );
    }
    return mapCandidateReviewManifest(
      row as unknown as RuntimePolicyCandidateReviewManifestRow,
    );
  }

  async issueCandidateIntent(input: IssueRuntimePolicyCandidateIntentInput) {
    const { data, error } = await this.neon.rpc(
      "issue_runtime_policy_candidate_intent",
      {
        p_compiler_revision: input.compilerRevision,
        p_location_id: input.locationId,
        p_policy_body: input.policyBody,
        p_tenant_id: input.tenantId,
      },
    );

    if (error)
      throw new Error(
        `Unable to issue runtime policy candidate intent: ${error.message}`,
      );
    if (typeof data !== "string" || !/^[a-f0-9]{64}$/u.test(data)) {
      throw new Error(
        "Runtime policy candidate intent returned an invalid token.",
      );
    }
    return data;
  }

  async recordAcceptance(input: RecordRuntimePolicyAcceptanceInput) {
    const { data, error } = await this.neon.rpc(
      "record_runtime_policy_acceptance",
      {
        p_candidate_id: input.candidateId,
        p_creation_key: input.creationKey,
        p_policy_body: input.policyBody,
        p_source_state: input.sourceState,
      },
    );
    if (error)
      throw new Error(`Runtime policy acceptance failed: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Runtime policy acceptance returned no decision.");
    return mapDecision(row as unknown as RuntimePolicyReviewDecisionRow);
  }

  async recordRejection(input: RecordRuntimePolicyRejectionInput) {
    const { data, error } = await this.neon.rpc(
      "record_runtime_policy_rejection",
      {
        p_candidate_id: input.candidateId,
        p_creation_key: input.creationKey,
      },
    );
    if (error)
      throw new Error(`Runtime policy rejection failed: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Runtime policy rejection returned no decision.");
    return mapDecision(row as unknown as RuntimePolicyReviewDecisionRow);
  }
}
