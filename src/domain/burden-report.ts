import { answerBankReadiness, sourceDocumentReadiness } from "./answer-bank";
import type { AnswerBankEntry } from "./answer-bank";
import type { BetaLoopSummary } from "./beta-loop";
import { manualSourceDocuments, type SourceDocument } from "./sources";
import type { Task, TaskAgeBucket, TaskEvent, TaskWorkflowStage } from "./tasks";
import {
  isUnresolvedTask,
  taskAgeSummaries,
  taskChannelSummaries,
  taskHumanIntakeContributorSummaries,
  taskIntentSummaries,
  taskLocationSummaries,
  taskWorkflowStageSummaries
} from "./tasks";
import type { TaskContributorUser } from "./tasks";
import type { Location } from "./tenancy";

export interface OwnerBurdenAgeRow {
  ageBucket: TaskAgeBucket;
  detail: string;
  label: string;
  totalCount: number;
  unresolvedCount: number;
}

export interface OwnerBurdenWorkflowRow {
  detail: string;
  label: string;
  stage: TaskWorkflowStage;
  totalCount: number;
  unresolvedCount: number;
}

export interface OwnerBurdenLocationRow {
  label: string;
  locationId: string;
  totalCount: number;
  unresolvedCount: number;
}

export interface OwnerBurdenStaffIntakeRow {
  actorUserId?: string;
  known: boolean;
  label: string;
  resolvedCount: number;
  totalCount: number;
  unresolvedCount: number;
}

export interface OwnerBurdenCommonRequestRow {
  fullLabel: string;
  label: string;
  totalCount: number;
  unresolvedCount: number;
}

export interface OwnerBurdenChannelRow {
  channel: Task["channel"];
  label: string;
  totalCount: number;
  unresolvedCount: number;
}

export interface OwnerBurdenReportMetric {
  detail: string;
  id: "tasks_created" | "tasks_resolved" | "answer_review" | "source_facts";
  label: string;
  value: string;
}

export interface OwnerBurdenReportRow {
  detail: string;
  label: string;
  state: "complete" | "in_progress" | "blocked";
  value: string;
}

export interface OwnerBurdenReport {
  ageRows: OwnerBurdenAgeRow[];
  blockedGates: string[];
  channelRows: OwnerBurdenChannelRow[];
  commonRequestRows: OwnerBurdenCommonRequestRow[];
  locationRows: OwnerBurdenLocationRow[];
  staffIntakeRows: OwnerBurdenStaffIntakeRow[];
  headline: string;
  localProofPercent: number;
  metrics: OwnerBurdenReportMetric[];
  rows: OwnerBurdenReportRow[];
  subheadline: string;
  workflowRows: OwnerBurdenWorkflowRow[];
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function verb(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function ownerBurdenReport({
  answerBankEntries,
  betaLoopSummary,
  locations,
  referenceTime = new Date(),
  sourceDocuments,
  tasks,
  taskEvents,
  users
}: {
  answerBankEntries: AnswerBankEntry[];
  betaLoopSummary: BetaLoopSummary;
  locations: Location[];
  referenceTime?: Date;
  sourceDocuments: SourceDocument[];
  tasks: Task[];
  taskEvents: TaskEvent[];
  users: TaskContributorUser[];
}): OwnerBurdenReport {
  const answerReadiness = answerBankReadiness(answerBankEntries);
  const manualSourceReadiness = sourceDocumentReadiness(manualSourceDocuments(sourceDocuments));
  const resolvedTasks = tasks.filter((task) => !isUnresolvedTask(task)).length;
  const unresolvedTasks = tasks.length - resolvedTasks;
  const sourceFacts = manualSourceReadiness.factsFound;
  const channelRows = taskChannelSummaries(tasks).map((summary) => ({
    channel: summary.channel,
    label: summary.label,
    totalCount: summary.count,
    unresolvedCount: summary.unresolvedCount
  }));
  const commonRequestRows = taskIntentSummaries(tasks, 5).map((summary) => ({
    fullLabel: summary.fullLabel,
    label: summary.label,
    totalCount: summary.count,
    unresolvedCount: summary.unresolvedCount
  }));
  const staffIntakeRows = taskHumanIntakeContributorSummaries(tasks, taskEvents, users);
  const locationRows = taskLocationSummaries(tasks, locations).map((summary) => ({
    label: summary.label,
    locationId: summary.locationId,
    totalCount: summary.count,
    unresolvedCount: summary.unresolvedCount
  }));
  const workflowRows = taskWorkflowStageSummaries(tasks).map((summary) => ({
    detail: summary.detail,
    label: summary.label,
    stage: summary.stage,
    totalCount: summary.count,
    unresolvedCount: summary.unresolvedCount
  }));
  const ageRows = taskAgeSummaries(tasks, referenceTime).map((summary) => ({
    ageBucket: summary.ageBucket,
    detail: summary.detail,
    label: summary.label,
    totalCount: summary.count,
    unresolvedCount: summary.unresolvedCount
  }));

  return {
    ageRows,
    blockedGates: betaLoopSummary.blockedReasons.filter((reason) =>
      reason.includes("hosted") || reason.includes("provider") || reason.includes("phone") || reason.includes("email")
    ),
    channelRows,
    commonRequestRows,
    locationRows,
    staffIntakeRows,
    headline:
      betaLoopSummary.readyForLocalBeta
        ? "Local burden report is complete"
        : "Local burden report is still building",
    localProofPercent: betaLoopSummary.localProofPercent,
    metrics: [
      {
        id: "tasks_created",
        label: "Staff tasks created",
        value: String(tasks.length),
        detail: `${pluralize(unresolvedTasks, "task")} still ${verb(unresolvedTasks, "needs", "need")} front-desk follow-up.`
      },
      {
        id: "tasks_resolved",
        label: "Tasks resolved locally",
        value: String(resolvedTasks),
        detail: "Done or ignored tasks count as locally closed staff work."
      },
      {
        id: "answer_review",
        label: "Answer review progress",
        value: `${answerReadiness.approved}/${answerBankEntries.length}`,
        detail:
          answerReadiness.needsReview > 0
            ? `${pluralize(answerReadiness.needsReview, "answer")} still ${verb(answerReadiness.needsReview, "needs", "need")} owner review.`
            : "All staged answer rows are approved, routed, or retired."
      },
      {
        id: "source_facts",
        label: "Manual facts staged",
        value: String(sourceFacts),
        detail: `${pluralize(manualSourceReadiness.conflictsFound, "conflict")} ${verb(manualSourceReadiness.conflictsFound, "is", "are")} visible before live use.`
      }
    ],
    rows: [
      {
        label: "Task burden captured",
        value: `${pluralize(tasks.length, "task")} created`,
        detail: unresolvedTasks > 0 ? `${pluralize(unresolvedTasks, "task")} still open.` : "All local tasks are closed.",
        state: tasks.length === 0 ? "blocked" : unresolvedTasks > 0 ? "in_progress" : "complete"
      },
      {
        label: "Answer review",
        value: `${pluralize(answerReadiness.approved, "approved answer")}`,
        detail:
          answerReadiness.needsReview > 0
            ? `${pluralize(answerReadiness.needsReview, "draft/conflict answer")} blocks local readiness.`
            : "No draft/conflict answers remain in the owner queue.",
        state: answerReadiness.needsReview > 0 || answerReadiness.approved === 0 ? "in_progress" : "complete"
      },
      {
        label: "Source fact staging",
        value: `${pluralize(sourceFacts, "fact")} staged`,
        detail:
          sourceFacts > 0
            ? `${pluralize(manualSourceReadiness.conflictsFound, "conflict")} flagged for owner review.`
            : "Manual source facts have not been staged yet.",
        state: sourceFacts > 0 ? "complete" : "blocked"
      },
      {
        label: "Local proof completion",
        value: `${betaLoopSummary.localProofPercent}%`,
        detail: `${betaLoopSummary.completedSteps} of ${betaLoopSummary.totalLocalProofSteps} local proof checkpoints are complete.`,
        state: betaLoopSummary.readyForLocalBeta ? "complete" : "in_progress"
      },
      {
        label: "Hosted and live gates",
        value: "Blocked",
        detail: "Hosted Neon proof and live phone/email providers remain intentionally closed.",
        state: "blocked"
      }
    ],
    subheadline:
      "Derived from existing local source, answer, task, and readiness rows. No hosted proof, SLA, provider ingress, notifications, billing, POS, or member-ledger behavior is claimed.",
    workflowRows
  };
}
