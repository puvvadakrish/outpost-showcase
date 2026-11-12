import {
  emptyFounderAdminBetaAccessRequestReport,
  founderAdminApprovedGymFollowthroughPacket,
  founderAdminAuthAdminProvisioningDryRun,
  founderAdminCustomerDemoGatePacket,
  founderAdminDemoOnboardingCompletion,
  founderAdminInviteDeliveryPreflight,
  founderAdminLimitedBetaOnboardingPacket,
  founderAdminOwnerAccessFulfillmentEvidence,
  founderAdminOwnerAccessCompletionProof,
  founderAdminStaffRosterHandoffEvidence,
  founderAdminOperatorOnboardingRehearsal,
  founderAdminHandoffProofBundle,
  founderAdminContinuousReadinessBatch,
  founderAdminProtectedPreviewWalkthrough,
  founderAdminCustomerHandoffSchedulingBatch,
  founderAdminCustomerHandoffGatePreflight,
  founderAdminCustomerSessionHostedImportReadiness,
  founderAdminLimitedBetaReadinessGate,
  founderAdminPostCustomerProofReadinessBatch,
  founderAdminApprovedBetaExpansionReadinessBatch,
  founderAdminRequestIntakeInviteAuthReadinessBatch,
  founderAdminOwnerStaffHandoffReadinessBatch,
  founderAdminApprovedGymHostedRehearsalReadinessBatch,
  founderAdminApprovedGymHostedRehearsalEvidence,
  founderAdminFirstGymGoNoGoBundle,
  founderAdminFirstGymOperatorRunRecord,
  founderAdminLimitedBetaOperatorReviewPacket,
  founderAdminPublicSelfServeLaunchPreflight,
  founderAdminPublicLaunchControlsBatch,
  founderAdminPublicLaunchNextReadinessBatch,
  founderAdminPublicRequestIntakeArtifact,
  founderAdminPublicRequestFollowupReadinessBatch,
  founderAdminPublicRequestCustomerSessionProofAcquisitionBatch,
  founderAdminPublicRequestFirstGymEvidenceAcquisitionBatch,
  founderAdminPublicRequestFirstGymCompletionGate,
  founderAdminPublicRequestFirstGymExecutionLedger,
  founderAdminPublicRequestFirstGymGoNoGoBundle,
  founderAdminPublicRequestFirstGymGoNoGoReadinessBatch,
  founderAdminPublicRequestFirstGymMissingProofPacket,
  founderAdminPublicRequestFirstGymOperatorRunRecord,
  founderAdminPublicRequestFirstGymProofSessionDiagnostics,
  founderAdminPublicRequestFirstGymProofSessionExecutionPack,
  founderAdminPublicRequestFirstGymProofSessionFollowupPreflight,
  founderAdminPublicRequestFirstGymProofSessionLaunchCheckpoint,
  founderAdminPublicRequestFirstGymProofCommandExecutionEnvelope,
  founderAdminPublicRequestFirstGymProofEvidenceIntakeManifest,
  founderAdminPublicRequestFirstGymProofEvidenceSessionHandoff,
  founderAdminPublicRequestFirstGymProofEvidenceSessionLedger,
  founderAdminPublicRequestFirstGymEvidenceExecutionReadiness,
  founderAdminPublicRequestFirstGymEvidenceRunCoordinator,
  founderAdminPublicRequestFirstGymProtectedPreviewEvidencePreflight,
  founderAdminPublicRequestFirstGymRealEvidenceExecutionGuard,
  founderAdminPublicRequestFirstGymRealEvidenceExecutionPacket,
  founderAdminPublicRequestFirstGymRealEvidenceRefreshCoordinator,
  founderAdminPublicRequestFirstGymRealEvidenceAttemptReadiness,
  founderAdminPublicRequestFirstGymProofSessionProgressBatch,
  founderAdminPublicRequestFirstGymProofSessionResumePacket,
  founderAdminPublicRequestFirstGymProofSessionRunbook,
  founderAdminPublicRequestFirstGymProofRunwayBatch,
  founderAdminPublicRequestLimitedBetaOperatorReviewPacket,
  founderAdminPublicRequestSelfServeLaunchPreflight,
  founderAdminPublicRequestHostedRehearsalEvidence,
  founderAdminPublicRequestHostedRehearsalReadinessBatch,
  founderAdminPublicRequestOwnerStaffHandoffReadinessBatch,
  founderAdminBetaRequestFollowThroughReadiness,
  founderAdminBetaRequestTriageReadiness,
  founderAdminBetaRequestOperatorSequence,
  founderAdminBetaFulfillmentPreflight,
  founderAdminDemoOnboardingRunway,
  founderAdminHandoffReadinessPacket,
  founderAdminLaunchFollowThroughReadiness,
  founderAdminLaunchDecisionPacketReadiness,
  founderAdminLaunchPackageReadiness,
  founderAdminNextSaasPreflights,
  founderAdminOperatorSelfServeRehearsalReadiness,
  founderAdminLaunchPromotionGate,
  founderAdminLaunchReadinessExport,
  founderAdminOperatorActionQueue,
  founderAdminOwnerOnboardingTimeline,
  founderAdminProofFreshnessSummary,
  founderAdminPublicRequestIntakeDryRun,
  founderAdminPublicSelfServePreflight,
  founderAdminStaffAccessPreflight,
  founderAdminSelfServeReadiness,
  operatorActionStateLabel,
  type FounderAdminBetaAccessRequestReport,
  type FounderAdminBetaAccessRequestRecord,
  type FounderAdminDemoOnboardingRunwaySlice,
  type FounderAdminProofStatusLedger,
  founderAdminReadinessSummary,
  type FounderAdminOwnerReadinessReport,
  type FounderAdminOwnerReadinessRow,
} from "@/domain/founder-admin-readiness";
import { displayLabel } from "@/domain/formatting";

function readinessLabel(value: string | null | undefined) {
  return value ? displayLabel(value) : "Missing";
}

function rollbackLabel(row: FounderAdminOwnerReadinessRow) {
  if (row.rollback_readiness.state === "dry_run_rollback_ready") {
    return "Rollback ready";
  }

  if (row.rollback_readiness.state === "blocked_seeded_tenant") {
    return "Seed tenant blocked";
  }

  if (row.rollback_readiness.state === "manual_review_required") {
    return "Manual review";
  }

  return "No tenant";
}

function proofKindLabel(value: string) {
  if (value === "hosted_founder_admin_readiness") {
    return "Admin portal proof";
  }

  if (value === "vercel_preview_verify") {
    return "Protected Preview proof";
  }

  return readinessLabel(value);
}

function shortProofHash(value: string | null | undefined) {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, 12)
    : "Missing";
}

type FounderProofEvidenceTimelineState = "pending" | "ready";

interface FounderProofEvidenceTimelineItem {
  detail: string;
  digest?: string;
  id: string;
  label: string;
  state: FounderProofEvidenceTimelineState;
  timestamp?: string;
}

function founderProofEvidenceTimeline(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderProofEvidenceTimelineItem[] {
  if (!proofLedger) {
    return [];
  }

  const hostedProof = proofLedger.proofRuns[0];
  const betaSummary = proofLedger.betaProofRunSummaryRecords[0];
  const triage = proofLedger.betaAccessRequestTriageReceipts[0];
  const followThrough = proofLedger.betaAccessRequestFollowThroughOutcomes[0];
  const customerSession = proofLedger.customerSessionRecords[0];
  const customerHandoff = proofLedger.customerHandoffGateRecords[0];
  const launchPackage = proofLedger.launchPackageRecords[0];
  const launchDecision = proofLedger.launchDecisionRecords[0];
  const handoffPacket = proofLedger.handoffPacketRecords[0];
  const rehearsal = proofLedger.operatorSelfServeRehearsalRecords[0];

  return [
    {
      detail: hostedProof
        ? `${proofKindLabel(hostedProof.proof_kind)} passed for ${hostedProof.app_origin}.`
        : "Run protected Preview and Admin portal proof commands.",
      digest: hostedProof?.id,
      id: "hosted_proof",
      label: "Hosted proof",
      state: hostedProof ? "ready" : "pending",
      timestamp: hostedProof?.completed_at,
    },
    {
      detail: betaSummary
        ? `Browser and request-chain proof digest imported for ${betaSummary.neon_branch_name}.`
        : "Run summary inspect and record-proof before relying on the beta request proof run.",
      digest: betaSummary?.summary_sha256,
      id: "beta_summary",
      label: "Beta proof-run digest",
      state: betaSummary ? "ready" : "pending",
      timestamp: betaSummary?.recorded_at,
    },
    {
      detail: triage
        ? `Request triage recorded as ${readinessLabel(triage.decision)}.`
        : "No human triage receipt imported for a beta access request.",
      digest: triage?.packet_sha256,
      id: "request_triage",
      label: "Request triage",
      state: triage ? "ready" : "pending",
      timestamp: triage?.recorded_at,
    },
    {
      detail: followThrough
        ? `Follow-through outcome recorded as ${readinessLabel(followThrough.outcome)}.`
        : "No terminal follow-through outcome recorded.",
      digest: followThrough?.followthrough_packet_sha256,
      id: "request_followthrough",
      label: "Request follow-through",
      state: followThrough ? "ready" : "pending",
      timestamp: followThrough?.recorded_at,
    },
    {
      detail: customerSession
        ? `Customer session digest imported for ${customerSession.gym_name}.`
        : "No customer-observed session digest imported.",
      digest: customerSession?.session_record_sha256,
      id: "customer_session_record",
      label: "Customer session record",
      state: customerSession ? "ready" : "pending",
      timestamp: customerSession?.recorded_at,
    },
    {
      detail: customerHandoff
        ? `Customer-observed gate recorded for ${customerHandoff.gym_name}.`
        : "Customer-observed handoff remains pending.",
      digest: customerHandoff?.source_artifact_sha256,
      id: "customer_handoff",
      label: "Customer handoff",
      state: customerHandoff ? "ready" : "pending",
      timestamp: customerHandoff?.recorded_at,
    },
    {
      detail: launchPackage
        ? `Launch package digest imported for ${launchPackage.gym_name}.`
        : "No launch package record imported.",
      digest: launchPackage?.launch_bundle_sha256,
      id: "launch_package",
      label: "Launch package",
      state: launchPackage ? "ready" : "pending",
      timestamp: launchPackage?.recorded_at,
    },
    {
      detail: launchDecision
        ? `Manual decision recorded as ${readinessLabel(launchDecision.decision)}.`
        : "No manual launch decision recorded.",
      digest: launchDecision?.decision_packet_sha256,
      id: "launch_decision",
      label: "Manual decision",
      state: launchDecision ? "ready" : "pending",
      timestamp: launchDecision?.recorded_at,
    },
    {
      detail: handoffPacket
        ? `Handoff packet recorded as ${readinessLabel(handoffPacket.readiness_state)}.`
        : "No handoff readiness packet record imported.",
      digest: handoffPacket?.packet_sha256,
      id: "handoff_packet",
      label: "Handoff packet",
      state: handoffPacket ? "ready" : "pending",
      timestamp: handoffPacket?.recorded_at,
    },
    {
      detail: rehearsal
        ? `Operator rehearsal recorded for ${rehearsal.gym_name}.`
        : "No operator self-serve rehearsal recorded.",
      digest: rehearsal?.rehearsal_packet_sha256,
      id: "operator_rehearsal",
      label: "Operator rehearsal",
      state: rehearsal ? "ready" : "pending",
      timestamp: rehearsal?.recorded_at,
    },
  ];
}

function requestQueueState(request: FounderAdminBetaAccessRequestRecord) {
  if (request.status === "declined") {
    return {
      className: "blocked",
      label: "Declined",
      nextStep: "Keep archived unless the owner submits a new request.",
      tone: "Blocked",
    };
  }

  if (request.status === "superseded") {
    return {
      className: "blocked",
      label: "Superseded",
      nextStep:
        "Keep archived and work from the latest request for this owner email.",
      tone: "Archived",
    };
  }

  if (request.fulfillment?.fulfilled && request.grant.present) {
    return {
      className: "ready",
      label: "Fulfilled",
      nextStep: request.tenant_bootstrap.tenant_id
        ? "Owner workspace exists. Use the packet and proof gates before any customer-observed claim."
        : "Owner access is active. Next step is owner sign-in and seedless workspace setup.",
      tone: "Ready",
    };
  }

  if (request.status === "reviewing") {
    return {
      className: "attention",
      label: "In review",
      nextStep:
        "Finish review, generate a temporary password out of band, then run the CLI fulfillment command.",
      tone: "Operator",
    };
  }

  return {
    className: "attention",
    label: "Needs review",
    nextStep:
      "Review gym and owner details, then run CLI fulfillment only if this is an approved beta owner.",
    tone: "Operator",
  };
}

export function FounderAdminReadinessConsole({
  betaAccessRequestReport = emptyFounderAdminBetaAccessRequestReport,
  mode,
  proofLedger,
  report,
  unavailableReason,
}: {
  betaAccessRequestReport?: FounderAdminBetaAccessRequestReport;
  mode: "hosted" | "local";
  proofLedger?: FounderAdminProofStatusLedger;
  report: FounderAdminOwnerReadinessReport;
  unavailableReason?: string;
}) {
  const summary = founderAdminReadinessSummary(report);
  const locked = mode === "hosted" && !report.authorized;
  const ownerRows = report.authorized ? report.rows : [];
  const betaAccessRequestRows = betaAccessRequestReport.authorized
    ? betaAccessRequestReport.rows
    : [];
  const latestBetaProofRunSummaryRecord =
    proofLedger?.betaProofRunSummaryRecords[0];
  const proofEvidenceTimeline = founderProofEvidenceTimeline(proofLedger);
  const handoffPacketRecords = proofLedger?.handoffPacketRecords ?? [];
  const selfServeReadiness = founderAdminSelfServeReadiness({
    betaAccessRequestReport,
    proofLedger,
    report,
  });
  const launchReadinessExport = founderAdminLaunchReadinessExport({
    betaAccessRequestReport,
    proofLedger,
    report,
  });
  const launchPromotionGate = founderAdminLaunchPromotionGate({
    betaAccessRequestReport,
    proofLedger,
    report,
  });
  const launchPackageReadiness =
    founderAdminLaunchPackageReadiness(proofLedger);
  const launchDecisionPacketReadiness =
    founderAdminLaunchDecisionPacketReadiness(proofLedger);
  const launchFollowThroughReadiness =
    founderAdminLaunchFollowThroughReadiness(proofLedger);
  const operatorSelfServeRehearsalReadiness =
    founderAdminOperatorSelfServeRehearsalReadiness(proofLedger);
  const nextSaasPreflights = founderAdminNextSaasPreflights(proofLedger);
  const demoOnboardingRunway = founderAdminDemoOnboardingRunway(proofLedger);
  const demoOnboardingCompletion =
    founderAdminDemoOnboardingCompletion(proofLedger);
  const customerDemoGatePacket =
    founderAdminCustomerDemoGatePacket(proofLedger);
  const limitedBetaOnboardingPacket =
    founderAdminLimitedBetaOnboardingPacket(proofLedger);
  const publicSelfServePreflight =
    founderAdminPublicSelfServePreflight(proofLedger);
  const approvedGymFollowthroughPacket =
    founderAdminApprovedGymFollowthroughPacket(proofLedger);
  const publicRequestIntakeDryRun =
    founderAdminPublicRequestIntakeDryRun(proofLedger);
  const inviteDeliveryPreflight =
    founderAdminInviteDeliveryPreflight(proofLedger);
  const authAdminProvisioningDryRun =
    founderAdminAuthAdminProvisioningDryRun(proofLedger);
  const ownerAccessFulfillmentEvidence =
    founderAdminOwnerAccessFulfillmentEvidence(proofLedger);
  const staffAccessPreflight = founderAdminStaffAccessPreflight(proofLedger);
  const ownerAccessCompletionProof =
    founderAdminOwnerAccessCompletionProof(proofLedger);
  const staffRosterHandoffEvidence =
    founderAdminStaffRosterHandoffEvidence(proofLedger);
  const operatorOnboardingRehearsal =
    founderAdminOperatorOnboardingRehearsal(proofLedger);
  const handoffProofBundle = founderAdminHandoffProofBundle(proofLedger);
  const continuousReadinessBatch =
    founderAdminContinuousReadinessBatch(proofLedger);
  const protectedPreviewWalkthrough =
    founderAdminProtectedPreviewWalkthrough(proofLedger);
  const customerHandoffSchedulingBatch =
    founderAdminCustomerHandoffSchedulingBatch(proofLedger);
  const customerHandoffGatePreflight =
    founderAdminCustomerHandoffGatePreflight(proofLedger);
  const customerSessionHostedImportReadiness =
    founderAdminCustomerSessionHostedImportReadiness(proofLedger);
  const limitedBetaReadinessGate =
    founderAdminLimitedBetaReadinessGate(proofLedger);
  const postCustomerProofReadinessBatch =
    founderAdminPostCustomerProofReadinessBatch(proofLedger);
  const approvedBetaExpansionReadinessBatch =
    founderAdminApprovedBetaExpansionReadinessBatch(proofLedger);
  const requestIntakeInviteAuthReadinessBatch =
    founderAdminRequestIntakeInviteAuthReadinessBatch(proofLedger);
  const ownerStaffHandoffReadinessBatch =
    founderAdminOwnerStaffHandoffReadinessBatch(proofLedger);
  const approvedGymHostedRehearsalReadinessBatch =
    founderAdminApprovedGymHostedRehearsalReadinessBatch(proofLedger);
  const approvedGymHostedRehearsalEvidence =
    founderAdminApprovedGymHostedRehearsalEvidence(proofLedger);
  const firstGymGoNoGoBundle =
    founderAdminFirstGymGoNoGoBundle(proofLedger);
  const firstGymOperatorRunRecord =
    founderAdminFirstGymOperatorRunRecord(proofLedger);
  const limitedBetaOperatorReviewPacket =
    founderAdminLimitedBetaOperatorReviewPacket(proofLedger);
  const publicSelfServeLaunchPreflight =
    founderAdminPublicSelfServeLaunchPreflight(proofLedger);
  const publicLaunchControlsBatch =
    founderAdminPublicLaunchControlsBatch(proofLedger);
  const publicLaunchNextReadinessBatch =
    founderAdminPublicLaunchNextReadinessBatch(proofLedger);
  const publicRequestIntakeArtifact =
    founderAdminPublicRequestIntakeArtifact(proofLedger);
  const publicRequestFollowupReadinessBatch =
    founderAdminPublicRequestFollowupReadinessBatch(proofLedger);
  const publicRequestOwnerStaffHandoffReadinessBatch =
    founderAdminPublicRequestOwnerStaffHandoffReadinessBatch(proofLedger);
  const publicRequestHostedRehearsalReadinessBatch =
    founderAdminPublicRequestHostedRehearsalReadinessBatch(proofLedger);
  const publicRequestHostedRehearsalEvidence =
    founderAdminPublicRequestHostedRehearsalEvidence(proofLedger);
  const publicRequestCustomerSessionProofAcquisitionBatch =
    founderAdminPublicRequestCustomerSessionProofAcquisitionBatch(proofLedger);
  const publicRequestFirstGymGoNoGoReadinessBatch =
    founderAdminPublicRequestFirstGymGoNoGoReadinessBatch(proofLedger);
  const publicRequestFirstGymEvidenceAcquisitionBatch =
    founderAdminPublicRequestFirstGymEvidenceAcquisitionBatch(proofLedger);
  const publicRequestFirstGymProofRunwayBatch =
    founderAdminPublicRequestFirstGymProofRunwayBatch(proofLedger);
  const publicRequestFirstGymExecutionLedger =
    founderAdminPublicRequestFirstGymExecutionLedger(proofLedger);
  const publicRequestFirstGymMissingProofPacket =
    founderAdminPublicRequestFirstGymMissingProofPacket(proofLedger);
  const publicRequestFirstGymCompletionGate =
    founderAdminPublicRequestFirstGymCompletionGate(proofLedger);
  const publicRequestFirstGymProofSessionRunbook =
    founderAdminPublicRequestFirstGymProofSessionRunbook(proofLedger);
  const publicRequestFirstGymProofSessionExecutionPack =
    founderAdminPublicRequestFirstGymProofSessionExecutionPack(proofLedger);
  const publicRequestFirstGymProofSessionProgressBatch =
    founderAdminPublicRequestFirstGymProofSessionProgressBatch(proofLedger);
  const publicRequestFirstGymProofSessionResumePacket =
    founderAdminPublicRequestFirstGymProofSessionResumePacket(proofLedger);
  const publicRequestFirstGymProofSessionDiagnostics =
    founderAdminPublicRequestFirstGymProofSessionDiagnostics(proofLedger);
  const publicRequestFirstGymProofSessionFollowupPreflight =
    founderAdminPublicRequestFirstGymProofSessionFollowupPreflight(proofLedger);
  const publicRequestFirstGymProofSessionLaunchCheckpoint =
    founderAdminPublicRequestFirstGymProofSessionLaunchCheckpoint(proofLedger);
  const publicRequestFirstGymProofCommandExecutionEnvelope =
    founderAdminPublicRequestFirstGymProofCommandExecutionEnvelope(proofLedger);
  const publicRequestFirstGymProofEvidenceIntakeManifest =
    founderAdminPublicRequestFirstGymProofEvidenceIntakeManifest(proofLedger);
  const publicRequestFirstGymProofEvidenceSessionHandoff =
    founderAdminPublicRequestFirstGymProofEvidenceSessionHandoff(proofLedger);
  const publicRequestFirstGymProofEvidenceSessionLedger =
    founderAdminPublicRequestFirstGymProofEvidenceSessionLedger(proofLedger);
  const publicRequestFirstGymEvidenceExecutionReadiness =
    founderAdminPublicRequestFirstGymEvidenceExecutionReadiness(proofLedger);
  const publicRequestFirstGymEvidenceRunCoordinator =
    founderAdminPublicRequestFirstGymEvidenceRunCoordinator(proofLedger);
  const publicRequestFirstGymProtectedPreviewEvidencePreflight =
    founderAdminPublicRequestFirstGymProtectedPreviewEvidencePreflight(
      proofLedger,
    );
  const publicRequestFirstGymRealEvidenceAttemptReadiness =
    founderAdminPublicRequestFirstGymRealEvidenceAttemptReadiness(proofLedger);
  const publicRequestFirstGymRealEvidenceExecutionPacket =
    founderAdminPublicRequestFirstGymRealEvidenceExecutionPacket(proofLedger);
  const publicRequestFirstGymRealEvidenceExecutionGuard =
    founderAdminPublicRequestFirstGymRealEvidenceExecutionGuard(proofLedger);
  const publicRequestFirstGymRealEvidenceRefreshCoordinator =
    founderAdminPublicRequestFirstGymRealEvidenceRefreshCoordinator(proofLedger);
  const publicRequestFirstGymGoNoGoBundle =
    founderAdminPublicRequestFirstGymGoNoGoBundle(proofLedger);
  const publicRequestFirstGymOperatorRunRecord =
    founderAdminPublicRequestFirstGymOperatorRunRecord(proofLedger);
  const publicRequestLimitedBetaOperatorReviewPacket =
    founderAdminPublicRequestLimitedBetaOperatorReviewPacket(proofLedger);
  const publicRequestSelfServeLaunchPreflight =
    founderAdminPublicRequestSelfServeLaunchPreflight(proofLedger);
  const operatorActionQueue = founderAdminOperatorActionQueue({
    betaAccessRequestReport,
    proofLedger,
    report,
  });
  const proofFreshness = founderAdminProofFreshnessSummary(proofLedger);
  const handoffReadinessPacket = founderAdminHandoffReadinessPacket({
    betaAccessRequestReport,
    proofLedger,
    report,
  });
  const launchDecisionPacketState =
    launchDecisionPacketReadiness.commands[0]?.state ?? "blocked";
  const latestLaunchDecisionRecord =
    launchDecisionPacketReadiness.latestDecisionRecord;
  const launchDecisionHistoryRecords = latestLaunchDecisionRecord
    ? launchDecisionPacketReadiness.decisionRecords
        .filter(
          (record) =>
            record.id !== latestLaunchDecisionRecord.id &&
            record.app_origin === latestLaunchDecisionRecord.app_origin &&
            record.neon_branch_name ===
              latestLaunchDecisionRecord.neon_branch_name,
        )
        .slice(0, 3)
    : [];

  return (
    <section
      className="founder-readiness-console panel"
      aria-label="Admin portal owner readiness console"
    >
      <div className="panel-header">
        <div>
          <h2>Beta owner readiness</h2>
          <p>
            Read-only support view for operator-assisted owner handoffs. It
            shows hosted Neon readiness state without exposing secrets or
            enabling live providers.
          </p>
        </div>
        <span className={`channel-pill founder-readiness-mode-${mode}`}>
          {mode === "hosted" ? "Hosted Neon" : "Local seed preview"}
        </span>
      </div>

      {locked ? (
        <div className="founder-readiness-locked">
          <strong>Admin portal session required</strong>
          <p>
            Sign in with an active admin portal account to view hosted owner
            readiness. Owner and staff sessions cannot read this support
            projection.
          </p>
          {unavailableReason ? <small>{unavailableReason}</small> : null}
        </div>
      ) : (
        <>
          <div
            className="founder-readiness-metrics"
            aria-label="Founder readiness metrics"
          >
            <div>
              <span>Beta owners</span>
              <strong>{summary.betaOwners}</strong>
            </div>
            <div>
              <span>Bootstrapped tenants</span>
              <strong>{summary.bootstrappedTenants}</strong>
            </div>
            <div>
              <span>Provider attention</span>
              <strong>{summary.providerAttention}</strong>
            </div>
            <div>
              <span>Rollback ready</span>
              <strong>{summary.rollbackReady}</strong>
            </div>
          </div>

          <section
            className="founder-operator-action-queue"
            aria-label="Admin operator next-action queue"
          >
            <div className="founder-proof-runs-title">
              <strong>{operatorActionQueue.title}</strong>
              <small>{operatorActionQueue.summary}</small>
            </div>
            <ol>
              {operatorActionQueue.actions.slice(0, 6).map((action) => (
                <li
                  className={`founder-operator-action founder-operator-action-${action.state}`}
                  key={action.id}
                >
                  <span
                    className={`founder-proof-state founder-proof-state-${action.state}`}
                  >
                    {operatorActionStateLabel(action.state)}
                  </span>
                  <div>
                    <strong>{action.label}</strong>
                    <small>{action.detail}</small>
                  </div>
                  <dl>
                    <div>
                      <dt>Source</dt>
                      <dd>{action.source}</dd>
                    </div>
                    <div>
                      <dt>Command</dt>
                      <dd className="founder-proof-command-value">
                        <code>{action.command}</code>
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ol>
            <div className="founder-operator-action-export">
              <div>
                <strong>Queue artifact</strong>
                <small>
                  Export is terminal-only and records the current next-action
                  snapshot without approving launch, invites, providers,
                  billing, POS, access control, or member-ledger writes.
                </small>
              </div>
              <code>{operatorActionQueue.exportCommand.command}</code>
              <code>{operatorActionQueue.inspectCommand.command}</code>
            </div>
          </section>

          <section
            className="founder-proof-freshness"
            aria-label="Admin proof freshness"
          >
            <div className="founder-proof-runs-title">
              <strong>{proofFreshness.title}</strong>
              <small>{proofFreshness.summary}</small>
            </div>
            <div className="founder-proof-freshness-summary">
              <div>
                <span>Overall</span>
                <strong
                  className={`founder-proof-state founder-proof-state-${proofFreshness.overallState}`}
                >
                  {readinessLabel(proofFreshness.overallState)}
                </strong>
              </div>
              <div>
                <span>Fresh</span>
                <strong>{proofFreshness.freshCount}</strong>
              </div>
              <div>
                <span>Stale</span>
                <strong>{proofFreshness.staleCount}</strong>
              </div>
              <div>
                <span>Missing</span>
                <strong>{proofFreshness.missingCount}</strong>
              </div>
            </div>
            <div className="founder-proof-freshness-items">
              {proofFreshness.items.map((item) => (
                <article
                  className={`founder-proof-freshness-item founder-proof-freshness-item-${item.state}`}
                  key={item.id}
                >
                  <span
                    className={`founder-proof-state founder-proof-state-${item.state}`}
                  >
                    {readinessLabel(item.state)}
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <dl>
                    <div>
                      <dt>Preview</dt>
                      <dd>{item.recordPreviewUrl ?? "No record"}</dd>
                    </div>
                    <div>
                      <dt>Branch</dt>
                      <dd>{item.recordBranchName ?? "No record"}</dd>
                    </div>
                    <div>
                      <dt>When</dt>
                      <dd>{item.timestamp ?? "Pending"}</dd>
                    </div>
                    <div>
                      <dt>Command</dt>
                      <dd className="founder-proof-command-value">
                        <code>{item.command}</code>
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            <div className="founder-operator-action-export">
              <div>
                <strong>Freshness artifact</strong>
                <small>
                  Export terminal-only snapshot. Inspect fails if evidence is
                  stale, missing, launch-enabling, provider-enabling, or outside
                  ignored artifacts.
                </small>
              </div>
              <code>{proofFreshness.exportCommand.command}</code>
              <code>{proofFreshness.inspectCommand.command}</code>
            </div>
          </section>

          <section
            className="founder-handoff-readiness-packet"
            aria-label="Admin handoff readiness packet"
          >
            <div className="founder-proof-runs-title">
              <strong>{handoffReadinessPacket.title}</strong>
              <small>{handoffReadinessPacket.summary}</small>
            </div>
            <div className="founder-proof-freshness-summary">
              <div>
                <span>Packet state</span>
                <strong
                  className={`founder-proof-state founder-proof-state-${handoffReadinessPacket.state}`}
                >
                  {readinessLabel(handoffReadinessPacket.state)}
                </strong>
              </div>
              <div>
                <span>Prerequisites</span>
                <strong>{handoffReadinessPacket.prerequisites.length}</strong>
              </div>
              <div>
                <span>Artifact</span>
                <strong>{handoffReadinessPacket.packetPath}</strong>
              </div>
            </div>
            <div className="founder-proof-freshness-items">
              {handoffReadinessPacket.prerequisites.map((gate) => (
                <article
                  className={`founder-proof-freshness-item founder-proof-freshness-item-${gate.state}`}
                  key={gate.label}
                >
                  <span
                    className={`founder-proof-state founder-proof-state-${gate.state}`}
                  >
                    {readinessLabel(gate.state)}
                  </span>
                  <div>
                    <strong>{gate.label}</strong>
                    <small>{gate.detail}</small>
                  </div>
                </article>
              ))}
            </div>
            <div className="founder-operator-action-export">
              <div>
                <strong>Packet artifact</strong>
                <small>
                  Composes proof freshness, next-action queue, and
                  launch-readiness artifacts into one customer-safe go/no-go
                  summary. It does not approve public launch or live providers.
                </small>
              </div>
              <code>{handoffReadinessPacket.exportCommand.command}</code>
              <code>{handoffReadinessPacket.inspectCommand.command}</code>
              <code>{handoffReadinessPacket.replayCommand.command}</code>
              <code>{handoffReadinessPacket.hostedProofCommand.command}</code>
              <code>{handoffReadinessPacket.recordCommand.command}</code>
            </div>
            <div
              className="founder-handoff-packet-records"
              aria-label="Admin handoff packet records"
            >
              <div className="founder-proof-runs-title">
                <strong>Packet records</strong>
                <small>
                  Hosted Neon digest history. Records are read-only and do not
                  approve customer handoff.
                </small>
              </div>
              {handoffPacketRecords.length === 0 ? (
                <article className="founder-proof-freshness-item founder-proof-freshness-item-pending">
                  <span className="founder-proof-state founder-proof-state-pending">
                    Pending
                  </span>
                  <div>
                    <strong>No packet record imported</strong>
                    <small>
                      Replay and inspect packet, then import digest metadata
                      with the terminal record command.
                    </small>
                  </div>
                </article>
              ) : (
                handoffPacketRecords.slice(0, 3).map((record) => (
                  <article
                    className={`founder-proof-freshness-item founder-proof-freshness-item-${record.replay_verified ? "ready" : "pending"}`}
                    key={record.id}
                  >
                    <span
                      className={`founder-proof-state founder-proof-state-${record.replay_verified ? "ready" : "pending"}`}
                    >
                      {record.replay_verified ? "Replayed" : "Recorded"}
                    </span>
                    <div>
                      <strong>
                        {readinessLabel(record.readiness_state)} packet
                      </strong>
                      <small>
                        {record.reviewer_label};{" "}
                        {shortProofHash(record.packet_sha256)};{" "}
                        {record.recorded_at}
                      </small>
                    </div>
                  </article>
                ))
              )}
            </div>
            <div
              className="founder-launch-readiness-non-goals"
              aria-label="Handoff readiness still blocked gates"
            >
              <strong>Still blocked after packet</strong>
              <ul>
                {handoffReadinessPacket.stillBlocked.map((gate) => (
                  <li key={gate}>{gate}</li>
                ))}
              </ul>
            </div>
          </section>

          <div
            className="founder-readiness-list"
            aria-label="Founder readiness owner rows"
          >
            {ownerRows.length === 0 ? (
              <div className="founder-readiness-empty">
                <strong>No beta owner grants found.</strong>
                <small>
                  Run the operator owner-access command before scheduling a
                  handoff.
                </small>
              </div>
            ) : (
              ownerRows.map((row) => (
                <article
                  className="founder-readiness-row"
                  key={row.owner_email}
                >
                  <div className="founder-readiness-owner">
                    <span>Owner</span>
                    <strong>{row.owner_email}</strong>
                    <small>
                      {row.grant.updated_at
                        ? `Updated ${row.grant.updated_at}`
                        : "No grant timestamp"}
                    </small>
                  </div>
                  <div>
                    <span>Grant</span>
                    <strong>{readinessLabel(row.grant.status)}</strong>
                    <small>
                      Note {row.grant.note_present ? "present" : "absent"};
                      display name{" "}
                      {row.grant.display_name_present ? "present" : "absent"}
                    </small>
                  </div>
                  <div>
                    <span>Account</span>
                    <strong>
                      {row.owner_account.app_user_present
                        ? "App user"
                        : "No app user"}
                    </strong>
                    <small>
                      {row.owner_account.auth_linked
                        ? "Neon Auth linked"
                        : "Auth not linked"}
                    </small>
                  </div>
                  <div>
                    <span>Tenant</span>
                    <strong>
                      {row.tenant_bootstrap.tenant_name ?? "No tenant"}
                    </strong>
                    <small>
                      {row.tenant_bootstrap.tenant_id ?? "Bootstrap pending"}
                    </small>
                  </div>
                  <div>
                    <span>Workflow</span>
                    <strong>
                      {row.tenant_bootstrap.manual_sources_count} sources /{" "}
                      {row.tenant_bootstrap.review_answers_count} review answers
                    </strong>
                    <small>
                      {row.tenant_bootstrap.locations_count} locations;{" "}
                      {row.tenant_bootstrap.open_tasks_count} open tasks
                    </small>
                  </div>
                  <div>
                    <span>Provider gate</span>
                    <strong>
                      {row.provider_gate.state === "attention"
                        ? "Attention"
                        : "Blocked"}
                    </strong>
                    <small>
                      {row.provider_gate.unexpected_live_records} unexpected
                      live records
                    </small>
                  </div>
                  <div>
                    <span>Rollback</span>
                    <strong>{rollbackLabel(row)}</strong>
                    <small>{row.rollback_readiness.reason}</small>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="founder-readiness-boundary">
            <strong>Blocked product gates</strong>
            <span>
              Public self-serve, invite delivery, notifications, phone/email
              providers, billing, POS, access control, and member-ledger writes
              remain off.
            </span>
          </div>

          <details className="founder-readiness-history">
            <summary>
              <span>Evidence history and command catalog</span>
              <small>Proof records, launch gates, request history, and operator references</small>
            </summary>
            <div className="founder-readiness-history-body">

          <section
            className="founder-launch-package-records"
            aria-label="Hosted beta proof-run summary records"
          >
            <div className="founder-proof-runs-title">
              <strong>Beta proof-run summary</strong>
              <small>
                Latest imported browser plus request-chain digest from hosted
                Neon. This does not approve self-serve launch or live providers.
              </small>
            </div>
            {latestBetaProofRunSummaryRecord ? (
              <article className="founder-proof-run founder-launch-package-record">
                <div>
                  <span>Preview</span>
                  <strong>{latestBetaProofRunSummaryRecord.app_origin}</strong>
                </div>
                <div>
                  <span>Branch</span>
                  <strong>
                    {latestBetaProofRunSummaryRecord.neon_branch_name}
                  </strong>
                </div>
                <div>
                  <span>Recorded</span>
                  <strong>{latestBetaProofRunSummaryRecord.recorded_at}</strong>
                </div>
                <div>
                  <span>Summary</span>
                  <strong>
                    {shortProofHash(
                      latestBetaProofRunSummaryRecord.summary_sha256,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Browser proof</span>
                  <strong>
                    {shortProofHash(
                      latestBetaProofRunSummaryRecord.browser_artifact_sha256,
                    )}
                    {" / "}
                    {readinessLabel(
                      latestBetaProofRunSummaryRecord.browser_cleanup,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Request chain</span>
                  <strong>
                    {shortProofHash(
                      latestBetaProofRunSummaryRecord.chain_artifact_sha256,
                    )}
                    {" / "}
                    {readinessLabel(
                      latestBetaProofRunSummaryRecord.chain_cleanup,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Self-serve</span>
                  <strong>
                    {latestBetaProofRunSummaryRecord.public_self_serve_launch_allowed
                      ? "Unexpected"
                      : "Blocked"}
                  </strong>
                </div>
                <div>
                  <span>Live providers</span>
                  <strong>
                    {latestBetaProofRunSummaryRecord.live_provider_enablement_allowed
                      ? "Unexpected"
                      : "Blocked"}
                  </strong>
                </div>
              </article>
            ) : (
              <div className="founder-proof-run-empty">
                <strong>No hosted beta proof-run summary imported.</strong>
                <small>
                  Run browser proof, request-chain proof, summary, inspect, then
                  import the summary digest.
                </small>
                <code>npm run hosted:beta-proof-run:record</code>
              </div>
            )}
          </section>

          <section
            className="founder-proof-evidence-timeline"
            aria-label="Admin proof evidence timeline"
          >
            <div className="founder-proof-runs-title">
              <strong>Proof evidence timeline</strong>
              <small>
                Latest operator evidence in sequence. This timeline is read-only
                and does not approve launch, invites, providers, billing, POS,
                access control, or member-ledger writes.
              </small>
            </div>
            <ol>
              {proofEvidenceTimeline.map((item) => (
                <li
                  className={`founder-proof-evidence-step founder-proof-evidence-step-${item.state}`}
                  key={item.id}
                >
                  <span
                    className={`founder-proof-state founder-proof-state-${item.state}`}
                  >
                    {readinessLabel(item.state)}
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <dl>
                    <div>
                      <dt>When</dt>
                      <dd>{item.timestamp ?? "Pending"}</dd>
                    </div>
                    <div>
                      <dt>Digest</dt>
                      <dd>{shortProofHash(item.digest)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ol>
          </section>

          <section
            className="founder-self-serve-readiness"
            aria-label="Pre-self-serve readiness matrix"
          >
            <div className="founder-proof-runs-title">
              <strong>{selfServeReadiness.title}</strong>
              <small>{selfServeReadiness.summary}</small>
            </div>
            <div className="founder-self-serve-gates">
              {selfServeReadiness.gates.map((gate) => (
                <article className="founder-self-serve-gate" key={gate.label}>
                  <span
                    className={`founder-proof-state founder-proof-state-${gate.state}`}
                  >
                    {readinessLabel(gate.state)}
                  </span>
                  <strong>{gate.label}</strong>
                  <small>{gate.detail}</small>
                </article>
              ))}
            </div>
          </section>

          <section
            className="founder-launch-readiness-export"
            aria-label="Launch-readiness export"
          >
            <div className="founder-proof-runs-title">
              <strong>{launchReadinessExport.title}</strong>
              <small>{launchReadinessExport.summary}</small>
            </div>
            <div className="founder-launch-readiness-body">
              <div className="founder-launch-readiness-gates">
                {launchReadinessExport.gates.map((gate) => (
                  <article
                    className="founder-launch-readiness-gate"
                    key={gate.label}
                  >
                    <span
                      className={`founder-proof-state founder-proof-state-${gate.state}`}
                    >
                      {readinessLabel(gate.state)}
                    </span>
                    <strong>{gate.label}</strong>
                    <small>{gate.detail}</small>
                  </article>
                ))}
              </div>
              <div
                className="founder-launch-readiness-commands"
                aria-label="Launch-readiness export commands"
              >
                <div className="founder-launch-readiness-export-path">
                  <span>Artifact</span>
                  <code>{launchReadinessExport.exportPath}</code>
                </div>
                {launchReadinessExport.commands.map((exportCommand) => (
                  <div
                    className="founder-launch-readiness-command"
                    key={exportCommand.label}
                  >
                    <div>
                      <span
                        className={`founder-proof-state founder-proof-state-${exportCommand.state}`}
                      >
                        {readinessLabel(exportCommand.state)}
                      </span>
                      <strong>{exportCommand.label}</strong>
                      <small>{exportCommand.detail}</small>
                    </div>
                    <code>{exportCommand.command}</code>
                  </div>
                ))}
              </div>
              <div
                className="founder-launch-readiness-non-goals"
                aria-label="Launch-readiness blocked gates"
              >
                <strong>Still blocked after export</strong>
                <ul>
                  {launchReadinessExport.nonGoals.map((nonGoal) => (
                    <li key={nonGoal}>{nonGoal}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section
            className="founder-launch-promotion-gate"
            aria-label="Launch promotion gate"
          >
            <div className="founder-proof-runs-title">
              <strong>{launchPromotionGate.title}</strong>
              <small>{launchPromotionGate.summary}</small>
            </div>
            <div className="founder-launch-promotion-body">
              <div className="founder-launch-promotion-gates">
                {launchPromotionGate.gates.map((gate) => (
                  <article
                    className="founder-launch-promotion-gate-row"
                    key={gate.label}
                  >
                    <span
                      className={`founder-proof-state founder-proof-state-${gate.state}`}
                    >
                      {readinessLabel(gate.state)}
                    </span>
                    <strong>{gate.label}</strong>
                    <small>{gate.detail}</small>
                  </article>
                ))}
              </div>
              <div
                className="founder-launch-promotion-command"
                aria-label="Launch promotion command"
              >
                <div className="founder-launch-readiness-export-path">
                  <span>Promotion summary</span>
                  <code>{launchPromotionGate.promotionPath}</code>
                </div>
                <div className="founder-launch-readiness-export-path">
                  <span>Release note</span>
                  <code>{launchPromotionGate.releaseNotePath}</code>
                </div>
                <div className="founder-launch-readiness-export-path">
                  <span>Launch bundle</span>
                  <code>{launchPromotionGate.bundlePath}</code>
                </div>
                {launchPromotionGate.commands.map((promotionCommand) => (
                  <div
                    className="founder-launch-readiness-command"
                    key={promotionCommand.label}
                  >
                    <div>
                      <span
                        className={`founder-proof-state founder-proof-state-${promotionCommand.state}`}
                      >
                        {readinessLabel(promotionCommand.state)}
                      </span>
                      <strong>{promotionCommand.label}</strong>
                      <small>{promotionCommand.detail}</small>
                    </div>
                    <code>{promotionCommand.command}</code>
                  </div>
                ))}
                <div
                  className="founder-launch-promotion-non-goals"
                  aria-label="Launch promotion blocked gates"
                >
                  <strong>Still blocked after promotion check</strong>
                  <ul>
                    {launchPromotionGate.nonGoals.map((nonGoal) => (
                      <li key={nonGoal}>{nonGoal}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <div
            className="founder-beta-access-requests"
            aria-label="Beta access request queue"
          >
            <div className="founder-proof-runs-title">
              <strong>Beta access request console</strong>
              <small>
                Operator review queue for public owner requests. Fulfillment
                stays in the CLI so temporary passwords and provider secrets
                never enter the browser.
              </small>
            </div>
            {betaAccessRequestRows.length === 0 ? (
              <div className="founder-proof-run-empty">
                <strong>No beta access requests.</strong>
                <small>
                  Prospective owners can request access from the owner sign-in
                  page.
                </small>
              </div>
            ) : (
              betaAccessRequestRows.map((request) => {
                const ownerReadinessRow = ownerRows.find(
                  (row) =>
                    row.owner_email.toLowerCase() ===
                    request.email.toLowerCase(),
                );

                return (
                  <BetaAccessRequestRow
                    key={request.id}
                    ownerReadinessRow={ownerReadinessRow}
                    proofLedger={proofLedger}
                    request={request}
                  />
                );
              })
            )}
          </div>

          {proofLedger ? (
            <div
              className="founder-proof-ledger"
              aria-label="Admin portal proof status ledger"
            >
              <div className="founder-proof-ledger-header">
                <div>
                  <h3>Hosted proof status</h3>
                  <p>
                    Secret-free operator ledger for the current Preview and Neon
                    branch. Passed verifier records are the durable source of
                    truth for a green hosted proof.
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>Preview</dt>
                    <dd>{proofLedger.previewUrl}</dd>
                  </div>
                  <div>
                    <dt>Neon branch</dt>
                    <dd>{proofLedger.branchName}</dd>
                  </div>
                  <div>
                    <dt>Projection</dt>
                    <dd>
                      {proofLedger.generatedAt ??
                        "No hosted projection timestamp"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="founder-proof-gates">
                {proofLedger.gates.map((gate) => (
                  <article className="founder-proof-gate" key={gate.label}>
                    <span
                      className={`founder-proof-state founder-proof-state-${gate.state}`}
                    >
                      {readinessLabel(gate.state)}
                    </span>
                    <strong>{gate.label}</strong>
                    <small>{gate.detail}</small>
                  </article>
                ))}
              </div>

              <div
                className="founder-proof-runs"
                aria-label="Last hosted proof records"
              >
                <div className="founder-proof-runs-title">
                  <strong>Last hosted proof records</strong>
                  <small>
                    Sanitized append-only evidence from operator verifiers.
                    Customer-observed handoff has its own reviewed proof records
                    below.
                  </small>
                </div>
                {proofLedger.proofRuns.length === 0 ? (
                  <div className="founder-proof-run-empty">
                    <strong>No passed hosted proof records.</strong>
                    <small>
                      Run the protected Preview verifier before marking hosted
                      proof green.
                    </small>
                  </div>
                ) : (
                  proofLedger.proofRuns.map((proofRun) => (
                    <article className="founder-proof-run" key={proofRun.id}>
                      <div>
                        <span>{proofKindLabel(proofRun.proof_kind)}</span>
                        <strong>{readinessLabel(proofRun.status)}</strong>
                      </div>
                      <div>
                        <span>Completed</span>
                        <strong>{proofRun.completed_at}</strong>
                      </div>
                      <div>
                        <span>Preview</span>
                        <strong>{proofRun.app_origin}</strong>
                      </div>
                      <div>
                        <span>Branch</span>
                        <strong>{proofRun.neon_branch_name}</strong>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div
                className="founder-customer-handoff-records"
                aria-label="Customer-observed handoff proof records"
              >
                <div className="founder-proof-runs-title">
                  <strong>Customer-observed handoff records</strong>
                  <small>
                    Reviewed final gate artifacts imported by operators. These
                    records do not unlock live providers.
                  </small>
                </div>
                {proofLedger.customerHandoffGateRecords.length === 0 ? (
                  <div className="founder-proof-run-empty">
                    <strong>
                      No persisted customer-observed handoff proof.
                    </strong>
                    <small>
                      Run the final gate, review the sanitized artifact, then
                      import it after a real external owner session.
                    </small>
                  </div>
                ) : (
                  proofLedger.customerHandoffGateRecords.map((record) => (
                    <article
                      className="founder-proof-run founder-customer-handoff-record"
                      key={record.id}
                    >
                      <div>
                        <span>Gym</span>
                        <strong>{record.gym_name}</strong>
                      </div>
                      <div>
                        <span>Recorded</span>
                        <strong>{record.recorded_at}</strong>
                      </div>
                      <div>
                        <span>Preview</span>
                        <strong>{record.app_origin}</strong>
                      </div>
                      <div>
                        <span>Branch</span>
                        <strong>{record.neon_branch_name}</strong>
                      </div>
                      <div>
                        <span>Artifact</span>
                        <strong>
                          {record.source_artifact_sha256.slice(0, 12)}
                        </strong>
                      </div>
                      {record.admin_handoff_packet_sha256 ? (
                        <div>
                          <span>Admin packet</span>
                          <strong>
                            {record.admin_handoff_packet_sha256.slice(0, 12)}
                          </strong>
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </div>

              <div
                className="founder-launch-package-records"
                aria-label="Admin launch package records"
              >
                <div className="founder-proof-runs-title">
                  <strong>Launch package records</strong>
                  <small>
                    Reviewed bundle and owner-message metadata imported by
                    operators. These records do not approve public self-serve
                    launch.
                  </small>
                </div>
                <div
                  className="founder-launch-package-summary"
                  aria-label="Launch package proof readiness"
                >
                  <div>
                    <span
                      className={`founder-proof-state founder-proof-state-${launchPackageReadiness.command.state}`}
                    >
                      {readinessLabel(launchPackageReadiness.command.state)}
                    </span>
                    <strong>{launchPackageReadiness.title}</strong>
                    <small>{launchPackageReadiness.summary}</small>
                  </div>
                  <div className="founder-launch-package-gates">
                    {launchPackageReadiness.gates.map((gate) => (
                      <article
                        className="founder-launch-package-gate"
                        key={gate.label}
                      >
                        <span
                          className={`founder-proof-state founder-proof-state-${gate.state}`}
                        >
                          {readinessLabel(gate.state)}
                        </span>
                        <strong>{gate.label}</strong>
                        <small>{gate.detail}</small>
                      </article>
                    ))}
                  </div>
                  <div className="founder-proof-command-row founder-launch-package-command">
                    <div>
                      <strong>{launchPackageReadiness.command.label}</strong>
                      <small>{launchPackageReadiness.command.detail}</small>
                    </div>
                    <code>{launchPackageReadiness.command.command}</code>
                  </div>
                </div>
                <div
                  className="founder-launch-package-summary"
                  aria-label="Launch decision packet readiness"
                >
                  <div>
                    <span
                      className={`founder-proof-state founder-proof-state-${launchDecisionPacketState}`}
                    >
                      {readinessLabel(launchDecisionPacketState)}
                    </span>
                    <strong>{launchDecisionPacketReadiness.title}</strong>
                    <small>{launchDecisionPacketReadiness.summary}</small>
                  </div>
                  <div className="founder-launch-readiness-export-path">
                    <span>Packet artifact</span>
                    <code>{launchDecisionPacketReadiness.packetPath}</code>
                  </div>
                  <div className="founder-launch-package-gates">
                    {launchDecisionPacketReadiness.gates.map((gate) => (
                      <article
                        className="founder-launch-package-gate"
                        key={gate.label}
                      >
                        <span
                          className={`founder-proof-state founder-proof-state-${gate.state}`}
                        >
                          {readinessLabel(gate.state)}
                        </span>
                        <strong>{gate.label}</strong>
                        <small>{gate.detail}</small>
                      </article>
                    ))}
                  </div>
                  {launchDecisionPacketReadiness.commands.map(
                    (packetCommand) => (
                      <div
                        className="founder-proof-command-row founder-launch-package-command"
                        key={packetCommand.label}
                      >
                        <div>
                          <strong>{packetCommand.label}</strong>
                          <small>{packetCommand.detail}</small>
                        </div>
                        <code>{packetCommand.command}</code>
                      </div>
                    ),
                  )}
                  <div className="founder-proof-command-row founder-launch-package-command">
                    <div>
                      <strong>
                        {launchDecisionPacketReadiness.recordCommand.label}
                      </strong>
                      <small>
                        {launchDecisionPacketReadiness.recordCommand.detail}
                      </small>
                    </div>
                    <code>
                      {launchDecisionPacketReadiness.recordCommand.command}
                    </code>
                  </div>
                  <div
                    className="founder-launch-decision-records"
                    aria-label="Launch decision records"
                  >
                    <div className="founder-proof-runs-title">
                      <strong>Manual review records</strong>
                      <small>
                        Reviewer metadata imported from the terminal. These
                        records do not approve public self-serve or live
                        providers.
                      </small>
                    </div>
                    {latestLaunchDecisionRecord ? (
                      <article className="founder-proof-run founder-launch-decision-record">
                        <div>
                          <span>Decision</span>
                          <strong>
                            {readinessLabel(
                              latestLaunchDecisionRecord.decision,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Reviewer</span>
                          <strong>
                            {latestLaunchDecisionRecord.reviewer_label}
                          </strong>
                        </div>
                        <div>
                          <span>Recorded</span>
                          <strong>
                            {latestLaunchDecisionRecord.recorded_at}
                          </strong>
                        </div>
                        <div>
                          <span>Packet</span>
                          <strong>
                            {latestLaunchDecisionRecord.decision_packet_sha256.slice(
                              0,
                              12,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Launch</span>
                          <strong>
                            {latestLaunchDecisionRecord.launch_enablement_allowed
                              ? "Unexpected"
                              : "Blocked"}
                          </strong>
                        </div>
                      </article>
                    ) : (
                      <div className="founder-proof-run-empty">
                        <strong>No manual launch decision recorded.</strong>
                        <small>
                          Generate and inspect the packet, then import the
                          reviewer decision from the terminal.
                        </small>
                      </div>
                    )}
                    {launchDecisionHistoryRecords.length > 0 ? (
                      <div className="founder-launch-decision-history">
                        {launchDecisionHistoryRecords.map((record) => (
                          <article
                            className="founder-proof-run founder-launch-decision-record"
                            key={record.id}
                          >
                            <div>
                              <span>Decision</span>
                              <strong>{readinessLabel(record.decision)}</strong>
                            </div>
                            <div>
                              <span>Reviewer</span>
                              <strong>{record.reviewer_label}</strong>
                            </div>
                            <div>
                              <span>Recorded</span>
                              <strong>{record.recorded_at}</strong>
                            </div>
                            <div>
                              <span>Packet</span>
                              <strong>
                                {record.decision_packet_sha256.slice(0, 12)}
                              </strong>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div
                    className="founder-launch-package-summary"
                    aria-label="Launch follow-through readiness"
                  >
                    <div>
                      <span
                        className={`founder-proof-state founder-proof-state-${launchFollowThroughReadiness.command.state}`}
                      >
                        {readinessLabel(
                          launchFollowThroughReadiness.command.state,
                        )}
                      </span>
                      <strong>{launchFollowThroughReadiness.title}</strong>
                      <small>{launchFollowThroughReadiness.summary}</small>
                    </div>
                    <div className="founder-launch-readiness-export-path">
                      <span>Follow-through artifact</span>
                      <code>{launchFollowThroughReadiness.artifactPath}</code>
                    </div>
                    <div className="founder-launch-package-gates">
                      {launchFollowThroughReadiness.gates.map((gate) => (
                        <article
                          className="founder-launch-package-gate"
                          key={gate.label}
                        >
                          <span
                            className={`founder-proof-state founder-proof-state-${gate.state}`}
                          >
                            {readinessLabel(gate.state)}
                          </span>
                          <strong>{gate.label}</strong>
                          <small>{gate.detail}</small>
                        </article>
                      ))}
                    </div>
                    <div className="founder-proof-command-row founder-launch-package-command">
                      <div>
                        <strong>
                          {launchFollowThroughReadiness.command.label}
                        </strong>
                        <small>
                          {launchFollowThroughReadiness.command.detail}
                        </small>
                      </div>
                      <code>
                        {launchFollowThroughReadiness.command.command}
                      </code>
                    </div>
                    <div className="founder-launch-package-blocked-gates">
                      <strong>Still blocked after follow-through</strong>
                      <ul>
                        <li>
                          No public owner account creation or browser approval.
                        </li>
                        <li>
                          No invite delivery. Notification dispatch remains off.
                        </li>
                        <li>No phone/email provider activation.</li>
                        <li>
                          No billing, POS, access control, or member-ledger
                          writes.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div
                  className="founder-launch-package-summary"
                  aria-label="Operator self-serve rehearsal readiness"
                >
                  <div>
                    <span
                      className={`founder-proof-state founder-proof-state-${operatorSelfServeRehearsalReadiness.recordCommand.state}`}
                    >
                      {readinessLabel(
                        operatorSelfServeRehearsalReadiness.recordCommand.state,
                      )}
                    </span>
                    <strong>{operatorSelfServeRehearsalReadiness.title}</strong>
                    <small>{operatorSelfServeRehearsalReadiness.summary}</small>
                  </div>
                  <div className="founder-launch-readiness-export-path">
                    <span>Rehearsal packet</span>
                    <code>
                      {operatorSelfServeRehearsalReadiness.packetPath}
                    </code>
                  </div>
                  <div className="founder-launch-readiness-export-path">
                    <span>Follow-through input</span>
                    <code>
                      {
                        operatorSelfServeRehearsalReadiness.followThroughArtifactPath
                      }
                    </code>
                  </div>
                  <div className="founder-launch-package-gates">
                    {operatorSelfServeRehearsalReadiness.gates.map((gate) => (
                      <article
                        className="founder-launch-package-gate"
                        key={gate.label}
                      >
                        <span
                          className={`founder-proof-state founder-proof-state-${gate.state}`}
                        >
                          {readinessLabel(gate.state)}
                        </span>
                        <strong>{gate.label}</strong>
                        <small>{gate.detail}</small>
                      </article>
                    ))}
                  </div>
                  <div className="founder-proof-command-row founder-launch-package-command">
                    <div>
                      <strong>
                        {
                          operatorSelfServeRehearsalReadiness.packetCommand
                            .label
                        }
                      </strong>
                      <small>
                        {
                          operatorSelfServeRehearsalReadiness.packetCommand
                            .detail
                        }
                      </small>
                    </div>
                    <code>
                      {
                        operatorSelfServeRehearsalReadiness.packetCommand
                          .command
                      }
                    </code>
                  </div>
                  <div className="founder-proof-command-row founder-launch-package-command">
                    <div>
                      <strong>
                        {
                          operatorSelfServeRehearsalReadiness.recordCommand
                            .label
                        }
                      </strong>
                      <small>
                        {
                          operatorSelfServeRehearsalReadiness.recordCommand
                            .detail
                        }
                      </small>
                    </div>
                    <code>
                      {
                        operatorSelfServeRehearsalReadiness.recordCommand
                          .command
                      }
                    </code>
                  </div>
                  <div className="founder-launch-package-blocked-gates">
                    <strong>Still blocked after rehearsal</strong>
                    <ul>
                      <li>
                        No public owner account creation or browser approval.
                      </li>
                      <li>
                        No invite delivery. Notification dispatch remains off.
                      </li>
                      <li>No phone/email provider activation.</li>
                      <li>
                        No billing, POS, access control, or member-ledger
                        writes.
                      </li>
                    </ul>
                  </div>
                  {operatorSelfServeRehearsalReadiness.records.length === 0 ? (
                    <div className="founder-proof-run-empty">
                      <strong>
                        No operator self-serve rehearsal recorded.
                      </strong>
                      <small>
                        Generate the packet, complete the operator-observed
                        rehearsal, then import completion metadata.
                      </small>
                    </div>
                  ) : (
                    <div
                      className="founder-launch-decision-records"
                      aria-label="Operator self-serve rehearsal records"
                    >
                      <div className="founder-proof-runs-title">
                        <strong>Rehearsal records</strong>
                        <small>
                          Hosted Neon completion rows. These records do not
                          approve public launch.
                        </small>
                      </div>
                      {operatorSelfServeRehearsalReadiness.records
                        .slice(0, 3)
                        .map((record) => (
                          <article
                            className="founder-proof-run founder-launch-decision-record"
                            key={record.id}
                          >
                            <div>
                              <span>Gym</span>
                              <strong>{record.gym_name}</strong>
                            </div>
                            <div>
                              <span>Owner</span>
                              <strong>{record.owner_label}</strong>
                            </div>
                            <div>
                              <span>Observed</span>
                              <strong>{record.observed_at}</strong>
                            </div>
                            <div>
                              <span>Record</span>
                              <strong>{record.id}</strong>
                            </div>
                            <div>
                              <span>Packet</span>
                              <strong>
                                {record.rehearsal_packet_sha256.slice(0, 12)}
                              </strong>
                            </div>
                          </article>
                        ))}
                    </div>
                  )}
                </div>

                <div
                  className="founder-launch-package-summary"
                  aria-label="Demo onboarding runway"
                >
                  <div>
                    <span className="founder-proof-state founder-proof-state-pending">
                      Runway
                    </span>
                    <strong>{demoOnboardingRunway.title}</strong>
                    <small>{demoOnboardingRunway.summary}</small>
                  </div>
                  <div className="founder-launch-readiness-export-path">
                    <span>Artifact</span>
                    <code>{demoOnboardingRunway.artifactPath}</code>
                  </div>
                  <div className="founder-launch-package-gates">
                    {demoOnboardingRunway.nextTwoSlices.map((slice) => (
                      <article
                        className="founder-launch-package-gate"
                        key={slice.id}
                      >
                        <span
                          className={`founder-proof-state founder-proof-state-${slice.state}`}
                        >
                          {readinessLabel(slice.state)}
                        </span>
                        <strong>{slice.title}</strong>
                        <small>{slice.detail}</small>
                        <code>{slice.command}</code>
                      </article>
                    ))}
                  </div>
                  <div className="founder-launch-package-gates">
                    {demoOnboardingRunway.gates.map((gate) => (
                      <article
                        className="founder-launch-package-gate"
                        key={gate.label}
                      >
                        <span
                          className={`founder-proof-state founder-proof-state-${gate.state}`}
                        >
                          {readinessLabel(gate.state)}
                        </span>
                        <strong>{gate.label}</strong>
                        <small>{gate.detail}</small>
                      </article>
                    ))}
                  </div>
                {demoOnboardingRunway.commands.map((command) => (
                  <div
                    className="founder-proof-command-row founder-launch-package-command"
                    key={command.label}
                  >
                      <div>
                        <strong>{command.label}</strong>
                        <small>{command.detail}</small>
                      </div>
                    <code>{command.command}</code>
                  </div>
                ))}
              </div>

              <div
                className="founder-launch-package-summary"
                aria-label="Demo onboarding completion proof"
              >
                <div>
                  <span className="founder-proof-state founder-proof-state-pending">
                    Completion
                  </span>
                  <strong>{demoOnboardingCompletion.title}</strong>
                  <small>{demoOnboardingCompletion.summary}</small>
                </div>
                <div className="founder-launch-readiness-export-path">
                  <span>Artifact</span>
                  <code>{demoOnboardingCompletion.artifactPath}</code>
                </div>
                <div className="founder-launch-package-gates">
                  {demoOnboardingCompletion.nextTwoSlices.map((slice) => (
                    <article
                      className="founder-launch-package-gate"
                      key={slice.id}
                    >
                      <span
                        className={`founder-proof-state founder-proof-state-${slice.state}`}
                      >
                        {readinessLabel(slice.state)}
                      </span>
                      <strong>{slice.title}</strong>
                      <small>{slice.detail}</small>
                      <code>{slice.command}</code>
                    </article>
                  ))}
                </div>
                <div className="founder-launch-package-gates">
                  {demoOnboardingCompletion.gates.map((gate) => (
                    <article
                      className="founder-launch-package-gate"
                      key={gate.label}
                    >
                      <span
                        className={`founder-proof-state founder-proof-state-${gate.state}`}
                      >
                        {readinessLabel(gate.state)}
                      </span>
                      <strong>{gate.label}</strong>
                      <small>{gate.detail}</small>
                    </article>
                  ))}
                </div>
                {demoOnboardingCompletion.commands.map((command) => (
                  <div
                    className="founder-proof-command-row founder-launch-package-command"
                    key={command.label}
                  >
                    <div>
                      <strong>{command.label}</strong>
                      <small>{command.detail}</small>
                    </div>
                    <code>{command.command}</code>
                  </div>
                ))}
              </div>

              <div
                className="founder-launch-package-summary"
                aria-label="Customer demo gate packet"
              >
                <div>
                  <span className="founder-proof-state founder-proof-state-pending">
                    Owner gate
                  </span>
                  <strong>{customerDemoGatePacket.title}</strong>
                  <small>{customerDemoGatePacket.summary}</small>
                </div>
                <div className="founder-launch-readiness-export-path">
                  <span>Artifact</span>
                  <code>{customerDemoGatePacket.artifactPath}</code>
                </div>
                <div className="founder-launch-package-gates">
                  {customerDemoGatePacket.nextTwoSlices.map((slice) => (
                    <article
                      className="founder-launch-package-gate"
                      key={slice.id}
                    >
                      <span
                        className={`founder-proof-state founder-proof-state-${slice.state}`}
                      >
                        {readinessLabel(slice.state)}
                      </span>
                      <strong>{slice.title}</strong>
                      <small>{slice.detail}</small>
                      <code>{slice.command}</code>
                    </article>
                  ))}
                </div>
                <div className="founder-launch-package-gates">
                  {customerDemoGatePacket.gates.map((gate) => (
                    <article
                      className="founder-launch-package-gate"
                      key={gate.label}
                    >
                      <span
                        className={`founder-proof-state founder-proof-state-${gate.state}`}
                      >
                        {readinessLabel(gate.state)}
                      </span>
                      <strong>{gate.label}</strong>
                      <small>{gate.detail}</small>
                    </article>
                  ))}
                </div>
                {customerDemoGatePacket.commands.map((command) => (
                  <div
                    className="founder-proof-command-row founder-launch-package-command"
                    key={command.label}
                  >
                    <div>
                      <strong>{command.label}</strong>
                      <small>{command.detail}</small>
                    </div>
                    <code>{command.command}</code>
                  </div>
                ))}
              </div>

              <div
                className="founder-launch-package-summary"
                aria-label="Limited beta onboarding packet"
              >
                <div>
                  <span className="founder-proof-state founder-proof-state-pending">
                    Operator beta
                  </span>
                  <strong>{limitedBetaOnboardingPacket.title}</strong>
                  <small>{limitedBetaOnboardingPacket.summary}</small>
                </div>
                <div className="founder-launch-readiness-export-path">
                  <span>Artifact</span>
                  <code>{limitedBetaOnboardingPacket.artifactPath}</code>
                </div>
                <div className="founder-launch-package-gates">
                  {limitedBetaOnboardingPacket.nextTwoSlices.map((slice) => (
                    <article
                      className="founder-launch-package-gate"
                      key={slice.id}
                    >
                      <span
                        className={`founder-proof-state founder-proof-state-${slice.state}`}
                      >
                        {readinessLabel(slice.state)}
                      </span>
                      <strong>{slice.title}</strong>
                      <small>{slice.detail}</small>
                      <code>{slice.command}</code>
                    </article>
                  ))}
                </div>
                <div className="founder-launch-package-gates">
                  {limitedBetaOnboardingPacket.gates.map((gate) => (
                    <article
                      className="founder-launch-package-gate"
                      key={gate.label}
                    >
                      <span
                        className={`founder-proof-state founder-proof-state-${gate.state}`}
                      >
                        {readinessLabel(gate.state)}
                      </span>
                      <strong>{gate.label}</strong>
                      <small>{gate.detail}</small>
                    </article>
                  ))}
                </div>
                {limitedBetaOnboardingPacket.commands.map((command) => (
                  <div
                    className="founder-proof-command-row founder-launch-package-command"
                    key={command.label}
                  >
                    <div>
                      <strong>{command.label}</strong>
                      <small>{command.detail}</small>
                    </div>
                    <code>{command.command}</code>
                  </div>
                ))}
              </div>

              <div
                className="founder-launch-package-summary"
                aria-label="Public self-serve preflight"
              >
                <div>
                  <span className="founder-proof-state founder-proof-state-blocked">
                    Self-serve
                  </span>
                  <strong>{publicSelfServePreflight.title}</strong>
                  <small>{publicSelfServePreflight.summary}</small>
                </div>
                <div className="founder-launch-readiness-export-path">
                  <span>Artifact</span>
                  <code>{publicSelfServePreflight.artifactPath}</code>
                </div>
                <div className="founder-launch-package-gates">
                  {publicSelfServePreflight.nextTwoSlices.map((slice) => (
                    <article
                      className="founder-launch-package-gate"
                      key={slice.id}
                    >
                      <span
                        className={`founder-proof-state founder-proof-state-${slice.state}`}
                      >
                        {readinessLabel(slice.state)}
                      </span>
                      <strong>{slice.title}</strong>
                      <small>{slice.detail}</small>
                      <code>{slice.command}</code>
                    </article>
                  ))}
                </div>
                <div className="founder-launch-package-gates">
                  {publicSelfServePreflight.gates.map((gate) => (
                    <article
                      className="founder-launch-package-gate"
                      key={gate.label}
                    >
                      <span
                        className={`founder-proof-state founder-proof-state-${gate.state}`}
                      >
                        {readinessLabel(gate.state)}
                      </span>
                      <strong>{gate.label}</strong>
                      <small>{gate.detail}</small>
                    </article>
                  ))}
                </div>
                {publicSelfServePreflight.commands.map((command) => (
                  <div
                    className="founder-proof-command-row founder-launch-package-command"
                    key={command.label}
                  >
                    <div>
                      <strong>{command.label}</strong>
                      <small>{command.detail}</small>
                    </div>
                    <code>{command.command}</code>
                  </div>
                ))}
                <div className="founder-launch-package-blocked-gates">
                  <strong>Still blocked preflight</strong>
                  <ul>
                    <li>No public owner registration or browser approval.</li>
                    <li>No invitation delivery, notifications, or providers.</li>
                    <li>No billing, POS, access control, or member-ledger writes.</li>
                  </ul>
                </div>
              </div>

              {[
                {
                  ariaLabel: "Approved gym request follow-through",
                  badge: "Follow-through",
                  packet: approvedGymFollowthroughPacket,
                },
                {
                  ariaLabel: "Public request intake dry-run",
                  badge: "Dry-run",
                  packet: publicRequestIntakeDryRun,
                },
                {
                  ariaLabel: "Invite delivery preflight",
                  badge: "No-send",
                  packet: inviteDeliveryPreflight,
                },
                {
                  ariaLabel: "Auth admin provisioning dry-run",
                  badge: "Dry-run",
                  packet: authAdminProvisioningDryRun,
                },
                {
                  ariaLabel: "Owner access fulfillment evidence",
                  badge: "Evidence",
                  packet: ownerAccessFulfillmentEvidence,
                },
                {
                  ariaLabel: "Staff access preflight",
                  badge: "No-send",
                  packet: staffAccessPreflight,
                },
                {
                  ariaLabel: "Owner access completion proof",
                  badge: "Proof",
                  packet: ownerAccessCompletionProof,
                },
                {
                  ariaLabel: "Staff roster handoff evidence",
                  badge: "Proof",
                  packet: staffRosterHandoffEvidence,
                },
                {
                  ariaLabel: "Operator onboarding rehearsal",
                  badge: "Rehearsal",
                  packet: operatorOnboardingRehearsal,
                },
                {
                  ariaLabel: "Handoff proof bundle",
                  badge: "Bundle",
                  packet: handoffProofBundle,
                },
                {
                  ariaLabel: "Continuous SaaS readiness batch",
                  badge: "Batch",
                  packet: continuousReadinessBatch,
                },
                {
                  ariaLabel: "Protected Preview walkthrough batch",
                  badge: "Walkthrough",
                  packet: protectedPreviewWalkthrough,
                },
                {
                  ariaLabel: "Customer handoff scheduling batch",
                  badge: "Schedule",
                  packet: customerHandoffSchedulingBatch,
                },
                {
                  ariaLabel: "Customer handoff gate preflight",
                  badge: "Preflight",
                  packet: customerHandoffGatePreflight,
                },
                {
                  ariaLabel: "Hosted customer-session import readiness",
                  badge: "Import",
                  packet: customerSessionHostedImportReadiness,
                },
                {
                  ariaLabel: "Limited beta readiness gate",
                  badge: "Beta gate",
                  packet: limitedBetaReadinessGate,
                },
                {
                  ariaLabel: "Post-customer-proof readiness batch",
                  badge: "Proof batch",
                  packet: postCustomerProofReadinessBatch,
                },
                {
                  ariaLabel: "Approved beta expansion readiness batch",
                  badge: "Beta expansion",
                  packet: approvedBetaExpansionReadinessBatch,
                },

  {
    ariaLabel: "Request intake invite Auth readiness batch",
    badge: "Request batch",
    packet: requestIntakeInviteAuthReadinessBatch,
  },
  {
    ariaLabel: "Owner staff handoff readiness batch",
    badge: "Handoff batch",
    packet: ownerStaffHandoffReadinessBatch,
  },
  {
    ariaLabel: "Approved gym hosted rehearsal readiness batch",
    badge: "Rehearsal batch",
    packet: approvedGymHostedRehearsalReadinessBatch,
  },
  {
    ariaLabel: "Approved gym hosted rehearsal evidence",
    badge: "Evidence",
    packet: approvedGymHostedRehearsalEvidence,
  },
  {
    ariaLabel: "First gym go no go bundle",
    badge: "Go/no-go",
    packet: firstGymGoNoGoBundle,
  },
  {
    ariaLabel: "First gym operator assisted run record",
    badge: "Run record",
    packet: firstGymOperatorRunRecord,
  },
  {
    ariaLabel: "Limited beta operator review packet",
    badge: "Beta review",
    packet: limitedBetaOperatorReviewPacket,
  },
  {
    ariaLabel: "Public self serve launch preflight",
    badge: "Launch preflight",
    packet: publicSelfServeLaunchPreflight,
  },
  {
    ariaLabel: "Public launch controls batch",
    badge: "Launch controls",
    packet: publicLaunchControlsBatch,
  },
  {
    ariaLabel: "Public launch next readiness batch",
    badge: "Next launch batch",
    packet: publicLaunchNextReadinessBatch,
  },
  {
    ariaLabel: "Public request intake artifact",
    badge: "Request intake",
    packet: publicRequestIntakeArtifact,
  },
  {
    ariaLabel: "Public request follow-up readiness batch",
    badge: "Request follow-up",
    packet: publicRequestFollowupReadinessBatch,
  },
  {
    ariaLabel: "Public request owner staff handoff readiness",
    badge: "Owner/staff handoff",
    packet: publicRequestOwnerStaffHandoffReadinessBatch,
  },
  {
    ariaLabel: "Public request hosted rehearsal readiness",
    badge: "Hosted rehearsal",
    packet: publicRequestHostedRehearsalReadinessBatch,
  },
  {
    ariaLabel: "Public request hosted rehearsal evidence",
    badge: "Hosted evidence",
    packet: publicRequestHostedRehearsalEvidence,
  },
  {
    ariaLabel: "Public request customer session proof acquisition",
    badge: "Customer proof",
    packet: publicRequestCustomerSessionProofAcquisitionBatch,
  },
  {
    ariaLabel: "Public request first gym go no go readiness",
    badge: "First-gym gate",
    packet: publicRequestFirstGymGoNoGoReadinessBatch,
  },
  {
    ariaLabel: "Public request first gym evidence acquisition",
    badge: "Evidence path",
    packet: publicRequestFirstGymEvidenceAcquisitionBatch,
  },
  {
    ariaLabel: "Public request first gym proof runway",
    badge: "Proof runway",
    packet: publicRequestFirstGymProofRunwayBatch,
  },
  {
    ariaLabel: "Public request first gym execution ledger",
    badge: "Execution ledger",
    packet: publicRequestFirstGymExecutionLedger,
  },
  {
    ariaLabel: "Public request first gym missing proof packet",
    badge: "Missing proof",
    packet: publicRequestFirstGymMissingProofPacket,
  },
  {
    ariaLabel: "Public request first gym completion gate",
    badge: "Completion gate",
    packet: publicRequestFirstGymCompletionGate,
  },
  {
    ariaLabel: "Public request first gym proof session runbook",
    badge: "Session runbook",
    packet: publicRequestFirstGymProofSessionRunbook,
  },
  {
    ariaLabel: "Public request first gym proof session execution pack",
    badge: "Execution pack",
    packet: publicRequestFirstGymProofSessionExecutionPack,
  },
  {
    ariaLabel: "Public request first gym proof session progress",
    badge: "Session progress",
    packet: publicRequestFirstGymProofSessionProgressBatch,
  },
  {
    ariaLabel: "Public request first gym proof session resume",
    badge: "Session resume",
    packet: publicRequestFirstGymProofSessionResumePacket,
  },
  {
    ariaLabel: "Public request first gym proof session diagnostics",
    badge: "Session diagnostics",
    packet: publicRequestFirstGymProofSessionDiagnostics,
  },
  {
    ariaLabel: "Public request first gym proof session follow-up preflight",
    badge: "Follow-up preflight",
    packet: publicRequestFirstGymProofSessionFollowupPreflight,
  },
  {
    ariaLabel: "Public request first gym proof session launch checkpoint",
    badge: "Launch checkpoint",
    packet: publicRequestFirstGymProofSessionLaunchCheckpoint,
  },
  {
    ariaLabel: "Public request first gym proof command execution envelope",
    badge: "Execution envelope",
    packet: publicRequestFirstGymProofCommandExecutionEnvelope,
  },
  {
    ariaLabel: "Public request first gym proof evidence intake manifest",
    badge: "Evidence intake",
    packet: publicRequestFirstGymProofEvidenceIntakeManifest,
  },
  {
    ariaLabel: "Public request first gym proof evidence session handoff",
    badge: "Session handoff",
    packet: publicRequestFirstGymProofEvidenceSessionHandoff,
  },
  {
    ariaLabel: "Public request first gym proof evidence session ledger",
    badge: "Session ledger",
    packet: publicRequestFirstGymProofEvidenceSessionLedger,
  },
  {
    ariaLabel: "Public request first gym evidence execution readiness",
    badge: "Execution readiness",
    packet: publicRequestFirstGymEvidenceExecutionReadiness,
  },
  {
    ariaLabel: "Public request first gym evidence run coordinator",
    badge: "Run coordinator",
    packet: publicRequestFirstGymEvidenceRunCoordinator,
  },
  {
    ariaLabel: "Public request first gym protected Preview evidence preflight",
    badge: "Preview preflight",
    packet: publicRequestFirstGymProtectedPreviewEvidencePreflight,
  },
  {
    ariaLabel: "Public request first gym real evidence attempt readiness",
    badge: "Evidence attempt",
    packet: publicRequestFirstGymRealEvidenceAttemptReadiness,
  },
  {
    ariaLabel: "Public request first gym real evidence execution packet",
    badge: "Execution packet",
    packet: publicRequestFirstGymRealEvidenceExecutionPacket,
  },
  {
    ariaLabel: "Public request first gym real evidence execution guard",
    badge: "Execution guard",
    packet: publicRequestFirstGymRealEvidenceExecutionGuard,
  },
  {
    ariaLabel: "Public request first gym real evidence refresh coordinator",
    badge: "Refresh coordinator",
    packet: publicRequestFirstGymRealEvidenceRefreshCoordinator,
  },
  {
    ariaLabel: "Public request first gym go no go bundle",
    badge: "Go/no-go bundle",
    packet: publicRequestFirstGymGoNoGoBundle,
  },
  {
    ariaLabel: "Public request first gym operator run",
    badge: "First-gym run",
    packet: publicRequestFirstGymOperatorRunRecord,
  },
  {
    ariaLabel: "Public request limited beta review",
    badge: "Beta review",
    packet: publicRequestLimitedBetaOperatorReviewPacket,
  },
  {
    ariaLabel: "Public request self serve launch preflight",
    badge: "Launch preflight",
    packet: publicRequestSelfServeLaunchPreflight,
  },
].map(({ ariaLabel, badge, packet }) => {
                const readinessRunway: FounderAdminDemoOnboardingRunwaySlice[] =
                  "nextReadinessBatches" in packet
                    ? (packet.nextReadinessBatches as FounderAdminDemoOnboardingRunwaySlice[])
                    : packet.nextTwoSlices;

                return (
                  <div
                  className="founder-launch-package-summary"
                  aria-label={ariaLabel}
                  key={ariaLabel}
                >
                  <div>
                    <span className="founder-proof-state founder-proof-state-blocked">
                      {badge}
                    </span>
                    <strong>{packet.title}</strong>
                    <small>{packet.summary}</small>
                  </div>
                  <div className="founder-launch-readiness-export-path">
                    <span>Artifact</span>
                    <code>{packet.artifactPath}</code>
                  </div>
                  <div className="founder-launch-package-gates">
                    {readinessRunway.map((slice) => (
                      <article
                        className="founder-launch-package-gate"
                        key={slice.id}
                      >
                        <span
                          className={`founder-proof-state founder-proof-state-${slice.state}`}
                        >
                          {readinessLabel(slice.state)}
                        </span>
                        <strong>{slice.title}</strong>
                        <small>{slice.detail}</small>
                        <code>{slice.command}</code>
                      </article>
                    ))}
                  </div>
                  <div className="founder-launch-package-gates">
                    {packet.gates.map((gate) => (
                      <article
                        className="founder-launch-package-gate"
                        key={gate.label}
                      >
                        <span
                          className={`founder-proof-state founder-proof-state-${gate.state}`}
                        >
                          {readinessLabel(gate.state)}
                        </span>
                        <strong>{gate.label}</strong>
                        <small>{gate.detail}</small>
                      </article>
                    ))}
                  </div>
                  {packet.commands.map((command) => (
                    <div
                      className="founder-proof-command-row founder-launch-package-command"
                      key={command.label}
                    >
                      <div>
                        <strong>{command.label}</strong>
                        <small>{command.detail}</small>
                      </div>
                      <code>{command.command}</code>
                    </div>
                  ))}
                  <div className="founder-launch-package-blocked-gates">
                    <strong>Still blocked</strong>
                    <ul>
                      <li>No browser approval or automatic owner grants.</li>
                      <li>No invitation delivery, notifications, or providers.</li>
                      <li>No billing, POS, access control, or member-ledger writes.</li>
                    </ul>
                  </div>
                  </div>
                );
              })}

              <div
                className="founder-launch-package-summary"
                aria-label="Next SaaS preflight readiness"
                >
                  <div>
                    <span className="founder-proof-state founder-proof-state-pending">
                      Preflight
                    </span>
                    <strong>Next SaaS preflights</strong>
                    <small>
                      Source import and email-channel setup packets for the next
                      beta workflow slices.
                    </small>
                  </div>
                  {[
                    nextSaasPreflights.sourceImport,
                    nextSaasPreflights.emailChannel,
                  ].map((preflight) => (
                    <section
                      className="founder-launch-package-summary"
                      aria-label={preflight.title}
                      key={preflight.title}
                    >
                      <div>
                        <span
                          className={`founder-proof-state founder-proof-state-${preflight.commands[0]?.state ?? "blocked"}`}
                        >
                          {readinessLabel(preflight.commands[0]?.state)}
                        </span>
                        <strong>{preflight.title}</strong>
                        <small>{preflight.summary}</small>
                      </div>
                      <div className="founder-launch-readiness-export-path">
                        <span>Artifact</span>
                        <code>{preflight.artifactPath}</code>
                      </div>
                      <div className="founder-launch-package-gates">
                        {preflight.gates.map((gate) => (
                          <article
                            className="founder-launch-package-gate"
                            key={gate.label}
                          >
                            <span
                              className={`founder-proof-state founder-proof-state-${gate.state}`}
                            >
                              {readinessLabel(gate.state)}
                            </span>
                            <strong>{gate.label}</strong>
                            <small>{gate.detail}</small>
                          </article>
                        ))}
                      </div>
                      {preflight.commands.map((command) => (
                        <div
                          className="founder-proof-command-row founder-launch-package-command"
                          key={command.label}
                        >
                          <div>
                            <strong>{command.label}</strong>
                            <small>{command.detail}</small>
                          </div>
                          <code>{command.command}</code>
                        </div>
                      ))}
                      <div className="founder-launch-package-blocked-gates">
                        <strong>Still blocked preflight</strong>
                        <ul>
                          <li>
                            No website scraping, Google API import, or automatic
                            source ingestion.
                          </li>
                          <li>
                            No Gmail, Resend, SMTP, inbound email, outbound
                            email, or notifications.
                          </li>
                          <li>
                            No public self-serve, billing, POS, access control,
                            or member-ledger writes.
                          </li>
                        </ul>
                      </div>
                    </section>
                  ))}
                </div>

                {proofLedger.launchPackageRecords.length === 0 ? (
                  <div className="founder-proof-run-empty">
                    <strong>No persisted launch package record.</strong>
                    <small>
                      Inspect the launch bundle, generate the owner message,
                      then import metadata after operator review.
                    </small>
                  </div>
                ) : (
                  proofLedger.launchPackageRecords.map((record) => (
                    <article
                      className="founder-proof-run founder-launch-package-record"
                      key={record.id}
                    >
                      <div>
                        <span>Gym</span>
                        <strong>{record.gym_name}</strong>
                      </div>
                      <div>
                        <span>Recorded</span>
                        <strong>{record.recorded_at}</strong>
                      </div>
                      <div>
                        <span>Preview</span>
                        <strong>{record.app_origin}</strong>
                      </div>
                      <div>
                        <span>Branch</span>
                        <strong>{record.neon_branch_name}</strong>
                      </div>
                      <div>
                        <span>Bundle</span>
                        <strong>
                          {record.launch_bundle_sha256.slice(0, 12)}
                        </strong>
                      </div>
                      <div>
                        <span>Self-serve</span>
                        <strong>
                          {record.public_self_serve_launch_allowed
                            ? "Unexpected"
                            : "Blocked"}
                        </strong>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="founder-proof-commands">
                {proofLedger.proofCommands.map((proofCommand) => (
                  <div
                    className="founder-proof-command-row"
                    key={proofCommand.command}
                  >
                    <div>
                      <strong>{proofCommand.label}</strong>
                      <small>{proofCommand.detail}</small>
                    </div>
                    <code>{proofCommand.command}</code>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function BetaAccessRequestRow({
  ownerReadinessRow,
  proofLedger,
  request,
}: {
  ownerReadinessRow?: FounderAdminOwnerReadinessRow;
  proofLedger?: FounderAdminProofStatusLedger;
  request: FounderAdminBetaAccessRequestRecord;
}) {
  const queueState = requestQueueState(request);
  const operatorSequence = founderAdminBetaRequestOperatorSequence(
    request,
    proofLedger,
  );
  const onboardingTimeline = founderAdminOwnerOnboardingTimeline(
    request,
    proofLedger,
    ownerReadinessRow,
  );
  const preflight = founderAdminBetaFulfillmentPreflight(request);
  const triage = founderAdminBetaRequestTriageReadiness(request, proofLedger);
  const followThrough = founderAdminBetaRequestFollowThroughReadiness(
    request,
    proofLedger,
  );

  return (
    <article
      className={`founder-beta-access-request founder-beta-access-request-${queueState.className}`}
    >
      <div className="founder-beta-access-priority">
        <span>{queueState.tone}</span>
        <strong>{queueState.label}</strong>
        <small>{queueState.nextStep}</small>
      </div>

      <div className="founder-beta-access-main">
        <div>
          <span>Gym</span>
          <strong>{request.gym_name}</strong>
          <small>{request.location_hint || "Location not provided"}</small>
        </div>
        <div>
          <span>Owner</span>
          <strong>{request.owner_name}</strong>
          <small>{request.email}</small>
        </div>
        <div>
          <span>Request</span>
          <strong>{readinessLabel(request.status)}</strong>
          <small>
            {request.request_count} request
            {request.request_count === 1 ? "" : "s"}; last{" "}
            {request.last_requested_at}
          </small>
        </div>
      </div>

      <div
        className="founder-beta-access-checks"
        aria-label={`Readiness checks for ${request.email}`}
      >
        <div>
          <span>Grant</span>
          <strong>
            {request.grant.present
              ? readinessLabel(request.grant.status)
              : "Not granted"}
          </strong>
          <small>
            {request.note_present ? "Request note present" : "No request note"}
          </small>
        </div>
        <div>
          <span>Fulfillment</span>
          <strong>
            {request.fulfillment?.fulfilled ? "Fulfilled" : "Pending"}
          </strong>
          <small>
            {request.fulfillment?.fulfilled_at
              ? `Linked ${request.fulfillment.fulfilled_at}`
              : "CLI not completed"}
          </small>
        </div>
        <div>
          <span>Account</span>
          <strong>
            {request.owner_account.app_user_present
              ? "App user"
              : "No app user"}
          </strong>
          <small>
            {request.owner_account.auth_linked
              ? "Neon Auth linked"
              : "Auth not linked"}
          </small>
        </div>
        <div>
          <span>Tenant</span>
          <strong>{request.tenant_bootstrap.tenant_name ?? "No tenant"}</strong>
          <small>
            {request.tenant_bootstrap.tenant_id ?? "Bootstrap pending"}
          </small>
        </div>
      </div>

      <div
        className={`founder-beta-access-preflight founder-beta-access-preflight-${preflight.state}`}
        aria-label={`Fulfillment preflight for ${request.email}`}
      >
        <div className="founder-beta-access-preflight-title">
          <span>{readinessLabel(preflight.state)}</span>
          <strong>{preflight.title}</strong>
          <small>{preflight.detail}</small>
        </div>
        <ul>
          {preflight.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <code>{preflight.command}</code>
      </div>

      <div
        className={`founder-beta-access-preflight founder-beta-access-preflight-${triage.state}`}
        aria-label={`Request triage for ${request.email}`}
      >
        <div className="founder-beta-access-preflight-title">
          <span>{readinessLabel(triage.state)}</span>
          <strong>Request triage</strong>
          <small>{triage.summary}</small>
        </div>
        <ul>
          <li>No browser approval or public owner self-registration.</li>
          <li>
            No invitation delivery. Notifications remain off. Auth provisioning
            stays outside this view.
          </li>
          <li>
            No phone/email providers, billing, POS, access-control, or
            member-ledger writes.
          </li>
        </ul>
        <code>{triage.packetCommand}</code>
        <code>{triage.recordCommand}</code>
        {triage.receipt ? (
          <dl>
            <div>
              <dt>Decision</dt>
              <dd>{readinessLabel(triage.receipt.decision)}</dd>
            </div>
            <div>
              <dt>Reviewer</dt>
              <dd>{triage.receipt.reviewer_label}</dd>
            </div>
            <div>
              <dt>Recorded</dt>
              <dd>{triage.receipt.recorded_at}</dd>
            </div>
            <div>
              <dt>Packet</dt>
              <dd>{triage.receipt.packet_sha256.slice(0, 12)}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div
        className={`founder-beta-access-preflight founder-beta-access-preflight-${followThrough.state}`}
        aria-label={`Request follow-through for ${request.email}`}
      >
        <div className="founder-beta-access-preflight-title">
          <span>{readinessLabel(followThrough.state)}</span>
          <strong>{followThrough.title}</strong>
          <small>{followThrough.summary}</small>
        </div>
        <ul>
          {followThrough.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        {followThrough.state === "ready" ? (
          <code>{followThrough.command}</code>
        ) : null}
        {followThrough.state === "ready" &&
        !followThrough.outcome &&
        followThrough.recordCommand ? (
          <code>{followThrough.recordCommand}</code>
        ) : null}
        <small>Artifact: {followThrough.artifactPath}</small>
        {followThrough.outcome ? (
          <dl>
            <div>
              <dt>Outcome</dt>
              <dd>{readinessLabel(followThrough.outcome.outcome)}</dd>
            </div>
            <div>
              <dt>Reviewer</dt>
              <dd>{followThrough.outcome.reviewer_label}</dd>
            </div>
            <div>
              <dt>Recorded</dt>
              <dd>{followThrough.outcome.recorded_at}</dd>
            </div>
            <div>
              <dt>Packet</dt>
              <dd>
                {followThrough.outcome.followthrough_packet_sha256.slice(0, 12)}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div
        className={`founder-beta-access-receipt ${
          request.fulfillment_receipt?.present
            ? "founder-beta-access-receipt-recorded"
            : "founder-beta-access-receipt-missing"
        }`}
        aria-label={`Fulfillment receipt for ${request.email}`}
      >
        <div className="founder-beta-access-receipt-title">
          <span>
            {request.fulfillment_receipt?.present ? "Recorded" : "Missing"}
          </span>
          <strong>Fulfillment receipt</strong>
          <small>
            {request.fulfillment_receipt?.present
              ? "Append-only CLI receipt recorded without secrets or browser mutation controls."
              : request.fulfillment?.fulfilled
                ? "Fulfillment is linked, but no receipt row is visible. Rerun proof or inspect the hosted branch before handoff."
                : "Receipt appears only after the CLI fulfillment command succeeds."}
          </small>
        </div>
        {request.fulfillment_receipt?.present ? (
          <dl>
            <div>
              <dt>Command</dt>
              <dd>{request.fulfillment_receipt.command_name}</dd>
            </div>
            <div>
              <dt>Recorded</dt>
              <dd>{request.fulfillment_receipt.completed_at}</dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>{request.fulfillment_receipt.neon_branch_name}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{readinessLabel(request.fulfillment_receipt.status)}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div
        className="founder-beta-access-lifecycle"
        aria-label={`Owner onboarding timeline for ${request.email}`}
      >
        <div className="founder-beta-access-lifecycle-title">
          <strong>Owner onboarding timeline</strong>
          <small>
            Derived from request, receipt, owner sign-in, workspace bootstrap,
            handoff packet, and rollback proof.
          </small>
        </div>
        <ol>
          {onboardingTimeline.map((step) => (
            <li
              className={`founder-beta-access-lifecycle-step founder-beta-access-lifecycle-step-${step.state}`}
              key={step.id}
            >
              <span>{readinessLabel(step.state)}</span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </li>
          ))}
        </ol>
      </div>

      <details className="founder-beta-access-operator">
        <summary>Operator command sequence</summary>
        <div className="founder-beta-access-operator-body">
          <div>
            <strong>{operatorSequence.title}</strong>
            <small>{operatorSequence.detail}</small>
          </div>
          <div className="founder-beta-access-operator-steps">
            {operatorSequence.steps.map((step) => (
              <article
                className="founder-beta-access-operator-step"
                key={step.label}
              >
                <div>
                  <span
                    className={`founder-proof-state founder-proof-state-${step.state}`}
                  >
                    {readinessLabel(step.state)}
                  </span>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </div>
                <code>{step.command}</code>
              </article>
            ))}
          </div>
          <ul>
            <li>
              Generate temporary passwords outside the browser and rotate them
              after the handoff.
            </li>
            <li>
              For a real owner, share the temporary password out of band after
              protected Preview proof is green.
            </li>
            <li>
              Invite delivery, notifications, live providers, billing, POS, and
              member-ledger writes stay blocked.
            </li>
          </ul>
        </div>
      </details>
    </article>
  );
}
