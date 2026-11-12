"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  OwnerSetupActionState,
  PersistenceMode,
} from "@/application/owner-setup/action-result";
import { AppShell, type AppShellAccount } from "@/components/AppShell";
import { AnswerBankReviewClient } from "@/components/owner/AnswerBankReviewClient";
import { AcmeHandoffReadinessPanel } from "@/components/owner/AcmeHandoffReadinessPanel";
import { HandoffRulesEditor } from "@/components/owner/HandoffRulesEditor";
import { ManualSourceIntakeEditor } from "@/components/owner/ManualSourceIntakeEditor";
import { OwnerBurdenReportPanel } from "@/components/owner/OwnerBurdenReportPanel";
import { NotificationDestinationEditor } from "@/components/owner/NotificationDestinationEditor";
import { OwnerBetaLoopPanel } from "@/components/owner/OwnerBetaLoopPanel";
import { OwnerBetaRehearsalPanel } from "@/components/owner/OwnerBetaRehearsalPanel";
import { OwnerBetaSupportReadinessPanel } from "@/components/owner/OwnerBetaSupportReadinessPanel";
import { OwnerReadinessBanner } from "@/components/owner/OwnerReadinessBanner";
import { RuntimeControlPanel } from "@/components/owner/RuntimeControlPanel";
import { RuntimeGuardrailPreviewPanel } from "@/components/owner/RuntimeGuardrailPreviewPanel";
import { RuntimePolicyCandidatePanel } from "@/components/owner/RuntimePolicyCandidatePanel";
import { OwnerSetupRail } from "@/components/owner/OwnerSetupRail";
import { StaffAccessPanel } from "@/components/owner/StaffAccessPanel";
import {
  answerApprovalSummaries,
  answerBankReadiness,
  notificationDestinationReadiness,
  ownerSetupSteps,
  sourceDocumentReadiness
} from "@/domain/answer-bank";
import { ownerBetaLoopSummary, ownerLocalBetaRehearsalChecklist } from "@/domain/beta-loop";
import { betaSupportReadinessLedger } from "@/domain/beta-support-readiness";
import { ownerBurdenReport } from "@/domain/burden-report";
import type { ProviderConnection } from "@/domain/channels";
import { providerConnectionReadiness } from "@/domain/channels";
import { acmeFitnessHandoffReadinessLedger, isAcmeFitnessHandoffTenant } from "@/domain/acme-handoff-readiness";
import {
  addDraftHandoffRule,
  addDraftNotificationDestination,
  createOwnerSetupDraftState,
  ownerSetupStorageKey,
  reconcileOwnerSetupDraftState,
  removeDraftHandoffRule,
  removeDraftNotificationDestination,
  type OwnerSetupDraftSeed,
  type OwnerSetupDraftState
} from "@/domain/owner-setup-draft";
import type { SourceDocument } from "@/domain/sources";
import type { Task, TaskEvent } from "@/domain/tasks";
import {
  taskActivityTrailSummaries,
  taskAgeSummaries,
  taskAttentionSummaries,
  taskAssigneeSummaries,
  taskChannelSummaries,
  taskConfidenceSummaries,
  taskFollowUpModeSummaries,
  taskIntentSummaries,
  taskLastTouchSummaries,
  taskLocationSummaries,
  taskMemberSystemBoundarySummaries,
  taskMemberSystemHoldQueue,
  taskOwnerPolicyDependencySummaries,
  taskOwnerPolicyReviewQueue,
  taskNextStepSummaries,
  taskProofCompletionSummaries,
  taskRequesterContactSummaries,
  taskQueueStateSummary,
  taskStaffActionLaneSummaries,
  taskStaffReplyReadyQueue,
  taskStatusSummaries,
  taskWorkflowStageSummaries
} from "@/domain/tasks";
import type { Location, Plan, Tenant, TenantMember } from "@/domain/tenancy";
import type { UsageEvent } from "@/domain/usage";
import type { TenantRuntimeControl } from "@/domain/runtime-control";
import type {
  RuntimePolicyCandidateLineageView,
  RuntimePolicyCandidateReviewManifestView,
  RuntimePolicyReviewCurrentnessRecord,
  RuntimePolicyReviewHistoryView,
  RuntimePolicySnapshotRecord,
} from "@/domain/runtime-policy-records";
import { ownerRuntimeGuardrailPreviews } from "@/domain/runtime-guardrails";
import { usagePlaceholderSummary } from "@/domain/usage";

interface OwnerSetupWorkspaceClientProps extends OwnerSetupDraftSeed {
  account?: AppShellAccount;
  locations: Location[];
  onApproveAnswer: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onCreateTaskFromAnswer: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onCreateHandoffRuleDraft: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onCreateNotificationDestinationDraft: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onDisableTenantStaffMember: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onEditDraftAnswer: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onProposeAnswersFromManualSource: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onRetireAnswer: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onSetRuntimeProcessingState: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onRecordRuntimePolicyCandidate: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onReviewRuntimePolicyCandidate: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onUpdateHandoffRule: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onUpdateLocationProfile: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onUpdateNotificationDestination: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onUpsertManualSourceDocument: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onUpsertTenantStaffMember: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  persistenceMessage: string;
  persistenceMode: PersistenceMode;
  plan?: Plan;
  providerConnections: ProviderConnection[];
  runtimeControl: TenantRuntimeControl;
  runtimePolicyCandidateLineage: RuntimePolicyCandidateLineageView[];
  runtimePolicyCandidateReviewManifests: RuntimePolicyCandidateReviewManifestView[];
  runtimePolicyPersistenceMode: PersistenceMode;
  runtimePolicyReviewCurrentness: RuntimePolicyReviewCurrentnessRecord[];
  runtimePolicyReviewHistory: RuntimePolicyReviewHistoryView[];
  runtimePolicyWriterAvailable: boolean;
  runtimePolicySnapshots: RuntimePolicySnapshotRecord[];
  sourceDocuments: SourceDocument[];
  staffMembers: TenantMember[];
  tasks: Task[];
  taskEvents: TaskEvent[];
  tenant: Tenant;
  usageEvents: UsageEvent[];
}

function loadStoredDraft(storageKey: string): OwnerSetupDraftState | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as OwnerSetupDraftState) : null;
  } catch {
    return null;
  }
}

export function OwnerSetupWorkspaceClient({
  account,
  answerBankEntries,
  handoffRules,
  locations,
  notificationDestinations,
  onApproveAnswer,
  onCreateTaskFromAnswer,
  onCreateHandoffRuleDraft,
  onCreateNotificationDestinationDraft,
  onDisableTenantStaffMember,
  onEditDraftAnswer,
  onProposeAnswersFromManualSource,
  onRetireAnswer,
  onSetRuntimeProcessingState,
  onRecordRuntimePolicyCandidate,
  onReviewRuntimePolicyCandidate,
  onUpdateHandoffRule,
  onUpdateLocationProfile: _onUpdateLocationProfile,
  onUpdateNotificationDestination,
  onUpsertManualSourceDocument,
  onUpsertTenantStaffMember,
  persistenceMessage,
  persistenceMode,
  providerConnections,
  runtimeControl,
  runtimePolicyCandidateLineage,
  runtimePolicyCandidateReviewManifests,
  runtimePolicyPersistenceMode,
  runtimePolicyReviewCurrentness,
  runtimePolicyReviewHistory,
  runtimePolicySnapshots,
  runtimePolicyWriterAvailable,
  sourceDocuments,
  staffMembers,
  tasks,
  taskEvents,
  tenant,
  usageEvents
}: OwnerSetupWorkspaceClientProps) {
  const seed = useMemo(
    () => ({ answerBankEntries: [], handoffRules, notificationDestinations }),
    [handoffRules, notificationDestinations]
  );
  const storageKey = ownerSetupStorageKey(tenant.id);
  const [draft, setDraft] = useState(() => createOwnerSetupDraftState(seed));
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    setDraft(reconcileOwnerSetupDraftState(seed, loadStoredDraft(storageKey)));
    setHasHydrated(true);
  }, [seed, storageKey]);

  useEffect(() => {
    if (hasHydrated) {
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
    }
  }, [draft, hasHydrated, storageKey]);

  function resetDraft() {
    const resetState = createOwnerSetupDraftState(seed);
    window.localStorage.removeItem(storageKey);
    setDraft(resetState);
  }

  const readiness = answerBankReadiness(answerBankEntries);
  const approvalSummaries = answerApprovalSummaries(answerBankEntries);
  const sourceReadiness = sourceDocumentReadiness(sourceDocuments);
  const destinationReadiness = notificationDestinationReadiness(draft.notificationDestinations);
  const providerReadiness = providerConnectionReadiness(providerConnections);
  const usageSummary = usagePlaceholderSummary(usageEvents);
  const taskActivityTrailSummaryRows = taskActivityTrailSummaries(tasks, taskEvents);
  const taskChannelSummaryRows = taskChannelSummaries(tasks);
  const taskLocationSummaryRows = taskLocationSummaries(tasks, locations);
  const taskAssigneeSummaryRows = taskAssigneeSummaries(
    tasks,
    staffMembers.map((member) => ({ id: member.userId, name: member.name }))
  );
  const taskAgeSummaryRows = taskAgeSummaries(tasks);
  const taskLastTouchSummaryRows = taskLastTouchSummaries(tasks);
  const taskAttentionSummaryRows = taskAttentionSummaries(tasks);
  const taskConfidenceSummaryRows = taskConfidenceSummaries(tasks);
  const taskFollowUpModeSummaryRows = taskFollowUpModeSummaries(tasks);
  const taskMemberSystemBoundarySummaryRows = taskMemberSystemBoundarySummaries(tasks);
  const memberSystemHoldQueueRows = taskMemberSystemHoldQueue(tasks);
  const taskOwnerPolicyDependencySummaryRows = taskOwnerPolicyDependencySummaries(tasks);
  const ownerPolicyReviewQueueRows = taskOwnerPolicyReviewQueue(tasks);
  const staffReplyReadyQueueRows = taskStaffReplyReadyQueue(tasks);
  const taskIntentSummaryRows = taskIntentSummaries(tasks);
  const taskNextStepSummaryRows = taskNextStepSummaries(tasks);
  const taskProofCompletionSummaryRows = taskProofCompletionSummaries(tasks, taskEvents);
  const taskRequesterContactSummaryRows = taskRequesterContactSummaries(tasks);
  const taskQueueSummary = taskQueueStateSummary(tasks);
  const taskStaffActionLaneSummaryRows = taskStaffActionLaneSummaries(tasks);
  const taskStatusSummaryRows = taskStatusSummaries(tasks);
  const taskWorkflowStageSummaryRows = taskWorkflowStageSummaries(tasks);
  const betaLoopSummary = ownerBetaLoopSummary({
    answerBankEntries,
    notificationDestinations: draft.notificationDestinations,
    providerConnections,
    sourceDocuments,
    tasks
  });
  const betaRehearsalChecklist = ownerLocalBetaRehearsalChecklist(betaLoopSummary);
  const betaSupportLedger = betaSupportReadinessLedger();
  const acmeHandoffLedger = useMemo(
    () => (isAcmeFitnessHandoffTenant(tenant) ? acmeFitnessHandoffReadinessLedger() : null),
    [tenant]
  );
  const burdenReport = ownerBurdenReport({
    answerBankEntries,
    betaLoopSummary,
    locations,
    sourceDocuments,
    tasks,
    taskEvents,
    users: staffMembers.map((member) => ({ id: member.userId, name: member.name }))
  });
  const runtimeGuardrailPreviews = ownerRuntimeGuardrailPreviews({
    answerBankEntries,
    handoffRules: draft.handoffRules,
    locations,
    tenantId: tenant.id
  });
  const setupSteps = ownerSetupSteps({
    locations,
    answerBankEntries,
    handoffRules: draft.handoffRules,
    sourceDocuments,
    notificationDestinations: draft.notificationDestinations
  });
  const launchBlockedReasons = [
    readiness.needsReview > 0
      ? { href: "/owner#answers", label: `${readiness.needsReview} answer-bank review item` }
      : null,
    sourceReadiness.conflictsFound > 0
      ? { href: "/owner#manual-source-intake", label: `${sourceReadiness.conflictsFound} public fact conflict` }
      : null,
    destinationReadiness.draft > 0
      ? { href: "/owner#notifications", label: `${destinationReadiness.draft} notification destination draft` }
      : null,
    { href: "/owner#channels", label: "phone and email providers not connected" }
  ].filter((reason): reason is { href: string; label: string } => reason !== null);

  return (
    <AppShell
      account={account}
      activeNav="owner"
      metrics={[
        { label: "Locations", value: locations.length },
        { label: "Approved", value: readiness.approved },
        { attention: true, label: "Review queue", value: readiness.needsReview }
      ]}
      tenantName={tenant.name}
      subtitle="Owner workspace"
    >
      <section className="page-header owner-page-header">
        <div>
          <h1>Owner review workspace</h1>
          <p>
            Turn manual source facts into approved answers and staff-ready follow-up before
            phone and email channels are allowed to go live.
          </p>
        </div>
        <div className="page-actions">
          <button className="button" onClick={resetDraft} type="button">
            Reset local draft
          </button>
          <a className="button" href="#handoff-rules">Handoff rules</a>
          <Link className="button button-primary" href={betaLoopSummary.primaryActionHref}>
            {betaLoopSummary.primaryActionLabel}
          </Link>
        </div>
      </section>

      <div className="owner-workspace-status">
        <RuntimeControlPanel
          control={runtimeControl}
          onSetRuntimeProcessingState={onSetRuntimeProcessingState}
          persistenceMode={persistenceMode}
          tenantId={tenant.id}
        />
        <OwnerBetaLoopPanel persistenceMode={persistenceMode} summary={betaLoopSummary} />
        <OwnerBurdenReportPanel report={burdenReport} />
        <RuntimeGuardrailPreviewPanel previews={runtimeGuardrailPreviews} />
        <RuntimePolicyCandidatePanel
          candidateLineage={runtimePolicyCandidateLineage}
          candidateManifests={runtimePolicyCandidateReviewManifests}
          locations={locations}
          onRecordRuntimePolicyCandidate={onRecordRuntimePolicyCandidate}
          onReviewRuntimePolicyCandidate={onReviewRuntimePolicyCandidate}
          persistenceMode={runtimePolicyPersistenceMode}
          policyWriterAvailable={runtimePolicyWriterAvailable}
          reviewCurrentness={runtimePolicyReviewCurrentness}
          reviewHistory={runtimePolicyReviewHistory}
          snapshots={runtimePolicySnapshots}
          tenantId={tenant.id}
        />
        <section className="panel owner-staff-queue-snapshot" aria-label="Staff queue snapshot">
          <div className="panel-header">
            <div>
              <span className="rail-title">Staff queue</span>
              <h2>Open work stays visible before channels go live</h2>
              <p>
                Read-only snapshot of current staff tasks. Review the workboard
                for details; this does not send notifications or enable live providers.
              </p>
            </div>
            <Link className="mini-button quiet" href="/staff/tasks">
              View workboard
            </Link>
          </div>
          <div className="owner-staff-queue-metrics" aria-label="Staff queue state counts">
            <div>
              <span>Open</span>
              <strong>{taskQueueSummary.openCount}</strong>
            </div>
            <div>
              <span>Terminal</span>
              <strong>{taskQueueSummary.terminalCount}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{taskQueueSummary.totalCount}</strong>
            </div>
          </div>
          <div className="owner-staff-status-mix" aria-label="Staff task status mix">
            {taskStatusSummaryRows.map((summary) => (
              <div className={`task-status-${summary.status}`} key={summary.status}>
                <span>{summary.label}</span>
                <strong>{summary.count}</strong>
              </div>
            ))}
          </div>
          <div className="owner-staff-workflow-stage-mix" aria-label="Staff task workflow-stage mix">
            {taskWorkflowStageSummaryRows.map((summary) => (
              <div
                className={`task-workflow-stage-${summary.stage}`}
                key={summary.stage}
              >
                <span>{summary.label}</span>
                <strong>{summary.count}</strong>
                <small>{summary.unresolvedCount} open · {summary.detail}</small>
              </div>
            ))}
          </div>
          <div className="owner-staff-follow-up-mode-mix" aria-label="Staff follow-up mode mix">
            {taskFollowUpModeSummaryRows.map((summary) => (
              <div
                className={`task-follow-up-mode-${summary.mode}`}
                key={summary.mode}
              >
                <span>{summary.label}</span>
                <strong>{summary.unresolvedCount}</strong>
                <small>{summary.count} total · {summary.detail}</small>
              </div>
            ))}
          </div>
          <div
            className="owner-staff-member-system-boundary-mix"
            aria-label="Staff member-system boundary mix"
          >
            {taskMemberSystemBoundarySummaryRows.map((summary) => (
              <div
                className={`task-member-system-boundary-${summary.boundary}`}
                key={summary.boundary}
              >
                <span>{summary.label}</span>
                <strong>{summary.count}</strong>
                <small>{summary.unresolvedCount} open · {summary.detail}</small>
              </div>
            ))}
          </div>
          <div
            className="owner-staff-owner-policy-dependency-mix"
            aria-label="Staff owner-policy dependency mix"
          >
            {taskOwnerPolicyDependencySummaryRows.map((summary) => (
              <div
                className={`task-owner-policy-dependency-${summary.dependency}`}
                key={summary.dependency}
              >
                <span>{summary.label}</span>
                <strong>{summary.count}</strong>
                <small>{summary.unresolvedCount} open · {summary.detail}</small>
              </div>
            ))}
          </div>
          <div
            className="owner-staff-action-lane-mix"
            aria-label="Staff action-lane mix"
          >
            {taskStaffActionLaneSummaryRows.map((summary) => (
              <div
                className={`task-staff-action-lane-${summary.lane}`}
                key={summary.lane}
              >
                <span>{summary.label}</span>
                <strong>{summary.count}</strong>
                <small>{summary.unresolvedCount} open · {summary.detail}</small>
              </div>
            ))}
          </div>
          <div
            className="task-action-queue owner-member-system-hold-queue"
            aria-label="Member-system hold queue"
            role="region"
          >
            {memberSystemHoldQueueRows.length > 0 ? (
              memberSystemHoldQueueRows.map((item) => (
                <article
                  className="task-action-queue-item task-action-queue-item-member-system-hold"
                  key={item.taskId}
                >
                  <span>{item.requesterName}</span>
                  <strong>{item.intent}</strong>
                  <small>{item.suggestedNextStep}</small>
                </article>
              ))
            ) : (
              <div className="quiet-strip">
                <strong>No member-system hold tasks</strong>
                <span className="muted">
                  No current staff work crosses the protected member-system boundary.
                </span>
              </div>
            )}
          </div>
          <div className="owner-policy-review-queue" aria-label="Owner policy review queue">
            {ownerPolicyReviewQueueRows.length > 0 ? (
              ownerPolicyReviewQueueRows.map((item) => (
                <article className="owner-policy-review-queue-item" key={item.taskId}>
                  <span>{item.requesterName}</span>
                  <strong>{item.intent}</strong>
                  <small>{item.suggestedNextStep}</small>
                </article>
              ))
            ) : (
              <div className="quiet-strip">
                <strong>No owner-policy review tasks</strong>
                <span className="muted">
                  Staff reply-ready work can continue inside the guarded workboard.
                </span>
              </div>
            )}
          </div>
          <div
            className="task-action-queue owner-staff-reply-ready-queue"
            aria-label="Staff reply-ready queue"
            role="region"
          >
            {staffReplyReadyQueueRows.length > 0 ? (
              staffReplyReadyQueueRows.map((item) => (
                <article
                  className="task-action-queue-item task-action-queue-item-staff-reply-ready"
                  key={item.taskId}
                >
                  <span>{item.requesterName}</span>
                  <strong>{item.intent}</strong>
                  <small>{item.suggestedNextStep}</small>
                </article>
              ))
            ) : (
              <div className="quiet-strip">
                <strong>No staff reply-ready tasks</strong>
                <span className="muted">
                  Review owner-policy and member-system hold lanes before follow-up.
                </span>
              </div>
            )}
          </div>
          <div className="owner-staff-activity-trail-mix" aria-label="Staff task activity trail mix">
            {taskActivityTrailSummaryRows.map((summary) => (
              <div
                className={`task-activity-trail-${summary.trailKind}`}
                key={summary.trailKind}
              >
                <span>{summary.label}</span>
                <strong>{summary.count}</strong>
                <small>{summary.unresolvedCount} open · {summary.detail}</small>
              </div>
            ))}
          </div>
          <div className="owner-staff-channel-mix" aria-label="Staff task channel mix">
            {taskChannelSummaryRows.map((summary) => (
              <div className={`task-channel-${summary.channel}`} key={summary.channel}>
                <span>{summary.label}</span>
                <strong>{summary.unresolvedCount}</strong>
                <small>{summary.count} total</small>
              </div>
            ))}
          </div>
          <div className="owner-staff-location-mix" aria-label="Staff task location mix">
            {taskLocationSummaryRows.map((summary) => (
              <div key={summary.locationId}>
                <span>{summary.label}</span>
                <strong>{summary.unresolvedCount}</strong>
                <small>{summary.count} total</small>
              </div>
            ))}
          </div>
          <div className="owner-staff-assignee-mix" aria-label="Staff task assignee mix">
            {taskAssigneeSummaryRows.map((summary) => (
              <div key={summary.value}>
                <span>{summary.label}</span>
                <strong>{summary.unresolvedCount}</strong>
                <small>{summary.count} total</small>
              </div>
            ))}
          </div>
          <div className="owner-staff-age-mix" aria-label="Staff task age mix">
            {taskAgeSummaryRows.map((summary) => (
              <div className={`task-age-${summary.ageBucket}`} key={summary.ageBucket}>
                <span>{summary.label}</span>
                <strong>{summary.count}</strong>
                <small>{summary.unresolvedCount} open · {summary.detail}</small>
              </div>
            ))}
          </div>
          <div className="owner-staff-last-touch-mix" aria-label="Staff task last-touch mix">
            {taskLastTouchSummaryRows.map((summary) => (
              <div
                className={`task-last-touch-${summary.lastTouchBucket}`}
                key={summary.lastTouchBucket}
              >
                <span>{summary.label}</span>
                <strong>{summary.count}</strong>
                <small>{summary.unresolvedCount} open · {summary.detail}</small>
              </div>
            ))}
          </div>
          <div className="owner-staff-attention-mix" aria-label="Staff task attention mix">
            {taskAttentionSummaryRows.map((summary) => (
              <div className={`task-attention-${summary.level}`} key={summary.level}>
                <span>{summary.label}</span>
                <strong>{summary.count}</strong>
                <small>{summary.unresolvedCount} open · {summary.detail}</small>
              </div>
            ))}
          </div>
          <div className="owner-staff-confidence-mix" aria-label="Staff task confidence mix">
            {taskConfidenceSummaryRows.map((summary) => (
              <div className={`task-confidence-${summary.confidenceBucket}`} key={summary.confidenceBucket}>
                <span>{summary.label}</span>
                <strong>{summary.count}</strong>
                <small>{summary.unresolvedCount} open · {summary.detail}</small>
              </div>
            ))}
          </div>
          <div className="owner-staff-proof-completion-mix" aria-label="Staff task proof completion mix">
            {taskProofCompletionSummaryRows.map((summary) => (
              <div
                className={`task-proof-completion-${summary.state}`}
                key={summary.state}
              >
                <span>{summary.label}</span>
                <strong>{summary.count}</strong>
                <small>{summary.unresolvedCount} open · {summary.detail}</small>
              </div>
            ))}
          </div>
          <div className="owner-staff-intent-mix" aria-label="Staff task intent mix">
            {taskIntentSummaryRows.map((summary) => (
              <div key={summary.intentKey}>
                <span title={summary.fullLabel}>{summary.label}</span>
                <strong>{summary.unresolvedCount}</strong>
                <small>{summary.count} total</small>
              </div>
            ))}
          </div>
          <div className="owner-staff-next-step-mix" aria-label="Staff task next-step mix">
            {taskNextStepSummaryRows.map((summary) => (
              <div key={summary.nextStepKey}>
                <span title={summary.fullLabel}>{summary.label}</span>
                <strong>{summary.unresolvedCount}</strong>
                <small>{summary.count} total</small>
              </div>
            ))}
          </div>
          <div className="owner-staff-requester-contact-mix" aria-label="Staff requester contact mix">
            {taskRequesterContactSummaryRows.map((summary) => (
              <div
                className={`task-requester-contact-${summary.contactKind}`}
                key={summary.contactKind}
              >
                <span>{summary.label}</span>
                <strong>{summary.unresolvedCount}</strong>
                <small>{summary.count} total · {summary.detail}</small>
              </div>
            ))}
          </div>
          <div className="quiet-strip">
            <strong>Human-owned queue only</strong>
            <span className="muted">
              Phone/email providers, outbound delivery, billing, POS, access
              control, and member-ledger writes remain blocked.
            </span>
          </div>
        </section>
        <OwnerReadinessBanner blockers={launchBlockedReasons} />
        <OwnerBetaRehearsalPanel checklist={betaRehearsalChecklist} />
        <OwnerBetaSupportReadinessPanel ledger={betaSupportLedger} />
        {acmeHandoffLedger ? <AcmeHandoffReadinessPanel ledger={acmeHandoffLedger} /> : null}
      </div>

      <div className="command-layout owner-setup-layout section-gap">
        <ManualSourceIntakeEditor
          locations={locations}
          onProposeAnswersFromManualSource={onProposeAnswersFromManualSource}
          onUpsertManualSourceDocument={onUpsertManualSourceDocument}
          persistenceMode={persistenceMode}
          sourceDocuments={sourceDocuments}
          tenantId={tenant.id}
        />
        <AnswerBankReviewClient
          entries={answerBankEntries}
          onApproveAnswer={onApproveAnswer}
          onCreateTaskFromAnswer={onCreateTaskFromAnswer}
          onEditDraftAnswer={onEditDraftAnswer}
          onRetireAnswer={onRetireAnswer}
          persistenceMessage={persistenceMessage}
          persistenceMode={persistenceMode}
          tenantId={tenant.id}
        />
        <div className="setup-editor-grid">
          <StaffAccessPanel
            members={staffMembers}
            onDisableTenantStaffMember={onDisableTenantStaffMember}
            onUpsertTenantStaffMember={onUpsertTenantStaffMember}
            persistenceMode={persistenceMode}
            tenantId={tenant.id}
          />
          <HandoffRulesEditor
            locations={locations}
            onCreateHandoffRuleDraft={onCreateHandoffRuleDraft}
            onAddDraftRule={() =>
              setDraft((current) => addDraftHandoffRule(current, tenant.id, undefined))
            }
            onRemoveDraftRule={(ruleId) =>
              setDraft((current) => removeDraftHandoffRule(current, ruleId))
            }
            onRulesChange={(rules) =>
              setDraft((current) => ({
                ...current,
                handoffRules: rules,
                updatedAt: new Date().toISOString()
              }))
            }
            onUpdateHandoffRule={onUpdateHandoffRule}
            persistenceMode={persistenceMode}
            rules={draft.handoffRules}
            tenantId={tenant.id}
          />
          <NotificationDestinationEditor
            locations={locations}
            onCreateNotificationDestinationDraft={onCreateNotificationDestinationDraft}
            destinations={draft.notificationDestinations}
            onAddDraftDestination={() =>
              setDraft((current) => addDraftNotificationDestination(current, tenant.id, undefined))
            }
            onDestinationsChange={(destinations) =>
              setDraft((current) => ({
                ...current,
                notificationDestinations: destinations,
                updatedAt: new Date().toISOString()
              }))
            }
            onRemoveDraftDestination={(destinationId) =>
              setDraft((current) => removeDraftNotificationDestination(current, destinationId))
            }
            onUpdateNotificationDestination={onUpdateNotificationDestination}
            persistenceMode={persistenceMode}
            tenantId={tenant.id}
          />
        </div>
        <section className="panel setup-editor" id="channels">
          <div className="panel-header">
            <div>
              <h2>Channel and usage stubs</h2>
              <p>Future phone, email, event, and usage records have homes. None are live.</p>
            </div>
            <span className="channel-pill">Blocked</span>
          </div>
          <div className="setup-editor-list">
            <div className="setup-editor-row">
              <div>
                <span className="rail-title">Provider readiness</span>
                <strong>{providerReadiness.notConfigured} not configured, {providerReadiness.disabled} disabled</strong>
                <p>Phone and email remain blocked until future provider setup, tests, and review.</p>
              </div>
            </div>
            <div className="setup-editor-row">
              <div>
                <span className="rail-title">Usage placeholders</span>
                <strong>{usageSummary.events} append-only seed event</strong>
                <p>No billing, overage, invoice, or upgrade recommendation behavior is computed.</p>
              </div>
            </div>
          </div>
        </section>
        <OwnerSetupRail
          approvalSummaries={approvalSummaries}
          handoffRules={draft.handoffRules}
          notificationDestinations={draft.notificationDestinations}
          readyForLiveAnswers={readiness.readyForLiveAnswers}
          setupSteps={setupSteps}
          sourceDocuments={sourceDocuments}
        />
      </div>
    </AppShell>
  );
}
