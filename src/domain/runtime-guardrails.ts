import type { AnswerBankEntry } from "./answer-bank";
import type { HandoffRule } from "./handoff-rules";
import type { Location } from "./tenancy";

export interface RuntimeGuardrailTopic {
  id: string;
  scope: "global" | "location";
  topic: string;
}

export interface RuntimeGuardrailHandoffTopic extends RuntimeGuardrailTopic {
  action: HandoffRule["action"];
  priority: number;
}

export type RuntimeGuardrailReviewReason =
  | "duplicate_answers"
  | "eligible_answer_handoff_overlap";

export interface RuntimeGuardrailReviewTopic {
  activeHandoffCount: number;
  answerCount: number;
  key: string;
  reasons: RuntimeGuardrailReviewReason[];
  topic: string;
}

export interface LocationRuntimeGuardrailPreview {
  activeHandoffTopics: RuntimeGuardrailHandoffTopic[];
  blockedAnswerTopics: RuntimeGuardrailTopic[];
  eligibleAnswerTopics: RuntimeGuardrailTopic[];
  inactiveHandoffRuleCount: number;
  locationId: string;
  locationName: string;
  retiredAnswerCount: number;
  reviewTopics: RuntimeGuardrailReviewTopic[];
  staffRoutedAnswerTopics: RuntimeGuardrailTopic[];
}

interface RuntimeGuardrailPreviewInput {
  answerBankEntries: AnswerBankEntry[];
  handoffRules: HandoffRule[];
  locations: Location[];
  tenantId: string;
}

function appliesToLocation(row: { locationId?: string }, locationId: string) {
  return !row.locationId || row.locationId === locationId;
}

function topicSummary(row: { id: string; locationId?: string; topic: string }): RuntimeGuardrailTopic {
  return {
    id: row.id,
    scope: row.locationId ? "location" : "global",
    topic: runtimeTopicDisplay(row.topic)
  };
}

function byTopicThenId(
  left: Pick<RuntimeGuardrailTopic, "id" | "topic">,
  right: Pick<RuntimeGuardrailTopic, "id" | "topic">
) {
  return left.topic.localeCompare(right.topic) || left.id.localeCompare(right.id);
}

export function runtimeTopicDisplay(topic: string) {
  return topic.trim().replace(/\s+/gu, " ");
}

export function runtimeTopicKey(topic: string) {
  return runtimeTopicDisplay(topic).toLowerCase();
}

export function isStaffRoutedRuntimeAnswer(entry: AnswerBankEntry) {
  return entry.approvalStatus === "routed" || entry.runtimeBehavior === "create_staff_task";
}

export function isEligibleRuntimeAnswer(entry: AnswerBankEntry) {
  return (
    !isStaffRoutedRuntimeAnswer(entry) &&
    entry.approvalStatus === "approved" &&
    entry.runtimeBehavior === "answer_live"
  );
}

function groupedByTopic<T extends { topic: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const key = runtimeTopicKey(row.topic);
    if (!key) continue;
    const existing = grouped.get(key);
    if (existing) existing.push(row);
    else grouped.set(key, [row]);
  }

  return grouped;
}

export function ownerRuntimeGuardrailPreviews({
  answerBankEntries,
  handoffRules,
  locations,
  tenantId
}: RuntimeGuardrailPreviewInput): LocationRuntimeGuardrailPreview[] {
  const tenantAnswers = answerBankEntries.filter((entry) => entry.tenantId === tenantId);
  const tenantRules = handoffRules.filter((rule) => rule.tenantId === tenantId);

  return locations
    .filter((location) => location.tenantId === tenantId)
    .map((location) => {
      const scopedAnswers = tenantAnswers.filter((entry) =>
        appliesToLocation(entry, location.id)
      );
      const activeAnswers = scopedAnswers.filter((entry) => entry.approvalStatus !== "retired");
      const staffRoutedAnswers = activeAnswers.filter(
        (entry) =>
          isStaffRoutedRuntimeAnswer(entry)
      );
      const staffRoutedIds = new Set(staffRoutedAnswers.map((entry) => entry.id));
      const eligibleAnswers = activeAnswers.filter(
        (entry) =>
          !staffRoutedIds.has(entry.id) && isEligibleRuntimeAnswer(entry)
      );
      const eligibleIds = new Set(eligibleAnswers.map((entry) => entry.id));
      const blockedAnswers = activeAnswers.filter(
        (entry) => !staffRoutedIds.has(entry.id) && !eligibleIds.has(entry.id)
      );
      const scopedRules = tenantRules.filter((rule) => appliesToLocation(rule, location.id));
      const activeRules = scopedRules.filter((rule) => rule.status === "active");
      const answersByTopic = groupedByTopic(activeAnswers);
      const eligibleAnswersByTopic = groupedByTopic(eligibleAnswers);
      const activeRulesByTopic = groupedByTopic(activeRules);
      const reviewTopicKeys = new Set([
        ...answersByTopic.keys(),
        ...activeRulesByTopic.keys()
      ]);
      const reviewTopics = [...reviewTopicKeys]
        .map((key): RuntimeGuardrailReviewTopic | null => {
          const matchingAnswers = answersByTopic.get(key) ?? [];
          const matchingEligibleAnswers = eligibleAnswersByTopic.get(key) ?? [];
          const matchingRules = activeRulesByTopic.get(key) ?? [];
          const reasons: RuntimeGuardrailReviewReason[] = [];

          if (matchingAnswers.length > 1) reasons.push("duplicate_answers");
          if (matchingEligibleAnswers.length > 0 && matchingRules.length > 0) {
            reasons.push("eligible_answer_handoff_overlap");
          }
          if (reasons.length === 0) return null;

          const displayRow = [...matchingAnswers, ...matchingRules]
            .map(topicSummary)
            .sort(byTopicThenId)[0];

          return {
            activeHandoffCount: matchingRules.length,
            answerCount: matchingAnswers.length,
            key,
            reasons,
            topic: displayRow?.topic ?? key
          };
        })
        .filter((row): row is RuntimeGuardrailReviewTopic => row !== null)
        .sort((left, right) => left.topic.localeCompare(right.topic) || left.key.localeCompare(right.key));

      return {
        activeHandoffTopics: activeRules
          .map((rule) => ({
            ...topicSummary(rule),
            action: rule.action,
            priority: rule.priority
          }))
          .sort((left, right) => left.priority - right.priority || byTopicThenId(left, right)),
        blockedAnswerTopics: blockedAnswers.map(topicSummary).sort(byTopicThenId),
        eligibleAnswerTopics: eligibleAnswers.map(topicSummary).sort(byTopicThenId),
        inactiveHandoffRuleCount: scopedRules.filter((rule) => rule.status !== "active").length,
        locationId: location.id,
        locationName: location.name,
        retiredAnswerCount: scopedAnswers.filter((entry) => entry.approvalStatus === "retired").length,
        reviewTopics,
        staffRoutedAnswerTopics: staffRoutedAnswers.map(topicSummary).sort(byTopicThenId)
      };
    });
}
