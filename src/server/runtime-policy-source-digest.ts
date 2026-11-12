import { createHash } from "node:crypto";
import type { AnswerBankEntry } from "@/domain/answer-bank";
import type { HandoffRule } from "@/domain/handoff-rules";
import type { Location } from "@/domain/tenancy";

interface RuntimePolicySourceDigestInput {
  answerBankEntries: readonly AnswerBankEntry[];
  handoffRules: readonly HandoffRule[];
  location: Location;
  tenantId: string;
}

export interface RuntimePolicySourceState {
  answers: Array<{
    answer: string;
    approvalStatus: AnswerBankEntry["approvalStatus"];
    id: string;
    locationId: string | null;
    runtimeBehavior: AnswerBankEntry["runtimeBehavior"];
    topic: string;
  }>;
  handoffs: Array<{
    action: HandoffRule["action"];
    activeWindow: string;
    destination: string;
    id: string;
    locationId: string | null;
    priority: number;
    topic: string;
    trigger: HandoffRule["trigger"];
  }>;
  location: {
    id: string;
    status: Location["status"];
    tenantId: string;
  };
  tenantId: string;
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function appliesToLocation(row: { locationId?: string }, locationId: string) {
  return !row.locationId || row.locationId === locationId;
}

export function runtimePolicySourceState({
  answerBankEntries,
  handoffRules,
  location,
  tenantId,
}: RuntimePolicySourceDigestInput): RuntimePolicySourceState {
  const answers = answerBankEntries
    .filter(
      (entry) =>
        entry.tenantId === tenantId &&
        entry.approvalStatus !== "retired" &&
        appliesToLocation(entry, location.id),
    )
    .map((entry) => ({
      answer: entry.answer,
      approvalStatus: entry.approvalStatus,
      id: entry.id,
      locationId: entry.locationId ?? null,
      runtimeBehavior: entry.runtimeBehavior,
      topic: entry.topic,
    }))
    .sort((left, right) => compareText(left.id, right.id));
  const handoffs = handoffRules
    .filter(
      (rule) =>
        rule.tenantId === tenantId &&
        rule.status === "active" &&
        appliesToLocation(rule, location.id),
    )
    .map((rule) => ({
      action: rule.action,
      activeWindow: rule.activeWindow,
      destination: rule.destination,
      id: rule.id,
      locationId: rule.locationId ?? null,
      priority: rule.priority,
      topic: rule.topic,
      trigger: rule.trigger,
    }))
    .sort(
      (left, right) =>
        left.priority - right.priority || compareText(left.id, right.id),
    );

  return {
    answers,
    handoffs,
    location: {
      id: location.id,
      status: location.status,
      tenantId: location.tenantId,
    },
    tenantId,
  };
}

export function runtimePolicySourceCanonicalJson(
  input: RuntimePolicySourceDigestInput,
) {
  return JSON.stringify(runtimePolicySourceState(input));
}

export function runtimePolicySourceDigest(
  input: RuntimePolicySourceDigestInput,
) {
  return createHash("sha256")
    .update(runtimePolicySourceCanonicalJson(input))
    .digest("hex");
}
