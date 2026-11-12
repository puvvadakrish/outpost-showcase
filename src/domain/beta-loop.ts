import { answerBankReadiness, notificationDestinationReadiness, sourceDocumentReadiness } from "./answer-bank";
import type { AnswerBankEntry } from "./answer-bank";
import type { ProviderConnection } from "./channels";
import { providerConnectionReadiness } from "./channels";
import type { NotificationDestination } from "./notifications";
import type { SourceDocument } from "./sources";
import type { Task, TaskProofSummary } from "./tasks";
import { isUnresolvedTask } from "./tasks";

export type BetaLoopStepState = "done" | "active" | "blocked";

export interface BetaLoopStep {
  id: "sources" | "answers" | "tasks" | "channels";
  label: string;
  detail: string;
  href: string;
  state: BetaLoopStepState;
}

export interface BetaLoopSummary {
  blockedReasons: string[];
  completedSteps: number;
  currentFocus: BetaLoopStep;
  localProofPercent: number;
  primaryActionHref: string;
  primaryActionLabel: string;
  readyForLocalBeta: boolean;
  steps: BetaLoopStep[];
  totalLocalProofSteps: number;
}

export interface BetaRehearsalChecklist {
  blockers: string[];
  commands: Array<{
    command: string;
    detail: string;
    label: string;
  }>;
  docsHref: string;
  heading: string;
  nextAction: string;
  operatorSteps: Array<{
    detail: string;
    label: string;
  }>;
  readinessChecks: Array<{
    detail: string;
    done: boolean;
    label: string;
  }>;
  stateLabel: string;
  steps: Array<{
    detail: string;
    label: string;
  }>;
}

export interface BetaWalkthroughStep {
  detail: string;
  href: string;
  label: string;
  state: BetaLoopStepState;
}

export interface StaffBetaProofWalkthrough {
  heading: string;
  note: string;
  steps: BetaWalkthroughStep[];
}

export function betaWalkthroughSteps(summary: BetaLoopSummary): BetaWalkthroughStep[] {
  return [
    {
      detail: "Manual facts saved",
      href: "/owner#manual-source-intake",
      label: "Source",
      state: summary.steps.find((step) => step.id === "sources")?.state ?? "blocked"
    },
    {
      detail: "Owner decides",
      href: "/owner#answers",
      label: "Review",
      state: summary.steps.find((step) => step.id === "answers")?.state ?? "blocked"
    },
    {
      detail: "Staff work created",
      href: "/staff/tasks",
      label: "Task",
      state: summary.steps.find((step) => step.id === "tasks")?.state ?? "blocked"
    },
    {
      detail: "Live gates closed",
      href: "/owner#channels",
      label: "Guardrails",
      state: "blocked"
    }
  ];
}

export function staffBetaProofWalkthrough(taskProof: TaskProofSummary | undefined): StaffBetaProofWalkthrough {
  const isAnswerReviewTask = taskProof?.origin === "answer_review";
  const isResolved = taskProof?.checklist.every((item) => item.done) ?? false;

  return {
    heading: isAnswerReviewTask
      ? "Owner review reached staff"
      : taskProof
        ? "Staff proof is in progress"
        : "Staff task proof",
    note: taskProof
      ? taskProof.detail
      : "Select a task to see how local beta work moves from owner setup into staff resolution.",
    steps: [
      {
        detail: "Manual source facts",
        href: "/owner#manual-source-intake",
        label: "Source",
        state: "done"
      },
      {
        detail: isAnswerReviewTask ? "Review created task" : "Owner or staff intake",
        href: "/owner#answers",
        label: "Review",
        state: taskProof ? "done" : "active"
      },
      {
        detail: taskProof?.title ?? "Selected staff task",
        href: "/staff/tasks",
        label: "Task",
        state: taskProof ? (isResolved ? "done" : "active") : "blocked"
      },
      {
        detail: "Phone and email off",
        href: "/owner#channels",
        label: "Guardrails",
        state: "blocked"
      }
    ]
  };
}

export function ownerBetaLoopSummary({
  answerBankEntries,
  notificationDestinations,
  providerConnections,
  sourceDocuments,
  tasks
}: {
  answerBankEntries: AnswerBankEntry[];
  notificationDestinations: NotificationDestination[];
  providerConnections: ProviderConnection[];
  sourceDocuments: SourceDocument[];
  tasks: Task[];
}): BetaLoopSummary {
  const answerReadiness = answerBankReadiness(answerBankEntries);
  const sourceReadiness = sourceDocumentReadiness(sourceDocuments);
  const destinationReadiness = notificationDestinationReadiness(notificationDestinations);
  const providerReadiness = providerConnectionReadiness(providerConnections);
  const unresolvedTasks = tasks.filter(isUnresolvedTask).length;
  const manualTasks = tasks.filter((task) => task.channel === "manual").length;
  const hasTaskProof = tasks.length > 0;

  const steps: BetaLoopStep[] = [
    {
      id: "sources",
      label: "Stage source facts",
      detail:
        sourceReadiness.factsFound > 0
          ? `${sourceReadiness.factsFound} facts staged with ${sourceReadiness.conflictsFound} conflict ${
              sourceReadiness.conflictsFound === 1 ? "flag" : "flags"
            }.`
          : "Add manual source notes before staging answer proposals.",
      href: "/owner#manual-source-intake",
      state: sourceReadiness.factsFound > 0 ? "done" : "active"
    },
    {
      id: "answers",
      label: "Approve safe answers",
      detail:
        answerReadiness.needsReview > 0
          ? `${answerReadiness.needsReview} draft or conflict ${
              answerReadiness.needsReview === 1 ? "answer needs" : "answers need"
            } owner review.`
          : `${answerReadiness.approved} approved ${
              answerReadiness.approved === 1 ? "answer is" : "answers are"
            } ready for local proof.`,
      href: "/owner#answers",
      state: answerReadiness.needsReview > 0 ? "active" : answerReadiness.approved > 0 ? "done" : "blocked"
    },
    {
      id: "tasks",
      label: "Prove staff work",
      detail: hasTaskProof
        ? `${tasks.length} ${tasks.length === 1 ? "task exists" : "tasks exist"} with ${unresolvedTasks} unresolved and ${manualTasks} manual ${
            manualTasks === 1 ? "entry" : "entries"
          }.`
        : "Create one manual staff task before treating the local beta loop as exercised.",
      href: "/staff/tasks",
      state: hasTaskProof ? (unresolvedTasks > 0 ? "active" : "done") : "blocked"
    },
    {
      id: "channels",
      label: "Keep live gates closed",
      detail:
        providerReadiness.notConfigured + providerReadiness.disabled > 0
          ? `${providerReadiness.notConfigured} provider ${
              providerReadiness.notConfigured === 1 ? "stub is" : "stubs are"
            } not configured and ${providerReadiness.disabled} disabled.`
          : "Provider stubs are present, but hosted proof is still required before live traffic.",
      href: "/owner#channels",
      state: "blocked"
    }
  ];
  const localProofSteps = steps.filter((step) => step.id !== "channels");
  const completedSteps = localProofSteps.filter((step) => step.state === "done").length;
  const currentFocus = steps.find((step) => step.state === "active") ?? steps.find((step) => step.state === "blocked") ?? steps[0];
  const readyForLocalBeta =
    sourceReadiness.factsFound > 0 &&
    answerReadiness.approved > 0 &&
    answerReadiness.needsReview === 0 &&
    hasTaskProof &&
    unresolvedTasks === 0 &&
    destinationReadiness.readyForTasks;

  const blockedReasons = [
    "hosted Neon proof must stay current in AGENTS.md/PLOT.md before any customer beta handoff",
    "phone and email providers are intentionally disconnected",
    sourceReadiness.factsFound === 0 ? "source facts have not been staged" : null,
    answerReadiness.needsReview > 0 ? "answer review is not complete" : null,
    answerReadiness.needsReview === 0 && answerReadiness.approved === 0 ? "no approved answers are ready" : null,
    !hasTaskProof ? "no staff task has been created for local proof" : null,
    hasTaskProof && unresolvedTasks > 0 ? "staff task proof is still unresolved" : null,
    !destinationReadiness.readyForTasks ? "task queue destination is not ready" : null
  ].filter((reason): reason is string => reason !== null);

  return {
    blockedReasons,
    completedSteps,
    currentFocus,
    localProofPercent: Math.round((completedSteps / localProofSteps.length) * 100),
    primaryActionHref: currentFocus.href,
    primaryActionLabel:
      currentFocus.state === "done"
        ? "Review local proof"
        : currentFocus.state === "active"
          ? currentFocus.label
          : "Review blocked gate",
    readyForLocalBeta,
    steps,
    totalLocalProofSteps: localProofSteps.length
  };
}

export function ownerLocalBetaRehearsalChecklist(summary: BetaLoopSummary): BetaRehearsalChecklist {
  return {
    blockers: [
      "Hosted Neon proof is tracked in AGENTS.md/PLOT.md; rerun it before any customer beta handoff.",
      "Phone, email, Retell, Resend/Gmail, billing, and live provider behavior remain disconnected."
    ],
    commands: [
      {
        label: "Neon Auth/Data API verifier",
        detail: "Seeds Neon Auth users, applies app seed rows, proves tenant RLS reads, edits one answer through RPC, and denies a cross-tenant edit.",
        command:
          "NEXT_PUBLIC_NEON_AUTH_URL=<Neon Auth URL> NEXT_PUBLIC_NEON_DATA_API_URL=<Neon Data API URL> npm run beta:rehearsal:local"
      },
      {
        label: "Staff claim verifier placeholder",
        detail: "Legacy local entry point for the narrower Auth/Data API verifier while hosted beta workflow proof is handled separately.",
        command:
          "NEXT_PUBLIC_NEON_AUTH_URL=<Neon Auth URL> NEXT_PUBLIC_NEON_DATA_API_URL=<Neon Data API URL> npm run staff:claim:rehearsal:local"
      },
      {
        label: "Hosted beta workflow verifier",
        detail:
          "Runs hosted readiness, owner staff-roster setup, staff Auth claim, manual source intake, answer review task creation, staff task actions, and owner/staff route smoke on a dedicated Neon branch.",
        command:
          "OUTPOST_NEON_PROJECT_ID=<project> OUTPOST_NEON_BRANCH_NAME=<branch> NEXT_PUBLIC_NEON_AUTH_URL=<Neon Auth URL> NEXT_PUBLIC_NEON_DATA_API_URL=<Neon Data API URL> NEXT_PUBLIC_OUTPOST_APP_URL=http://localhost:3102 OUTPOST_NEON_SEED_PASSWORD=<rotated password> npm run hosted:beta-workflow"
      }
    ],
    docsHref: "/docs/setup/local-beta-operator-runbook.md",
    heading: summary.readyForLocalBeta ? "Local rehearsal complete" : "Local rehearsal command",
    nextAction: summary.readyForLocalBeta
      ? "Reset the Neon branch before rerunning the verifier or before recording a fresh demo path."
      : "Run after configuring Neon Auth and Data API endpoint env vars.",
    operatorSteps: [
      {
        label: "Reset local proof data",
        detail: "Start from a clean Neon branch, then run the Auth/Data API RLS verifier."
      },
      {
        label: "Run both verifier entry points",
        detail: "Use public Neon Auth and Data API URLs; never use owner database credentials."
      },
      {
        label: "Inspect owner and staff screens",
        detail: "Capture `/owner` and `/staff/tasks` locally and verify proof copy stays local-only."
      },
      {
        label: "Reset after proof",
        detail: "Return the local database to seed state before handing the branch to the next operator."
      }
    ],
    readinessChecks: [
      {
        label: "Source facts staged",
        detail: "Manual source facts exist for the tenant.",
        done: summary.steps.find((step) => step.id === "sources")?.state === "done"
      },
      {
        label: "Owner review complete",
        detail: "Draft/conflict answers are approved or intentionally routed.",
        done: summary.steps.find((step) => step.id === "answers")?.state === "done"
      },
      {
        label: "Staff proof resolved",
        detail: "At least one task exists and unresolved local proof work is complete.",
        done: summary.steps.find((step) => step.id === "tasks")?.state === "done"
      },
      {
        label: "Hosted/live gates closed",
        detail: "Hosted Neon proof must stay current and live providers remain disconnected before customer readiness.",
        done: false
      }
    ],
    stateLabel: summary.readyForLocalBeta ? "Local proof packaged" : "Local proof pending",
    steps: [
      {
        label: "Seed Neon Auth users",
        detail: "Creates or reuses seeded owner/staff auth accounts and maps app seed rows to the real Neon Auth ids."
      },
      {
        label: "Prove tenant RLS reads",
        detail: "Signs in seeded Acme Fitness and Peak CrossFit owners and verifies each can read only its own tenant rows."
      },
      {
        label: "Edit one answer through RPC",
        detail: "Updates one Acme Fitness draft answer through the Neon Data API and verifies revision plus audit rows."
      },
      {
        label: "Deny cross-tenant mutation",
        detail: "Attempts the same answer edit as the Peak CrossFit owner and expects the RPC to fail."
      },
      {
        label: "Keep live gates blocked",
        detail: "Finishes with verifier proof only while customer beta handoff and provider gates remain blocked."
      }
    ]
  };
}
