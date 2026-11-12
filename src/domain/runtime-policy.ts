import type { AnswerBankEntry } from "./answer-bank";
import type { HandoffRule } from "./handoff-rules";
import { handoffActions, handoffTriggers } from "./models";
import {
  isEligibleRuntimeAnswer,
  isStaffRoutedRuntimeAnswer,
  runtimeTopicDisplay,
  runtimeTopicKey
} from "./runtime-guardrails";
import type { Location } from "./tenancy";

export const runtimePolicySchemaVersion = 1 as const;
export const runtimePolicyCompilerRevision = 1 as const;

export type RuntimePolicyDiagnosticCode =
  | "answer_handoff_overlap"
  | "blank_answer"
  | "blank_handoff_active_window"
  | "blank_handoff_destination"
  | "blank_location_id"
  | "blank_source_id"
  | "blank_tenant_id"
  | "blank_topic"
  | "duplicate_answers"
  | "duplicate_source_id"
  | "handoff_priority_tie"
  | "invalid_handoff_action"
  | "invalid_handoff_priority"
  | "invalid_handoff_trigger"
  | "invalid_snapshot_version"
  | "location_not_active"
  | "location_tenant_mismatch";

export interface RuntimePolicyDiagnostic {
  readonly code: RuntimePolicyDiagnosticCode;
  readonly priority?: number;
  readonly severity: "error" | "warning";
  readonly sourceIds: readonly string[];
  readonly topicKey?: string;
}

export interface RuntimePolicyHandoff {
  readonly action: HandoffRule["action"];
  readonly activeWindow: string;
  readonly destination: string;
  readonly priority: number;
  readonly sourceRuleId: string;
  readonly topic: string;
  readonly trigger: HandoffRule["trigger"];
}

export type RuntimePolicyAnswerTopic =
  | {
      readonly answer: string;
      readonly kind: "answer";
      readonly sourceAnswerId: string;
      readonly topic: string;
      readonly topicKey: string;
    }
  | {
      readonly kind: "create_staff_task";
      readonly sourceAnswerId: string;
      readonly topic: string;
      readonly topicKey: string;
    };

export interface RuntimePolicyCandidate {
  readonly answerTopics: readonly RuntimePolicyAnswerTopic[];
  readonly defaultPolicy: Readonly<{ kind: "create_staff_task" }>;
  readonly handoffs: readonly RuntimePolicyHandoff[];
  readonly locationId: string;
  readonly schemaVersion: typeof runtimePolicySchemaVersion;
  readonly tenantId: string;
  readonly warnings: readonly RuntimePolicyDiagnostic[];
}

export interface RuntimePolicySnapshot extends RuntimePolicyCandidate {
  readonly snapshotVersion: number;
}

export type RuntimePolicyCandidateCompileResult =
  | Readonly<{
      diagnostics: readonly RuntimePolicyDiagnostic[];
      ok: false;
    }>
  | Readonly<{
      candidate: RuntimePolicyCandidate;
      diagnostics: readonly RuntimePolicyDiagnostic[];
      ok: true;
    }>;

export type RuntimePolicyCompileResult =
  | Readonly<{
      diagnostics: readonly RuntimePolicyDiagnostic[];
      ok: false;
    }>
  | Readonly<{
      diagnostics: readonly RuntimePolicyDiagnostic[];
      ok: true;
      snapshot: RuntimePolicySnapshot;
    }>;

export interface CompileRuntimePolicySnapshotInput {
  readonly answerBankEntries: readonly AnswerBankEntry[];
  readonly handoffRules: readonly HandoffRule[];
  readonly location: Location;
  readonly snapshotVersion: number;
  readonly tenantId: string;
}

export type CompileRuntimePolicyCandidateInput = Omit<
  CompileRuntimePolicySnapshotInput,
  "snapshotVersion"
>;

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function appliesToLocation(row: { readonly locationId?: string }, locationId: string) {
  return !row.locationId || row.locationId === locationId;
}

function groupedByTopic<T extends { readonly topic: string }>(rows: readonly T[]) {
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

function duplicateIds(rows: readonly { readonly id: string }[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.id)) duplicates.add(row.id);
    seen.add(row.id);
  }

  return [...duplicates].sort(compareText);
}

function includesValue<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

function diagnosticOrder(left: RuntimePolicyDiagnostic, right: RuntimePolicyDiagnostic) {
  const severityDelta = Number(left.severity === "warning") - Number(right.severity === "warning");
  if (severityDelta !== 0) return severityDelta;
  const codeDelta = compareText(left.code, right.code);
  if (codeDelta !== 0) return codeDelta;
  const topicDelta = compareText(left.topicKey ?? "", right.topicKey ?? "");
  if (topicDelta !== 0) return topicDelta;
  const priorityDelta = (left.priority ?? 0) - (right.priority ?? 0);
  if (priorityDelta !== 0) return priorityDelta;
  return compareText(left.sourceIds.join("\u0000"), right.sourceIds.join("\u0000"));
}

function freezeValue<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      freezeValue(nested);
    }
    Object.freeze(value);
  }

  return value;
}

function failed(diagnostics: RuntimePolicyDiagnostic[]): Readonly<{
  diagnostics: readonly RuntimePolicyDiagnostic[];
  ok: false;
}> {
  return freezeValue({
    diagnostics: [...diagnostics].sort(diagnosticOrder),
    ok: false as const
  });
}

export function compileRuntimePolicyCandidate({
  answerBankEntries,
  handoffRules,
  location,
  tenantId
}: CompileRuntimePolicyCandidateInput): RuntimePolicyCandidateCompileResult {
  const diagnostics: RuntimePolicyDiagnostic[] = [];

  if (!tenantId.trim()) {
    diagnostics.push({
      code: "blank_tenant_id",
      severity: "error",
      sourceIds: []
    });
  }
  if (!location.id.trim()) {
    diagnostics.push({
      code: "blank_location_id",
      severity: "error",
      sourceIds: []
    });
  }
  if (location.tenantId !== tenantId) {
    diagnostics.push({
      code: "location_tenant_mismatch",
      severity: "error",
      sourceIds: []
    });
    return failed(diagnostics);
  }

  if (location.status !== "active") {
    diagnostics.push({
      code: "location_not_active",
      severity: "error",
      sourceIds: []
    });
  }

  const scopedAnswers = answerBankEntries
    .filter(
      (entry) =>
        entry.tenantId === tenantId &&
        entry.approvalStatus !== "retired" &&
        appliesToLocation(entry, location.id)
    )
    .sort((left, right) => compareText(left.id, right.id));
  const scopedHandoffs = handoffRules
    .filter(
      (rule) =>
        rule.tenantId === tenantId &&
        rule.status === "active" &&
        appliesToLocation(rule, location.id)
    )
    .sort((left, right) => left.priority - right.priority || compareText(left.id, right.id));

  const duplicateAnswerIds = duplicateIds(scopedAnswers);
  if (duplicateAnswerIds.length > 0) {
    diagnostics.push({
      code: "duplicate_source_id",
      severity: "error",
      sourceIds: duplicateAnswerIds
    });
  }
  const duplicateHandoffIds = duplicateIds(scopedHandoffs);
  if (duplicateHandoffIds.length > 0) {
    diagnostics.push({
      code: "duplicate_source_id",
      severity: "error",
      sourceIds: duplicateHandoffIds
    });
  }

  for (const answer of scopedAnswers) {
    if (!answer.id.trim()) {
      diagnostics.push({
        code: "blank_source_id",
        severity: "error",
        sourceIds: [],
        topicKey: runtimeTopicKey(answer.topic) || undefined
      });
    }
    if (!runtimeTopicKey(answer.topic)) {
      diagnostics.push({
        code: "blank_topic",
        severity: "error",
        sourceIds: [answer.id]
      });
    }
  }
  for (const handoff of scopedHandoffs) {
    if (!handoff.id.trim()) {
      diagnostics.push({
        code: "blank_source_id",
        severity: "error",
        sourceIds: [],
        topicKey: runtimeTopicKey(handoff.topic) || undefined
      });
    }
    if (!runtimeTopicKey(handoff.topic)) {
      diagnostics.push({
        code: "blank_topic",
        severity: "error",
        sourceIds: [handoff.id]
      });
    }
    if (!handoff.destination.trim()) {
      diagnostics.push({
        code: "blank_handoff_destination",
        severity: "error",
        sourceIds: [handoff.id],
        topicKey: runtimeTopicKey(handoff.topic) || undefined
      });
    }
    if (!handoff.activeWindow.trim()) {
      diagnostics.push({
        code: "blank_handoff_active_window",
        severity: "error",
        sourceIds: [handoff.id],
        topicKey: runtimeTopicKey(handoff.topic) || undefined
      });
    }
    if (!Number.isInteger(handoff.priority) || handoff.priority < 1 || handoff.priority > 1000) {
      diagnostics.push({
        code: "invalid_handoff_priority",
        severity: "error",
        sourceIds: [handoff.id],
        topicKey: runtimeTopicKey(handoff.topic) || undefined
      });
    }
    if (!includesValue(handoffTriggers, handoff.trigger)) {
      diagnostics.push({
        code: "invalid_handoff_trigger",
        severity: "error",
        sourceIds: [handoff.id],
        topicKey: runtimeTopicKey(handoff.topic) || undefined
      });
    }
    if (!includesValue(handoffActions, handoff.action)) {
      diagnostics.push({
        code: "invalid_handoff_action",
        severity: "error",
        sourceIds: [handoff.id],
        topicKey: runtimeTopicKey(handoff.topic) || undefined
      });
    }
  }

  const handoffsByPriority = new Map<number, HandoffRule[]>();
  for (const handoff of scopedHandoffs) {
    const tied = handoffsByPriority.get(handoff.priority);
    if (tied) tied.push(handoff);
    else handoffsByPriority.set(handoff.priority, [handoff]);
  }
  for (const [priority, tied] of handoffsByPriority) {
    if (tied.length > 1) {
      diagnostics.push({
        code: "handoff_priority_tie",
        priority,
        severity: "error",
        sourceIds: tied.map((rule) => rule.id).sort(compareText)
      });
    }
  }

  const answersByTopic = groupedByTopic(scopedAnswers);
  const topicHandoffsByTopic = groupedByTopic(
    scopedHandoffs.filter((rule) => rule.trigger === "topic")
  );
  const answerTopics: RuntimePolicyAnswerTopic[] = [];

  for (const [key, answers] of answersByTopic) {
    const topicHandoffs = topicHandoffsByTopic.get(key) ?? [];
    if (topicHandoffs.length > 0) {
      const eligibleAnswers = answers.filter(isEligibleRuntimeAnswer);
      if (eligibleAnswers.length > 0) {
        diagnostics.push({
          code: "answer_handoff_overlap",
          severity: "warning",
          sourceIds: [...eligibleAnswers.map((entry) => entry.id), ...topicHandoffs.map((rule) => rule.id)]
            .sort(compareText),
          topicKey: key
        });
      }
      continue;
    }

    if (answers.length > 1) {
      diagnostics.push({
        code: "duplicate_answers",
        severity: "error",
        sourceIds: answers.map((entry) => entry.id).sort(compareText),
        topicKey: key
      });
      continue;
    }

    const answer = answers[0];
    if (!answer) continue;
    if (isStaffRoutedRuntimeAnswer(answer)) {
      answerTopics.push({
        kind: "create_staff_task",
        sourceAnswerId: answer.id,
        topic: runtimeTopicDisplay(answer.topic),
        topicKey: key
      });
    } else if (isEligibleRuntimeAnswer(answer)) {
      if (!answer.answer.trim()) {
        diagnostics.push({
          code: "blank_answer",
          severity: "error",
          sourceIds: [answer.id],
          topicKey: key
        });
        continue;
      }
      answerTopics.push({
        answer: answer.answer.trim(),
        kind: "answer",
        sourceAnswerId: answer.id,
        topic: runtimeTopicDisplay(answer.topic),
        topicKey: key
      });
    }
  }

  const orderedDiagnostics = [...diagnostics].sort(diagnosticOrder);
  if (orderedDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return failed(orderedDiagnostics);
  }

  const warnings = orderedDiagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  const candidate: RuntimePolicyCandidate = {
    answerTopics: answerTopics.sort((left, right) => compareText(left.topicKey, right.topicKey)),
    defaultPolicy: { kind: "create_staff_task" },
    handoffs: scopedHandoffs.map((rule) => ({
      action: rule.action,
      activeWindow: rule.activeWindow.trim(),
      destination: rule.destination.trim(),
      priority: rule.priority,
      sourceRuleId: rule.id,
      topic: runtimeTopicDisplay(rule.topic),
      trigger: rule.trigger
    })),
    locationId: location.id,
    schemaVersion: runtimePolicySchemaVersion,
    tenantId,
    warnings
  };

  return freezeValue({
    candidate,
    diagnostics: orderedDiagnostics,
    ok: true as const
  });
}

export function compileRuntimePolicySnapshot({
  snapshotVersion,
  ...input
}: CompileRuntimePolicySnapshotInput): RuntimePolicyCompileResult {
  const result = compileRuntimePolicyCandidate(input);
  const diagnostics = [...result.diagnostics];

  if (!Number.isSafeInteger(snapshotVersion) || snapshotVersion < 1) {
    diagnostics.push({
      code: "invalid_snapshot_version",
      severity: "error",
      sourceIds: []
    });
  }

  if (!result.ok || diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return failed(diagnostics);
  }

  return freezeValue({
    diagnostics: [...diagnostics].sort(diagnosticOrder),
    ok: true as const,
    snapshot: {
      ...result.candidate,
      snapshotVersion
    }
  });
}
