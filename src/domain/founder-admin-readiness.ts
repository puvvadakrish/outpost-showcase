export type FounderAdminReadinessGateState = "attention" | "blocked";

export type FounderAdminRollbackState =
  | "blocked_seeded_tenant"
  | "dry_run_rollback_ready"
  | "manual_review_required"
  | "not_applicable";

export interface FounderAdminOwnerReadinessRow {
  grant: {
    created_at: string | null;
    display_name_present: boolean;
    note_present: boolean;
    present: boolean;
    status: string;
    updated_at: string | null;
  };
  owner_account: {
    app_user_present: boolean;
    auth_linked: boolean;
    created_at: string | null;
  };
  owner_email: string;
  provider_gate: {
    state: FounderAdminReadinessGateState;
    unexpected_live_records: number;
  };
  rollback_readiness: {
    reason: string;
    state: FounderAdminRollbackState;
  };
  tenant_bootstrap: {
    billing_mode: string | null;
    created_at: string | null;
    locations_count: number;
    manual_sources_count: number;
    open_tasks_count: number;
    owner_membership_status: string | null;
    review_answers_count: number;
    tenant_id: string | null;
    tenant_name: string | null;
    tenant_status: string | null;
  };
}

export interface FounderAdminOwnerReadinessReport {
  authorized: boolean;
  generated_at: string | null;
  rows: FounderAdminOwnerReadinessRow[];
}

export type FounderAdminProofLedgerState = "blocked" | "pending" | "ready";

export interface FounderAdminProofLedgerGate {
  detail: string;
  label: string;
  state: FounderAdminProofLedgerState;
}

export interface FounderAdminProofLedgerCommand {
  command: string;
  detail: string;
  label: string;
}

export const FOUNDER_ADMIN_PROOF_GATE_LABELS = {
  customerHandoff: "Customer-observed handoff",
  founderAdmin: "Admin portal proof",
  hostedBetaWorkflow: "Hosted beta workflow proof",
} as const;

export type FounderAdminProofRunKind =
  | "hosted_founder_admin_readiness"
  | "vercel_preview_verify";

export type FounderAdminProofRunStatus = "passed";

export interface FounderAdminProofRunRecord {
  app_origin: string;
  completed_at: string;
  id: string;
  neon_branch_name: string;
  proof_kind: FounderAdminProofRunKind;
  started_at: string;
  status: FounderAdminProofRunStatus;
  summary: Record<string, unknown>;
}

export interface FounderAdminProofRunReport {
  authorized: boolean;
  generated_at: string | null;
  rows: FounderAdminProofRunRecord[];
}

export type FounderAdminCustomerHandoffGateStatus =
  "customer_observed_beta_handoff_gate_passed";

export interface FounderAdminCustomerHandoffGateRecord {
  admin_handoff_packet_sha256?: string | null;
  app_origin: string;
  beta_owner_label: string;
  gate_generated_at: string;
  gym_name: string;
  id: string;
  neon_branch_name: string;
  observer_label: string;
  participant_label: string;
  recorded_at: string;
  session_at: string;
  source_artifact_sha256: string;
  status: FounderAdminCustomerHandoffGateStatus;
  summary: Record<string, unknown>;
}

export interface FounderAdminCustomerHandoffGateReport {
  authorized: boolean;
  generated_at: string | null;
  rows: FounderAdminCustomerHandoffGateRecord[];
}

export interface FounderAdminCustomerSessionRecord {
  app_origin: string;
  billing_pos_member_writes_allowed: boolean;
  created_at: string;
  customer_observed_handoff_claimed: boolean;
  customer_observed_session_recorded: boolean;
  gym_name: string;
  handoff_scheduling_packet_sha256: string;
  id: string;
  invite_delivery_allowed: boolean;
  live_provider_enablement_allowed: boolean;
  neon_branch_name: string;
  observed_checks: Record<string, unknown>;
  operator_label: string;
  owner_email: string;
  owner_label: string;
  public_self_serve_launch_allowed: boolean;
  recorded_at: string;
  session_record_path: string;
  session_record_sha256: string;
  status: string;
  summary: Record<string, unknown>;
}

export interface FounderAdminCustomerSessionRecordReport {
  authorized: boolean;
  generated_at: string | null;
  rows: FounderAdminCustomerSessionRecord[];
}

export interface FounderAdminLaunchPackageRecord {
  app_origin: string;
  customer_handoff_recorded: boolean;
  gym_name: string;
  id: string;
  launch_bundle_path: string;
  launch_bundle_sha256: string;
  neon_branch_name: string;
  owner_label: string;
  owner_message_path: string;
  owner_message_sha256: string;
  public_self_serve_launch_allowed: boolean;
  recorded_at: string;
  status: string;
  summary: Record<string, unknown>;
}

export interface FounderAdminLaunchPackageRecordReport {
  authorized: boolean;
  generated_at: string | null;
  rows: FounderAdminLaunchPackageRecord[];
}

export interface FounderAdminBetaProofRunSummaryRecord {
  app_origin: string;
  browser_artifact_sha256: string;
  browser_cleanup: "cleanup_requested" | "retained";
  chain_artifact_sha256: string;
  chain_cleanup: "cleanup_requested" | "retained";
  created_at: string;
  id: string;
  live_provider_enablement_allowed: boolean;
  neon_branch_name: string;
  public_self_serve_launch_allowed: boolean;
  recorded_at: string;
  status: string;
  summary_sha256: string;
}

export interface FounderAdminBetaProofRunSummaryRecordReport {
  authorized: boolean;
  generated_at: string | null;
  rows: FounderAdminBetaProofRunSummaryRecord[];
}

export type FounderAdminLaunchDecisionValue =
  | "reviewed_for_next_launch_slice"
  | "changes_requested"
  | "deferred";

export interface FounderAdminLaunchDecisionRecord {
  app_origin: string;
  decision: FounderAdminLaunchDecisionValue;
  decision_packet_path: string;
  decision_packet_sha256: string;
  id: string;
  launch_bundle_sha256: string;
  launch_enablement_allowed: boolean;
  launch_package_record_id: string;
  neon_branch_name: string;
  public_self_serve_launch_allowed: boolean;
  recorded_at: string;
  review_note_present: boolean;
  reviewer_label: string;
  status: string;
  summary: Record<string, unknown>;
}

export interface FounderAdminLaunchDecisionRecordReport {
  authorized: boolean;
  generated_at: string | null;
  rows: FounderAdminLaunchDecisionRecord[];
}

export interface FounderAdminHandoffPacketRecord {
  app_origin: string;
  created_at: string;
  id: string;
  launch_readiness_sha256: string;
  live_provider_enablement_allowed: boolean;
  neon_branch_name: string;
  next_actions_sha256: string;
  packet_path: string;
  packet_sha256: string;
  proof_freshness_sha256: string;
  public_self_serve_launch_allowed: boolean;
  readiness_state: "action_required" | "ready";
  recorded_at: string;
  replay_verified: boolean;
  review_note_present: boolean;
  reviewer_label: string;
  status: string;
}

export interface FounderAdminHandoffPacketRecordReport {
  authorized: boolean;
  generated_at: string | null;
  rows: FounderAdminHandoffPacketRecord[];
}

export type FounderAdminBetaAccessRequestStatus =
  | "new"
  | "reviewing"
  | "approved"
  | "declined"
  | "superseded";

export interface FounderAdminBetaAccessRequestRecord {
  created_at: string;
  email: string;
  fulfillment: {
    fulfilled: boolean;
    fulfilled_at: string | null;
    grant_linked: boolean;
    note_present: boolean;
  };
  fulfillment_receipt: {
    command_name: string;
    completed_at: string;
    id: string;
    neon_branch_name: string;
    present: boolean;
    status: string;
  } | null;
  grant: {
    present: boolean;
    status: string | null;
  };
  gym_name: string;
  id: string;
  last_requested_at: string;
  location_hint: string;
  note_present: boolean;
  owner_account: {
    app_user_present: boolean;
    auth_linked: boolean;
  };
  owner_name: string;
  provider_gate?: {
    unexpected_live_records: number;
  };
  request_count: number;
  status: FounderAdminBetaAccessRequestStatus;
  tenant_bootstrap: {
    tenant_id: string | null;
    tenant_name: string | null;
  };
  updated_at: string;
}

export interface FounderAdminBetaAccessRequestReport {
  authorized: boolean;
  generated_at: string | null;
  rows: FounderAdminBetaAccessRequestRecord[];
}

export type FounderAdminBetaAccessRequestTriageDecision =
  | "ready_for_operator_fulfillment"
  | "needs_followup"
  | "not_a_fit";

export interface FounderAdminBetaAccessRequestTriageReceipt {
  app_origin: string;
  created_at: string;
  decision: FounderAdminBetaAccessRequestTriageDecision;
  id: string;
  launch_enablement_allowed: boolean;
  neon_branch_name: string;
  owner_email: string;
  packet_path: string;
  packet_sha256: string;
  public_self_serve_launch_allowed: boolean;
  recorded_at: string;
  request_id: string;
  review_note_present: boolean;
  reviewer_label: string;
  status: string;
  summary: Record<string, unknown>;
}

export interface FounderAdminBetaAccessRequestTriageReceiptReport {
  authorized: boolean;
  generated_at: string | null;
  rows: FounderAdminBetaAccessRequestTriageReceipt[];
}

export type FounderAdminBetaAccessRequestFollowThroughOutcome =
  | "operator_handoff_completed"
  | "followup_required"
  | "deferred_not_ready";

export interface FounderAdminBetaAccessRequestFollowThroughOutcomeRecord {
  app_origin: string;
  created_at: string;
  followthrough_packet_path: string;
  followthrough_packet_sha256: string;
  id: string;
  launch_enablement_allowed: boolean;
  neon_branch_name: string;
  outcome: FounderAdminBetaAccessRequestFollowThroughOutcome;
  owner_email: string;
  public_self_serve_launch_allowed: boolean;
  recorded_at: string;
  request_id: string;
  review_note_present: boolean;
  reviewer_label: string;
  status: string;
  summary: Record<string, unknown>;
}

export interface FounderAdminBetaAccessRequestFollowThroughOutcomeReport {
  authorized: boolean;
  generated_at: string | null;
  rows: FounderAdminBetaAccessRequestFollowThroughOutcomeRecord[];
}

export type FounderAdminBetaAccessLifecycleStepState =
  | "blocked"
  | "pending"
  | "ready";

export interface FounderAdminBetaAccessLifecycleStep {
  detail: string;
  id:
    | "request_queued"
    | "operator_review"
    | "access_fulfilled"
    | "owner_signed_in"
    | "workspace_bootstrapped"
    | "handoff_ready";
  label: string;
  state: FounderAdminBetaAccessLifecycleStepState;
}

export type FounderAdminOwnerOnboardingTimelineStepState =
  | "attention"
  | "blocked"
  | "pending"
  | "ready";

export interface FounderAdminOwnerOnboardingTimelineStep {
  detail: string;
  id:
    | "beta_request"
    | "fulfillment_receipt"
    | "owner_sign_in"
    | "workspace_bootstrap"
    | "handoff_packet"
    | "reset_rollback";
  label: string;
  state: FounderAdminOwnerOnboardingTimelineStepState;
}

export type FounderAdminBetaFulfillmentPreflightState =
  | "attention"
  | "blocked"
  | "ready";

export interface FounderAdminBetaFulfillmentPreflight {
  command: string;
  detail: string;
  reasons: string[];
  state: FounderAdminBetaFulfillmentPreflightState;
  title: string;
}

export type FounderAdminBetaRequestTriageState =
  | "blocked"
  | "pending"
  | "ready";

export interface FounderAdminBetaRequestTriageReadiness {
  packetCommand: string;
  receipt?: FounderAdminBetaAccessRequestTriageReceipt;
  recordCommand: string;
  state: FounderAdminBetaRequestTriageState;
  summary: string;
}

export type FounderAdminBetaRequestFollowThroughState =
  | "blocked"
  | "pending"
  | "ready";

export interface FounderAdminBetaRequestFollowThroughReadiness {
  artifactPath: string;
  command: string;
  outcome?: FounderAdminBetaAccessRequestFollowThroughOutcomeRecord;
  recordCommand: string;
  reasons: string[];
  state: FounderAdminBetaRequestFollowThroughState;
  summary: string;
  title: string;
}

export type FounderAdminOperatorSequenceStepState =
  | "attention"
  | "blocked"
  | "ready";

export interface FounderAdminOperatorSequenceStep {
  command: string;
  detail: string;
  label: string;
  state: FounderAdminOperatorSequenceStepState;
}

export interface FounderAdminOperatorSequence {
  detail: string;
  steps: FounderAdminOperatorSequenceStep[];
  title: string;
}

export type FounderAdminSelfServeReadinessState =
  | "blocked"
  | "pending"
  | "ready";

export interface FounderAdminSelfServeReadinessGate {
  detail: string;
  label: string;
  state: FounderAdminSelfServeReadinessState;
}

export interface FounderAdminSelfServeReadiness {
  gates: FounderAdminSelfServeReadinessGate[];
  summary: string;
  title: string;
}

export type FounderAdminLaunchReadinessExportState =
  | "blocked"
  | "pending"
  | "ready";

export interface FounderAdminLaunchReadinessExportGate {
  detail: string;
  label: string;
  state: FounderAdminLaunchReadinessExportState;
}

export interface FounderAdminLaunchReadinessExportCommand {
  command: string;
  detail: string;
  label: string;
  state: FounderAdminLaunchReadinessExportState;
}

export interface FounderAdminLaunchReadinessExport {
  commands: FounderAdminLaunchReadinessExportCommand[];
  exportPath: string;
  gates: FounderAdminLaunchReadinessExportGate[];
  nonGoals: string[];
  summary: string;
  title: string;
}

export type FounderAdminLaunchPromotionGateState =
  | "blocked"
  | "pending"
  | "ready";

export interface FounderAdminLaunchPromotionGateItem {
  detail: string;
  label: string;
  state: FounderAdminLaunchPromotionGateState;
}

export interface FounderAdminLaunchPromotionGateCommand {
  command: string;
  detail: string;
  label: string;
  state: FounderAdminLaunchPromotionGateState;
}

export interface FounderAdminLaunchPromotionGate {
  bundlePath: string;
  commands: FounderAdminLaunchPromotionGateCommand[];
  gates: FounderAdminLaunchPromotionGateItem[];
  nonGoals: string[];
  promotionPath: string;
  releaseNotePath: string;
  summary: string;
  title: string;
}

export type FounderAdminLaunchPackageReadinessState =
  | "blocked"
  | "pending"
  | "ready";

export interface FounderAdminLaunchPackageReadinessGate {
  detail: string;
  label: string;
  state: FounderAdminLaunchPackageReadinessState;
}

export interface FounderAdminLaunchPackageReadinessCommand {
  command: string;
  detail: string;
  label: string;
  state: FounderAdminLaunchPackageReadinessState;
}

export interface FounderAdminLaunchPackageReadiness {
  command: FounderAdminLaunchPackageReadinessCommand;
  gates: FounderAdminLaunchPackageReadinessGate[];
  latestRecord?: FounderAdminLaunchPackageRecord;
  summary: string;
  title: string;
}

export type FounderAdminLaunchDecisionPacketState =
  | "blocked"
  | "pending"
  | "ready";

export interface FounderAdminLaunchDecisionPacketGate {
  detail: string;
  label: string;
  state: FounderAdminLaunchDecisionPacketState;
}

export interface FounderAdminLaunchDecisionPacketCommand {
  command: string;
  detail: string;
  label: string;
  state: FounderAdminLaunchDecisionPacketState;
}

export interface FounderAdminLaunchDecisionPacketReadiness {
  commands: FounderAdminLaunchDecisionPacketCommand[];
  decisionRecords: FounderAdminLaunchDecisionRecord[];
  gates: FounderAdminLaunchDecisionPacketGate[];
  latestDecisionRecord?: FounderAdminLaunchDecisionRecord;
  latestRecord?: FounderAdminLaunchPackageRecord;
  packetPath: string;
  recordCommand: FounderAdminLaunchDecisionPacketCommand;
  summary: string;
  title: string;
}

export type FounderAdminLaunchFollowThroughState =
  | "blocked"
  | "pending"
  | "ready";

export interface FounderAdminLaunchFollowThroughGate {
  detail: string;
  label: string;
  state: FounderAdminLaunchFollowThroughState;
}

export interface FounderAdminLaunchFollowThroughCommand {
  command: string;
  detail: string;
  label: string;
  state: FounderAdminLaunchFollowThroughState;
}

export interface FounderAdminLaunchFollowThroughReadiness {
  artifactPath: string;
  command: FounderAdminLaunchFollowThroughCommand;
  gates: FounderAdminLaunchFollowThroughGate[];
  latestDecisionRecord?: FounderAdminLaunchDecisionRecord;
  summary: string;
  title: string;
}

export interface FounderAdminOperatorSelfServeRehearsalRecord {
  app_origin: string;
  followthrough_artifact_sha256: string;
  gym_name: string;
  id: string;
  launch_decision_record_id: string;
  launch_enablement_allowed: boolean;
  neon_branch_name: string;
  observed_at: string;
  operator_label: string;
  owner_label: string;
  public_self_serve_launch_allowed: boolean;
  recorded_at: string;
  rehearsal_packet_path: string;
  rehearsal_packet_sha256: string;
  status: string;
  summary: Record<string, unknown>;
}

export interface FounderAdminOperatorSelfServeRehearsalReport {
  authorized: boolean;
  generated_at: string | null;
  rows: FounderAdminOperatorSelfServeRehearsalRecord[];
}

export type FounderAdminOperatorSelfServeRehearsalState =
  | "blocked"
  | "pending"
  | "ready";

export interface FounderAdminOperatorSelfServeRehearsalGate {
  detail: string;
  label: string;
  state: FounderAdminOperatorSelfServeRehearsalState;
}

export interface FounderAdminOperatorSelfServeRehearsalCommand {
  command: string;
  detail: string;
  label: string;
  state: FounderAdminOperatorSelfServeRehearsalState;
}

export interface FounderAdminOperatorSelfServeRehearsalReadiness {
  followThroughArtifactPath: string;
  gates: FounderAdminOperatorSelfServeRehearsalGate[];
  latestRecord?: FounderAdminOperatorSelfServeRehearsalRecord;
  packetCommand: FounderAdminOperatorSelfServeRehearsalCommand;
  packetPath: string;
  recordCommand: FounderAdminOperatorSelfServeRehearsalCommand;
  records: FounderAdminOperatorSelfServeRehearsalRecord[];
  summary: string;
  title: string;
}

export type FounderAdminChannelPreflightState = "blocked" | "pending" | "ready";

export interface FounderAdminChannelPreflightCommand {
  command: string;
  detail: string;
  label: string;
  state: FounderAdminChannelPreflightState;
}

export interface FounderAdminChannelPreflightGate {
  detail: string;
  label: string;
  state: FounderAdminChannelPreflightState;
}

export interface FounderAdminChannelPreflightReadiness {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  summary: string;
  title: string;
}

export interface FounderAdminNextSaasPreflights {
  emailChannel: FounderAdminChannelPreflightReadiness;
  sourceImport: FounderAdminChannelPreflightReadiness;
}

export interface FounderAdminDemoOnboardingRunwaySlice {
  command: string;
  detail: string;
  id:
    | "hosted_customer_session_proof"
    | "operator_demo_onboarding_rehearsal"
    | "customer_observed_gym_demo_gate"
    | "limited_operator_assisted_beta_onboarding"
    | "approved_gym_operator_fulfillment"
    | "approved_gym_request_followthrough"
    | "public_self_serve_preflight"
    | "public_request_intake_dry_run"
    | "request_intake_invite_auth_readiness_batch"
    | "owner_staff_handoff_readiness_batch"
    | "approved_gym_hosted_rehearsal_readiness_batch"
    | "approved_gym_hosted_rehearsal_evidence"
    | "first_gym_go_no_go_bundle"
    | "first_gym_operator_assisted_run"
    | "invite_auth_dry_run_gates"
    | "public_request_intake_artifact"
    | "public_request_followup_readiness_batch"
    | "public_request_owner_staff_handoff_readiness_batch"
    | "public_request_hosted_rehearsal_readiness_batch"
    | "public_request_first_gym_go_no_go_readiness_batch"
    | "invite_auth_no_send_no_create_records"
    | "live_provider_revenue_member_system_runbooks"
    | "limited_beta_operator_onboarding_review"
    | "invite_delivery_preflight"
    | "auth_admin_provisioning_dry_run"
    | "owner_access_fulfillment_evidence"
    | "staff_invite_no_send_preflight"
    | "owner_access_completion_proof"
    | "staff_roster_claim_handoff_evidence"
    | "operator_assisted_onboarding_rehearsal"
    | "handoff_proof_bundle"
    | "protected_preview_walkthrough"
    | "customer_observed_handoff_gate"
    | "live_provider_revenue_gates";
  state: FounderAdminChannelPreflightState;
  title: string;
}

export interface FounderAdminDemoOnboardingRunway {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminDemoOnboardingCompletion {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminCustomerDemoGatePacket {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminLimitedBetaOnboardingPacket {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminPublicSelfServePreflight {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminApprovedGymFollowthroughPacket {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminPublicRequestIntakeDryRun {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}
export interface FounderAdminInviteDeliveryPreflight {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}
export interface FounderAdminAuthAdminProvisioningDryRun {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}
export interface FounderAdminOwnerAccessFulfillmentEvidence {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}
export interface FounderAdminStaffInviteNoSendPreflight {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}
export interface FounderAdminOwnerAccessCompletionProof {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}
export interface FounderAdminStaffRosterHandoffEvidence {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}
export interface FounderAdminOperatorOnboardingRehearsal {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}
export interface FounderAdminHandoffProofBundle {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}
export interface FounderAdminContinuousReadinessBatch {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminProtectedPreviewWalkthrough {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminCustomerHandoffSchedulingBatch {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminCustomerHandoffGatePreflight {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminCustomerSessionHostedImportReadiness {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminLimitedBetaReadinessGate {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminPostCustomerProofReadinessBatch {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminApprovedBetaExpansionReadinessBatch {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminRequestIntakeInviteAuthReadinessBatch {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminOwnerStaffHandoffReadinessBatch {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export interface FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  artifactPath: string;
  commands: FounderAdminChannelPreflightCommand[];
  gates: FounderAdminChannelPreflightGate[];
  nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[];
  nextTwoSlices: FounderAdminDemoOnboardingRunwaySlice[];
  summary: string;
  title: string;
}

export type FounderAdminOperatorActionState =
  | "blocked"
  | "done"
  | "next"
  | "waiting";

export interface FounderAdminOperatorAction {
  command: string;
  detail: string;
  id: string;
  label: string;
  rank: number;
  source: string;
  state: FounderAdminOperatorActionState;
}

export interface FounderAdminOperatorActionQueue {
  actions: FounderAdminOperatorAction[];
  blockedGates: string[];
  exportCommand: FounderAdminLaunchReadinessExportCommand;
  exportPath: string;
  inspectCommand: FounderAdminLaunchReadinessExportCommand;
  nextAction?: FounderAdminOperatorAction;
  nonGoals: string[];
  summary: string;
  title: string;
}

export type FounderAdminProofFreshnessState =
  | "blocked"
  | "fresh"
  | "missing"
  | "stale";

export interface FounderAdminProofFreshnessItem {
  command: string;
  detail: string;
  id: string;
  label: string;
  recordBranchName?: string;
  recordPreviewUrl?: string;
  state: FounderAdminProofFreshnessState;
  timestamp?: string;
}

export interface FounderAdminProofFreshnessSummary {
  blockedGates: string[];
  exportCommand: FounderAdminLaunchReadinessExportCommand;
  exportPath: string;
  freshCount: number;
  inspectCommand: FounderAdminLaunchReadinessExportCommand;
  items: FounderAdminProofFreshnessItem[];
  missingCount: number;
  overallState: FounderAdminProofFreshnessState;
  staleCount: number;
  summary: string;
  title: string;
}

export type FounderAdminHandoffReadinessPacketState =
  | "action_required"
  | "blocked"
  | "ready";

export interface FounderAdminHandoffReadinessPacketGate {
  detail: string;
  label: string;
  state: FounderAdminLaunchReadinessExportState;
}

export interface FounderAdminHandoffReadinessPacket {
  exportCommand: FounderAdminLaunchReadinessExportCommand;
  hostedProofCommand: FounderAdminLaunchReadinessExportCommand;
  inspectCommand: FounderAdminLaunchReadinessExportCommand;
  packetPath: string;
  prerequisites: FounderAdminHandoffReadinessPacketGate[];
  recordCommand: FounderAdminLaunchReadinessExportCommand;
  replayCommand: FounderAdminLaunchReadinessExportCommand;
  state: FounderAdminHandoffReadinessPacketState;
  stillBlocked: string[];
  summary: string;
  title: string;
}

export interface FounderAdminProofStatusLedger {
  branchName: string;
  betaAccessRequestFollowThroughOutcomes: FounderAdminBetaAccessRequestFollowThroughOutcomeRecord[];
  betaProofRunSummaryRecords: FounderAdminBetaProofRunSummaryRecord[];
  betaAccessRequestTriageReceipts: FounderAdminBetaAccessRequestTriageReceipt[];
  customerHandoffGateRecords: FounderAdminCustomerHandoffGateRecord[];
  customerSessionRecords: FounderAdminCustomerSessionRecord[];
  generatedAt: string | null;
  handoffPacketRecords: FounderAdminHandoffPacketRecord[];
  launchDecisionRecords: FounderAdminLaunchDecisionRecord[];
  gates: FounderAdminProofLedgerGate[];
  launchPackageRecords: FounderAdminLaunchPackageRecord[];
  operatorSelfServeRehearsalRecords: FounderAdminOperatorSelfServeRehearsalRecord[];
  previewUrl: string;
  proofCommands: FounderAdminProofLedgerCommand[];
  proofRuns: FounderAdminProofRunRecord[];
}

export const emptyFounderAdminOwnerReadinessReport: FounderAdminOwnerReadinessReport =
  {
    authorized: false,
    generated_at: null,
    rows: [],
  };

export const emptyFounderAdminProofRunReport: FounderAdminProofRunReport = {
  authorized: false,
  generated_at: null,
  rows: [],
};

export const emptyFounderAdminCustomerHandoffGateReport: FounderAdminCustomerHandoffGateReport =
  {
    authorized: false,
    generated_at: null,
    rows: [],
  };

export const emptyFounderAdminCustomerSessionRecordReport: FounderAdminCustomerSessionRecordReport =
  {
    authorized: false,
    generated_at: null,
    rows: [],
  };

export const emptyFounderAdminLaunchPackageRecordReport: FounderAdminLaunchPackageRecordReport =
  {
    authorized: false,
    generated_at: null,
    rows: [],
  };

export const emptyFounderAdminBetaProofRunSummaryRecordReport: FounderAdminBetaProofRunSummaryRecordReport =
  {
    authorized: false,
    generated_at: null,
    rows: [],
  };

export const emptyFounderAdminLaunchDecisionRecordReport: FounderAdminLaunchDecisionRecordReport =
  {
    authorized: false,
    generated_at: null,
    rows: [],
  };

export const emptyFounderAdminHandoffPacketRecordReport: FounderAdminHandoffPacketRecordReport =
  {
    authorized: false,
    generated_at: null,
    rows: [],
  };

export const emptyFounderAdminOperatorSelfServeRehearsalReport: FounderAdminOperatorSelfServeRehearsalReport =
  {
    authorized: false,
    generated_at: null,
    rows: [],
  };

export const emptyFounderAdminBetaAccessRequestReport: FounderAdminBetaAccessRequestReport =
  {
    authorized: false,
    generated_at: null,
    rows: [],
  };

export const emptyFounderAdminBetaAccessRequestTriageReceiptReport: FounderAdminBetaAccessRequestTriageReceiptReport =
  {
    authorized: false,
    generated_at: null,
    rows: [],
  };
export const emptyFounderAdminBetaAccessRequestFollowThroughOutcomeReport: FounderAdminBetaAccessRequestFollowThroughOutcomeReport =
  {
    authorized: false,
    generated_at: null,
    rows: [],
  };

export function founderAdminReadinessSummary(
  report: FounderAdminOwnerReadinessReport,
) {
  const rows = report.authorized ? report.rows : [];
  const bootstrappedTenants = rows.filter(
    (row) => row.tenant_bootstrap.tenant_id,
  ).length;
  const providerAttention = rows.filter(
    (row) => row.provider_gate.unexpected_live_records > 0,
  ).length;
  const rollbackReady = rows.filter(
    (row) => row.rollback_readiness.state === "dry_run_rollback_ready",
  ).length;

  return {
    betaOwners: rows.length,
    bootstrappedTenants,
    providerAttention,
    rollbackReady,
  };
}

export function founderAdminBetaAccessRequestLifecycle(
  request: FounderAdminBetaAccessRequestRecord,
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminBetaAccessLifecycleStep[] {
  const archived =
    request.status === "declined" || request.status === "superseded";
  const reviewed =
    request.status === "reviewing" ||
    request.status === "approved" ||
    request.fulfillment.fulfilled;
  const fulfilled = request.fulfillment.fulfilled && request.grant.present;
  const ownerSignedIn = request.owner_account.auth_linked;
  const workspaceBootstrapped = Boolean(request.tenant_bootstrap.tenant_id);
  const hostedProofReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.hostedBetaWorkflow,
  );
  const founderAdminProofReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.founderAdmin,
  );
  const customerHandoffReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.customerHandoff,
  );
  const handoffReady =
    workspaceBootstrapped && hostedProofReady && founderAdminProofReady;

  return [
    {
      id: "request_queued",
      label: "Request queued",
      state: archived ? "blocked" : "ready",
      detail: archived
        ? `Request is ${request.status}; keep it archived unless a new request is submitted.`
        : `${request.request_count} request${request.request_count === 1 ? "" : "s"} received; last ${request.last_requested_at}.`,
    },
    {
      id: "operator_review",
      label: "Operator review",
      state: archived ? "blocked" : reviewed ? "ready" : "pending",
      detail: archived
        ? "Review is closed for this archived request."
        : reviewed
          ? `Request is ${request.status}; continue through the protected fulfillment path.`
          : "Review gym, owner, location, and note details before CLI fulfillment.",
    },
    {
      id: "access_fulfilled",
      label: "Access fulfilled",
      state: archived ? "blocked" : fulfilled ? "ready" : "pending",
      detail: archived
        ? "No active owner access should be fulfilled for this request."
        : fulfilled
          ? `CLI fulfillment linked an owner grant${request.fulfillment.fulfilled_at ? ` at ${request.fulfillment.fulfilled_at}` : ""}.`
          : "Run CLI fulfillment only after approval; keep temporary passwords out of the browser.",
    },
    {
      id: "owner_signed_in",
      label: "Owner signed in",
      state: archived
        ? "blocked"
        : ownerSignedIn
          ? "ready"
          : fulfilled
            ? "pending"
            : "blocked",
      detail: archived
        ? "Archived requests should not move to owner sign-in."
        : ownerSignedIn
          ? "Owner account is linked to Neon Auth."
          : fulfilled
            ? "Owner access exists; wait for the owner to sign in with the protected Preview."
            : "Fulfill access before expecting owner sign-in.",
    },
    {
      id: "workspace_bootstrapped",
      label: "Workspace bootstrapped",
      state: archived
        ? "blocked"
        : workspaceBootstrapped
          ? "ready"
          : ownerSignedIn
            ? "pending"
            : "blocked",
      detail: archived
        ? "Archived requests should not create a workspace."
        : workspaceBootstrapped
          ? `Workspace ${request.tenant_bootstrap.tenant_name ?? request.tenant_bootstrap.tenant_id} exists.`
          : ownerSignedIn
            ? "Owner has signed in; seedless workspace bootstrap is still pending."
            : "Owner sign-in is required before workspace bootstrap.",
    },
    {
      id: "handoff_ready",
      label: "Handoff ready",
      state: archived
        ? "blocked"
        : handoffReady
          ? "ready"
          : workspaceBootstrapped
            ? "pending"
            : "blocked",
      detail: archived
        ? "Archived requests cannot be handoff ready."
        : handoffReady
          ? customerHandoffReady
            ? "Protected Preview, admin portal proof, and customer-observed proof are recorded."
            : "Protected Preview and admin portal proof are recorded; customer-observed completion remains a separate final gate."
          : workspaceBootstrapped
            ? "Workspace exists, but matching hosted proof records are still required before handoff."
            : "Workspace bootstrap and matching hosted proof are required before handoff.",
    },
  ];
}

export function founderAdminOwnerOnboardingTimeline(
  request: FounderAdminBetaAccessRequestRecord,
  proofLedger?: FounderAdminProofStatusLedger,
  ownerReadinessRow?: FounderAdminOwnerReadinessRow,
): FounderAdminOwnerOnboardingTimelineStep[] {
  const archived =
    request.status === "declined" || request.status === "superseded";
  const fulfilled = request.fulfillment.fulfilled && request.grant.present;
  const receiptRecorded = request.fulfillment_receipt?.present === true;
  const ownerSignedIn = request.owner_account.auth_linked;
  const workspaceBootstrapped = Boolean(request.tenant_bootstrap.tenant_id);
  const hostedProofReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.hostedBetaWorkflow,
  );
  const founderAdminProofReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.founderAdmin,
  );
  const customerHandoffReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.customerHandoff,
  );
  const packetReady =
    workspaceBootstrapped && hostedProofReady && founderAdminProofReady;
  const rollbackStep = rollbackTimelineStep(
    ownerReadinessRow,
    workspaceBootstrapped,
    archived,
  );

  return [
    {
      id: "beta_request",
      label: "Beta request",
      state: archived ? "blocked" : "ready",
      detail: archived
        ? `Request is ${request.status}; keep it archived unless the owner submits a new request.`
        : `${request.gym_name} requested owner access for ${request.email}.`,
    },
    {
      id: "fulfillment_receipt",
      label: "Fulfillment receipt",
      state: archived
        ? "blocked"
        : receiptRecorded
          ? "ready"
          : fulfilled
            ? "attention"
            : "pending",
      detail: archived
        ? "Archived requests should not receive fulfillment receipts."
        : receiptRecorded
          ? `CLI receipt recorded on ${request.fulfillment_receipt?.neon_branch_name ?? "the hosted branch"}.`
          : fulfilled
            ? "Access is fulfilled, but the append-only receipt is missing from the admin projection."
            : "Run CLI fulfillment after approval; the receipt appears only after successful grant-linked fulfillment.",
    },
    {
      id: "owner_sign_in",
      label: "Owner sign-in",
      state: archived
        ? "blocked"
        : ownerSignedIn
          ? "ready"
          : fulfilled
            ? "pending"
            : "blocked",
      detail: archived
        ? "Archived requests should not continue to owner sign-in."
        : ownerSignedIn
          ? "Owner identity is linked to Neon Auth."
          : fulfilled
            ? "Owner access is active; wait for the owner to sign in on the protected Preview."
            : "Fulfill owner access before expecting sign-in.",
    },
    {
      id: "workspace_bootstrap",
      label: "Workspace bootstrap",
      state: archived
        ? "blocked"
        : workspaceBootstrapped
          ? "ready"
          : ownerSignedIn
            ? "pending"
            : "blocked",
      detail: archived
        ? "Archived requests should not bootstrap a workspace."
        : workspaceBootstrapped
          ? `Workspace ${request.tenant_bootstrap.tenant_name ?? request.tenant_bootstrap.tenant_id} exists.`
          : ownerSignedIn
            ? "Owner sign-in is complete; seedless workspace bootstrap remains pending."
            : "Owner sign-in is required before workspace bootstrap.",
    },
    {
      id: "handoff_packet",
      label: "Handoff packet",
      state: archived
        ? "blocked"
        : packetReady
          ? "ready"
          : workspaceBootstrapped
            ? "pending"
            : "blocked",
      detail: archived
        ? "Archived requests should not produce handoff packets."
        : packetReady
          ? customerHandoffReady
            ? "Packet and hosted proof are green, and customer-observed proof is recorded."
            : "Packet can be generated from current hosted proof; customer-observed completion remains a separate final gate."
          : workspaceBootstrapped
            ? "Workspace exists, but matching protected Preview and admin proof records are still required before packet handoff."
            : "Workspace bootstrap is required before preparing the owner handoff packet.",
    },
    rollbackStep,
  ];
}

export function founderAdminBetaFulfillmentPreflight(
  request: FounderAdminBetaAccessRequestRecord,
): FounderAdminBetaFulfillmentPreflight {
  const command = [
    `OUTPOST_OWNER_BETA_REQUEST_EMAIL=${shellSingleQuote(request.email)}`,
    "npm run beta:operator:request-preflight",
  ].join(" \\\n  ");
  const reasons: string[] = [];
  const attention: string[] = [];
  const unexpectedLiveRecords =
    request.provider_gate?.unexpected_live_records ?? 0;

  if (request.status === "declined") {
    reasons.push("Request is declined.");
  }

  if (request.status === "superseded") {
    reasons.push(
      "Request is superseded; use the latest request for this owner email.",
    );
  }

  if (request.fulfillment.fulfilled || request.fulfillment.grant_linked) {
    reasons.push("Request already has fulfillment recorded.");
  }

  if (unexpectedLiveRecords > 0) {
    reasons.push(
      "Unexpected live-provider records exist for the linked tenant.",
    );
  }

  if (request.grant.present) {
    attention.push(
      request.grant.status === "active"
        ? "An owner beta access grant already exists."
        : `An owner beta access grant already exists with status ${request.grant.status ?? "unknown"}.`,
    );
  }

  if (request.owner_account.app_user_present) {
    attention.push("An app user already exists for this owner email.");
  }

  if (request.owner_account.auth_linked) {
    attention.push("The owner email is already linked to Neon Auth.");
  }

  if (request.tenant_bootstrap.tenant_id) {
    attention.push(
      `Workspace bootstrap already exists for ${request.tenant_bootstrap.tenant_name ?? request.tenant_bootstrap.tenant_id}.`,
    );
  }

  if (reasons.length > 0) {
    return {
      command,
      detail:
        "Do not run fulfillment until the blocking condition is resolved.",
      reasons,
      state: "blocked",
      title: "Preflight blocked",
    };
  }

  if (attention.length > 0) {
    return {
      command,
      detail:
        "Review existing access state before running the fulfillment command.",
      reasons: attention,
      state: "attention",
      title: "Needs operator review",
    };
  }

  return {
    command,
    detail: "Dry-run checks show this request is ready for CLI fulfillment.",
    reasons: [
      "Request is active and unfulfilled.",
      "No existing owner grant, app user, workspace, or live-provider surprise was found.",
    ],
    state: "ready",
    title: "Ready for CLI fulfillment",
  };
}

export function founderAdminBetaRequestTriageReadiness(
  request: FounderAdminBetaAccessRequestRecord,
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminBetaRequestTriageReadiness {
  const branchName = proofLedger?.branchName ?? "<hosted-neon-branch>";
  const previewUrl = proofLedger?.previewUrl ?? "<protected-preview-url>";
  const packetPath = `artifacts/admin-launch-readiness/${slugifyLedgerValue(request.id)}-beta-request-triage.json`;
  const receipt = (proofLedger?.betaAccessRequestTriageReceipts ?? []).find(
    (candidate) =>
      candidate.request_id === request.id &&
      candidate.neon_branch_name === branchName &&
      normalizeOrigin(candidate.app_origin) === normalizeOrigin(previewUrl) &&
      candidate.public_self_serve_launch_allowed === false &&
      candidate.launch_enablement_allowed === false,
  );
  const archived =
    request.status === "declined" || request.status === "superseded";
  const state: FounderAdminBetaRequestTriageState = receipt
    ? "ready"
    : archived
      ? "blocked"
      : "pending";
  const packetCommand = [
    `OUTPOST_BETA_REQUEST_TRIAGE_REQUEST_ID=${shellSingleQuote(request.id)}`,
    `OUTPOST_BETA_REQUEST_TRIAGE_PACKET_PATH=${shellSingleQuote(packetPath)}`,
    `OUTPOST_VERCEL_DEPLOYMENT_URL=${shellSingleQuote(previewUrl)}`,
    "npm run admin:beta-request:triage-packet",
  ].join(" \\\n  ");
  const recordCommand = [
    `OUTPOST_BETA_REQUEST_TRIAGE_PACKET_PATH=${shellSingleQuote(packetPath)}`,
    `OUTPOST_VERCEL_DEPLOYMENT_URL=${shellSingleQuote(previewUrl)}`,
    "OUTPOST_BETA_REQUEST_TRIAGE_DECISION='<ready_for_operator_fulfillment|needs_followup|not_a_fit>'",
    "OUTPOST_BETA_REQUEST_TRIAGE_REVIEWER_LABEL='<reviewer-name>'",
    "npm run admin:beta-request:triage-record",
  ].join(" \\\n  ");

  return {
    packetCommand,
    receipt,
    recordCommand,
    state,
    summary: receipt
      ? `Triage recorded as ${displayTriageDecision(receipt.decision)} by ${receipt.reviewer_label}.`
      : archived
        ? "Request is archived; do not record fulfillment triage unless reopened by a future operator process."
        : "Export packet, review request, then record human triage before operator fulfillment.",
  };
}

export function founderAdminBetaRequestFollowThroughReadiness(
  request: FounderAdminBetaAccessRequestRecord,
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminBetaRequestFollowThroughReadiness {
  const branchName = proofLedger?.branchName ?? "<hosted-neon-branch>";
  const previewUrl = proofLedger?.previewUrl ?? "<protected-preview-url>";
  const artifactPath = `artifacts/admin-launch-readiness/${slugifyLedgerValue(request.id)}-beta-request-followthrough.json`;
  const triage = founderAdminBetaRequestTriageReadiness(request, proofLedger);
  const receipt = triage.receipt;
  const outcome = (
    proofLedger?.betaAccessRequestFollowThroughOutcomes ?? []
  ).find(
    (candidate) =>
      receipt !== undefined &&
      candidate.request_id === request.id &&
      candidate.neon_branch_name === branchName &&
      normalizeOrigin(candidate.app_origin) === normalizeOrigin(previewUrl) &&
      candidate.public_self_serve_launch_allowed === false &&
      candidate.launch_enablement_allowed === false &&
      candidate.summary.triage_receipt_id === receipt.id &&
      candidate.summary.triage_packet_sha256 === receipt.packet_sha256,
  );
  const archived =
    request.status === "declined" || request.status === "superseded";
  const fulfillmentComplete =
    request.fulfillment.fulfilled && request.grant.present;
  const readyDecision = receipt?.decision === "ready_for_operator_fulfillment";
  const command = [
    `OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REQUEST_ID=${shellSingleQuote(request.id)}`,
    `OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH=${shellSingleQuote(artifactPath)}`,
    `OUTPOST_VERCEL_DEPLOYMENT_URL=${shellSingleQuote(previewUrl)}`,
    "npm run admin:beta-request:followthrough",
  ].join(" \\\n  ");
  const recordCommand = [
    `OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH=${shellSingleQuote(artifactPath)}`,
    `OUTPOST_VERCEL_DEPLOYMENT_URL=${shellSingleQuote(previewUrl)}`,
    "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_OUTCOME='<operator_handoff_completed|followup_required|deferred_not_ready>'",
    "OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_REVIEWER_LABEL='<reviewer-name>'",
    "npm run admin:beta-request:followthrough-record",
  ].join(" \\\n  ");

  if (outcome) {
    return {
      artifactPath,
      command,
      outcome,
      recordCommand,
      reasons: [
        `Outcome recorded as ${displayFollowThroughOutcome(outcome.outcome)} by ${outcome.reviewer_label}.`,
        "Public self-serve, invite delivery, live providers, billing, POS, and member-ledger writes remain blocked.",
      ],
      state: "ready",
      summary: `Follow-through outcome recorded ${outcome.recorded_at}.`,
      title: "Outcome recorded",
    };
  }

  if (archived) {
    return {
      artifactPath,
      command,
      recordCommand,
      reasons: [
        "Request is declined or superseded.",
        "Do not continue to owner access fulfillment from this request.",
      ],
      state: "blocked",
      summary: "Request archived; follow-through is blocked.",
      title: "Follow-through blocked",
    };
  }

  if (!receipt) {
    return {
      artifactPath,
      command,
      recordCommand,
      reasons: [
        "No matching reviewed triage receipt visible for this protected Preview Neon branch.",
      ],
      state: "pending",
      summary: "Record triage before writing follow-through packet.",
      title: "Waiting on triage",
    };
  }

  if (!readyDecision) {
    return {
      artifactPath,
      command,
      recordCommand,
      reasons: [
        `Latest triage decision is ${displayTriageDecision(receipt.decision)}.`,
        "Operator fulfillment remains blocked until a ready triage decision is recorded.",
      ],
      state: "blocked",
      summary: "Triage did not clear this request for operator fulfillment.",
      title: "Follow-through blocked",
    };
  }

  if (fulfillmentComplete) {
    return {
      artifactPath,
      command,
      recordCommand,
      reasons: [
        "Owner access fulfillment is already linked for this request.",
        "Use fulfillment receipt and owner handoff steps instead of regenerating this packet.",
      ],
      state: "ready",
      summary:
        "Follow-through was cleared and owner access is already fulfilled.",
      title: "Fulfillment already linked",
    };
  }

  return {
    artifactPath,
    command,
    recordCommand,
    reasons: [
      "Reviewed triage is ready for operator fulfillment.",
      "Run this terminal-only packet before the separate owner access fulfillment command.",
    ],
    state: "ready",
    summary:
      "Reviewed triage can move to terminal-only owner access fulfillment.",
    title: "Ready for follow-through",
  };
}

export function founderAdminBetaRequestOperatorSequence(
  request: FounderAdminBetaAccessRequestRecord,
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminOperatorSequence {
  const preflight = founderAdminBetaFulfillmentPreflight(request);
  const fulfillmentComplete =
    request.fulfillment.fulfilled && request.grant.present;
  const receiptRecorded = request.fulfillment_receipt?.present === true;
  const previewProofReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.hostedBetaWorkflow,
  );
  const ownerReady =
    request.owner_account.auth_linked &&
    Boolean(request.tenant_bootstrap.tenant_id);
  const ownerHandoffSlug = slugifyLedgerValue(
    request.gym_name || request.email || "owner-handoff",
  );
  const ownerHandoffBundlePath = `artifacts/beta-owner-handoff/${ownerHandoffSlug}-handoff-bundle.json`;
  const ownerHandoffMessagePath = `artifacts/beta-owner-handoff/${ownerHandoffSlug}-owner-message.md`;
  const handoffPreviewUrl =
    proofLedger &&
    !isMissingLedgerValue(proofLedger.previewUrl) &&
    !isLocalOrigin(proofLedger.previewUrl)
      ? proofLedger.previewUrl
      : "<protected-preview-url>";
  const handoffBranchName =
    proofLedger && !isMissingLedgerValue(proofLedger.branchName)
      ? proofLedger.branchName
      : "<neon-proof-branch>";

  return {
    title: "Protected operator sequence",
    detail:
      "Run these from the terminal in order. The browser remains read-only and never stores passwords, API keys, session secrets, or invite delivery state.",
    steps: [
      {
        command: preflight.command,
        detail: preflight.detail,
        label: "1. Dry-run preflight",
        state: preflight.state,
      },
      {
        command: [
          `OUTPOST_OWNER_BETA_REQUEST_EMAIL=${shellSingleQuote(request.email)}`,
          "OUTPOST_OWNER_BETA_PASSWORD='<temporary-password>'",
          "OUTPOST_OWNER_BETA_REQUEST_FULFILLMENT_NOTE='<operator-note-without-secrets>'",
          "npm run beta:operator:request-fulfillment",
        ].join(" \\\n  "),
        detail: fulfillmentComplete
          ? "Owner access is already fulfilled; do not rerun unless support deliberately rotates access."
          : preflight.state === "blocked"
            ? "Blocked until preflight reasons are resolved."
            : "Generate the temporary password out of band, then run CLI fulfillment only after operator approval.",
        label: "2. Fulfill owner access",
        state: fulfillmentComplete
          ? "ready"
          : preflight.state === "blocked"
            ? "blocked"
            : "attention",
      },
      {
        command: "npm run hosted:request-fulfillment-proof",
        detail: previewProofReady
          ? "Protected Preview proof is recorded for this Preview."
          : receiptRecorded
            ? "Receipt is visible; rerun disposable proof against the protected Preview before customer handoff."
            : "Proof should run after successful fulfillment so the admin portal receipt projection can be verified.",
        label: "3. Verify protected Preview",
        state: previewProofReady
          ? "ready"
          : fulfillmentComplete
            ? "attention"
            : "blocked",
      },
      {
        command: [
          `OUTPOST_VERCEL_DEPLOYMENT_URL=${shellSingleQuote(handoffPreviewUrl)}`,
          `OUTPOST_NEON_BRANCH_NAME=${shellSingleQuote(handoffBranchName)}`,
          `OUTPOST_BETA_HANDOFF_GYM_NAME=${shellSingleQuote(request.gym_name || "<gym-name>")}`,
          `OUTPOST_BETA_HANDOFF_OWNER_EMAIL=${shellSingleQuote(request.email)}`,
          `OUTPOST_BETA_HANDOFF_OWNER_NAME=${shellSingleQuote(request.owner_name || "<owner-name>")}`,
          `OUTPOST_BETA_HANDOFF_BUNDLE_PATH=${shellSingleQuote(ownerHandoffBundlePath)}`,
          "npm run hosted:owner-handoff:prepare",
        ].join(" \\\n  "),
        detail: ownerReady
          ? "Owner identity and workspace are present; prepare the handoff bundle at the path used by the message step before any observed session."
          : "Owner sign-in and workspace bootstrap are required before preparing the customer handoff bundle.",
        label: "4. Prepare owner handoff",
        state: ownerReady ? "ready" : "blocked",
      },
      {
        command: [
          `OUTPOST_BETA_HANDOFF_BUNDLE_PATH=${shellSingleQuote(ownerHandoffBundlePath)}`,
          `OUTPOST_BETA_HANDOFF_MESSAGE_PATH=${shellSingleQuote(ownerHandoffMessagePath)}`,
          "npm run beta:owner-handoff:message",
        ].join(" \\\n  "),
        detail: ownerReady
          ? "Draft the customer-safe handoff message from the prepared bundle; this does not send invites or claim customer-observed completion."
          : "Prepare the owner handoff bundle after owner sign-in and workspace bootstrap before drafting the message.",
        label: "5. Draft owner message",
        state: ownerReady ? "attention" : "blocked",
      },
    ],
  };
}

export function founderAdminSelfServeReadiness({
  betaAccessRequestReport = emptyFounderAdminBetaAccessRequestReport,
  proofLedger,
  report,
}: {
  betaAccessRequestReport?: FounderAdminBetaAccessRequestReport;
  proofLedger?: FounderAdminProofStatusLedger;
  report: FounderAdminOwnerReadinessReport;
}): FounderAdminSelfServeReadiness {
  const hostedProofReady =
    proofLedgerGateReady(
      proofLedger,
      FOUNDER_ADMIN_PROOF_GATE_LABELS.hostedBetaWorkflow,
    ) &&
    proofLedgerGateReady(
      proofLedger,
      FOUNDER_ADMIN_PROOF_GATE_LABELS.founderAdmin,
    ) &&
    proofLedgerGateReady(proofLedger, "Preview deployment URL");
  const customerHandoffReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.customerHandoff,
  );
  const requests = betaAccessRequestReport.authorized
    ? betaAccessRequestReport.rows
    : [];
  const fulfilledRequests = requests.filter(
    (request) =>
      request.fulfillment.fulfilled &&
      request.grant.present &&
      request.fulfillment_receipt?.present,
  );
  const activeRequests = requests.filter(
    (request) =>
      request.status !== "declined" && request.status !== "superseded",
  );
  const readinessRows = report.authorized ? report.rows : [];
  const rollbackReadyRows = readinessRows.filter(
    (row) => row.rollback_readiness.state === "dry_run_rollback_ready",
  );
  const bootstrappedRows = readinessRows.filter(
    (row) => row.tenant_bootstrap.tenant_id,
  );
  const providerAttention = readinessRows.reduce(
    (total, row) =>
      total + Math.max(0, row.provider_gate.unexpected_live_records),
    0,
  );

  return {
    title: "Pre-self-serve readiness",
    summary:
      "This is the no-go matrix before public owner onboarding. Operator-assisted beta can continue; public self-serve remains blocked until these gates are deliberately promoted.",
    gates: [
      {
        label: "Protected Preview proof",
        state: hostedProofReady ? "ready" : proofLedger ? "pending" : "blocked",
        detail: hostedProofReady
          ? "Hosted beta workflow, admin portal proof, and Preview URL proof are all recorded for this Preview."
          : proofLedger
            ? "Rerun the protected Preview proof commands until matching hosted records are ready."
            : "Hosted proof ledger is unavailable in this session.",
      },
      {
        label: "Operator fulfillment path",
        state:
          fulfilledRequests.length > 0
            ? "ready"
            : activeRequests.length > 0
              ? "pending"
              : "blocked",
        detail:
          fulfilledRequests.length > 0
            ? `${fulfilledRequests.length} beta request${fulfilledRequests.length === 1 ? "" : "s"} fulfilled with append-only CLI receipts.`
            : activeRequests.length > 0
              ? `${activeRequests.length} active request${activeRequests.length === 1 ? "" : "s"} still need preflight, fulfillment, and proof.`
              : "No active beta access request has a fulfilled receipt path yet.",
      },
      {
        label: "Reset and rollback readiness",
        state:
          rollbackReadyRows.length > 0
            ? "ready"
            : bootstrappedRows.length > 0
              ? "pending"
              : "blocked",
        detail:
          rollbackReadyRows.length > 0
            ? `${rollbackReadyRows.length} beta tenant${rollbackReadyRows.length === 1 ? "" : "s"} classified rollback-ready.`
            : bootstrappedRows.length > 0
              ? "A beta workspace exists, but rollback readiness still needs operator review."
              : "Workspace bootstrap is required before rollback readiness can be classified.",
      },
      {
        label: "Customer-observed handoff",
        state: customerHandoffReady
          ? "ready"
          : hostedProofReady
            ? "pending"
            : "blocked",
        detail: customerHandoffReady
          ? "A reviewed customer-observed handoff gate record exists for this Preview and Neon branch."
          : hostedProofReady
            ? "Run the real external owner handoff, review the artifact, then import the gate record."
            : "Customer-observed proof waits for protected Preview proof.",
      },
      {
        label: "Live-provider and billing gates",
        state: "blocked",
        detail:
          providerAttention > 0
            ? `${providerAttention} unexpected live-provider record${providerAttention === 1 ? "" : "s"} need review; invite delivery, notifications, billing, POS, access control, and member-ledger writes remain blocked.`
            : "No live-provider promotion is allowed here; invite delivery, notifications, billing, POS, access control, and member-ledger writes remain blocked.",
      },
      {
        label: "Public self-serve launch",
        state: "blocked",
        detail:
          "Do not enable public signup, browser approval, invite delivery, or automatic owner onboarding until this blocked gate is replaced by a reviewed launch slice.",
      },
    ],
  };
}

export function founderAdminLaunchReadinessExport({
  betaAccessRequestReport = emptyFounderAdminBetaAccessRequestReport,
  proofLedger,
  report,
}: {
  betaAccessRequestReport?: FounderAdminBetaAccessRequestReport;
  proofLedger?: FounderAdminProofStatusLedger;
  report: FounderAdminOwnerReadinessReport;
}): FounderAdminLaunchReadinessExport {
  const selfServeReadiness = founderAdminSelfServeReadiness({
    betaAccessRequestReport,
    proofLedger,
    report,
  });
  const previewConfigured = Boolean(
    proofLedger &&
    !isMissingLedgerValue(proofLedger.previewUrl) &&
    !isLocalOrigin(proofLedger.previewUrl),
  );
  const branchConfigured = Boolean(
    proofLedger && !isMissingLedgerValue(proofLedger.branchName),
  );
  const exportReady = previewConfigured && branchConfigured;
  const previewCommandValue = previewConfigured
    ? (proofLedger?.previewUrl ?? "<protected-preview-url>")
    : "<protected-preview-url>";
  const branchCommandValue = branchConfigured
    ? (proofLedger?.branchName ?? "<neon-proof-branch>")
    : "<neon-proof-branch>";
  const exportPath = `artifacts/admin-launch-readiness/${slugifyLedgerValue(
    proofLedger?.branchName ?? "pending-branch",
  )}-launch-readiness.json`;
  const gateState = (label: string) =>
    selfServeReadiness.gates.find((gate) => gate.label === label)?.state ??
    "blocked";
  const exportCommand = [
    `OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH=${shellSingleQuote(exportPath)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL=${shellSingleQuote(previewCommandValue)}`,
    `OUTPOST_NEON_BRANCH_NAME=${shellSingleQuote(branchCommandValue)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_PROOF=${shellSingleQuote(gateState("Protected Preview proof"))}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_FULFILLMENT=${shellSingleQuote(gateState("Operator fulfillment path"))}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK=${shellSingleQuote(gateState("Reset and rollback readiness"))}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF=${shellSingleQuote(gateState("Customer-observed handoff"))}`,
    "npm run admin:launch-readiness:export",
  ].join(" \\\n  ");

  return {
    title: "Launch-readiness export",
    summary:
      "Generate a sanitized review artifact from the current admin portal proof state before any future public self-serve launch slice.",
    exportPath,
    gates: [
      ...selfServeReadiness.gates,
      {
        label: "Export artifact",
        state: exportReady ? "ready" : "blocked",
        detail: exportReady
          ? "Protected Preview URL and Neon proof branch are available for a sanitized export."
          : "A non-local protected Preview URL and Neon proof branch are required before export.",
      },
    ],
    commands: [
      {
        label: "Write launch-readiness export",
        command: exportCommand,
        detail: exportReady
          ? "Writes a secret-scanned JSON artifact under ignored artifacts/."
          : "Missing runtime evidence: run against a protected Vercel Preview URL and hosted Neon branch before copying this command.",
        state: exportReady ? "ready" : "blocked",
      },
      {
        label: "Inspect launch-readiness export",
        command: [
          `OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH=${shellSingleQuote(exportPath)}`,
          "npm run admin:launch-readiness:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies the artifact keeps live-provider and public self-serve gates blocked.",
        state: exportReady ? "pending" : "blocked",
      },
    ],
    nonGoals: [
      "No browser approval buttons.",
      "No public owner self-signup.",
      "No invite delivery or notification sending.",
      "No phone/email provider activation.",
      "No billing, POS, access control, or member-ledger writes.",
    ],
  };
}

export function founderAdminLaunchPromotionGate({
  betaAccessRequestReport = emptyFounderAdminBetaAccessRequestReport,
  proofLedger,
  report,
}: {
  betaAccessRequestReport?: FounderAdminBetaAccessRequestReport;
  proofLedger?: FounderAdminProofStatusLedger;
  report: FounderAdminOwnerReadinessReport;
}): FounderAdminLaunchPromotionGate {
  const launchReadinessExport = founderAdminLaunchReadinessExport({
    betaAccessRequestReport,
    proofLedger,
    report,
  });
  const gateState = (label: string) =>
    launchReadinessExport.gates.find((gate) => gate.label === label)?.state ??
    "blocked";
  // The CLI consumes the export artifact itself, so only the UI projection needs this explicit artifact row.
  const requiredGateLabels = [
    "Protected Preview proof",
    "Operator fulfillment path",
    "Reset and rollback readiness",
    "Customer-observed handoff",
    "Export artifact",
  ];
  const requiredGatesReady = requiredGateLabels.every(
    (label) => gateState(label) === "ready",
  );
  const promotionPath = launchReadinessExport.exportPath.replace(
    /-launch-readiness\.json$/u,
    "-promotion-candidate.json",
  );
  const releaseNotePath = promotionPath.replace(
    /-promotion-candidate\.json$/u,
    "-promotion-release-note.md",
  );
  const bundlePath = launchReadinessExport.exportPath.replace(
    /-launch-readiness\.json$/u,
    "-launch-bundle.json",
  );
  const previewConfigured = Boolean(
    proofLedger &&
    !isMissingLedgerValue(proofLedger.previewUrl) &&
    !isLocalOrigin(proofLedger.previewUrl),
  );
  const branchConfigured = Boolean(
    proofLedger && !isMissingLedgerValue(proofLedger.branchName),
  );
  const previewCommandValue = previewConfigured
    ? (proofLedger?.previewUrl ?? "<protected-preview-url>")
    : "<protected-preview-url>";
  const branchCommandValue = branchConfigured
    ? (proofLedger?.branchName ?? "<neon-proof-branch>")
    : "<neon-proof-branch>";
  const promotionCommand = [
    `OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH=${shellSingleQuote(launchReadinessExport.exportPath)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH=${shellSingleQuote(promotionPath)}`,
    "npm run admin:launch-readiness:promote",
  ].join(" \\\n  ");
  const releaseNoteCommand = [
    `OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH=${shellSingleQuote(promotionPath)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_RELEASE_NOTE_PATH=${shellSingleQuote(releaseNotePath)}`,
    "npm run admin:launch-readiness:release-note",
  ].join(" \\\n  ");
  const bundleCommand = [
    `OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH=${shellSingleQuote(bundlePath)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH=${shellSingleQuote(launchReadinessExport.exportPath)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH=${shellSingleQuote(promotionPath)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_RELEASE_NOTE_PATH=${shellSingleQuote(releaseNotePath)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL=${shellSingleQuote(previewCommandValue)}`,
    `OUTPOST_NEON_BRANCH_NAME=${shellSingleQuote(branchCommandValue)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_PROOF=${shellSingleQuote(gateState("Protected Preview proof"))}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_FULFILLMENT=${shellSingleQuote(gateState("Operator fulfillment path"))}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK=${shellSingleQuote(gateState("Reset and rollback readiness"))}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF=${shellSingleQuote(gateState("Customer-observed handoff"))}`,
    "npm run admin:launch-readiness:bundle",
  ].join(" \\\n  ");
  const bundleInspectCommand = [
    `OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH=${shellSingleQuote(bundlePath)}`,
    "npm run admin:launch-readiness:bundle:inspect",
  ].join(" \\\n  ");

  return {
    title: "Launch promotion gate",
    summary:
      "Run after export inspection to produce a promotion-candidate summary. Passing this gate still does not enable public self-serve or live providers.",
    bundlePath,
    promotionPath,
    releaseNotePath,
    gates: [
      ...requiredGateLabels.map((label) => {
        const state = gateState(label);
        return {
          label,
          state,
          detail:
            state === "ready"
              ? `${label} is ready for promotion review.`
              : `${label} must be ready before a promotion candidate can be checked.`,
        };
      }),
      {
        label: "Live-provider and billing gates",
        state:
          gateState("Live-provider and billing gates") === "blocked"
            ? "ready"
            : "blocked",
        detail:
          "Promotion review requires live-provider, invite delivery, billing, POS, access control, and member-ledger gates to remain blocked.",
      },
      {
        label: "Public self-serve remains blocked",
        state:
          gateState("Public self-serve launch") === "blocked"
            ? "ready"
            : "blocked",
        detail:
          "Promotion review can be checked only while browser approval, public owner signup, and automatic onboarding remain blocked.",
      },
    ],
    commands: [
      {
        label: "Check launch promotion candidate",
        command: promotionCommand,
        detail: requiredGatesReady
          ? "Reads the export artifact, rechecks blocked gates, and writes a promotion-candidate summary under ignored artifacts/."
          : "Complete the protected Preview, fulfillment, rollback, customer handoff, and export artifact gates first.",
        state: requiredGatesReady ? "ready" : "blocked",
      },
      {
        label: "Write release-note artifact",
        command: releaseNoteCommand,
        detail: requiredGatesReady
          ? "Converts the checked promotion summary into attachable Markdown for PR or release review."
          : "Run this only after the promotion candidate has been checked.",
        state: requiredGatesReady ? "pending" : "blocked",
      },
      {
        label: "Write launch-readiness bundle",
        command: bundleCommand,
        detail: requiredGatesReady
          ? "Runs the full export, inspection, promotion, and release-note chain, then writes a manifest for review."
          : "Run this only after the protected Preview, fulfillment, rollback, and customer handoff gates are ready.",
        state: requiredGatesReady ? "pending" : "blocked",
      },
      {
        label: "Inspect launch-readiness bundle",
        command: bundleInspectCommand,
        detail: requiredGatesReady
          ? "Verifies the final bundle keeps public self-serve and live-provider gates blocked before PR or release review."
          : "Run this only after the launch-readiness bundle exists.",
        state: requiredGatesReady ? "pending" : "blocked",
      },
    ],
    nonGoals: [
      "No public launch approval.",
      "No browser mutation or approval button.",
      "No invite delivery or notification sending.",
      "No phone/email provider activation.",
      "No billing, POS, access control, or member-ledger writes.",
    ],
  };
}

export function founderAdminLaunchPackageReadiness(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminLaunchPackageReadiness {
  const previewConfigured = Boolean(
    proofLedger &&
    !isMissingLedgerValue(proofLedger.previewUrl) &&
    !isLocalOrigin(proofLedger.previewUrl),
  );
  const branchConfigured = Boolean(
    proofLedger && !isMissingLedgerValue(proofLedger.branchName),
  );
  const previewProofReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.hostedBetaWorkflow,
  );
  const adminProofReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.founderAdmin,
  );
  const customerHandoffReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.customerHandoff,
  );
  const liveProviderGateBlocked =
    proofLedger?.gates.some(
      (gate) =>
        gate.label === "Live-provider gates" && gate.state === "blocked",
    ) ?? false;
  const latestRecord = latestMatchingLaunchPackageRecord(
    proofLedger?.launchPackageRecords ?? [],
    proofLedger?.previewUrl,
    proofLedger?.branchName,
  );
  const publicSelfServeAnomaly = (proofLedger?.launchPackageRecords ?? []).some(
    (record) => record.public_self_serve_launch_allowed === true,
  );
  const launchPackageReady =
    Boolean(latestRecord) &&
    latestRecord?.customer_handoff_recorded === true &&
    latestRecord?.public_self_serve_launch_allowed === false;
  const prerequisiteReady =
    previewProofReady && adminProofReady && customerHandoffReady;
  const commandState: FounderAdminLaunchPackageReadinessState =
    launchPackageReady
      ? "ready"
      : prerequisiteReady && previewConfigured && branchConfigured
        ? "pending"
        : "blocked";

  return {
    title: "Launch package proof",
    summary: launchPackageReady
      ? `A reviewed package record exists for ${latestRecord?.gym_name ?? "this beta owner"} on the current Preview and Neon branch.`
      : prerequisiteReady
        ? "Hosted proof and customer-observed handoff are ready; run the terminal proof command to package and import the launch record."
        : "Launch package proof is blocked until protected Preview, admin portal, and customer-observed handoff proof are recorded.",
    latestRecord,
    gates: [
      {
        label: "Protected Preview proof",
        state: previewProofReady
          ? "ready"
          : previewConfigured
            ? "pending"
            : "blocked",
        detail: previewProofReady
          ? "A matching protected Preview proof run is recorded."
          : previewConfigured
            ? "Run the protected Preview verifier for this app origin."
            : "A non-local Vercel Preview URL is required.",
      },
      {
        label: "Admin portal proof",
        state: adminProofReady ? "ready" : proofLedger ? "pending" : "blocked",
        detail: adminProofReady
          ? "A matching admin portal proof run is recorded."
          : proofLedger
            ? "Run the hosted admin portal readiness verifier for this Preview."
            : "The hosted proof ledger is unavailable.",
      },
      {
        label: "Customer-observed handoff",
        state: customerHandoffReady
          ? "ready"
          : previewProofReady && adminProofReady
            ? "pending"
            : "blocked",
        detail: customerHandoffReady
          ? "A reviewed customer-observed handoff gate record exists for this Preview and branch."
          : previewProofReady && adminProofReady
            ? "Complete and import the real customer-observed handoff gate before package import."
            : "Customer-observed proof waits for hosted Preview and admin proof.",
      },
      {
        label: "Launch package record",
        state: launchPackageReady
          ? "ready"
          : prerequisiteReady
            ? "pending"
            : "blocked",
        detail: launchPackageReady
          ? `Package metadata was recorded at ${latestRecord?.recorded_at ?? "the hosted proof time"}.`
          : prerequisiteReady
            ? "Run the terminal proof command to generate artifacts, import metadata, and verify the row."
            : "The package record cannot be imported until prerequisite proof exists.",
      },
      {
        label: "Public self-serve remains blocked",
        state: publicSelfServeAnomaly ? "blocked" : "ready",
        detail: publicSelfServeAnomaly
          ? "A launch package record unexpectedly allowed public self-serve. Treat launch as blocked."
          : "Launch package proof does not approve public signup, browser approval, automatic onboarding, or invite delivery.",
      },
      {
        label: "Live-provider gates remain blocked",
        state: liveProviderGateBlocked ? "ready" : "blocked",
        detail:
          "Phone/email providers, notifications, billing, POS, access control, and member-ledger writes must remain disabled.",
      },
    ],
    command: {
      command: "npm run hosted:launch-package:record-proof",
      detail:
        commandState === "ready"
          ? "Rerun only when replacing the reviewed launch package artifacts for this Preview."
          : commandState === "pending"
            ? "Generates sanitized artifacts, imports the package record, and verifies it in hosted Neon."
            : "This command fails closed until the hosted proof and customer-observed handoff gates are ready.",
      label: "Verify and import launch package record",
      state: commandState,
    },
  };
}

export function founderAdminLaunchDecisionPacketReadiness(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminLaunchDecisionPacketReadiness {
  const previewConfigured = Boolean(
    proofLedger &&
    !isMissingLedgerValue(proofLedger.previewUrl) &&
    !isLocalOrigin(proofLedger.previewUrl),
  );
  const launchPackageReadiness =
    founderAdminLaunchPackageReadiness(proofLedger);
  const latestRecord = launchPackageReadiness.latestRecord;
  const publicSelfServeAnomaly = (proofLedger?.launchPackageRecords ?? []).some(
    (record) => record.public_self_serve_launch_allowed === true,
  );
  const liveProviderGateBlocked =
    proofLedger?.gates.some(
      (gate) =>
        gate.label === "Live-provider gates" && gate.state === "blocked",
    ) ?? false;
  const artifactSlug = slugifyLedgerValue(
    proofLedger?.branchName ?? "pending-branch",
  );
  const packetPath = `artifacts/admin-launch-readiness/${artifactSlug}-launch-decision-packet.json`;
  const bundlePath =
    latestRecord?.launch_bundle_path ??
    `artifacts/admin-launch-readiness/${artifactSlug}-launch-bundle.json`;
  const previewCommandValue = previewConfigured
    ? (proofLedger?.previewUrl ?? "<protected-preview-url>")
    : "<protected-preview-url>";
  const packetReady =
    Boolean(latestRecord) && !publicSelfServeAnomaly && liveProviderGateBlocked;
  const latestDecisionRecord = latestMatchingLaunchDecisionRecord(
    proofLedger?.launchDecisionRecords ?? [],
    proofLedger?.previewUrl,
    proofLedger?.branchName,
  );
  const packetState: FounderAdminLaunchDecisionPacketState = packetReady
    ? "ready"
    : launchPackageReadiness.command.state === "ready" ||
        launchPackageReadiness.command.state === "pending"
      ? "pending"
      : "blocked";
  const packetCommand = [
    `OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH=${shellSingleQuote(bundlePath)}`,
    `OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH=${shellSingleQuote(packetPath)}`,
    `OUTPOST_VERCEL_DEPLOYMENT_URL=${shellSingleQuote(previewCommandValue)}`,
    "npm run hosted:launch-decision:packet",
  ].join(" \\\n  ");
  const inspectCommand = [
    `OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH=${shellSingleQuote(packetPath)}`,
    "npm run admin:launch-decision:inspect",
  ].join(" \\\n  ");
  const recordCommand = [
    `OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH=${shellSingleQuote(packetPath)}`,
    "OUTPOST_ADMIN_LAUNCH_DECISION='reviewed_for_next_launch_slice'",
    "OUTPOST_ADMIN_LAUNCH_DECISION_REVIEWER='<reviewer-name>'",
    "OUTPOST_ADMIN_LAUNCH_DECISION_NOTE='<manual-review-note-without-secrets>'",
    "npm run admin:launch-decision:record",
  ].join(" \\\n  ");

  return {
    title: "Launch decision packet",
    summary: latestDecisionRecord
      ? `Manual review recorded as ${displayDecisionValue(latestDecisionRecord.decision)} by ${latestDecisionRecord.reviewer_label}. Public launch remains blocked.`
      : packetReady
        ? `A package record exists for ${latestRecord?.gym_name ?? "this beta owner"}; generate the manual-review packet before any separate launch-enabling slice.`
        : "The manual launch decision packet waits for launch package proof and blocked live-provider gates.",
    decisionRecords: proofLedger?.launchDecisionRecords ?? [],
    latestDecisionRecord,
    latestRecord,
    packetPath,
    gates: [
      {
        label: "Launch package record",
        state: latestRecord
          ? "ready"
          : launchPackageReadiness.command.state === "ready"
            ? "pending"
            : "blocked",
        detail: latestRecord
          ? `Package record ${latestRecord.id} is present for this Preview and Neon branch.`
          : "Import and verify a matching launch package record before preparing the decision packet.",
      },
      {
        label: "Launch bundle",
        state: latestRecord?.launch_bundle_sha256 ? "ready" : "blocked",
        detail: latestRecord?.launch_bundle_sha256
          ? `Bundle digest ${latestRecord.launch_bundle_sha256.slice(0, 12)} will be rechecked by the terminal command.`
          : "The hosted packet command needs a reviewed launch bundle path and digest.",
      },
      {
        label: "Manual review remains required",
        state: latestDecisionRecord
          ? "ready"
          : latestRecord
            ? "pending"
            : "blocked",
        detail: latestDecisionRecord
          ? `Decision record ${latestDecisionRecord.id} was recorded at ${latestDecisionRecord.recorded_at}.`
          : "The packet is evidence for human review only; record review from the terminal after inspection.",
      },
      {
        label: "Public self-serve remains blocked",
        state: publicSelfServeAnomaly ? "blocked" : "ready",
        detail: publicSelfServeAnomaly
          ? "A launch package record unexpectedly allowed public self-serve. Do not generate a decision packet."
          : "Public signup, browser approval, automatic onboarding, and invite delivery remain blocked.",
      },
      {
        label: "Live-provider gates remain blocked",
        state: liveProviderGateBlocked ? "ready" : "blocked",
        detail:
          "Phone/email providers, notifications, billing, POS, access control, and member-ledger writes remain disabled.",
      },
    ],
    commands: [
      {
        label: "Write launch decision packet",
        command: packetCommand,
        detail: packetReady
          ? "Re-inspects the bundle, checks the matching hosted package row, and writes a sanitized JSON packet under ignored artifacts/."
          : "Run only after launch package proof is ready for this protected Preview and Neon branch.",
        state: packetState,
      },
      {
        label: "Inspect launch decision packet",
        command: inspectCommand,
        detail:
          "Verifies the packet still requires human review and keeps public launch, providers, invites, billing, POS, and member-ledger writes blocked.",
        state: packetReady ? "pending" : packetState,
      },
    ],
    recordCommand: {
      label: "Record manual launch decision",
      command: recordCommand,
      detail: latestDecisionRecord
        ? "Manual review metadata is already recorded for this Preview and Neon branch. Rerun only for a new reviewed packet."
        : packetReady
          ? "Imports reviewer, decision, and packet digest metadata into hosted Neon without enabling launch."
          : "Run only after the decision packet is generated and inspected.",
      state: latestDecisionRecord
        ? "ready"
        : packetReady
          ? "pending"
          : "blocked",
    },
  };
}

export function founderAdminProofStatusLedger({
  appOrigin,
  betaAccessRequestFollowThroughOutcomeReport = emptyFounderAdminBetaAccessRequestFollowThroughOutcomeReport,
  betaProofRunSummaryRecordReport = emptyFounderAdminBetaProofRunSummaryRecordReport,
  betaAccessRequestTriageReceiptReport = emptyFounderAdminBetaAccessRequestTriageReceiptReport,
  branchName,
  customerHandoffGateReport = emptyFounderAdminCustomerHandoffGateReport,
  customerSessionRecordReport = emptyFounderAdminCustomerSessionRecordReport,
  handoffPacketRecordReport = emptyFounderAdminHandoffPacketRecordReport,
  hostedNeonConfigured,
  launchDecisionRecordReport = emptyFounderAdminLaunchDecisionRecordReport,
  launchPackageRecordReport = emptyFounderAdminLaunchPackageRecordReport,
  mode,
  operatorSelfServeRehearsalReport = emptyFounderAdminOperatorSelfServeRehearsalReport,
  proofRunReport = emptyFounderAdminProofRunReport,
  report,
}: {
  appOrigin?: string | null;
  betaAccessRequestFollowThroughOutcomeReport?: FounderAdminBetaAccessRequestFollowThroughOutcomeReport;
  betaProofRunSummaryRecordReport?: FounderAdminBetaProofRunSummaryRecordReport;
  betaAccessRequestTriageReceiptReport?: FounderAdminBetaAccessRequestTriageReceiptReport;
  branchName?: string | null;
  customerHandoffGateReport?: FounderAdminCustomerHandoffGateReport;
  customerSessionRecordReport?: FounderAdminCustomerSessionRecordReport;
  handoffPacketRecordReport?: FounderAdminHandoffPacketRecordReport;
  hostedNeonConfigured: boolean;
  launchDecisionRecordReport?: FounderAdminLaunchDecisionRecordReport;
  launchPackageRecordReport?: FounderAdminLaunchPackageRecordReport;
  mode: "hosted" | "local";
  operatorSelfServeRehearsalReport?: FounderAdminOperatorSelfServeRehearsalReport;
  proofRunReport?: FounderAdminProofRunReport;
  report: FounderAdminOwnerReadinessReport;
}): FounderAdminProofStatusLedger {
  const previewUrl = normalizeLedgerValue(appOrigin, "Preview URL missing");
  const proofBranchName = normalizeLedgerValue(
    branchName,
    "Neon branch missing",
  );
  const hostedSessionReady = mode === "hosted" && report.authorized;
  const previewConfigured = Boolean(appOrigin && !isLocalOrigin(appOrigin));
  const proofRuns = proofRunReport.authorized ? proofRunReport.rows : [];
  const betaAccessRequestTriageReceipts =
    betaAccessRequestTriageReceiptReport.authorized
      ? betaAccessRequestTriageReceiptReport.rows
      : [];
  const betaAccessRequestFollowThroughOutcomes =
    betaAccessRequestFollowThroughOutcomeReport.authorized
      ? betaAccessRequestFollowThroughOutcomeReport.rows
      : [];
  const betaProofRunSummaryRecords = betaProofRunSummaryRecordReport.authorized
    ? betaProofRunSummaryRecordReport.rows
    : [];
  const customerHandoffGateRecords = customerHandoffGateReport.authorized
    ? customerHandoffGateReport.rows
    : [];
  const customerSessionRecords = customerSessionRecordReport.authorized
    ? customerSessionRecordReport.rows
    : [];
  const handoffPacketRecords = handoffPacketRecordReport.authorized
    ? handoffPacketRecordReport.rows
    : [];
  const launchPackageRecords = launchPackageRecordReport.authorized
    ? launchPackageRecordReport.rows
    : [];
  const launchDecisionRecords = launchDecisionRecordReport.authorized
    ? launchDecisionRecordReport.rows
    : [];
  const operatorSelfServeRehearsalRecords =
    operatorSelfServeRehearsalReport.authorized
      ? operatorSelfServeRehearsalReport.rows
      : [];
  const latestFounderAdminProof = latestPassedProofRun(
    proofRuns,
    "hosted_founder_admin_readiness",
  );
  const latestPreviewProof = latestPassedProofRun(
    proofRuns,
    "vercel_preview_verify",
  );
  const matchingFounderAdminProof = latestMatchingPassedProofRun(
    proofRuns,
    "hosted_founder_admin_readiness",
    appOrigin,
  );
  const matchingPreviewProof = latestMatchingPassedProofRun(
    proofRuns,
    "vercel_preview_verify",
    appOrigin,
  );
  const matchingCustomerHandoffGate = latestMatchingCustomerHandoffGateRecord(
    customerHandoffGateRecords,
    appOrigin,
    branchName,
  );

  return {
    branchName: proofBranchName,
    betaAccessRequestFollowThroughOutcomes,
    betaProofRunSummaryRecords,
    betaAccessRequestTriageReceipts,
    customerHandoffGateRecords,
    customerSessionRecords,
    generatedAt: latestGeneratedAt(
      handoffPacketRecordReport.generated_at,
      customerSessionRecordReport.generated_at,
      betaAccessRequestTriageReceiptReport.generated_at,
      betaProofRunSummaryRecordReport.generated_at,
      operatorSelfServeRehearsalReport.generated_at,
      launchDecisionRecordReport.generated_at,
      launchPackageRecordReport.generated_at,
      customerHandoffGateReport.generated_at,
      proofRunReport.generated_at,
      report.generated_at,
    ),
    handoffPacketRecords,
    launchDecisionRecords,
    launchPackageRecords,
    operatorSelfServeRehearsalRecords,
    previewUrl,
    gates: [
      {
        label: FOUNDER_ADMIN_PROOF_GATE_LABELS.hostedBetaWorkflow,
        state: matchingPreviewProof
          ? "ready"
          : hostedNeonConfigured && previewConfigured
            ? "pending"
            : "blocked",
        detail: matchingPreviewProof
          ? `Last protected Preview proof passed at ${matchingPreviewProof.completed_at}.`
          : latestPreviewProof && previewConfigured
            ? `Last protected Preview proof was for ${latestPreviewProof.app_origin}; rerun against this Preview before marking it green.`
            : hostedNeonConfigured && previewConfigured
              ? "Command evidence is not stored in product state; rerun the protected Preview verifier before marking this gate green."
              : "Hosted Neon env and a protected Preview URL are required before this proof can run.",
      },
      {
        label: FOUNDER_ADMIN_PROOF_GATE_LABELS.founderAdmin,
        state: matchingFounderAdminProof
          ? "ready"
          : hostedSessionReady
            ? "pending"
            : "blocked",
        detail: matchingFounderAdminProof
          ? `Last admin portal proof passed at ${matchingFounderAdminProof.completed_at}.`
          : latestFounderAdminProof && previewConfigured
            ? `Last admin portal proof was for ${latestFounderAdminProof.app_origin}; rerun against this Preview before marking it green.`
            : hostedSessionReady
              ? "This session can read the sanitized admin portal readiness projection; rerun the hosted admin portal verifier to persist proof."
              : "Sign in with an active admin portal account on the hosted Preview.",
      },
      {
        label: "Preview deployment URL",
        state: matchingPreviewProof
          ? "ready"
          : previewConfigured
            ? "pending"
            : "blocked",
        detail: previewConfigured
          ? matchingPreviewProof
            ? `Verified Preview origin ${matchingPreviewProof.app_origin}.`
            : latestPreviewProof
              ? `Available origin differs from last verified proof ${latestPreviewProof.app_origin}.`
              : "Non-local origin is available; rerun the protected Preview verifier before marking deployment proof green."
          : "Set the public app origin to a Vercel Preview before hosted proof.",
      },
      {
        label: FOUNDER_ADMIN_PROOF_GATE_LABELS.customerHandoff,
        state: matchingCustomerHandoffGate
          ? "ready"
          : hostedNeonConfigured && previewConfigured
            ? "pending"
            : "blocked",
        detail: matchingCustomerHandoffGate
          ? `Customer-observed handoff proof was recorded for ${matchingCustomerHandoffGate.gym_name} at ${matchingCustomerHandoffGate.recorded_at}.`
          : hostedNeonConfigured && previewConfigured
            ? "Run the final handoff gate command, review the artifact, then import it into hosted Neon before marking this green."
            : "Hosted Neon env and a protected Preview URL are required before customer-observed proof can be recorded.",
      },
      {
        label: "Live-provider gates",
        state: "blocked",
        detail:
          "Phone/email providers, invite delivery, notifications, billing, POS, access control, and member-ledger writes remain off.",
      },
    ],
    proofCommands: [
      {
        label: "Full protected Preview proof",
        command: "npm run vercel:preview:verify",
        detail:
          "Runs hosted beta workflow, admin portal proof, route smoke, and no-live-provider checks.",
      },
      {
        label: "Admin portal proof only",
        command: "npm run hosted:admin-portal-readiness",
        detail:
          "Proves admin portal RPC access and owner/staff/anonymous denial against hosted Neon.",
      },

      {
        label: "Hosted beta request browser proof",
        command: "npm run hosted:beta-request-browser-proof",
        detail:
          "Submits one disposable owner beta request through the protected Preview browser form, verifies the hosted Neon row, writes evidence, and cleans up proof data.",
      },

      {
        label: "Hosted beta request chain proof",
        command: "npm run hosted:beta-request-chain-proof",
        detail:
          "Submits one disposable beta owner request, records triage and follow-through outcome, fulfills access, verifies admin ledgers, and cleans up proof rows.",
      },
      {
        label: "Write beta proof-run summary",
        command: "npm run hosted:beta-proof-run:summary",
        detail:
          "Combines browser request and request-chain evidence into one sanitized next-slice summary artifact.",
      },

      {
        label: "Inspect beta proof-run summary",
        command: "npm run hosted:beta-proof-run:summary:inspect",
        detail:
          "Verifies the combined proof summary keeps public self-serve and live-provider gates blocked.",
      },

      {
        label: "Import beta proof-run summary",
        command: "npm run hosted:beta-proof-run:record",
        detail:
          "Imports inspected browser plus request-chain proof digest metadata into hosted Neon for Admin portal visibility.",
      },
      {
        label: "Verify beta proof-run summary record",
        command: "npm run hosted:beta-proof-run:record-proof",
        detail:
          "Re-inspects, imports, and verifies the summary digest through the founder-admin Neon Data API RPC.",
      },

      {
        label: "Import customer session record",
        command: "npm run admin:customer-session:record-hosted",
        detail:
          "Imports inspected customer-observed session digest metadata into hosted Neon without enabling self-serve or providers.",
      },

      {
        label: "Verify customer session record",
        command: "npm run hosted:customer-session-record:proof",
        detail:
          "Re-inspects, imports, and verifies the customer session digest through the founder-admin Neon Data API RPC.",
      },

      {
        label: "Import customer handoff proof",
        command: "npm run beta:owner-handoff:record",
        detail:
          "Imports a validated customer-observed gate artifact into hosted Neon for admin portal visibility.",
      },
      {
        label: "Import launch package record",
        command: "npm run hosted:launch-package:record-proof",
        detail:
          "Verifies existing hosted proof, generates the launch bundle and owner message, imports metadata, and confirms the hosted Neon row.",
      },
      {
        label: "Write launch decision packet",
        command: "npm run hosted:launch-decision:packet",
        detail:
          "Re-inspects the launch bundle, verifies the matching hosted package record, and writes a manual-review packet without enabling launch.",
      },
      {
        label: "Record manual launch decision",
        command: "npm run admin:launch-decision:record",
        detail:
          "Imports the inspected packet digest and reviewer decision metadata without approving public self-serve or live providers.",
      },
      {
        label: "Write launch follow-through",
        command: "npm run admin:launch-decision:followthrough",
        detail:
          "Converts a reviewed launch decision record into a scoped next-slice artifact without enabling self-serve or live providers.",
      },
      {
        label: "Write self-serve rehearsal packet",
        command:
          "npm run admin:self-serve-rehearsal:packet",
        detail:
          "Creates a customer-safe operator-assisted rehearsal checklist from the reviewed follow-through artifact.",
      },
      {
        label: "Record self-serve rehearsal",
        command: "npm run admin:self-serve-rehearsal:record",
        detail:
          "Imports operator-observed rehearsal completion into hosted Neon without enabling public launch or live providers.",
      },
      {
        label: "Write beta request triage packet",
        command: "npm run admin:beta-request:triage-packet",
        detail:
          "Exports one hosted owner beta request for human review without approving, inviting, or provisioning access.",
      },
      {
        label: "Record beta request triage",
        command: "npm run admin:beta-request:triage-record",
        detail:
          "Imports reviewed request triage metadata without changing request status or enabling self-serve.",
      },
      {
        label: "Write beta request follow-through",
        command: "npm run admin:beta-request:followthrough",
        detail:
          "Writes terminal-only packet for reviewed triage before separate owner access fulfillment.",
      },
      {
        label: "Record beta request follow-through outcome",
        command: "npm run admin:beta-request:followthrough-record",
        detail:
          "Imports customer-safe operator outcome metadata without enabling public self-serve or live providers.",
      },
      {
        label: "Customer handoff completion",
        command: "npm run beta:owner-handoff:complete",
        detail:
          "Run only after a real external owner has observed the handoff gate.",
      },
      {
        label: "Customer handoff gate",
        command: "npm run beta:owner-handoff:gate",
        detail:
          "Validates packet plus customer-observed completion before any self-serve or live-provider work.",
      },
    ],
    proofRuns,
  };
}

export function founderAdminLaunchFollowThroughReadiness(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminLaunchFollowThroughReadiness {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const latestDecisionRecord = latestMatchingLaunchDecisionRecord(
    proofLedger?.launchDecisionRecords ?? [],
    previewUrl,
    branchName,
  );
  const reviewedDecision =
    latestDecisionRecord?.decision === "reviewed_for_next_launch_slice";
  const changesRequested =
    latestDecisionRecord?.decision === "changes_requested";
  const artifactPath = `artifacts/admin-launch-readiness/${slugifyLedgerValue(branchName)}-launch-followthrough.json`;
  const previewCommandValue = previewConfigured
    ? previewUrl
    : "<protected-preview-url>";
  const command = [
    `OUTPOST_ADMIN_LAUNCH_FOLLOWTHROUGH_PATH=${shellSingleQuote(artifactPath)}`,
    `OUTPOST_VERCEL_DEPLOYMENT_URL=${shellSingleQuote(previewCommandValue)}`,
    "npm run admin:launch-decision:followthrough",
  ].join(" \\\n  ");
  const commandState: FounderAdminLaunchFollowThroughState = reviewedDecision
    ? "ready"
    : latestDecisionRecord
      ? "blocked"
      : previewConfigured
        ? "pending"
        : "blocked";

  return {
    title: "Launch follow-through",
    summary: reviewedDecision
      ? `Reviewed decision ${latestDecisionRecord.id} can be converted into a scoped next-slice artifact.`
      : changesRequested
        ? "The latest launch decision requested changes; follow-through waits for a new reviewed packet."
        : latestDecisionRecord
          ? `The latest launch decision is ${displayDecisionValue(latestDecisionRecord.decision)}; follow-through stays blocked.`
          : "Follow-through waits for a reviewed launch decision record for this Preview and Neon branch.",
    artifactPath,
    latestDecisionRecord,
    gates: [
      {
        label: "Reviewed decision record",
        state: reviewedDecision
          ? "ready"
          : latestDecisionRecord
            ? "blocked"
            : previewConfigured
              ? "pending"
              : "blocked",
        detail: reviewedDecision
          ? `Reviewed next-slice decision recorded by ${latestDecisionRecord.reviewer_label} at ${latestDecisionRecord.recorded_at}.`
          : changesRequested
            ? "A reviewer requested changes; generate and record a new reviewed packet before follow-through."
            : latestDecisionRecord
              ? `Latest decision is ${displayDecisionValue(latestDecisionRecord.decision)}.`
              : "Record manual launch decision after packet review.",
      },
      {
        label: "Public self-serve remains blocked",
        state: latestDecisionRecord
          ? latestDecisionRecord.public_self_serve_launch_allowed
            ? "blocked"
            : "ready"
          : previewConfigured
            ? "pending"
            : "blocked",
        detail: latestDecisionRecord
          ? "Follow-through plans the next slice only; it does not enable signup, browser approval, or invite delivery."
          : "A reviewed launch decision record is required before this gate can be marked ready.",
      },
      {
        label: "Live-provider gates remain blocked",
        state: latestDecisionRecord
          ? latestDecisionRecord.launch_enablement_allowed
            ? "blocked"
            : "ready"
          : previewConfigured
            ? "pending"
            : "blocked",
        detail: latestDecisionRecord
          ? "Phone/email providers, notifications, billing, POS, access control, and member-ledger writes remain disabled."
          : "A reviewed launch decision record is required before this gate can be marked ready.",
      },
    ],
    command: {
      label: "Write launch follow-through",
      command,
      detail: reviewedDecision
        ? "Reads hosted decision evidence, rechecks blocked gates, and writes sanitized next-slice artifact."
        : "Run only after a reviewed launch decision record exists for this Preview and Neon branch.",
      state: commandState,
    },
  };
}

export function founderAdminOperatorSelfServeRehearsalReadiness(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminOperatorSelfServeRehearsalReadiness {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const followThrough = founderAdminLaunchFollowThroughReadiness(proofLedger);
  const followThroughReady = followThrough.command.state === "ready";
  const normalizedPreviewOrigin = normalizeOrigin(previewUrl);
  const records = (proofLedger?.operatorSelfServeRehearsalRecords ?? []).filter(
    (record) =>
      normalizeOrigin(record.app_origin) === normalizedPreviewOrigin &&
      record.neon_branch_name === branchName,
  );
  const latestRecord = records[0];
  const packetPath = `artifacts/admin-launch-readiness/${slugifyLedgerValue(branchName)}-operator-self-serve-rehearsal.json`;
  const previewCommandValue = previewConfigured
    ? previewUrl
    : "<protected-preview-url>";
  const packetCommand = [
    `OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_FOLLOWTHROUGH_PATH=${shellSingleQuote(followThrough.artifactPath)}`,
    `OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_PACKET_PATH=${shellSingleQuote(packetPath)}`,
    "npm run admin:self-serve-rehearsal:packet",
  ].join(" \\\n  ");
  const recordCommand = [
    `OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_PACKET_PATH=${shellSingleQuote(packetPath)}`,
    `OUTPOST_VERCEL_DEPLOYMENT_URL=${shellSingleQuote(previewCommandValue)}`,
    "OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_OPERATOR_LABEL='<operator-name>'",
    "OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_OWNER_LABEL='<owner-label>'",
    "OUTPOST_OPERATOR_SELF_SERVE_REHEARSAL_GYM_NAME='<gym-name>'",
    "npm run admin:self-serve-rehearsal:record",
  ].join(" \\\n  ");
  const packetState: FounderAdminOperatorSelfServeRehearsalState = latestRecord
    ? "ready"
    : followThroughReady
      ? "pending"
      : followThrough.command.state;
  const recordState: FounderAdminOperatorSelfServeRehearsalState = latestRecord
    ? "ready"
    : followThroughReady
      ? "pending"
      : "blocked";

  return {
    title: "Operator self-serve rehearsal",
    summary: latestRecord
      ? `Rehearsal recorded for ${latestRecord.gym_name} at ${latestRecord.recorded_at}.`
      : followThroughReady
        ? "Reviewed follow-through is ready; generate rehearsal packet and record operator-observed completion."
        : "Rehearsal waits for reviewed launch follow-through.",
    followThroughArtifactPath: followThrough.artifactPath,
    packetPath,
    records,
    latestRecord,
    gates: [
      {
        label: "Reviewed follow-through",
        state: followThroughReady ? "ready" : followThrough.command.state,
        detail: followThroughReady
          ? "Reviewed launch decision can be used to prepare the operator rehearsal packet."
          : "Prepare launch follow-through before rehearsing the operator-assisted self-serve path.",
      },
      {
        label: "Rehearsal packet",
        state: packetState,
        detail: latestRecord
          ? `Packet digest ${latestRecord.rehearsal_packet_sha256.slice(0, 12)} was recorded.`
          : followThroughReady
            ? "Generate the customer-safe packet from the follow-through artifact."
            : "Packet waits for reviewed follow-through.",
      },
      {
        label: "Completion ledger",
        state: recordState,
        detail: latestRecord
          ? `Hosted Neon completion row ${latestRecord.id} is available.`
          : followThroughReady
            ? "Record completion only after the operator observes the rehearsal using customer-safe labels."
            : "Completion cannot be recorded until packet generation is allowed.",
      },
      {
        label: "Public self-serve remains blocked",
        state: latestRecord
          ? latestRecord.public_self_serve_launch_allowed
            ? "blocked"
            : "ready"
          : followThroughReady
            ? "pending"
            : "blocked",
        detail: latestRecord
          ? "Completion record still blocks public signup, browser approval, and invite delivery."
          : "No public self-serve launch is approved by this rehearsal.",
      },
      {
        label: "Live-provider gates remain blocked",
        state: latestRecord
          ? latestRecord.launch_enablement_allowed
            ? "blocked"
            : "ready"
          : followThroughReady
            ? "pending"
            : "blocked",
        detail: latestRecord
          ? "Completion record still blocks phone/email providers, notifications, billing, POS, access control, and member-ledger writes."
          : "No live-provider or billing promotion is approved by this rehearsal.",
      },
    ],
    packetCommand: {
      label: "Write rehearsal packet",
      command: packetCommand,
      detail: followThroughReady
        ? "Creates ignored JSON packet with operator checklist from reviewed follow-through."
        : "Run only after launch follow-through is ready.",
      state: packetState,
    },
    recordCommand: {
      label: "Record rehearsal completion",
      command: recordCommand,
      detail: latestRecord
        ? "Completion already recorded for this Preview and Neon branch."
        : followThroughReady
          ? "Imports operator-observed completion metadata into hosted Neon."
          : "Run only after packet generation and operator-observed rehearsal.",
      state: recordState,
    },
  };
}

export function founderAdminNextSaasPreflights(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminNextSaasPreflights {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const hostedContextReady = Boolean(
    proofLedger &&
    branchConfigured &&
    !isMissingLedgerValue(proofLedger.previewUrl) &&
    !isLocalOrigin(proofLedger.previewUrl),
  );
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const sourcePath = `artifacts/admin-launch-readiness/${branchSlug}-source-import-preflight.json`;
  const emailPath = `artifacts/admin-launch-readiness/${branchSlug}-email-channel-preflight.json`;
  const sourceFactsPath = `artifacts/admin-launch-readiness/${branchSlug}-source-facts-packet.json`;
  const emailSamplePath = `artifacts/admin-launch-readiness/${branchSlug}-email-sample-packet.json`;
  const sourceWorkflowPath = `artifacts/admin-launch-readiness/${branchSlug}-source-workflow-rehearsal.json`;
  const emailTriagePath = `artifacts/admin-launch-readiness/${branchSlug}-email-triage-rehearsal.json`;
  const sourceApplyPath = `artifacts/admin-launch-readiness/${branchSlug}-source-apply-rehearsal.json`;
  const emailTaskPath = `artifacts/admin-launch-readiness/${branchSlug}-email-task-rehearsal.json`;
  const sourceApplyCompletionPath = `artifacts/admin-launch-readiness/${branchSlug}-source-apply-completion.json`;
  const emailTaskCompletionPath = `artifacts/admin-launch-readiness/${branchSlug}-email-task-completion.json`;
  const launchEvidenceBundlePath = `artifacts/admin-launch-readiness/${branchSlug}-launch-evidence-bundle.json`;
  const handoffSchedulingPacketPath = `artifacts/admin-launch-readiness/${branchSlug}-handoff-scheduling-packet.json`;
  const customerSessionRecordPath = `artifacts/admin-launch-readiness/${branchSlug}-customer-observed-session-record.json`;
  const sourceState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const emailState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const sourceCommand = [
    `OUTPOST_ADMIN_SOURCE_IMPORT_PREFLIGHT_PATH=${shellSingleQuote(sourcePath)}`,
    "OUTPOST_ADMIN_SOURCE_IMPORT_GYM_NAME='<gym-name>'",
    "OUTPOST_ADMIN_SOURCE_IMPORT_OWNER_EMAIL='<owner-email>'",
    "OUTPOST_ADMIN_SOURCE_IMPORT_WEBSITE_URL='<https-gym-website>'",
    "OUTPOST_ADMIN_SOURCE_IMPORT_GOOGLE_PROFILE_URL='<https-google-profile-optional>'",
    "npm run admin:source-import:preflight",
  ].join(" \\\n  ");
  const emailCommand = [
    `OUTPOST_ADMIN_EMAIL_CHANNEL_PREFLIGHT_PATH=${shellSingleQuote(emailPath)}`,
    "OUTPOST_ADMIN_EMAIL_CHANNEL_GYM_NAME='<gym-name>'",
    "OUTPOST_ADMIN_EMAIL_CHANNEL_OWNER_EMAIL='<owner-email>'",
    "OUTPOST_ADMIN_EMAIL_CHANNEL_MAILBOX_LABEL='<mailbox-label>'",
    "OUTPOST_ADMIN_EMAIL_CHANNEL_FORWARDING_PLAN='<manual-forwarding-review>'",
    "npm run admin:email-channel:preflight",
  ].join(" \\\n  ");

  return {
    sourceImport: {
      artifactPath: sourcePath,
      commands: [
        {
          command: sourceCommand,
          detail: hostedContextReady
            ? "Writes a customer-safe source-readiness artifact without scraping or importing."
            : "Needs hosted Preview context before preparing source import preflight.",
          label: "Prepare source import preflight",
          state: sourceState,
        },
        {
          command: [
            `OUTPOST_ADMIN_SOURCE_IMPORT_PREFLIGHT_PATH=${shellSingleQuote(sourcePath)}`,
            "npm run admin:source-import:inspect",
          ].join(" \\\n  "),
          detail:
            "Verifies the artifact keeps scraping, Google import, task generation, providers, and billing blocked.",
          label: "Inspect source import preflight",
          state: sourceState,
        },
        {
          command: [
            `OUTPOST_ADMIN_SOURCE_IMPORT_PREFLIGHT_PATH=${shellSingleQuote(sourcePath)}`,
            `OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH=${shellSingleQuote(sourceFactsPath)}`,
            "OUTPOST_ADMIN_SOURCE_FACTS_LABEL='<reviewed-source-label>'",
            "OUTPOST_ADMIN_SOURCE_FACTS_JSON='<reviewed-facts-json-array>'",
            "npm run admin:source-facts:packet",
          ].join(" \\\n  "),
          detail:
            "Writes reviewed pasted facts into an artifact shaped for existing manual source review.",
          label: "Prepare source facts packet",
          state: sourceState,
        },
        {
          command: [
            `OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH=${shellSingleQuote(sourceFactsPath)}`,
            "npm run admin:source-facts:inspect",
          ].join(" \\\n  "),
          detail:
            "Verifies pasted source facts still require manual intake and answer review.",
          label: "Inspect source facts packet",
          state: sourceState,
        },
        {
          command: [
            `OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH=${shellSingleQuote(sourceFactsPath)}`,
            `OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH=${shellSingleQuote(sourceWorkflowPath)}`,
            "OUTPOST_ADMIN_SOURCE_WORKFLOW_LOCATION_LABEL='<location-label>'",
            "OUTPOST_ADMIN_SOURCE_WORKFLOW_OWNER_REVIEWER='<owner-reviewer-label>'",
            "npm run admin:source-workflow:rehearsal",
          ].join(" \\\n  "),
          detail:
            "Prepares operator steps for applying reviewed facts through existing manual source owner review paths.",
          label: "Prepare source workflow rehearsal",
          state: sourceState,
        },
        {
          command: [
            `OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH=${shellSingleQuote(sourceWorkflowPath)}`,
            "npm run admin:source-workflow:inspect",
          ].join(" \\\n  "),
          detail:
            "Verifies rehearsal keeps imports, automatic approval, task generation, email, notifications, providers blocked.",
          label: "Inspect source workflow rehearsal",
          state: sourceState,
        },
        {
          command: [
            `OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH=${shellSingleQuote(sourceWorkflowPath)}`,
            `OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH=${shellSingleQuote(sourceApplyPath)}`,
            "OUTPOST_ADMIN_SOURCE_APPLY_OWNER_WORKSPACE_URL='<protected-preview-owner-url>'",
            "OUTPOST_ADMIN_SOURCE_APPLY_OPERATOR_LABEL='<operator-label>'",
            "npm run admin:source-apply:rehearsal",
          ].join(" \\\n  "),
          detail:
            "Prepares browser/manual source apply steps for the existing owner workspace.",
          label: "Prepare source apply rehearsal",
          state: sourceState,
        },
        {
          command: [
            `OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH=${shellSingleQuote(sourceApplyPath)}`,
            "npm run admin:source-apply:inspect",
          ].join(" \\\n  "),
          detail:
            "Verifies source apply rehearsal keeps automatic import, approval, task generation, email, notifications, providers blocked.",
          label: "Inspect source apply rehearsal",
          state: sourceState,
        },
        {
          command: [
            `OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH=${shellSingleQuote(sourceApplyPath)}`,
            `OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH=${shellSingleQuote(sourceApplyCompletionPath)}`,
            "OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_OPERATOR='<operator-label>'",
            "OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_OWNER_WORKSPACE_OBSERVED='yes'",
            "OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_MANUAL_SOURCE_SAVED='yes'",
            "OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_ANSWER_REVIEW_STAGED='yes'",
            "OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_AUTOMATIC_APPROVAL_NOT_OBSERVED='yes'",
            "OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_LIVE_PROVIDER_COPY_BLOCKED='yes'",
            "npm run admin:source-apply:record",
          ].join(" \\\n  "),
          detail:
            "Records operator-observed source completion evidence after the manual owner workspace pass.",
          label: "Record observed source completion",
          state: sourceState,
        },
        {
          command: [
            `OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH=${shellSingleQuote(sourceApplyCompletionPath)}`,
            "npm run admin:source-apply:record-inspect",
          ].join(" \\\n  "),
          detail:
            "Verifies observed source completion keeps source automation, approval, task generation, email, notifications, providers blocked.",
          label: "Inspect observed source completion",
          state: sourceState,
        },
      ],
      gates: [
        {
          detail:
            "Website and Google Profile URLs are collected as candidate sources only.",
          label: "Candidate source URLs",
          state: sourceState,
        },
        {
          detail:
            "No website scraping, Google API import, or automatic fact creation is enabled.",
          label: "Import runtime",
          state: "blocked",
        },
        {
          detail:
            "Imported facts still require future owner review before answer approval.",
          label: "Owner approval",
          state: "blocked",
        },
        {
          detail:
            "Reviewed facts are packetized only; they do not write source rows until existing owner/manual intake is used.",
          label: "Runtime writes",
          state: "blocked",
        },
        {
          detail:
            "Workflow rehearsal gives operator steps only; existing manual intake remains the only allowed write path.",
          label: "Operator rehearsal",
          state: "blocked",
        },
        {
          detail:
            "Apply rehearsal is browser/manual proof only; it does not import sources, approve answers, or generate tasks.",
          label: "Source apply rehearsal",
          state: "blocked",
        },
        {
          detail:
            "Observed source completion is evidence-only; it does not claim public self-serve, source automation, or customer handoff readiness.",
          label: "Observed source completion",
          state: "blocked",
        },
      ],
      summary:
        "Prepare website/Google source import requirements without performing live import.",
      title: "Source import preflight",
    },
    emailChannel: {
      artifactPath: emailPath,
      commands: [
        {
          command: emailCommand,
          detail: hostedContextReady
            ? "Writes a customer-safe email-channel readiness artifact using labels only, no credentials."
            : "Needs hosted Preview context before preparing email channel preflight.",
          label: "Prepare email channel preflight",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_EMAIL_CHANNEL_PREFLIGHT_PATH=${shellSingleQuote(emailPath)}`,
            "npm run admin:email-channel:inspect",
          ].join(" \\\n  "),
          detail:
            "Verifies Gmail, Resend, SMTP, inbound email, outbound delivery, and notifications remain blocked.",
          label: "Inspect email channel preflight",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_EMAIL_CHANNEL_PREFLIGHT_PATH=${shellSingleQuote(emailPath)}`,
            `OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH=${shellSingleQuote(emailSamplePath)}`,
            "OUTPOST_ADMIN_EMAIL_SAMPLE_SUBJECT='<sample-subject>'",
            "OUTPOST_ADMIN_EMAIL_SAMPLE_SENDER_LABEL='<sender-label>'",
            "OUTPOST_ADMIN_EMAIL_SAMPLE_BODY='<sample-body>'",
            "OUTPOST_ADMIN_EMAIL_SAMPLE_INTENT='<suggested-intent>'",
            "OUTPOST_ADMIN_EMAIL_SAMPLE_NEXT_STEP='<suggested-next-step>'",
            "npm run admin:email-sample:packet",
          ].join(" \\\n  "),
          detail:
            "Writes one pasted email sample into an artifact for future manual triage design.",
          label: "Prepare email sample packet",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH=${shellSingleQuote(emailSamplePath)}`,
            "npm run admin:email-sample:inspect",
          ].join(" \\\n  "),
          detail:
            "Verifies the email sample does not create tasks, connect inboxes, send replies, or notify anyone.",
          label: "Inspect email sample packet",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH=${shellSingleQuote(emailSamplePath)}`,
            `OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH=${shellSingleQuote(emailTriagePath)}`,
            "OUTPOST_ADMIN_EMAIL_TRIAGE_CATEGORY='<manual-triage-category>'",
            "OUTPOST_ADMIN_EMAIL_TRIAGE_OWNER_REVIEW_LABEL='<owner-review-label>'",
            "OUTPOST_ADMIN_EMAIL_TRIAGE_STAFF_TASK_DRAFT='<staff-task-draft>'",
            "npm run admin:email-triage:rehearsal",
          ].join(" \\\n  "),
          detail:
            "Prepares a read-only triage rehearsal from one pasted email sample.",
          label: "Prepare email triage rehearsal",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH=${shellSingleQuote(emailTriagePath)}`,
            "npm run admin:email-triage:inspect",
          ].join(" \\\n  "),
          detail:
            "Verifies triage rehearsal keeps inboxes, outbound delivery, notifications, task creation blocked.",
          label: "Inspect email triage rehearsal",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH=${shellSingleQuote(emailTriagePath)}`,
            `OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH=${shellSingleQuote(emailTaskPath)}`,
            "OUTPOST_ADMIN_EMAIL_TASK_STAFF_WORKSPACE_URL='<protected-preview-staff-url>'",
            "OUTPOST_ADMIN_EMAIL_TASK_OPERATOR_LABEL='<operator-label>'",
            "npm run admin:email-task:rehearsal",
          ].join(" \\\n  "),
          detail:
            "Prepares browser/manual task-entry steps from the read-only email triage rehearsal.",
          label: "Prepare email task rehearsal",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH=${shellSingleQuote(emailTaskPath)}`,
            "npm run admin:email-task:inspect",
          ].join(" \\\n  "),
          detail:
            "Verifies email task rehearsal keeps inboxes, outbound delivery, notifications, automatic task creation, providers blocked.",
          label: "Inspect email task rehearsal",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH=${shellSingleQuote(emailTaskPath)}`,
            `OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH=${shellSingleQuote(emailTaskCompletionPath)}`,
            "OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_OPERATOR='<operator-label>'",
            "OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_OWNER_REVIEW_OBSERVED='yes'",
            "OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_MANUAL_TASK_DECISION_OBSERVED='yes'",
            "OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_EMAIL_INGRESS_NOT_OBSERVED='yes'",
            "OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_OUTBOUND_DELIVERY_NOT_OBSERVED='yes'",
            "OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_NOTIFICATION_NOT_OBSERVED='yes'",
            "OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_LIVE_PROVIDER_COPY_BLOCKED='yes'",
            "npm run admin:email-task:record",
          ].join(" \\\n  "),
          detail:
            "Records operator-observed email task completion evidence after owner review and any manual task decision.",
          label: "Record observed email task completion",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH=${shellSingleQuote(emailTaskCompletionPath)}`,
            "npm run admin:email-task:record-inspect",
          ].join(" \\\n  "),
          detail:
            "Verifies observed email task completion keeps inboxes, outbound delivery, notifications, automatic task creation, providers blocked.",
          label: "Inspect observed email task completion",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH=${shellSingleQuote(sourceApplyCompletionPath)}`,
            `OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH=${shellSingleQuote(emailTaskCompletionPath)}`,
            `OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH=${shellSingleQuote(launchEvidenceBundlePath)}`,
            "npm run admin:launch-evidence:bundle",
          ].join(" \\\n  "),
          detail:
            "Bundles source and email completion evidence into one pre-self-serve go/no-go artifact.",
          label: "Prepare launch evidence bundle",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH=${shellSingleQuote(launchEvidenceBundlePath)}`,
            "npm run admin:launch-evidence:inspect",
          ].join(" \\\n  "),
          detail:
            "Verifies bundled evidence and keeps customer-observed handoff, public self-serve, providers, and billing gates blocked.",
          label: "Inspect launch evidence bundle",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH=${shellSingleQuote(launchEvidenceBundlePath)}`,
            `OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH=${shellSingleQuote(handoffSchedulingPacketPath)}`,
            "OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR='<operator-label>'",
            "OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW='<support-window>'",
            "OUTPOST_ADMIN_HANDOFF_SCHEDULING_OWNER_LABEL='<owner-label>'",
            "npm run admin:handoff-scheduling:packet",
          ].join(" \\\n "),
          detail:
            "Prepares a customer-safe agenda and support checklist for scheduling the observed owner session.",
          label: "Prepare handoff scheduling packet",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH=${shellSingleQuote(handoffSchedulingPacketPath)}`,
            "npm run admin:handoff-scheduling:inspect",
          ].join(" \\\n "),
          detail:
            "Verifies scheduling packet keeps customer-observed completion, invite delivery, providers, and billing gates blocked.",
          label: "Inspect handoff scheduling packet",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH=${shellSingleQuote(handoffSchedulingPacketPath)}`,
            `OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH=${shellSingleQuote(customerSessionRecordPath)}`,
            "OUTPOST_ADMIN_CUSTOMER_SESSION_OPERATOR='<operator-label>'",
            "OUTPOST_ADMIN_CUSTOMER_SESSION_WINDOW='<observed-owner-session-window>'",
            "OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_PRESENT='yes'",
            "OUTPOST_ADMIN_CUSTOMER_SESSION_PREVIEW_OBSERVED='yes'",
            "OUTPOST_ADMIN_CUSTOMER_SESSION_OWNER_WORKSPACE_OBSERVED='yes'",
            "OUTPOST_ADMIN_CUSTOMER_SESSION_STAFF_HANDOFF_OBSERVED='yes'",
            "OUTPOST_ADMIN_CUSTOMER_SESSION_RESET_ROLLBACK_REVIEWED='yes'",
            "OUTPOST_ADMIN_CUSTOMER_SESSION_UNEXPECTED_DATA_NOT_OBSERVED='yes'",
            "OUTPOST_ADMIN_CUSTOMER_SESSION_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED='yes'",
            "OUTPOST_ADMIN_CUSTOMER_SESSION_INVITE_DELIVERY_NOT_OBSERVED='yes'",
            "OUTPOST_ADMIN_CUSTOMER_SESSION_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED='yes'",
            "npm run admin:customer-session:record",
          ].join(" \\\n "),
          detail:
            "Records a real owner-observed protected Preview session from the scheduling packet; still blocks self-serve, invites, providers, billing, POS, and member writes.",
          label: "Record customer-observed session",
          state: emailState,
        },
        {
          command: [
            `OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH=${shellSingleQuote(customerSessionRecordPath)}`,
            "npm run admin:customer-session:inspect",
          ].join(" \\\n "),
          detail:
            "Verifies customer-observed proof remains chained to scheduling evidence and keeps productization gates blocked.",
          label: "Inspect customer-observed session",
          state: emailState,
        },
      ],
      gates: [
        {
          detail:
            "Mailbox is represented by a label only; no addresses, tokens, or credentials are stored.",
          label: "Mailbox label",
          state: emailState,
        },
        {
          detail:
            "Gmail, Resend, SMTP, provider webhooks, and inbound email are not connected.",
          label: "Email ingress",
          state: "blocked",
        },
        {
          detail:
            "Replies, notifications, and delivery remain manual until explicitly productized.",
          label: "Outbound delivery",
          state: "blocked",
        },
        {
          detail:
            "Pasted email samples are packetized only; they do not create staff tasks or send messages.",
          label: "Task creation",
          state: "blocked",
        },
        {
          detail:
            "Email triage rehearsal is classification guidance only; live ingress and outbound delivery remain disabled.",
          label: "Triage rehearsal",
          state: "blocked",
        },
        {
          detail:
            "Email task rehearsal is manual task-entry guidance only; inboxes, replies, notifications, and automatic tasks stay blocked.",
          label: "Email task rehearsal",
          state: "blocked",
        },
        {
          detail:
            "Observed email task completion is evidence-only; it does not claim inbox connection, outbound delivery, notifications, or customer handoff readiness.",
          label: "Observed email task completion",
          state: "blocked",
        },
        {
          detail:
            "Launch evidence bundle is pre-self-serve go/no-go evidence only; customer-observed handoff and live-provider gates stay blocked.",
          label: "Launch evidence bundle",
          state: "blocked",
        },
        {
          detail:
            "Handoff scheduling packet prepares the observed-session agenda only; it does not invite, notify, or mark customer completion.",
          label: "Handoff scheduling packet",
          state: "blocked",
        },
        {
          detail:
            "Customer-observed session record can prove an owner watched the protected Preview, but it does not open public self-serve, invite delivery, providers, billing, POS, or member-ledger writes.",
          label: "Customer-observed session record",
          state: "blocked",
        },
      ],
      summary:
        "Prepare email-triage requirements without connecting inboxes or sending mail.",
      title: "Email channel preflight",
    },
  };
}

export function founderAdminDemoOnboardingRunway(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminDemoOnboardingRunway {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const customerSessionRecordPath =
    "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json";
  const runwayPath = `artifacts/admin-launch-readiness/${branchSlug}-demo-onboarding-runway.json`;
  const hasHostedCustomerSessionRecord =
    (proofLedger?.customerSessionRecords.length ?? 0) > 0;
  const hostedProofState: FounderAdminChannelPreflightState =
    hasHostedCustomerSessionRecord ? "ready" : "pending";
  const rehearsalState: FounderAdminChannelPreflightState =
    hasHostedCustomerSessionRecord ? "pending" : "blocked";

  return {
    artifactPath: runwayPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH=${shellSingleQuote(customerSessionRecordPath)}`,
          `OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH=${shellSingleQuote(runwayPath)}`,
          "npm run admin:demo-onboarding-runway",
        ].join(" \\\n  "),
        detail:
          "Writes a customer-safe next-two-slice artifact from the observed customer session record.",
        label: "Prepare demo/onboarding runway",
        state: hostedProofState,
      },
      {
        command: [
          `OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH=${shellSingleQuote(runwayPath)}`,
          "npm run admin:demo-onboarding-runway:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies the runway keeps self-serve, invites, providers, notifications, billing, POS, and member-ledger writes blocked.",
        label: "Inspect demo/onboarding runway",
        state: hostedProofState,
      },
    ],
    gates: [
      {
        detail: hasHostedCustomerSessionRecord
          ? "Hosted Neon contains a customer-session digest visible to founder-admin users."
          : "Import the customer-session artifact digest into hosted Neon before demo readiness is durable.",
        label: "Hosted customer-session digest",
        state: hostedProofState,
      },
      {
        detail:
          "Operator-led demo may use protected Preview evidence only; public owner self-signup remains blocked.",
        label: "Public self-serve launch",
        state: "blocked",
      },
      {
        detail:
          "No invite delivery, Gmail, Resend, SMTP, phone/email providers, webhooks, or notifications are enabled.",
        label: "Live provider activation",
        state: "blocked",
      },
      {
        detail:
          "No billing, POS, access control, or member-ledger writes are in scope.",
        label: "Billing/POS/member writes",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
        detail:
          "Import the customer-observed session digest into hosted Neon and prove founder-admin RPC visibility.",
        id: "hosted_customer_session_proof",
        state: hostedProofState,
        title: "Hosted customer-session proof",
      },
      {
        command: "npm run beta:owner-handoff:inspect",
        detail:
          "Use the customer-safe handoff checklist to rehearse the next gym owner onboarding path on protected Preview.",
        id: "operator_demo_onboarding_rehearsal",
        state: rehearsalState,
        title: "Operator-led demo onboarding rehearsal",
      },
    ],
    summary: hasHostedCustomerSessionRecord
      ? "Customer-observed session digest is durable. Next: rehearse operator-led gym demo/onboarding from the customer-safe checklist."
      : "Next: import customer-session proof into hosted Neon, then rehearse operator-led demo/onboarding. Public self-serve remains blocked.",
    title: "Demo/onboarding runway",
  };
}

export function founderAdminDemoOnboardingCompletion(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminDemoOnboardingCompletion {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const runwayPath = `artifacts/admin-launch-readiness/${branchSlug}-demo-onboarding-runway.json`;
  const completionPath = `artifacts/admin-launch-readiness/${branchSlug}-demo-onboarding-completion.json`;
  const hasHostedCustomerSessionRecord =
    (proofLedger?.customerSessionRecords.length ?? 0) > 0;
  const commandState: FounderAdminChannelPreflightState =
    hasHostedCustomerSessionRecord ? "pending" : "blocked";

  return {
    artifactPath: completionPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH=${shellSingleQuote(
            runwayPath,
          )}`,
          `OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH=${shellSingleQuote(
            completionPath,
          )}`,
          "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_OPERATOR='<operator name>'",
          "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PREVIEW_REVIEWED='yes'",
          "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_OWNER_WORKSPACE_REVIEWED='yes'",
          "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_STAFF_HANDOFF_REVIEWED='yes'",
          "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_RESET_ROLLBACK_REVIEWED='yes'",
          "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_HOSTED_PROOF_REVIEWED='yes'",
          "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_NO_UNEXPECTED_DATA='yes'",
          "OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_NO_LIVE_PROVIDER_CLAIMS='yes'",
          "npm run admin:demo-onboarding:record",
        ].join(" \\\n  "),
        detail:
          "Records operator-observed demo/onboarding completion from the runway artifact.",
        label: "Record demo/onboarding completion",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH=${shellSingleQuote(
            completionPath,
          )}`,
          "npm run admin:demo-onboarding:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies parent SHA, required observations, and blocked self-serve/live-provider gates.",
        label: "Inspect demo/onboarding completion",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hasHostedCustomerSessionRecord
          ? "Hosted customer-session digest exists; completion can be recorded after operator-observed rehearsal."
          : "Run hosted customer-session proof before recording demo/onboarding completion.",
        label: "Hosted customer-session proof",
        state: hasHostedCustomerSessionRecord ? "pending" : "blocked",
      },
      {
        detail:
          "Completion is operator evidence only; customer-observed owner completion still needs the real gym owner present.",
        label: "Customer-observed owner gate",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve signup and invite delivery stay disabled until after the real owner gate is green.",
        label: "Public signup and invites",
        state: "blocked",
      },
      {
        detail:
          "No phone/email provider activation, notifications, billing, POS, access-control, or member-ledger writes are allowed.",
        label: "Live/provider and revenue gates",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command: "npm run beta:owner-handoff:message",
        detail:
          "Schedule the real owner-observed gym demo and record completion only after the owner sees the protected Preview, workspace, staff path, reset/rollback checklist, and blocked live-provider claims.",
        id: "customer_observed_gym_demo_gate",
        state: "pending",
        title: "Customer-observed gym demo gate",
      },
      {
        command:
          "npm run admin:beta-request:triage-packet && npm run admin:beta-request:followthrough",
        detail:
          "Prepare repeatable operator-assisted owner intake for the next gym without public self-serve, invite delivery, providers, billing, POS, or member-ledger writes.",
        id: "limited_operator_assisted_beta_onboarding",
        state: "blocked",
        title: "Limited operator-assisted beta onboarding",
      },
    ],
    summary: hasHostedCustomerSessionRecord
      ? "Record operator demo/onboarding completion, then move to real customer-observed owner gate."
      : "Completion remains blocked until hosted customer-session proof is imported and visible.",
    title: "Demo/onboarding completion proof",
  };
}

export function founderAdminCustomerDemoGatePacket(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminCustomerDemoGatePacket {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const completionPath = `artifacts/admin-launch-readiness/${branchSlug}-demo-onboarding-completion.json`;
  const packetPath = `artifacts/admin-launch-readiness/${branchSlug}-customer-demo-gate-packet.json`;
  const hasHostedCustomerSessionRecord =
    (proofLedger?.customerSessionRecords.length ?? 0) > 0;
  const commandState: FounderAdminChannelPreflightState =
    hasHostedCustomerSessionRecord ? "pending" : "blocked";

  return {
    artifactPath: packetPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_DEMO_ONBOARDING_COMPLETION_PATH=${shellSingleQuote(
            completionPath,
          )}`,
          `OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH=${shellSingleQuote(
            packetPath,
          )}`,
          "OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_OPERATOR='<operator name>'",
          "OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_WINDOW='<scheduled owner session>'",
          "npm run admin:customer-demo-gate:packet",
        ].join(" \\\n  "),
        detail:
          "Prepares the real owner-observed demo gate agenda without recording customer completion.",
        label: "Prepare customer demo gate packet",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH=${shellSingleQuote(
            packetPath,
          )}`,
          "npm run admin:customer-demo-gate:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies packet agenda, parent SHA, required confirmations, and blocked launch/provider gates.",
        label: "Inspect customer demo gate packet",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Packet only schedules/checklists the real owner gate; it does not record completion.",
        label: "Customer completion claim",
        state: "blocked",
      },
      {
        detail:
          "The real owner must be present before customer-observed completion can be recorded.",
        label: "Owner present",
        state: "pending",
      },
      {
        detail:
          "Public self-serve signup and invite delivery remain disabled.",
        label: "Public signup and invites",
        state: "blocked",
      },
      {
        detail:
          "No live providers, notifications, billing, POS, access-control, or member-ledger writes are allowed.",
        label: "Live/provider and revenue gates",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "npm run admin:limited-beta-onboarding:packet && npm run admin:limited-beta-onboarding:inspect",
        detail:
          "Prepare repeatable operator-assisted beta onboarding from customer demo gate packet before using request triage/follow-through for the next gym.",
        id: "limited_operator_assisted_beta_onboarding",
        state: "pending",
        title: "Limited operator-assisted beta onboarding",
      },
      {
        command:
          "npm run admin:public-self-serve:preflight && npm run admin:public-self-serve:inspect",
        detail:
          "Only prepare public self-serve after the real customer gate and limited operator-assisted onboarding evidence are green.",
        id: "public_self_serve_preflight",
        state: "blocked",
        title: "Public self-serve preflight",
      },
    ],
    summary:
      "Prepare the real owner-observed demo gate agenda while keeping customer completion and self-serve launch blocked.",
    title: "Customer demo gate packet",
  };
}

export function founderAdminLimitedBetaOnboardingPacket(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminLimitedBetaOnboardingPacket {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const customerDemoGatePath = `artifacts/admin-launch-readiness/${branchSlug}-customer-demo-gate-packet.json`;
  const packetPath = `artifacts/admin-launch-readiness/${branchSlug}-limited-beta-onboarding-packet.json`;
  const hasHostedCustomerSessionRecord =
    (proofLedger?.customerSessionRecords.length ?? 0) > 0;
  const commandState: FounderAdminChannelPreflightState =
    hasHostedCustomerSessionRecord ? "pending" : "blocked";

  return {
    artifactPath: packetPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_CUSTOMER_DEMO_GATE_PACKET_PATH=${shellSingleQuote(
            customerDemoGatePath,
          )}`,
          `OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH=${shellSingleQuote(
            packetPath,
          )}`,
          "OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_OPERATOR='<operator name>'",
          "OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_CANDIDATE_GYM='<next approved gym label>'",
          "npm run admin:limited-beta-onboarding:packet",
        ].join(" \\\n "),
        detail:
          "Prepares customer-safe operator checklist for the next approved beta gym.",
        label: "Prepare limited beta onboarding packet",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH=${shellSingleQuote(
            packetPath,
          )}`,
          "npm run admin:limited-beta-onboarding:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies operator-managed access, request triage, follow-through, and blocked launch/provider gates.",
        label: "Inspect limited beta onboarding packet",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hasHostedCustomerSessionRecord
          ? "Customer demo gate packet can feed the next operator-assisted beta onboarding checklist."
          : "Customer demo gate packet waits hosted customer-session proof before onboarding packet can be trusted.",
        label: "Customer demo gate evidence",
        state: commandState,
      },
      {
        detail:
          "Owner access stays CLI/operator-managed; no public signup approval or browser approval buttons.",
        label: "Owner access mode",
        state: "blocked",
      },
      {
        detail:
          "No invite delivery, notifications, phone/email providers, Gmail, Resend, SMTP, or provider webhooks.",
        label: "Invite/provider runtime",
        state: "blocked",
      },
      {
        detail:
          "No billing, POS, access-control, or member-ledger writes are allowed.",
        label: "Revenue/member writes",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "npm run admin:beta-request:triage-packet && npm run admin:beta-request:followthrough",
        detail:
          "Use reviewed beta request triage and follow-through for one approved gym without browser approval or invite delivery.",
        id: "approved_gym_request_followthrough",
        state: "pending",
        title: "Approved gym request follow-through",
      },
      {
        command:
          "npm run admin:public-self-serve:preflight && npm run admin:public-self-serve:inspect",
        detail:
          "Prepare launch prerequisites only after limited operator-assisted onboarding evidence is available.",
        id: "public_self_serve_preflight",
        state: "blocked",
        title: "Public self-serve preflight",
      },
    ],
    summary:
      "Prepare the next gym's operator-assisted beta onboarding path while public self-serve and live providers remain blocked.",
    title: "Limited beta onboarding packet",
  };
}

export function founderAdminPublicSelfServePreflight(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminPublicSelfServePreflight {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const limitedBetaPath = `artifacts/admin-launch-readiness/${branchSlug}-limited-beta-onboarding-packet.json`;
  const preflightPath = `artifacts/admin-launch-readiness/${branchSlug}-public-self-serve-preflight.json`;
  const commandState: FounderAdminChannelPreflightState = "blocked";

  return {
    artifactPath: preflightPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_LIMITED_BETA_ONBOARDING_PACKET_PATH=${shellSingleQuote(
            limitedBetaPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          "npm run admin:public-self-serve:preflight",
        ].join(" \\\n "),
        detail:
          "Writes public self-serve preflight only from limited beta onboarding evidence; launch remains blocked.",
        label: "Prepare public self-serve preflight",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          "npm run admin:public-self-serve:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies public signup, invite delivery, browser approval, provider activation, billing, POS, and member writes stay blocked.",
        label: "Inspect public self-serve preflight",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Limited operator-assisted onboarding evidence must exist before this preflight becomes actionable.",
        label: "Limited onboarding evidence",
        state: "blocked",
      },
      {
        detail:
          "Public owner signup, browser approval buttons, invite delivery, and Auth admin product APIs stay disabled.",
        label: "Public signup path",
        state: "blocked",
      },
      {
        detail:
          "Source automation, automatic answer approval, automatic task generation, email ingress, outbound email, and notifications stay disabled.",
        label: "Automation/provider path",
        state: "blocked",
      },
      {
        detail:
          "Billing, POS, access control, and member-ledger writes require separate later launch gates.",
        label: "Revenue/member writes",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "npm run admin:approved-gym-followthrough:packet && npm run admin:approved-gym-followthrough:inspect",
        detail:
          "Chain reviewed public preflight to a ready owner beta request follow-through packet for one approved non-House-of-Fitness gym.",
        id: "approved_gym_request_followthrough",
        state: "blocked",
        title: "Approved gym request follow-through",
      },
      {
        command:
          "npm run admin:public-request-intake:dry-run && npm run admin:public-request-intake:inspect",
        detail:
          "Dry-run public request intake as request-only and review-only before any invite delivery or owner provisioning work.",
        id: "public_request_intake_dry_run",
        state: "blocked",
        title: "Public request intake dry-run",
      },
    ],
    summary:
      "List public self-serve prerequisites without approving signup, invites, providers, billing, POS, or member-ledger writes.",
    title: "Public self-serve preflight",
  };
}

export function founderAdminApprovedGymFollowthroughPacket(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminApprovedGymFollowthroughPacket {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const preflightPath = `artifacts/admin-launch-readiness/${branchSlug}-public-self-serve-preflight.json`;
  const followthroughPath = `artifacts/admin-launch-readiness/${branchSlug}-owner-beta-request-followthrough.json`;
  const packetPath = `artifacts/admin-launch-readiness/${branchSlug}-approved-gym-followthrough-packet.json`;
  const commandState: FounderAdminChannelPreflightState = "blocked";

  return {
    artifactPath: packetPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_SELF_SERVE_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          `OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH=${shellSingleQuote(
            followthroughPath,
          )}`,
          `OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH=${shellSingleQuote(
            packetPath,
          )}`,
          "OUTPOST_ADMIN_APPROVED_GYM_LABEL='<approved non-House-of-Fitness gym>'",
          "npm run admin:approved-gym-followthrough:packet",
        ].join(" \\\n  "),
        detail:
          "Chains public preflight and reviewed request follow-through for one approved non-House-of-Fitness gym.",
        label: "Prepare approved gym follow-through packet",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH=${shellSingleQuote(
            packetPath,
          )}`,
          "npm run admin:approved-gym-followthrough:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies operator-managed owner access, request review, blocked invites, providers, billing, POS, and member writes.",
        label: "Inspect approved gym follow-through packet",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires an existing ready owner beta request follow-through packet; this panel does not query or mutate hosted Neon.",
        label: "Reviewed request evidence",
        state: "blocked",
      },
      {
        detail:
          "The approved gym must be explicitly non-House-of-Fitness before next-customer readiness is claimed.",
        label: "Non-House-of-Fitness scope",
        state: "blocked",
      },
      {
        detail:
          "Owner access remains fulfilled by operator CLI commands; no browser approval or automatic grants.",
        label: "Owner access mode",
        state: "blocked",
      },
      {
        detail:
          "No invite delivery, notifications, provider activation, billing, POS, access control, or member-ledger writes.",
        label: "Live/provider and revenue gates",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "npm run admin:public-request-intake:dry-run && npm run admin:public-request-intake:inspect",
        detail:
          "Dry-run public intake as request-only/review-only, without automatic approval or provisioning.",
        id: "public_request_intake_dry_run",
        state: "blocked",
        title: "Public request intake dry-run",
      },
      {
        command:
          "npm run admin:invite-delivery:preflight && npm run admin:invite-delivery:inspect",
        detail:
          "Design invite delivery as a separate preflight after intake proof, before any sending.",
        id: "invite_delivery_preflight",
        state: "blocked",
        title: "Invite delivery preflight",
      },
    ],
    summary:
      "Package one approved non-House-of-Fitness gym request follow-through while owner access stays operator-managed.",
    title: "Approved gym request follow-through",
  };
}

export function founderAdminPublicRequestIntakeDryRun(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminPublicRequestIntakeDryRun {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const followthroughPacketPath = `artifacts/admin-launch-readiness/${branchSlug}-approved-gym-followthrough-packet.json`;
  const dryRunPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-intake-dry-run.json`;
  const commandState: FounderAdminChannelPreflightState = "blocked";

  return {
    artifactPath: dryRunPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_APPROVED_GYM_FOLLOWTHROUGH_PACKET_PATH=${shellSingleQuote(
            followthroughPacketPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH=${shellSingleQuote(
            dryRunPath,
          )}`,
          "OUTPOST_ADMIN_PUBLIC_REQUEST_DRY_RUN_GYM='<requesting gym label>'",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_DRY_RUN_OWNER_EMAIL='<owner email label>'",
          "npm run admin:public-request-intake:dry-run",
        ].join(" \\\n  "),
        detail:
          "Writes a customer-safe request-only/review-only intake dry-run artifact without creating access.",
        label: "Prepare public request intake dry-run",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH=${shellSingleQuote(
            dryRunPath,
          )}`,
          "npm run admin:public-request-intake:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies automatic approval, owner provisioning, invite delivery, providers, and revenue writes stay blocked.",
        label: "Inspect public request intake dry-run",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Dry-run captures request shape only; public request persistence is still blocked.",
        label: "Public request persistence",
        state: "blocked",
      },
      {
        detail:
          "No automatic approval, owner provisioning, owner grant, or Auth admin product API.",
        label: "Approval/provisioning",
        state: "blocked",
      },
      {
        detail:
          "No browser approval buttons, invite delivery, email sending, notifications, or provider activation.",
        label: "Invite/provider path",
        state: "blocked",
      },
      {
        detail: "No billing, POS, access control, or member-ledger writes.",
        label: "Revenue/member writes",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "Not implemented: keep invitation delivery blocked until public request intake dry-run is green.",
        detail:
          "Prepare reviewed invite metadata without sending email or notifications.",
        id: "invite_delivery_preflight",
        state: "blocked",
        title: "Invite delivery preflight",
      },
      {
        command:
          "Not implemented: keep Auth admin provisioning blocked until invite delivery preflight is green.",
        detail:
          "Dry-run owner provisioning separately before any product API can create accounts.",
        id: "auth_admin_provisioning_dry_run",
        state: "blocked",
        title: "Auth admin provisioning dry-run",
      },
    ],
    summary:
      "Dry-run public request intake as request-only and review-only while launch, provisioning, invites, and providers stay blocked.",
    title: "Public request intake dry-run",
  };
}

export function founderAdminInviteDeliveryPreflight(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminInviteDeliveryPreflight {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const intakePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-intake-dry-run.json`;
  const invitePath = `artifacts/admin-launch-readiness/${branchSlug}-invite-delivery-preflight.json`;
  const commandState: FounderAdminChannelPreflightState = "blocked";

  return {
    artifactPath: invitePath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_DRY_RUN_PATH=${shellSingleQuote(
            intakePath,
          )}`,
          `OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH=${shellSingleQuote(
            invitePath,
          )}`,
          "OUTPOST_ADMIN_INVITE_PREFLIGHT_SUBJECT='<reviewed invite subject>'",
          "OUTPOST_ADMIN_INVITE_PREFLIGHT_AUDIENCE='<reviewed owner email>'",
          "npm run admin:invite-delivery:preflight",
        ].join(" \\\n  "),
        detail:
          "Writes reviewed invite metadata without sending email, notifications, or provider traffic.",
        label: "Prepare invite delivery preflight",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH=${shellSingleQuote(
            invitePath,
          )}`,
          "npm run admin:invite-delivery:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies browser sends, invite delivery, notifications, providers, Auth admin product API, and member writes stay blocked.",
        label: "Inspect invite delivery preflight",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "No browser send button, email send, or notification send.",
        label: "No-send invite",
        state: "blocked",
      },
      {
        detail:
          "No Gmail, Resend, SMTP, provider webhooks, or provider activation.",
        label: "Provider path",
        state: "blocked",
      },
      {
        detail:
          "No owner provisioning, automatic owner grant, or Auth admin product API.",
        label: "Provisioning path",
        state: "blocked",
      },
      {
        detail: "No billing, POS, access control, or member-ledger writes.",
        label: "Revenue/member writes",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "npm run admin:auth-admin:dry-run && npm run admin:auth-admin:inspect",
        detail:
          "Dry-run owner account provisioning without product Auth admin APIs or user creation.",
        id: "auth_admin_provisioning_dry_run",
        state: "blocked",
        title: "Auth admin provisioning dry-run",
      },
      {
        command:
          "Not implemented: keep owner access fulfillment evidence operator-managed until Auth admin dry-run is green.",
        detail:
          "Link invite review to operator-created access without adding browser provisioning.",
        id: "owner_access_fulfillment_evidence",
        state: "blocked",
        title: "Owner access fulfillment evidence",
      },
    ],
    summary:
      "Prepare invite delivery as reviewed metadata only while all sends, providers, provisioning, and member writes stay blocked.",
    title: "Invite delivery preflight",
  };
}

export function founderAdminAuthAdminProvisioningDryRun(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminAuthAdminProvisioningDryRun {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const invitePath = `artifacts/admin-launch-readiness/${branchSlug}-invite-delivery-preflight.json`;
  const authDryRunPath = `artifacts/admin-launch-readiness/${branchSlug}-auth-admin-provisioning-dry-run.json`;
  const commandState: FounderAdminChannelPreflightState = "blocked";

  return {
    artifactPath: authDryRunPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_INVITE_DELIVERY_PREFLIGHT_PATH=${shellSingleQuote(
            invitePath,
          )}`,
          `OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH=${shellSingleQuote(
            authDryRunPath,
          )}`,
          "OUTPOST_ADMIN_AUTH_ADMIN_DRY_RUN_OWNER_EMAIL='<reviewed owner email>'",
          "npm run admin:auth-admin:dry-run",
        ].join(" \\\n  "),
        detail:
          "Writes an operator-reviewed provisioning shape without creating a Neon Auth user from product code.",
        label: "Prepare Auth admin provisioning dry-run",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH=${shellSingleQuote(
            authDryRunPath,
          )}`,
          "npm run admin:auth-admin:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies product Auth admin APIs, automatic grants, invite sends, providers, and member writes stay blocked.",
        label: "Inspect Auth admin provisioning dry-run",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "No product Auth admin API and no browser provisioning button.",
        label: "Product provisioning",
        state: "blocked",
      },
      {
        detail:
          "No Auth user is created by this artifact and no owner grant is automatic.",
        label: "Account/grant write",
        state: "blocked",
      },
      {
        detail: "No invite delivery, notification sending, or provider activation.",
        label: "Invite/provider path",
        state: "blocked",
      },
      {
        detail: "No billing, POS, access control, or member-ledger writes.",
        label: "Revenue/member writes",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "Not implemented: link invite review to operator-created owner access evidence without product Auth admin APIs.",
        detail:
          "Prove the reviewed invite and operator-created access can be reconciled before productizing fulfillment.",
        id: "approved_gym_request_followthrough",
        state: "blocked",
        title: "Owner access fulfillment evidence",
      },
      {
        command:
          "Not implemented: design no-send staff invite preflight after owner access fulfillment evidence is green.",
        detail:
          "Keep staff invites, email delivery, and notifications blocked until owner access handoff is proven.",
        id: "staff_invite_no_send_preflight",
        state: "blocked",
        title: "Staff invite no-send preflight",
      },
    ],
    summary:
      "Dry-run owner account provisioning as operator-review-only while product Auth admin APIs and writes stay blocked.",
    title: "Auth admin provisioning dry-run",
  };
}

export function founderAdminOwnerAccessFulfillmentEvidence(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminOwnerAccessFulfillmentEvidence {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const authDryRunPath = `artifacts/admin-launch-readiness/${branchSlug}-auth-admin-provisioning-dry-run.json`;
  const ownerAccessPath = `artifacts/admin-launch-readiness/${branchSlug}-owner-access-fulfillment-evidence.json`;
  const commandState: FounderAdminChannelPreflightState = "blocked";

  return {
    artifactPath: ownerAccessPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_AUTH_ADMIN_PROVISIONING_DRY_RUN_PATH=${shellSingleQuote(
            authDryRunPath,
          )}`,
          `OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH=${shellSingleQuote(
            ownerAccessPath,
          )}`,
          "OUTPOST_ADMIN_OWNER_ACCESS_EMAIL='<reviewed owner email>'",
          "OUTPOST_ADMIN_OWNER_ACCESS_METHOD='operator-runbook-reviewed-neon-auth-and-owner-grant'",
          "npm run admin:owner-access:fulfillment",
        ].join(" \\\n  "),
        detail:
          "Writes operator-managed owner access evidence without product Auth admin APIs, browser approval, or automatic grants.",
        label: "Prepare owner access fulfillment evidence",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH=${shellSingleQuote(
            ownerAccessPath,
          )}`,
          "npm run admin:owner-access:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies owner access remains operator-managed and product Auth admin APIs, automatic grants, sends, providers, member writes stay blocked.",
        label: "Inspect owner access fulfillment evidence",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "No product Auth admin API, browser approval button, or product-created owner access.",
        label: "Product provisioning",
        state: "blocked",
      },
      {
        detail:
          "Operator evidence only; customer-visible completion proof remains separate.",
        label: "Operator evidence",
        state: "blocked",
      },
      {
        detail: "No invite delivery, notification sending, or provider activation.",
        label: "Invite/provider path",
        state: "blocked",
      },
      {
        detail: "No billing, POS, access control, or member-ledger writes.",
        label: "Revenue/member writes",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "npm run admin:staff-invite:no-send && npm run admin:staff-invite:inspect",
        detail:
          "Prepare reviewed staff invite metadata while all send and provider paths remain blocked.",
        id: "staff_invite_no_send_preflight",
        state: "blocked",
        title: "Staff invite no-send preflight",
      },
      {
        command:
          "Not implemented: record customer-visible owner access completion after protected Preview sign-in proof.",
        detail:
          "Do not mark owner handoff complete until a real owner or operator-observed browser pass proves access.",
        id: "owner_access_completion_proof",
        state: "blocked",
        title: "Owner access completion proof",
      },
    ],
    summary:
      "Link reviewed owner invite/Auth dry-run metadata to operator-managed owner access evidence while product provisioning stays blocked.",
    title: "Owner access fulfillment evidence",
  };
}

export function founderAdminStaffInviteNoSendPreflight(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminStaffInviteNoSendPreflight {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const ownerAccessPath = `artifacts/admin-launch-readiness/${branchSlug}-owner-access-fulfillment-evidence.json`;
  const staffInvitePath = `artifacts/admin-launch-readiness/${branchSlug}-staff-invite-no-send-preflight.json`;
  const commandState: FounderAdminChannelPreflightState = "blocked";

  return {
    artifactPath: staffInvitePath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH=${shellSingleQuote(
            ownerAccessPath,
          )}`,
          `OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH=${shellSingleQuote(
            staffInvitePath,
          )}`,
          "OUTPOST_ADMIN_STAFF_INVITE_AUDIENCE='<reviewed staff email>'",
          "OUTPOST_ADMIN_STAFF_INVITE_ROLE='staff'",
          "OUTPOST_ADMIN_STAFF_INVITE_LOCATION_LABEL='<reviewed location>'",
          "npm run admin:staff-invite:no-send",
        ].join(" \\\n  "),
        detail:
          "Writes reviewed staff invite metadata without sending email, notifications, or provider traffic.",
        label: "Prepare staff invite no-send preflight",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH=${shellSingleQuote(
            staffInvitePath,
          )}`,
          "npm run admin:staff-invite:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies staff invite sends, notifications, providers, Auth admin product APIs, automatic staff grants, member writes stay blocked.",
        label: "Inspect staff invite no-send preflight",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "No staff invite send button, email send, magic link, or notification send.",
        label: "No-send staff invite",
        state: "blocked",
      },
      {
        detail:
          "No Gmail, Resend, SMTP, provider webhooks, or provider activation.",
        label: "Provider path",
        state: "blocked",
      },
      {
        detail:
          "No product Auth admin API, staff Auth user creation, or automatic staff grant.",
        label: "Provisioning path",
        state: "blocked",
      },
      {
        detail: "No billing, POS, access control, or member-ledger writes.",
        label: "Revenue/member writes",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "Not implemented: record customer-visible owner access completion after protected Preview sign-in proof.",
        detail:
          "Convert operator evidence into customer-safe completion only after real browser proof.",
        id: "owner_access_completion_proof",
        state: "blocked",
        title: "Owner access completion proof",
      },
      {
        command:
          "Not implemented: staff roster claim handoff evidence without invite delivery.",
        detail:
          "Prove staff can claim from operator-managed roster before enabling invite delivery.",
        id: "staff_roster_claim_handoff_evidence",
        state: "blocked",
        title: "Staff roster claim handoff evidence",
      },
    ],
    summary:
      "Prepare reviewed staff invite metadata only while staff invite delivery, notifications, providers, provisioning, member writes stay blocked.",
    title: "Staff invite no-send preflight",
  };
}

export const founderAdminStaffAccessPreflight =
  founderAdminStaffInviteNoSendPreflight;

export function founderAdminOwnerAccessCompletionProof(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminOwnerAccessCompletionProof {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured ? slugifyLedgerValue(branchName) : "neon-branch-missing";
  const previewUrl =
    proofLedger && !isMissingLedgerValue(proofLedger.previewUrl)
      ? proofLedger.previewUrl
      : "<protected-preview-url>";
  const ownerAccessPath = `artifacts/admin-launch-readiness/${branchSlug}-owner-access-fulfillment-evidence.json`;
  const completionPath = `artifacts/admin-launch-readiness/${branchSlug}-owner-access-completion-proof.json`;
  const commandState: FounderAdminChannelPreflightState = "blocked";
  return {
    artifactPath: completionPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_OWNER_ACCESS_FULFILLMENT_PATH=${shellSingleQuote(ownerAccessPath)}`,
          `OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH=${shellSingleQuote(completionPath)}`,
          `OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PREVIEW_URL=${shellSingleQuote(previewUrl)}`,
          "OUTPOST_ADMIN_OWNER_ACCESS_PREVIEW_SIGN_IN_OBSERVED=yes",
          "OUTPOST_ADMIN_OWNER_ACCESS_WORKSPACE_OBSERVED=yes",
          "OUTPOST_ADMIN_OWNER_ACCESS_HANDOFF_PACKET_REVIEWED=yes",
          "OUTPOST_ADMIN_OWNER_ACCESS_RESET_ROLLBACK_REVIEWED=yes",
          "OUTPOST_ADMIN_OWNER_ACCESS_UNEXPECTED_DATA_NOT_OBSERVED=yes",
          "OUTPOST_ADMIN_OWNER_ACCESS_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED=yes",
          "npm run admin:owner-access:completion-proof",
        ].join(" \\\n  "),
        detail:
          "Records protected Preview owner sign-in and workspace evidence while customer-observed completion stays blocked.",
        label: "Record owner access completion proof",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH=${shellSingleQuote(completionPath)}`,
          "npm run admin:owner-access:completion-proof:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies owner access completion proof is browser-backed and still blocks customer completion, sends, providers, and member writes.",
        label: "Inspect owner access completion proof",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Owner access proof may be recorded only from protected Preview/browser evidence.",
        label: "Owner proof",
        state: "blocked",
      },
      {
        detail:
          "Customer-observed completion is still separate and cannot be implied by this artifact.",
        label: "Customer completion",
        state: "blocked",
      },
      {
        detail:
          "No browser approval button, product Auth admin API, or automatic owner grant.",
        label: "Provisioning path",
        state: "blocked",
      },
      {
        detail:
          "No invite delivery, notifications, providers, billing, POS, or member writes.",
        label: "Live/revenue path",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "npm run admin:staff-roster:handoff-evidence && npm run admin:staff-roster:handoff-evidence:inspect",
        detail:
          "Record staff roster claim handoff proof without activating invite delivery.",
        id: "staff_roster_claim_handoff_evidence",
        state: "blocked",
        title: "Staff roster claim handoff evidence",
      },
      {
        command:
          "npm run admin:operator-onboarding:rehearsal && npm run admin:operator-onboarding:rehearsal:inspect",
        detail:
          "Reconcile owner and staff evidence into an internal onboarding rehearsal.",
        id: "operator_assisted_onboarding_rehearsal",
        state: "blocked",
        title: "Operator-assisted onboarding rehearsal",
      },
    ],
    summary:
      "Records protected Preview owner access completion proof while customer-observed completion and live-provider gates remain blocked.",
    title: "Owner access completion proof",
  };
}

export function founderAdminStaffRosterHandoffEvidence(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminStaffRosterHandoffEvidence {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured ? slugifyLedgerValue(branchName) : "neon-branch-missing";
  const staffPreflightPath = `artifacts/admin-launch-readiness/${branchSlug}-staff-invite-no-send-preflight.json`;
  const ownerCompletionPath = `artifacts/admin-launch-readiness/${branchSlug}-owner-access-completion-proof.json`;
  const staffHandoffPath = `artifacts/admin-launch-readiness/${branchSlug}-staff-roster-handoff-evidence.json`;
  const commandState: FounderAdminChannelPreflightState = "blocked";
  return {
    artifactPath: staffHandoffPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_STAFF_INVITE_NO_SEND_PREFLIGHT_PATH=${shellSingleQuote(staffPreflightPath)}`,
          `OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH=${shellSingleQuote(ownerCompletionPath)}`,
          `OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH=${shellSingleQuote(staffHandoffPath)}`,
          "OUTPOST_ADMIN_STAFF_ROSTER_CLAIM_PATH_OBSERVED=yes",
          "OUTPOST_ADMIN_STAFF_ROSTER_WORKBOARD_OBSERVED=yes",
          "OUTPOST_ADMIN_STAFF_ROSTER_OWNER_MANAGED_REVIEWED=yes",
          "OUTPOST_ADMIN_STAFF_ROSTER_INVITE_DELIVERY_NOT_OBSERVED=yes",
          "OUTPOST_ADMIN_STAFF_ROSTER_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED=yes",
          "npm run admin:staff-roster:handoff-evidence",
        ].join(" \\\n  "),
        detail:
          "Records staff roster claim handoff proof while delivery and provider paths remain blocked.",
        label: "Record staff roster handoff evidence",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH=${shellSingleQuote(staffHandoffPath)}`,
          "npm run admin:staff-roster:handoff-evidence:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies staff handoff proof chains to no-send preflight and owner completion proof.",
        label: "Inspect staff roster handoff evidence",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Staff claim proof is operator-reviewed roster access, not message delivery.",
        label: "Staff handoff",
        state: "blocked",
      },
      {
        detail:
          "No staff message send, notification, Gmail, Resend, SMTP, or provider webhook.",
        label: "No-send path",
        state: "blocked",
      },
      {
        detail:
          "No product Auth admin API, product-created staff Auth user, or automatic staff grant.",
        label: "Provisioning path",
        state: "blocked",
      },
      {
        detail: "No billing, POS, access control, or member-ledger writes.",
        label: "Revenue/member writes",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "npm run admin:operator-onboarding:rehearsal && npm run admin:operator-onboarding:rehearsal:inspect",
        detail:
          "Reconcile owner and staff handoff into an internal operator rehearsal.",
        id: "operator_assisted_onboarding_rehearsal",
        state: "blocked",
        title: "Operator-assisted onboarding rehearsal",
      },
      {
        command:
          "npm run admin:handoff-proof:bundle && npm run admin:handoff-proof:bundle:inspect",
        detail:
          "Bundle the proof chain so the next internal browser test is replayable.",
        id: "handoff_proof_bundle",
        state: "blocked",
        title: "Replayable handoff proof bundle",
      },
    ],
    summary:
      "Records staff roster claim handoff evidence without activating staff delivery, providers, product Auth admin APIs, or member writes.",
    title: "Staff roster claim handoff evidence",
  };
}

export function founderAdminOperatorOnboardingRehearsal(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminOperatorOnboardingRehearsal {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured ? slugifyLedgerValue(branchName) : "neon-branch-missing";
  const ownerCompletionPath = `artifacts/admin-launch-readiness/${branchSlug}-owner-access-completion-proof.json`;
  const staffHandoffPath = `artifacts/admin-launch-readiness/${branchSlug}-staff-roster-handoff-evidence.json`;
  const rehearsalPath = `artifacts/admin-launch-readiness/${branchSlug}-operator-onboarding-rehearsal.json`;
  const commandState: FounderAdminChannelPreflightState = "blocked";
  return {
    artifactPath: rehearsalPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_OWNER_ACCESS_COMPLETION_PROOF_PATH=${shellSingleQuote(ownerCompletionPath)}`,
          `OUTPOST_ADMIN_STAFF_ROSTER_HANDOFF_EVIDENCE_PATH=${shellSingleQuote(staffHandoffPath)}`,
          `OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH=${shellSingleQuote(rehearsalPath)}`,
          "OUTPOST_ADMIN_OPERATOR_ONBOARDING_OWNER_WORKSPACE_REHEARSED=yes",
          "OUTPOST_ADMIN_OPERATOR_ONBOARDING_STAFF_WORKBOARD_REHEARSED=yes",
          "OUTPOST_ADMIN_OPERATOR_ONBOARDING_MANUAL_SOURCE_FLOW_REHEARSED=yes",
          "OUTPOST_ADMIN_OPERATOR_ONBOARDING_RESET_ROLLBACK_REHEARSED=yes",
          "OUTPOST_ADMIN_OPERATOR_ONBOARDING_SUPPORT_PACKET_REHEARSED=yes",
          "OUTPOST_ADMIN_OPERATOR_ONBOARDING_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED=yes",
          "npm run admin:operator-onboarding:rehearsal",
        ].join(" \\\n  "),
        detail:
          "Records internal operator-assisted onboarding rehearsal after owner and staff handoff proof.",
        label: "Record operator onboarding rehearsal",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH=${shellSingleQuote(rehearsalPath)}`,
          "npm run admin:operator-onboarding:rehearsal:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies the rehearsal is ready for internal end-to-end testing but not customer/public launch.",
        label: "Inspect operator onboarding rehearsal",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Internal owner/staff workflow rehearsal may be ready without claiming customer-observed completion.",
        label: "Internal rehearsal",
        state: "blocked",
      },
      {
        detail:
          "Manual source to answer review to staff task flow remains operator-observed, not automated provider ingress.",
        label: "Workflow proof",
        state: "blocked",
      },
      {
        detail:
          "No public owner self-signup, automatic grants, sends, providers, or notifications.",
        label: "Productization path",
        state: "blocked",
      },
      {
        detail: "No billing, POS, access control, or member-ledger writes.",
        label: "Revenue/member writes",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "npm run admin:handoff-proof:bundle && npm run admin:handoff-proof:bundle:inspect",
        detail:
          "Bundle the proof chain for repeatable internal browser testing.",
        id: "handoff_proof_bundle",
        state: "blocked",
        title: "Replayable handoff proof bundle",
      },
      {
        command:
          "Not implemented: customer-observed handoff gate with actual gym owner availability.",
        detail:
          "Record only after the owner sees protected Preview, owner workspace, staff path, reset/rollback, and blocked live-provider claims.",
        id: "customer_observed_handoff_gate",
        state: "blocked",
        title: "Customer-observed handoff gate",
      },
    ],
    summary:
      "Reconciles owner and staff handoff proof into an internal operator-assisted onboarding rehearsal.",
    title: "Operator-assisted onboarding rehearsal",
  };
}

export function founderAdminHandoffProofBundle(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminHandoffProofBundle {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const branchSlug = branchConfigured ? slugifyLedgerValue(branchName) : "neon-branch-missing";
  const rehearsalPath = `artifacts/admin-launch-readiness/${branchSlug}-operator-onboarding-rehearsal.json`;
  const bundlePath = `artifacts/admin-launch-readiness/${branchSlug}-handoff-proof-bundle.json`;
  const commandState: FounderAdminChannelPreflightState = "blocked";
  return {
    artifactPath: bundlePath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_OPERATOR_ONBOARDING_REHEARSAL_PATH=${shellSingleQuote(rehearsalPath)}`,
          `OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH=${shellSingleQuote(bundlePath)}`,
          "npm run admin:handoff-proof:bundle",
        ].join(" \\\n  "),
        detail:
          "Prepares a replayable owner/staff/operator handoff proof bundle for internal end-to-end testing.",
        label: "Prepare handoff proof bundle",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH=${shellSingleQuote(bundlePath)}`,
          "npm run admin:handoff-proof:bundle:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies bundle chain, replay commands, ready gates, and blocked public/live-provider gates.",
        label: "Inspect handoff proof bundle",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Bundle is ready for internal Admin/Owner/Staff browser testing, not public launch.",
        label: "Internal test bundle",
        state: "blocked",
      },
      {
        detail:
          "Customer-observed completion still requires actual gym owner observation.",
        label: "Customer gate",
        state: "blocked",
      },
      {
        detail:
          "No public self-serve, automatic grants, sends, providers, or notifications.",
        label: "Productization path",
        state: "blocked",
      },
      {
        detail: "No billing, POS, access control, or member-ledger writes.",
        label: "Revenue/member writes",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "Run protected Preview Admin/Owner/Staff browser walkthrough against the handoff proof bundle.",
        detail:
          "Use the bundle as the checklist for a thorough internal end-to-end user test.",
        id: "handoff_proof_bundle",
        state: "blocked",
        title: "Protected Preview browser walkthrough",
      },
      {
        command:
          "Schedule customer-observed handoff gate with the gym owner when available.",
        detail:
          "Only then can the customer-observed completion artifact be recorded.",
        id: "customer_observed_handoff_gate",
        state: "blocked",
        title: "Customer-observed handoff gate",
      },
    ],
    summary:
      "Bundles owner access completion, staff roster handoff, and operator rehearsal proof into a replayable internal handoff test artifact.",
    title: "Replayable handoff proof bundle",
  };
}

export function founderAdminContinuousReadinessBatch(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminContinuousReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const handoffProofBundlePath = `artifacts/admin-launch-readiness/${branchSlug}-handoff-proof-bundle.json`;
  const handoffReadinessPacketPath = `artifacts/admin-launch-readiness/${branchSlug}-handoff-readiness-packet.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-continuous-readiness-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState =
    hostedContextReady ? "pending" : "blocked";

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_HANDOFF_PROOF_BUNDLE_PATH=${shellSingleQuote(handoffProofBundlePath)}`,
          `OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH=${shellSingleQuote(handoffReadinessPacketPath)}`,
          `OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH=${shellSingleQuote(batchPath)}`,
          "npm run admin:readiness-batch:prepare",
        ].join(" \\\n "),
        detail:
          "Connects handoff proof bundle and handoff-readiness packet into one replayable readiness batch manifest.",
        label: "Prepare continuous readiness batch",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH=${shellSingleQuote(batchPath)}`,
          "npm run admin:readiness-batch:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies both parent hashes and keeps customer, public self-serve, invite, provider, billing, POS, and member-write gates blocked.",
        label: "Inspect continuous readiness batch",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          hostedContextReady
            ? "Protected Preview URL and hosted Neon branch are present for batch parent alignment."
            : "Set protected Preview URL and hosted Neon branch before writing continuous batch.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "Batch consumes the handoff proof bundle and handoff-readiness packet; it does not replace their inspect commands.",
        label: "Parent replayability",
        state: commandState,
      },
      {
        detail:
          "Use this manifest for internal protected Preview walkthrough only; real customer completion remains separate.",
        label: "Customer observed gate",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invite delivery, notifications, live providers, Auth admin product APIs, automatic grants, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextTwoSlices: [
      {
        command:
          "Use browser smoke against protected Preview for Admin, owner workspace, staff workboard, and reset/rollback checklist.",
        detail:
          "This is the next internal end-to-end walkthrough before calling the gym owner.",
        id: "protected_preview_walkthrough",
        state: "pending",
        title: "Protected Preview walkthrough",
      },
      {
        command:
          "Schedule customer-observed handoff gate with the real gym owner when available.",
        detail:
          "Record only after owner sees the protected Preview, workspace, staff path, reset/rollback checklist, and blocked live-provider claims.",
        id: "customer_observed_handoff_gate",
        state: "blocked",
        title: "Customer-observed handoff gate",
      },
    ],
    summary:
      hostedContextReady
        ? "Stitches proof-bundle and handoff-readiness lanes into one replayable Admin readiness batch."
        : "Continuous readiness batch waits for protected Preview URL and hosted Neon branch context.",
    title: "Continuous SaaS readiness batch",
  };
}

export function founderAdminProtectedPreviewWalkthrough(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminProtectedPreviewWalkthrough {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-continuous-readiness-batch.json`;
  const walkthroughPath = `artifacts/admin-launch-readiness/${branchSlug}-protected-preview-walkthrough.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";

  return {
    artifactPath: walkthroughPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_CONTINUOUS_READINESS_BATCH_PATH=${shellSingleQuote(batchPath)}`,
          `OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH=${shellSingleQuote(walkthroughPath)}`,
          "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_ADMIN_OBSERVED='yes'",
          "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_OWNER_OBSERVED='yes'",
          "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_STAFF_OBSERVED='yes'",
          "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_RESET_ROLLBACK_REVIEWED='yes'",
          "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_UNEXPECTED_DATA_NOT_OBSERVED='yes'",
          "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_LIVE_PROVIDER_CLAIMS_BLOCKED='yes'",
          "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_PUBLIC_SELF_SERVE_BLOCKED='yes'",
          "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_INVITE_DELIVERY_BLOCKED='yes'",
          "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_BILLING_POS_MEMBER_WRITES_BLOCKED='yes'",
          "OUTPOST_ADMIN_PREVIEW_WALKTHROUGH_OPERATOR='<operator-label>'",
          "npm run admin:preview-walkthrough:record",
        ].join(" \\\n "),
        detail:
          "Records sanitized internal walkthrough evidence for Admin, owner, staff, reset/rollback, and blocked live-provider claims.",
        label: "Record protected Preview walkthrough",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH=${shellSingleQuote(walkthroughPath)}`,
          "npm run admin:preview-walkthrough:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA, required observations, and keeps customer, public self-serve, invite, provider, billing, POS, and member-write gates blocked.",
        label: "Inspect protected Preview walkthrough",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch are present for internal walkthrough evidence."
          : "Set protected Preview URL and hosted Neon branch before recording walkthrough evidence.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "This records internal operator evidence only; real customer-observed completion remains a separate gate.",
        label: "Customer observed completion",
        state: "blocked",
      },
      {
        detail:
          "Admin, owner, staff, reset/rollback, unexpected-data, no-live-provider, no-invite, and no-revenue checks must be explicit yes values.",
        label: "Operator observations",
        state: commandState,
      },
      {
        detail:
          "Public self-serve, invite delivery, notifications, live providers, Auth admin product APIs, automatic grants, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches: [
      {
        command: "npm run admin:customer-session:record",
        detail:
          "Schedule only when the real gym owner can observe protected Preview, owner workspace, staff path, reset/rollback checklist, and blocked live-provider claims.",
        id: "customer_observed_handoff_gate",
        state: "pending",
        title: "Customer-observed handoff gate",
      },
      {
        command: "npm run admin:beta-request:followthrough",
        detail:
          "Use the same operator-managed owner/staff access pattern for the next approved gym; no public self-serve or invite delivery.",
        id: "limited_operator_assisted_beta_onboarding",
        state: "blocked",
        title: "Limited operator-assisted beta onboarding",
      },
      {
        command: "npm run admin:public-self-serve:preflight",
        detail:
          "Design and prove public signup separately after real customer handoff evidence is recorded.",
        id: "public_self_serve_preflight",
        state: "blocked",
        title: "Public self-serve preflight",
      },
      {
        command:
          "Keep live providers, billing, POS, access control, and member-ledger writes blocked until separately proven.",
        detail:
          "Phone/email providers, notifications, revenue systems, and member-system writes remain outside this batch.",
        id: "live_provider_revenue_gates",
        state: "blocked",
        title: "Live-provider and revenue gates",
      },
    ],
    nextTwoSlices: [
      {
        command: "npm run admin:customer-session:record",
        detail:
          "Schedule only when the real gym owner can observe protected Preview, owner workspace, staff path, reset/rollback checklist, and blocked live-provider claims.",
        id: "customer_observed_handoff_gate",
        state: "pending",
        title: "Customer-observed handoff gate",
      },
      {
        command: "npm run admin:beta-request:followthrough",
        detail:
          "Use the same operator-managed owner/staff access pattern for the next approved gym; no public self-serve or invite delivery.",
        id: "limited_operator_assisted_beta_onboarding",
        state: "blocked",
        title: "Limited operator-assisted beta onboarding",
      },
      {
        command: "npm run admin:public-self-serve:preflight",
        detail:
          "Design and prove public signup separately after real customer handoff evidence is recorded.",
        id: "public_self_serve_preflight",
        state: "blocked",
        title: "Public self-serve preflight",
      },
      {
        command:
          "Keep live providers, billing, POS, access control, and member-ledger writes blocked until separately proven.",
        detail:
          "Phone/email providers, notifications, revenue systems, and member-system writes remain outside this batch.",
        id: "live_provider_revenue_gates",
        state: "blocked",
        title: "Live-provider and revenue gates",
      },
    ],
    summary: hostedContextReady
      ? "Records the internal protected Preview Admin/Owner/Staff walkthrough as the next readiness batch gate."
      : "Protected Preview walkthrough waits for protected Preview URL and hosted Neon branch context.",
    title: "Protected Preview walkthrough batch",
  };
}

export function founderAdminCustomerHandoffSchedulingBatch(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminCustomerHandoffSchedulingBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const walkthroughPath = `artifacts/admin-launch-readiness/${branchSlug}-protected-preview-walkthrough.json`;
  const schedulingPath = `artifacts/admin-launch-readiness/${branchSlug}-customer-handoff-scheduling-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command: "npm run admin:customer-session:record",
      detail:
        "Run only during the real owner-observed session after the owner sees protected Preview, owner workspace, staff path, reset/rollback checklist, and blocked live-provider claims.",
      id: "customer_observed_handoff_gate",
      state: "pending",
      title: "Customer-observed handoff gate",
    },
    {
      command: "npm run admin:beta-request:followthrough",
      detail:
        "Use the same operator-managed access path for the next approved gym; still no public self-serve or invite delivery.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "blocked",
      title: "Limited operator-assisted beta onboarding",
    },
    {
      command: "npm run admin:public-self-serve:preflight",
      detail:
        "Only design public owner signup after customer-observed handoff and operator-assisted onboarding evidence are green.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve preflight",
    },
    {
      command:
        "Keep live providers, billing, POS, access control, and member-ledger writes blocked until separately proven.",
      detail:
        "Phone/email providers, notifications, revenue systems, and member-system writes remain outside this scheduling batch.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: schedulingPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PROTECTED_PREVIEW_WALKTHROUGH_PATH=${shellSingleQuote(walkthroughPath)}`,
          `OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH=${shellSingleQuote(schedulingPath)}`,
          "OUTPOST_ADMIN_CUSTOMER_HANDOFF_GYM_NAME='<gym-name>'",
          "OUTPOST_ADMIN_CUSTOMER_HANDOFF_OPERATOR='<operator-label>'",
          "OUTPOST_ADMIN_CUSTOMER_HANDOFF_SUPPORT_WINDOW='<support-window>'",
          "npm run admin:customer-handoff:schedule",
        ].join(" \\\n "),
        detail:
          "Prepares a customer-safe agenda and support checklist from protected Preview walkthrough proof.",
        label: "Prepare customer handoff scheduling batch",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH=${shellSingleQuote(schedulingPath)}`,
          "npm run admin:customer-handoff:schedule:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA, agenda, support checklist, and blocked customer/live-provider/revenue gates.",
        label: "Inspect customer handoff scheduling batch",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch are present for customer handoff scheduling."
          : "Set protected Preview URL and hosted Neon branch before preparing customer handoff scheduling.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "This prepares scheduling material only; customer-observed completion remains separate until the owner attends.",
        label: "Customer observed completion",
        state: "blocked",
      },
      {
        detail:
          "Gym name, operator label, and support window are required; credentials and session details stay outside the artifact.",
        label: "Customer-safe scheduling inputs",
        state: commandState,
      },
      {
        detail:
          "Public self-serve, invite delivery, notifications, live providers, Auth admin product APIs, automatic grants, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Prepares customer-safe scheduling material for the real owner-observed handoff without recording completion."
      : "Customer handoff scheduling waits for protected Preview URL and hosted Neon branch context.",
    title: "Customer handoff scheduling batch",
  };
}

export function founderAdminCustomerHandoffGatePreflight(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminCustomerHandoffGatePreflight {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const schedulingPath = `artifacts/admin-launch-readiness/${branchSlug}-customer-handoff-scheduling-batch.json`;
  const preflightPath = `artifacts/admin-launch-readiness/${branchSlug}-customer-handoff-gate-preflight.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command: "npm run admin:customer-session:record",
      detail:
        "Use only during the real owner-observed session after every required observation is true.",
      id: "customer_observed_handoff_gate",
      state: "pending",
      title: "Real customer-observed handoff gate",
    },
    {
      command: "npm run admin:customer-session:inspect",
      detail:
        "Inspect the customer session record before importing or relying on customer-observed proof.",
      id: "hosted_customer_session_proof",
      state: "blocked",
      title: "Customer session record inspection",
    },
    {
      command: "npm run admin:beta-request:followthrough",
      detail:
        "Use operator-managed owner/staff access for the next approved gym only after customer-observed proof is green.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "blocked",
      title: "Limited operator-assisted beta onboarding",
    },
    {
      command: "npm run admin:public-self-serve:preflight",
      detail:
        "Public self-serve remains blocked until customer-observed and operator-assisted beta evidence are reviewed.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve preflight",
    },
    {
      command:
        "Keep live providers, billing, POS, access control, member-ledger writes blocked until separately proven.",
      detail:
        "Phone/email providers, notifications, revenue systems, member-system writes remain outside this batch.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: preflightPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_CUSTOMER_HANDOFF_SCHEDULING_BATCH_PATH=${shellSingleQuote(
            schedulingPath,
          )}`,
          `OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          "npm run admin:customer-handoff:gate-preflight",
        ].join(" \\\n  "),
        detail:
          "Prepares the customer-observed session evidence checklist without recording completion.",
        label: "Prepare customer handoff gate preflight",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          "npm run admin:customer-handoff:gate-preflight:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies scheduling parent SHA, required customer observations, command templates, and blocked gates.",
        label: "Inspect customer handoff gate preflight",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch present for customer handoff gate preflight."
          : "Set protected Preview URL and hosted Neon branch before preparing customer gate preflight.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "Preflight only; customer-observed completion remains false until the real owner attends.",
        label: "Customer observed completion",
        state: "blocked",
      },
      {
        detail:
          "Required observations, stop conditions, and record/inspect commands are generated for the live session.",
        label: "Customer evidence checklist",
        state: commandState,
      },
      {
        detail:
          "Public self-serve, invite delivery, notifications, live providers, Auth admin product APIs, automatic grants, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Bridges scheduling into a repeatable customer-observed gate checklist without claiming completion."
      : "Customer handoff gate preflight waits protected Preview URL and hosted Neon branch context.",
    title: "Customer handoff gate preflight",
  };
}

export function founderAdminCustomerSessionHostedImportReadiness(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminCustomerSessionHostedImportReadiness {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const gatePreflightPath = `artifacts/admin-launch-readiness/${branchSlug}-customer-handoff-gate-preflight.json`;
  const importReadinessPath = `artifacts/admin-launch-readiness/${branchSlug}-customer-session-hosted-import-readiness.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command: "npm run admin:customer-session:record",
      detail:
        "Run only during the real owner-observed handoff after every customer observation is true.",
      id: "customer_observed_handoff_gate",
      state: "pending",
      title: "Real customer-observed handoff gate",
    },
    {
      command:
        "npm run admin:customer-session:inspect && npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
      detail:
        "Import and prove the customer-session digest only after the real record exists.",
      id: "hosted_customer_session_proof",
      state: "blocked",
      title: "Hosted customer-session proof",
    },
    {
      command: "npm run admin:beta-request:followthrough",
      detail:
        "Use operator-managed owner/staff access for the next approved gym after customer proof is imported and reviewed.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "blocked",
      title: "Limited operator-assisted beta onboarding",
    },
    {
      command: "npm run admin:public-self-serve:preflight",
      detail:
        "Public self-serve remains blocked until customer proof and operator-assisted beta evidence are green.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve preflight",
    },
    {
      command:
        "Keep live providers, billing, POS, access control, member-ledger writes blocked until separately proven.",
      detail:
        "Phone/email providers, notifications, revenue systems, member-system writes remain outside this batch.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: importReadinessPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_CUSTOMER_HANDOFF_GATE_PREFLIGHT_PATH=${shellSingleQuote(
            gatePreflightPath,
          )}`,
          `OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH=${shellSingleQuote(
            importReadinessPath,
          )}`,
          "npm run admin:customer-session:hosted-import-readiness",
        ].join(" \\\n  "),
        detail:
          "Prepares hosted customer-session import/proof commands while keeping them blocked until a real customer record exists.",
        label: "Prepare hosted customer-session import readiness",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH=${shellSingleQuote(
            importReadinessPath,
          )}`,
          "npm run admin:customer-session:hosted-import-readiness:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies gate-preflight parent SHA, required record steps, stop conditions, and blocked gates.",
        label: "Inspect hosted customer-session import readiness",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch present for customer-session import readiness."
          : "Set protected Preview URL and hosted Neon branch before preparing hosted import readiness.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "A real owner-observed customer-session record is required before hosted import/proof commands can be used.",
        label: "Customer session record",
        state: "blocked",
      },
      {
        detail:
          "Record, inspect, hosted import, and hosted proof commands are sequenced without storing secrets.",
        label: "Hosted import sequence",
        state: commandState,
      },
      {
        detail:
          "Public self-serve, invite delivery, notifications, live providers, Auth admin product APIs, automatic grants, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages hosted customer-session import/proof steps while the real customer record remains the hard gate."
      : "Hosted customer-session import readiness waits protected Preview URL and hosted Neon branch context.",
    title: "Hosted customer-session import readiness",
  };
}

export function founderAdminLimitedBetaReadinessGate(
  proofLedger: FounderAdminProofStatusLedger | undefined,
): FounderAdminLimitedBetaReadinessGate {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const importReadinessPath = `artifacts/admin-launch-readiness/${branchSlug}-customer-session-hosted-import-readiness.json`;
  const gatePath = `artifacts/admin-launch-readiness/${branchSlug}-limited-beta-readiness-gate.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command: "npm run admin:customer-session:record",
      detail:
        "Real customer-observed session remains the hard gate before beta expansion.",
      id: "customer_observed_handoff_gate",
      state: "pending",
      title: "Real customer-observed handoff gate",
    },
    {
      command:
        "npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
      detail:
        "Hosted customer-session proof must be green before limited beta onboarding starts.",
      id: "hosted_customer_session_proof",
      state: "blocked",
      title: "Hosted customer-session proof",
    },
    {
      command: "npm run admin:beta-request:followthrough",
      detail:
        "Use operator-managed owner/staff access for one approved gym after proof review.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "blocked",
      title: "Limited operator-assisted beta onboarding",
    },
    {
      command: "npm run admin:public-self-serve:preflight",
      detail:
        "Public self-serve remains blocked until limited beta evidence is reviewed.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve preflight",
    },
    {
      command:
        "Keep live providers, billing, POS, access control, member-ledger writes blocked until separately proven.",
      detail:
        "Phone/email providers, notifications, revenue systems, member-system writes remain outside this gate.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: gatePath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_IMPORT_READINESS_PATH=${shellSingleQuote(
            importReadinessPath,
          )}`,
          `OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH=${shellSingleQuote(
            gatePath,
          )}`,
          "npm run admin:limited-beta:readiness-gate",
        ].join(" \\\n  "),
        detail:
          "Prepares limited beta onboarding readiness while customer-session proof remains the hard gate.",
        label: "Prepare limited beta readiness gate",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH=${shellSingleQuote(
            gatePath,
          )}`,
          "npm run admin:limited-beta:readiness-gate:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies hosted import readiness parent SHA, operator-managed access, checklist, and blocked gates.",
        label: "Inspect limited beta readiness gate",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch present for limited beta readiness gate."
          : "Set protected Preview URL and hosted Neon branch before preparing limited beta gate.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "Limited beta onboarding remains blocked until hosted customer-session proof exists.",
        label: "Customer proof prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Next gym onboarding must use operator-managed access only; no public signup or invite send path.",
        label: "Operator-managed beta",
        state: commandState,
      },
      {
        detail:
          "Public self-serve, invite delivery, notifications, live providers, Auth admin product APIs, automatic grants, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the next approved-gym beta gate while customer-session proof remains required."
      : "Limited beta readiness gate waits protected Preview URL and hosted Neon branch context.",
    title: "Limited beta readiness gate",
  };
}

export function founderAdminPostCustomerProofReadinessBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminPostCustomerProofReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const gatePath = `artifacts/admin-launch-readiness/${branchSlug}-limited-beta-readiness-gate.json`;
  const recordPath = `artifacts/admin-launch-readiness/${branchSlug}-customer-observed-session-record.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-post-customer-proof-readiness-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "npm run admin:beta-request:triage-packet && npm run admin:beta-request:followthrough",
      detail:
        "Onboard one approved gym with operator-managed owner access after hosted customer proof review.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "pending",
      title: "Limited operator-assisted beta onboarding",
    },
    {
      command:
        "npm run admin:public-self-serve:preflight && npm run admin:public-self-serve:inspect",
      detail:
        "Package public self-serve prerequisites after limited beta evidence; launch remains blocked.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve preflight",
    },
    {
      command:
        "Keep phone/email providers, notifications, billing, POS, access control, member-ledger writes blocked until separately proven.",
      detail:
        "Live provider and revenue/member-system work needs its own proof, review, and customer approval.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_LIMITED_BETA_READINESS_GATE_PATH=${shellSingleQuote(
            gatePath,
          )}`,
          `OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH=${shellSingleQuote(
            recordPath,
          )}`,
          `OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "OUTPOST_ADMIN_POST_CUSTOMER_PROOF_HOSTED_PROOF_OBSERVED='yes'",
          "npm run admin:post-customer-proof:batch",
        ].join(" \\\n  "),
        detail:
          "Prepares the post-customer-proof readiness batch after hosted proof has been observed.",
        label: "Prepare post-customer-proof readiness batch",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:post-customer-proof:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies parent SHA chain, customer-observed record, hosted proof attestation, and blocked gates.",
        label: "Inspect post-customer-proof readiness batch",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch are present for the post-customer-proof batch."
          : "Set protected Preview URL and hosted Neon branch before preparing post-customer-proof batch.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "Requires real customer-observed session record plus hosted customer-session proof already run.",
        label: "Customer proof prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Next approved gym remains operator-managed; no browser approval buttons, automatic grants, or invite delivery.",
        label: "Operator-managed beta",
        state: commandState,
      },
      {
        detail:
          "Public self-serve, invite delivery, notifications, live providers, Auth admin product APIs, automatic grants, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the continuous post-customer-proof batch: limited beta onboarding, public self-serve preflight, and live-provider/revenue gates."
      : "Post-customer-proof readiness waits protected Preview URL and hosted Neon branch context.",
    title: "Post-customer-proof readiness batch",
  };
}

export function founderAdminApprovedBetaExpansionReadinessBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedBetaExpansionReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const postProofPath = `artifacts/admin-launch-readiness/${branchSlug}-post-customer-proof-readiness-batch.json`;
  const followthroughPath = `artifacts/admin-launch-readiness/${branchSlug}-owner-beta-request-followthrough.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-approved-beta-expansion-readiness-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "npm run beta:operator:request-fulfillment && npm run hosted:request-fulfillment-proof",
      detail:
        "Fulfill one approved gym through operator-managed owner access, then prove hosted visibility.",
      id: "approved_gym_operator_fulfillment",
      state: "pending",
      title: "Approved gym operator fulfillment",
    },
    {
      command:
        "npm run admin:public-request-intake:dry-run && npm run admin:public-request-intake:inspect",
      detail:
        "Package public request intake as request-only and review-only; no automatic approval or provisioning.",
      id: "public_request_intake_dry_run",
      state: "blocked",
      title: "Public request intake dry-run",
    },
    {
      command:
        "npm run admin:invite-delivery:preflight && npm run admin:auth-admin:dry-run",
      detail:
        "Prepare invite/Auth operations as no-send, operator-review-only dry-runs.",
      id: "invite_auth_dry_run_gates",
      state: "blocked",
      title: "Invite and Auth dry-run gates",
    },
    {
      command:
        "Keep phone/email providers, notifications, billing, POS, access control, member-ledger writes blocked until separately proven.",
      detail:
        "Live provider and revenue/member-system work remains outside approved beta expansion.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_POST_CUSTOMER_PROOF_READINESS_BATCH_PATH=${shellSingleQuote(
            postProofPath,
          )}`,
          `OUTPOST_BETA_REQUEST_FOLLOWTHROUGH_PATH=${shellSingleQuote(
            followthroughPath,
          )}`,
          `OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_GYM_LABEL='<approved gym label>'",
          "npm run admin:approved-beta-expansion:batch",
        ].join(" \\\n  "),
        detail:
          "Packages approved-gym beta expansion after customer proof and human-reviewed beta request follow-through.",
        label: "Prepare approved beta expansion batch",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:approved-beta-expansion:inspect",
        ].join(" \\\n  "),
        detail:
          "Verifies post-proof parent SHA, owner request follow-through SHA, approved-gym guard, and blocked gates.",
        label: "Inspect approved beta expansion batch",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch are present for approved beta expansion."
          : "Set protected Preview URL and hosted Neon branch before preparing approved beta expansion.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "Requires post-customer-proof batch plus human-reviewed owner beta request follow-through.",
        label: "Approved gym proof prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Owner access remains operator-managed; public request intake stays dry-run and review-only.",
        label: "Operator-managed expansion",
        state: commandState,
      },
      {
        detail:
          "Public self-serve, invite delivery, notifications, live providers, Auth admin product APIs, automatic grants, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages approved-gym beta expansion and the next dry-run gates without enabling public self-serve or live providers."
      : "Approved beta expansion batch waits protected Preview URL and hosted Neon branch context.",
    title: "Approved beta expansion readiness batch",
  };
}

export function founderAdminRequestIntakeInviteAuthReadinessBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminRequestIntakeInviteAuthReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const approvedExpansionPath = `artifacts/admin-launch-readiness/${branchSlug}-approved-beta-expansion-readiness-batch.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-request-intake-invite-auth-readiness-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "npm run admin:owner-access-fulfillment:evidence && npm run admin:staff-invite:no-send",
      detail:
        "Link reviewed request metadata to operator-managed owner access, then prepare staff handoff without invite sending.",
      id: "owner_access_fulfillment_evidence",
      state: "blocked",
      title: "Owner and staff handoff evidence",
    },
    {
      command:
        "npm run hosted:beta-request-chain-proof && npm run hosted:beta-request-browser-proof",
      detail:
        "Rerun hosted request chain and browser proof for the approved gym before customer-facing walkthrough.",
      id: "operator_assisted_onboarding_rehearsal",
      state: "pending",
      title: "Approved-gym hosted rehearsal",
    },
    {
      command:
        "Package public self-serve launch criteria only after operator-assisted beta proof is green.",
      detail:
        "Public owner signup, browser approvals, automatic grants, and invite delivery remain blocked until a separate launch gate.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve launch gate",
    },
    {
      command:
        "Keep phone/email providers, notifications, billing, POS, access control, member-ledger writes blocked until separately proven.",
      detail:
        "Live-provider and revenue/member-system work remains outside this request-intake/invite/Auth dry-run batch.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider revenue gates",
    },
  ];

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_APPROVED_BETA_EXPANSION_READINESS_BATCH_PATH=${shellSingleQuote(
            approvedExpansionPath,
          )}`,
          `OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_GYM_LABEL='<approved gym label>'",
          "npm run admin:request-intake-invite-auth:batch",
        ].join(" \\\n "),
        detail:
          "Packages approved gym fulfillment, public request intake, invite no-send, and Auth no-create dry-run gates.",
        label: "Prepare request intake invite/Auth batch",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:request-intake-invite-auth:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies approved expansion parent SHA, request-only intake, no-send invite, no-create Auth, and blocked live-provider gates.",
        label: "Inspect request intake invite/Auth batch",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch present for request-intake invite/Auth batch."
          : "Set protected Preview URL and hosted Neon branch before preparing this batch.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "Requires approved beta expansion readiness batch for a real non-House-of-Fitness gym.",
        label: "Approved expansion prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Public request intake remains request-only/review-only; invite delivery remains no-send.",
        label: "Request and invite gates",
        state: "blocked",
      },
      {
        detail:
          "Auth admin provisioning remains no-create; no product Auth admin API, automatic grants, or browser approval buttons.",
        label: "Auth/admin gates",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages a larger approved-gym batch: operator fulfillment readiness, public request intake dry-run, invite no-send, Auth no-create, and blocked live-provider gates."
      : "Request-intake invite/Auth readiness batch waits protected Preview URL and hosted Neon branch context.",
    title: "Request intake invite/Auth readiness batch",
  };
}

export function founderAdminOwnerStaffHandoffReadinessBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminOwnerStaffHandoffReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const parentPath = `artifacts/admin-launch-readiness/${branchSlug}-request-intake-invite-auth-readiness-batch.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-owner-staff-handoff-readiness-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run owner/staff handoff evidence commands, then package approved-gym browser rehearsal.",
      detail:
        "Convert prepared owner/staff handoff readiness into hosted browser proof without enabling invite delivery.",
      id: "operator_assisted_onboarding_rehearsal",
      state: "pending",
      title: "Approved-gym hosted rehearsal",
    },
    {
      command:
        "Record customer-observed owner/staff walkthrough only after the approved gym sees the protected Preview.",
      detail:
        "Customer-observed proof remains separate from this operator-readiness batch.",
      id: "customer_observed_handoff_gate",
      state: "blocked",
      title: "Approved-gym customer walkthrough",
    },
    {
      command:
        "Package public self-serve launch criteria only after operator-assisted beta proof is green.",
      detail:
        "Public signup, browser approvals, automatic grants, and invite delivery remain blocked.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve launch gate",
    },
    {
      command:
        "Keep phone/email providers, notifications, billing, POS, access control, member-ledger writes blocked until separately proven.",
      detail:
        "Live-provider and revenue/member-system work remains outside owner/staff handoff readiness.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider revenue gates",
    },
  ];

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_REQUEST_INTAKE_INVITE_AUTH_READINESS_BATCH_PATH=${shellSingleQuote(
            parentPath,
          )}`,
          `OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_GYM_LABEL='<approved gym label>'",
          "npm run admin:owner-staff-handoff:batch",
        ].join(" \\\n "),
        detail:
          "Packages owner access evidence readiness, staff no-send handoff readiness, approved-gym rehearsal, and blocked launch/live gates.",
        label: "Prepare owner/staff handoff batch",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:owner-staff-handoff:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies request-intake parent SHA, owner/staff evidence remains pending, no-send/no-create gates, and blocked live-provider gates.",
        label: "Inspect owner/staff handoff batch",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch present for owner/staff handoff readiness."
          : "Set protected Preview URL and hosted Neon branch before preparing owner/staff handoff readiness.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "Requires request-intake invite/Auth readiness batch for a real non-House-of-Fitness gym.",
        label: "Request-intake prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Owner access evidence and staff no-send preflight are required but not recorded by this batch.",
        label: "Owner/staff evidence",
        state: "blocked",
      },
      {
        detail:
          "Approved-gym hosted browser rehearsal and customer-observed walkthrough remain pending separate proof.",
        label: "Hosted/customer proof",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages owner/staff handoff readiness after request-intake invite/Auth proof while evidence, hosted rehearsal, and customer-observed walkthrough remain separate gates."
      : "Owner/staff handoff readiness batch waits protected Preview URL and hosted Neon branch context.",
    title: "Owner/staff handoff readiness batch",
  };
}

export function founderAdminApprovedGymHostedRehearsalReadinessBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const parentPath = `artifacts/admin-launch-readiness/${branchSlug}-owner-staff-handoff-readiness-batch.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-approved-gym-hosted-rehearsal-readiness-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run approved-gym protected Preview browser rehearsal, then record only non-secret hosted evidence.",
      detail:
        "Verify owner workspace, staff path, reset checklist, and blocked live-provider claims.",
      id: "operator_assisted_onboarding_rehearsal",
      state: "pending",
      title: "Record approved-gym hosted rehearsal",
    },
    {
      command:
        "Schedule customer-observed approved-gym walkthrough after hosted rehearsal proof is recorded.",
      detail:
        "The real gym must see the protected Preview before customer-observed completion can be recorded.",
      id: "customer_observed_handoff_gate",
      state: "blocked",
      title: "Approved-gym customer walkthrough",
    },
    {
      command:
        "Prepare first-gym go/no-go evidence bundle after customer-observed walkthrough passes.",
      detail:
        "Bundle the run evidence and support checklist before any broader launch gate.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "First-gym go/no-go bundle",
    },
    {
      command:
        "Keep public signup, invites, providers, billing, POS, access control, member-ledger writes blocked until separately proven.",
      detail:
        "Public self-serve and live-provider/revenue work remains outside the first-gym operator-assisted run.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Public/live-provider gates",
    },
  ];

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH=${shellSingleQuote(
            parentPath,
          )}`,
          `OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_LABEL='<approved gym label>'",
          "npm run admin:approved-gym-hosted-rehearsal:batch",
        ].join(" \\\n "),
        detail:
          "Packages hosted rehearsal command path while browser proof and customer-observed walkthrough remain pending.",
        label: "Prepare approved-gym hosted rehearsal batch",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:approved-gym-hosted-rehearsal:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies owner/staff parent SHA, hosted rehearsal required flags, customer proof pending, and blocked launch/live gates.",
        label: "Inspect approved-gym hosted rehearsal batch",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch present for approved-gym hosted rehearsal."
          : "Set protected Preview URL and hosted Neon branch before preparing hosted rehearsal.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "Requires owner/staff handoff readiness batch for a real non-House-of-Fitness gym.",
        label: "Owner/staff handoff prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Owner workspace, staff workboard, reset/rollback, no-unexpected-data, and no-live-provider checks remain required.",
        label: "Hosted rehearsal checks",
        state: "blocked",
      },
      {
        detail:
          "Customer-observed walkthrough and first-gym go/no-go bundle remain separate later gates.",
        label: "Customer proof gates",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages approved-gym hosted rehearsal readiness while browser proof, customer-observed walkthrough, and first-gym go/no-go remain separate gates."
      : "Approved-gym hosted rehearsal readiness batch waits protected Preview URL and hosted Neon branch context.",
    title: "Approved-gym hosted rehearsal readiness batch",
  };
}

export function founderAdminApprovedGymHostedRehearsalEvidence(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const readinessPath = `artifacts/admin-launch-readiness/${branchSlug}-approved-gym-hosted-rehearsal-readiness-batch.json`;
  const evidencePath = `artifacts/admin-launch-readiness/${branchSlug}-approved-gym-hosted-rehearsal-evidence.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Record real customer-observed session only when the gym owner sees the protected Preview.",
      detail:
        "Owner workspace, staff handoff path, reset/rollback, no unexpected data, and no-live-provider confirmations are mandatory.",
      id: "customer_observed_handoff_gate",
      state: "pending",
      title: "Customer-observed approved-gym walkthrough",
    },
    {
      command:
        "Bundle hosted rehearsal evidence with the real customer-observed record.",
      detail:
        "This becomes the go/no-go packet for the first operator-assisted gym run.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "First-gym go/no-go bundle",
    },
    {
      command:
        "Keep public signup, invites, providers, billing, POS, access control, member-ledger writes blocked until separately proven.",
      detail:
        "Public self-serve and live-provider/revenue work remains outside this first-gym operator-assisted run.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Public/live-provider gates",
    },
  ];

  return {
    artifactPath: evidencePath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_READINESS_BATCH_PATH=${shellSingleQuote(
            readinessPath,
          )}`,
          `OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH=${shellSingleQuote(
            evidencePath,
          )}`,
          "OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_OWNER_WORKSPACE_OBSERVED=yes",
          "OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_STAFF_WORKBOARD_OBSERVED=yes",
          "OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_RESET_ROLLBACK_REVIEWED=yes",
          "OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_UNEXPECTED_DATA_NOT_OBSERVED=yes",
          "OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED=yes",
          "OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_INVITE_DELIVERY_NOT_OBSERVED=yes",
          "OUTPOST_ADMIN_APPROVED_GYM_REHEARSAL_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED=yes",
          "npm run admin:approved-gym-hosted-rehearsal:evidence",
        ].join(" \\\n "),
        detail:
          "Records non-secret hosted rehearsal evidence after operator/browser verification while customer-observed completion remains separate.",
        label: "Record hosted rehearsal evidence",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH=${shellSingleQuote(
            evidencePath,
          )}`,
          "npm run admin:approved-gym-hosted-rehearsal:evidence:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA, rehearsal observations, no-live-provider gates, and customer-observed completion still blocked.",
        label: "Inspect hosted rehearsal evidence",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch present for approved-gym hosted rehearsal evidence."
          : "Set protected Preview URL and hosted Neon branch before recording hosted rehearsal evidence.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "Requires approved-gym hosted rehearsal readiness batch for a real non-House-of-Fitness gym.",
        label: "Rehearsal readiness prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Owner workspace, staff workboard, reset/rollback, no unexpected data, no invite delivery, no-live-provider, and no billing/POS/member-write confirmations are required.",
        label: "Observed rehearsal checks",
        state: "blocked",
      },
      {
        detail:
          "Customer-observed walkthrough is still recorded only by the existing real-owner session command.",
        label: "Customer proof gate",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Records approved-gym hosted rehearsal evidence without claiming customer-observed completion or enabling public/live-provider gates."
      : "Approved-gym hosted rehearsal evidence waits protected Preview URL and hosted Neon branch context.",
    title: "Approved-gym hosted rehearsal evidence",
  };
}

export function founderAdminFirstGymGoNoGoBundle(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const rehearsalPath = `artifacts/admin-launch-readiness/${branchSlug}-approved-gym-hosted-rehearsal-evidence.json`;
  const customerSessionPath =
    "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json";
  const bundlePath = `artifacts/admin-launch-readiness/${branchSlug}-first-gym-go-no-go-bundle.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run the first gym operator-assisted end-to-end session using the bundle as checklist.",
      detail:
        "This is the actual operator-assisted gym run; do not treat it as public self-serve launch.",
      id: "first_gym_operator_assisted_run",
      state: "pending",
      title: "First gym operator-assisted E2E run",
    },
    {
      command:
        "After reviewing the first gym run, prepare limited operator-assisted beta onboarding for the next approved gym.",
      detail:
        "Owner access stays operator-managed until limited beta evidence is reviewed.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "blocked",
      title: "Limited operator-assisted beta onboarding",
    },
    {
      command:
        "Prepare public self-serve and live-provider/revenue gates only after limited beta evidence.",
      detail:
        "Public signup, invites, providers, billing, POS, access control, and member-ledger writes remain blocked.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve and live-provider gates",
    },
  ];

  return {
    artifactPath: bundlePath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_APPROVED_GYM_HOSTED_REHEARSAL_EVIDENCE_PATH=${shellSingleQuote(
            rehearsalPath,
          )}`,
          `OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH=${shellSingleQuote(
            customerSessionPath,
          )}`,
          `OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH=${shellSingleQuote(
            bundlePath,
          )}`,
          "npm run admin:first-gym:go-no-go",
        ].join(" \\\n "),
        detail:
          "Bundles approved-gym hosted rehearsal evidence with a real customer-observed session record.",
        label: "Prepare first-gym go/no-go bundle",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH=${shellSingleQuote(
            bundlePath,
          )}`,
          "npm run admin:first-gym:go-no-go:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies both parent SHAs, customer-observed proof, first-gym readiness, and blocked public/live-provider gates.",
        label: "Inspect first-gym go/no-go bundle",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch present for first-gym go/no-go packaging."
          : "Set protected Preview URL and hosted Neon branch before preparing the first-gym go/no-go bundle.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "Requires approved-gym hosted rehearsal evidence and real customer-observed session record.",
        label: "Parent proof records",
        state: "blocked",
      },
      {
        detail:
          "Only the real customer-observed session record may claim customer-observed completion.",
        label: "Customer-observed proof",
        state: "blocked",
      },
      {
        detail:
          "The bundle prepares the first operator-assisted gym run, not public launch.",
        label: "First-gym run boundary",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Bundles hosted rehearsal evidence and real customer-observed session proof into the first-gym operator-assisted go/no-go packet."
      : "First-gym go/no-go bundle waits protected Preview URL and hosted Neon branch context.",
    title: "First-gym go/no-go bundle",
  };
}

export function founderAdminFirstGymOperatorRunRecord(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const goNoGoPath = `artifacts/admin-launch-readiness/${branchSlug}-first-gym-go-no-go-bundle.json`;
  const recordPath = `artifacts/admin-launch-readiness/${branchSlug}-first-gym-operator-run-record.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Prepare limited beta operator review from the first-gym run record.",
      detail:
        "This keeps the next gym operator-assisted until the first run is reviewed.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "pending",
      title: "Limited beta operator review",
    },
    {
      command:
        "Prepare public self-serve launch preflight only after limited beta review.",
      detail:
        "Public signup, invites, providers, billing, POS, and member-ledger writes stay blocked.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve launch preflight",
    },
    {
      command:
        "Keep live-provider and revenue/member-system gates as separate proof tracks.",
      detail:
        "Phone/email providers and revenue/account systems need their own proof and review.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: recordPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_FIRST_GYM_GO_NO_GO_BUNDLE_PATH=${shellSingleQuote(
            goNoGoPath,
          )}`,
          `OUTPOST_ADMIN_FIRST_GYM_OPERATOR_RUN_RECORD_PATH=${shellSingleQuote(
            recordPath,
          )}`,
          "OUTPOST_ADMIN_FIRST_GYM_OPERATOR='Krish'",
          "OUTPOST_ADMIN_FIRST_GYM_OWNER_WORKSPACE_COMPLETED=yes",
          "OUTPOST_ADMIN_FIRST_GYM_STAFF_WORKBOARD_COMPLETED=yes",
          "OUTPOST_ADMIN_FIRST_GYM_SOURCE_TO_ANSWER_TO_TASK_COMPLETED=yes",
          "OUTPOST_ADMIN_FIRST_GYM_RESET_ROLLBACK_EXERCISED=yes",
          "OUTPOST_ADMIN_FIRST_GYM_SUPPORT_HANDOFF_REVIEWED=yes",
          "OUTPOST_ADMIN_FIRST_GYM_UNEXPECTED_DATA_NOT_OBSERVED=yes",
          "OUTPOST_ADMIN_FIRST_GYM_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED=yes",
          "OUTPOST_ADMIN_FIRST_GYM_INVITE_DELIVERY_NOT_OBSERVED=yes",
          "OUTPOST_ADMIN_FIRST_GYM_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED=yes",
          "npm run admin:first-gym:run",
        ].join(" \\\n "),
        detail:
          "Records the actual first gym operator-assisted run after owner workspace, staff workboard, source-answer-task, support, and rollback checks.",
        label: "Record first-gym operator-assisted run",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_FIRST_GYM_OPERATOR_RUN_RECORD_PATH=${shellSingleQuote(
            recordPath,
          )}`,
          "npm run admin:first-gym:run:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies the parent go/no-go SHA, required observations, and blocked public/live-provider gates.",
        label: "Inspect first-gym run record",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: hostedContextReady
          ? "Protected Preview URL and hosted Neon branch present for first-gym run evidence."
          : "Set protected Preview URL and hosted Neon branch before recording first-gym run evidence.",
        label: "Hosted proof context",
        state: hostedContextReady ? "pending" : "blocked",
      },
      {
        detail:
          "Requires first-gym go/no-go bundle and explicit operator observation confirmations.",
        label: "Run evidence prerequisites",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invite delivery, provider activation, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Records the first operator-assisted gym run as evidence for limited beta review without opening public or live-provider gates."
      : "First-gym run record waits protected Preview URL and hosted Neon branch context.",
    title: "First-gym operator-assisted run record",
  };
}

export function founderAdminLimitedBetaOperatorReviewPacket(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const runRecordPath = `artifacts/admin-launch-readiness/${branchSlug}-first-gym-operator-run-record.json`;
  const reviewPath = `artifacts/admin-launch-readiness/${branchSlug}-limited-beta-operator-review-packet.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command: "Prepare public self-serve launch preflight from this review.",
      detail:
        "This is still not launch permission; it packages what must be green first.",
      id: "public_self_serve_preflight",
      state: "pending",
      title: "Public self-serve launch preflight",
    },
    {
      command:
        "Run one more limited operator-assisted beta onboarding before public launch.",
      detail:
        "Owner access remains operator-managed and customer-observed proof remains explicit.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "pending",
      title: "Next approved gym limited beta",
    },
    {
      command:
        "Prepare live-provider and revenue/member-system gates separately.",
      detail:
        "Phone/email providers, billing, POS, access control, and member-ledger writes are still blocked.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: reviewPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_FIRST_GYM_OPERATOR_RUN_RECORD_PATH=${shellSingleQuote(
            runRecordPath,
          )}`,
          `OUTPOST_ADMIN_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH=${shellSingleQuote(
            reviewPath,
          )}`,
          "OUTPOST_ADMIN_LIMITED_BETA_REVIEWED_FIRST_GYM_RUN=yes",
          "OUTPOST_ADMIN_LIMITED_BETA_OPERATOR='Krish'",
          "OUTPOST_ADMIN_LIMITED_BETA_CANDIDATE_GYM='Next approved beta gym'",
          "npm run admin:limited-beta:operator-review",
        ].join(" \\\n "),
        detail:
          "Packages the first-gym run into a limited beta review packet for the next operator-assisted gym.",
        label: "Prepare limited beta operator review",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH=${shellSingleQuote(
            reviewPath,
          )}`,
          "npm run admin:limited-beta:operator-review:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies the first-gym run SHA, operator-managed access, and blocked public/live-provider gates.",
        label: "Inspect limited beta operator review",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires first-gym operator-assisted run record and explicit review confirmation.",
        label: "First-gym review prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Owner access remains operator-managed; no browser approvals or invite delivery are introduced.",
        label: "Operator-managed access",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, providers, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Turns the reviewed first-gym run into a limited beta operator review packet for the next approved gym."
      : "Limited beta operator review waits protected Preview URL and hosted Neon branch context.",
    title: "Limited beta operator review packet",
  };
}

export function founderAdminPublicSelfServeLaunchPreflight(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const reviewPath = `artifacts/admin-launch-readiness/${branchSlug}-limited-beta-operator-review-packet.json`;
  const preflightPath = `artifacts/admin-launch-readiness/${branchSlug}-public-self-serve-launch-preflight.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Design public request intake as pending review only; do not add browser approvals.",
      detail:
        "Public self-serve starts as a reviewed request path, not account creation or automatic access.",
      id: "public_request_intake_dry_run",
      state: "pending",
      title: "Public request intake dry-run",
    },
    {
      command:
        "Prepare invite/Auth no-send dry runs before any delivery or Auth user creation.",
      detail:
        "Invite delivery and product Auth admin APIs remain blocked until separately proven.",
      id: "invite_auth_dry_run_gates",
      state: "blocked",
      title: "Invite/Auth no-send gates",
    },
    {
      command:
        "Prepare live-provider and revenue/member-system proof tracks separately.",
      detail:
        "Phone/email providers, billing, POS, access control, and member-ledger writes remain blocked.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: preflightPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH=${shellSingleQuote(
            reviewPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          "npm run admin:public-self-serve:launch-preflight",
        ].join(" \\\n "),
        detail:
          "Prepares public self-serve launch requirements from limited beta review while keeping launch disabled.",
        label: "Prepare public self-serve launch preflight",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          "npm run admin:public-self-serve:launch-preflight:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies limited beta parent SHA and confirms public launch, invites, providers, and revenue/member-system gates remain blocked.",
        label: "Inspect public self-serve launch preflight",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires limited beta operator review packet; this preflight does not itself authorize launch.",
        label: "Limited beta prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Public request intake must stay request-only and human-reviewed until a separate launch gate is green.",
        label: "Public request boundary",
        state: "blocked",
      },
      {
        detail:
          "Invites, Auth admin APIs, providers, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Prepares public self-serve launch requirements without enabling public signup, invites, providers, or revenue/member-system writes."
      : "Public self-serve launch preflight waits protected Preview URL and hosted Neon branch context.",
    title: "Public self-serve launch preflight",
  };
}

export function founderAdminPublicLaunchControlsBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const preflightPath = `artifacts/admin-launch-readiness/${branchSlug}-public-self-serve-launch-preflight.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-public-launch-controls-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Implement public request intake as request-only and human-reviewed.",
      detail:
        "No browser approval buttons, automatic provisioning, invite delivery, or Auth user creation.",
      id: "public_request_intake_dry_run",
      state: "pending",
      title: "Public request intake dry-run",
    },
    {
      command:
        "Prepare invite/Auth no-send and no-create dry-run artifacts.",
      detail:
        "No email sending, notifications, magic links, Auth users, or automatic grants.",
      id: "invite_auth_dry_run_gates",
      state: "blocked",
      title: "Invite/Auth no-send gates",
    },
    {
      command:
        "Prepare live-provider, revenue, POS, access-control, and member-ledger proof tracks separately.",
      detail:
        "No provider activation or account-system writes are allowed from this batch.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider/revenue/member-system tracks",
    },
  ];

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-launch-controls:batch",
        ].join(" \\\n "),
        detail:
          "Packages request-only public intake, invite/Auth no-send dry runs, and blocked live-provider/revenue/member-system proof tracks.",
        label: "Prepare public launch controls batch",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-launch-controls:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent preflight SHA and keeps public launch, invites, Auth creation, providers, revenue, POS, access-control, and member-ledger writes blocked.",
        label: "Inspect public launch controls batch",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires public self-serve launch preflight; this batch does not authorize public launch.",
        label: "Launch preflight prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Public request intake is request-only and human-reviewed; browser approval and automatic provisioning remain blocked.",
        label: "Public request intake boundary",
        state: "blocked",
      },
      {
        detail:
          "Invite/Auth stays no-send/no-create, and providers/revenue/member-system writes remain separate proof tracks.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages public launch controls without enabling public signup, invite delivery, Auth user creation, providers, or revenue/member-system writes."
      : "Public launch controls batch waits protected Preview URL and hosted Neon branch context.",
    title: "Public launch controls batch",
  };
}

export function founderAdminPublicLaunchNextReadinessBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const controlsPath = `artifacts/admin-launch-readiness/${branchSlug}-public-launch-controls-batch.json`;
  const nextBatchPath = `artifacts/admin-launch-readiness/${branchSlug}-public-launch-next-readiness-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Build the request-only public intake artifact and optional read-only Admin preview without accepting public submissions.",
      detail:
        "Human review remains required; no browser approval, owner provisioning, invite delivery, or Auth user creation.",
      id: "public_request_intake_artifact",
      state: "pending",
      title: "Request-only public intake artifact",
    },
    {
      command:
        "Prepare invite/Auth no-send and no-create proof records from reviewed request metadata.",
      detail:
        "No email, notifications, magic links, product Auth admin API, Auth users, or automatic grants.",
      id: "invite_auth_no_send_no_create_records",
      state: "blocked",
      title: "Invite/Auth no-send/no-create records",
    },
    {
      command:
        "Prepare live-provider, revenue, POS, access-control, and member-ledger proof tracks as blocked runbooks.",
      detail:
        "No provider ingress/egress, billing, POS, access-control, or member-ledger writes.",
      id: "live_provider_revenue_member_system_runbooks",
      state: "blocked",
      title: "Live-provider/revenue/member-system runbooks",
    },
    {
      command:
        "Run another real limited beta operator-assisted onboarding review before public launch.",
      detail:
        "Public launch decision remains blocked until a non-House-of-Fitness real gym review is recorded.",
      id: "limited_beta_operator_onboarding_review",
      state: "blocked",
      title: "Limited beta onboarding review",
    },
  ];

  return {
    artifactPath: nextBatchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH=${shellSingleQuote(
            controlsPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH=${shellSingleQuote(
            nextBatchPath,
          )}`,
          "npm run admin:public-launch-next:batch",
        ].join(" \\\n "),
        detail:
          "Packages the current request-only intake, invite/Auth no-send/no-create, live-provider/revenue/member-system, and limited-beta review tracks from the public launch controls parent.",
        label: "Prepare public launch next readiness batch",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH=${shellSingleQuote(
            nextBatchPath,
          )}`,
          "npm run admin:public-launch-next:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA and keeps public submissions, browser approvals, invite/Auth creation, live providers, revenue, POS, access control, and member-ledger writes blocked.",
        label: "Inspect public launch next readiness batch",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires public launch controls batch; this package does not authorize public launch.",
        label: "Launch controls prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Public intake remains request-only and human-reviewed with no public form submission or browser approval.",
        label: "Request-only intake boundary",
        state: "blocked",
      },
      {
        detail:
          "Invite/Auth remains no-send/no-create, live providers and revenue/member-system writes remain separate blocked proof tracks, and limited beta review is still required.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the next public-launch readiness set without enabling public submissions, invite delivery, Auth user creation, live providers, or revenue/member-system writes."
      : "Public launch next readiness batch waits protected Preview URL and hosted Neon branch context.",
    title: "Public launch next readiness batch",
  };
}

export function founderAdminPublicRequestIntakeArtifact(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const parentPath = `artifacts/admin-launch-readiness/${branchSlug}-public-launch-next-readiness-batch.json`;
  const artifactPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-intake-artifact.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Prepare invite/Auth no-send and no-create records from reviewed request metadata.",
      detail:
        "No email, notifications, magic links, product Auth admin API, Auth users, or automatic grants.",
      id: "invite_auth_no_send_no_create_records",
      state: "blocked",
      title: "Invite/Auth no-send/no-create records",
    },
    {
      command:
        "Prepare live-provider, revenue, POS, access-control, and member-ledger proof tracks as blocked runbooks.",
      detail:
        "No provider ingress/egress, billing, POS, access-control, or member-ledger writes.",
      id: "live_provider_revenue_member_system_runbooks",
      state: "blocked",
      title: "Live-provider/revenue/member-system runbooks",
    },
    {
      command:
        "Run another real limited beta operator-assisted onboarding review before public launch.",
      detail:
        "Public launch decision remains blocked until a non-House-of-Fitness real gym review is recorded.",
      id: "limited_beta_operator_onboarding_review",
      state: "blocked",
      title: "Limited beta onboarding review",
    },
  ];

  return {
    artifactPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_LAUNCH_NEXT_READINESS_BATCH_PATH=${shellSingleQuote(
            parentPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH=${shellSingleQuote(
            artifactPath,
          )}`,
          "npm run admin:public-request-intake:artifact",
        ].join(" \\\n "),
        detail:
          "Writes a request-only, read-only public intake artifact for operator review without accepting public submissions.",
        label: "Prepare public request intake artifact",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH=${shellSingleQuote(
            artifactPath,
          )}`,
          "npm run admin:public-request-intake:artifact:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA, request-only/no-persistence mode, read-only Admin preview, and all no-send/no-create/no-live-provider gates.",
        label: "Inspect public request intake artifact",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires public launch next readiness batch; this artifact does not accept public submissions.",
        label: "Next readiness prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Admin preview is read-only: no public submit, approval, owner provisioning, or invite send buttons.",
        label: "Read-only Admin preview",
        state: "blocked",
      },
      {
        detail:
          "Invite/Auth, live providers, revenue systems, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Prepares request-only public intake review data without enabling public submissions, approvals, provisioning, invites, Auth creation, or live providers."
      : "Public request intake artifact waits protected Preview URL and hosted Neon branch context.",
    title: "Public request intake artifact",
  };
}

export function founderAdminPublicRequestFollowupReadinessBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const parentPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-intake-artifact.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-followup-readiness-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Prepare owner/staff handoff evidence only after a reviewed request is selected.",
      detail:
        "Owner access remains operator-managed; staff invite delivery remains no-send.",
      id: "owner_staff_handoff_readiness_batch",
      state: "blocked",
      title: "Owner/staff handoff readiness",
    },
    {
      command:
        "Run hosted rehearsal for the approved non-House-of-Fitness gym before customer walkthrough.",
      detail:
        "No public launch or provider activation is implied by rehearsal readiness.",
      id: "approved_gym_hosted_rehearsal_readiness_batch",
      state: "blocked",
      title: "Approved-gym hosted rehearsal",
    },
    {
      command:
        "Assemble first-gym go/no-go bundle only after the real limited beta review is recorded.",
      detail:
        "Public self-serve, invite delivery, providers, billing, POS, and member writes stay blocked.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "First-gym go/no-go bundle",
    },
  ];

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_INTAKE_ARTIFACT_PATH=${shellSingleQuote(
            parentPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FOLLOWUP_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-request-followup:batch",
        ].join(" \\\n "),
        detail:
          "Packages invite/Auth no-send/no-create records, blocked live-provider/revenue/member runbooks, and limited beta review requirements.",
        label: "Prepare public request follow-up batch",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FOLLOWUP_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-request-followup:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA, metadata-only invite/Auth records, blocked runbooks, limited beta review gate, and all no-live-provider gates.",
        label: "Inspect public request follow-up batch",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires the request-only public intake artifact; no public submission is accepted here.",
        label: "Request intake artifact prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Invite/Auth records are metadata-only: no email, magic link, Auth user, product Auth admin API, or automatic grant.",
        label: "Invite/Auth no-send/no-create",
        state: "blocked",
      },
      {
        detail:
          "Live-provider, revenue, POS, access-control, and member-ledger work remains blocked runbook-only.",
        label: "Provider/revenue/member runbooks",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the current public request follow-up readiness set without sending invites, creating Auth users, enabling providers, or allowing launch."
      : "Public request follow-up readiness waits protected Preview URL and hosted Neon branch context.",
    title: "Public request follow-up readiness batch",
  };
}

export function founderAdminPublicRequestOwnerStaffHandoffReadinessBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const parentPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-followup-readiness-batch.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-owner-staff-handoff-readiness-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Prepare approved-gym hosted rehearsal readiness from this owner/staff bridge.",
      detail:
        "Owner access and staff handoff remain operator-managed; customer-observed proof stays separate.",
      id: "approved_gym_hosted_rehearsal_readiness_batch",
      state: "blocked",
      title: "Approved-gym hosted rehearsal readiness",
    },
    {
      command:
        "Record first-gym go/no-go only after hosted rehearsal and real customer-observed evidence.",
      detail:
        "No public launch, provider activation, invite send, or revenue/member writes.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "First-gym go/no-go bundle",
    },
    {
      command:
        "Keep public self-serve launch preflight blocked until limited beta review is green.",
      detail:
        "Public signup, browser approvals, Auth creation, automatic grants, and invite delivery remain blocked.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve launch gate",
    },
  ];

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FOLLOWUP_READINESS_BATCH_PATH=${shellSingleQuote(
            parentPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-request-owner-staff:batch",
        ].join(" \\\n "),
        detail:
          "Packages operator-managed owner access, staff no-send handoff, and hosted rehearsal prerequisites from the current public-request chain.",
        label: "Prepare public request owner/staff handoff batch",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-request-owner-staff:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA, owner/staff no-send/no-create boundaries, pending customer proof, and all no-live-provider gates.",
        label: "Inspect public request owner/staff handoff batch",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires the current-chain public request follow-up readiness batch.",
        label: "Follow-up readiness prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Owner access is operator-managed evidence only; this does not provision owners or create Auth users.",
        label: "Operator-managed owner access",
        state: "blocked",
      },
      {
        detail:
          "Staff handoff stays no-send and no-create; live providers and revenue/member systems remain blocked.",
        label: "Staff no-send/live gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Bridges reviewed public request follow-up into owner/staff handoff readiness without provisioning, sending invites, creating Auth users, or enabling providers."
      : "Public request owner/staff handoff readiness waits protected Preview URL and hosted Neon branch context.",
    title: "Public request owner/staff handoff readiness",
  };
}

export function founderAdminPublicRequestHostedRehearsalReadinessBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const parentPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-owner-staff-handoff-readiness-batch.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-hosted-rehearsal-readiness-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Record first-gym go/no-go only after hosted rehearsal and real customer-observed evidence.",
      detail:
        "Bundle owner workspace, staff handoff, reset/rollback, no unexpected data, and no-live-provider proof before any gym onboarding decision.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "First-gym go/no-go bundle",
    },
    {
      command:
        "Keep public self-serve launch preflight blocked until limited beta review is green.",
      detail:
        "Public signup, browser approvals, Auth creation, automatic grants, and invite delivery remain blocked.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve launch gate",
    },
    {
      command:
        "Keep phone/email providers, revenue systems, POS, access control, and member-ledger writes blocked.",
      detail:
        "Live provider and revenue-member-system work remains outside this readiness batch.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_OWNER_STAFF_HANDOFF_READINESS_BATCH_PATH=${shellSingleQuote(
            parentPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-request-hosted-rehearsal:batch",
        ].join(" \\\n "),
        detail:
          "Packages the current-chain hosted browser rehearsal prerequisites without recording customer-observed or launch proof.",
        label: "Prepare public request hosted rehearsal batch",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-request-hosted-rehearsal:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA, browser-rehearsal-required flags, customer proof pending, and all no-live-provider gates.",
        label: "Inspect public request hosted rehearsal batch",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires the current-chain public request owner/staff handoff readiness batch.",
        label: "Owner/staff handoff prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Owner workspace, staff workboard, reset/rollback, no unexpected data, and no-live-provider checks remain required.",
        label: "Hosted browser rehearsal",
        state: "blocked",
      },
      {
        detail:
          "Customer-observed walkthrough and first-gym go/no-go bundle remain separate later gates.",
        label: "Customer proof gates",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages current-chain hosted rehearsal readiness while browser proof, customer-observed walkthrough, and first-gym go/no-go remain separate gates."
      : "Public request hosted rehearsal readiness waits protected Preview URL and hosted Neon branch context.",
    title: "Public request hosted rehearsal readiness",
  };
}

export function founderAdminPublicRequestHostedRehearsalEvidence(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const readinessPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-hosted-rehearsal-readiness-batch.json`;
  const evidencePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-hosted-rehearsal-evidence.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Record the real customer-observed session and hosted digest proof when the owner attends.",
      detail:
        "Hosted rehearsal evidence alone does not claim customer-observed completion.",
      id: "customer_observed_handoff_gate",
      state: "blocked",
      title: "Customer-observed session proof",
    },
    {
      command:
        "Prepare first-gym go/no-go after hosted rehearsal and customer-observed proof both exist.",
      detail:
        "First-gym run stays blocked until the go/no-go bundle is green.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "First-gym go/no-go bundle",
    },
    {
      command:
        "Keep public self-serve, invite delivery, providers, billing, POS, access control, and member-ledger writes blocked.",
      detail:
        "Live-provider and revenue/member-system work remains separate proof.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Public/live-provider gates",
    },
  ];

  return {
    artifactPath: evidencePath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH=${shellSingleQuote(
            readinessPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH=${shellSingleQuote(
            evidencePath,
          )}`,
          "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_OWNER_WORKSPACE_OBSERVED=yes",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_STAFF_WORKBOARD_OBSERVED=yes",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_RESET_ROLLBACK_REVIEWED=yes",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_UNEXPECTED_DATA_NOT_OBSERVED=yes",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED=yes",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_INVITE_DELIVERY_NOT_OBSERVED=yes",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_REHEARSAL_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED=yes",
          "npm run admin:public-request-hosted-rehearsal:evidence",
        ].join(" \\\n "),
        detail:
          "Records non-secret current-chain hosted rehearsal evidence after operator/browser verification while customer proof remains separate.",
        label: "Record public request hosted rehearsal evidence",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH=${shellSingleQuote(
            evidencePath,
          )}`,
          "npm run admin:public-request-hosted-rehearsal:evidence:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA, observation confirmations, no-live-provider gates, and customer/go-no-go proof still blocked.",
        label: "Inspect public request hosted rehearsal evidence",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires the current-chain public request hosted rehearsal readiness batch.",
        label: "Hosted rehearsal readiness prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Owner workspace, staff workboard, reset/rollback, no unexpected data, no invite delivery, no-live-provider, and no billing/POS/member-write confirmations are required.",
        label: "Observed rehearsal checks",
        state: "blocked",
      },
      {
        detail:
          "Customer-observed session, hosted customer-session proof, go/no-go, first-gym run, and launch remain separate gates.",
        label: "Customer/go-no-go proof gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Records current-chain hosted rehearsal evidence without claiming customer-observed completion, go/no-go, first-gym run, or public/live-provider readiness."
      : "Public request hosted rehearsal evidence waits protected Preview URL and hosted Neon branch context.",
    title: "Public request hosted rehearsal evidence",
  };
}

export function founderAdminPublicRequestCustomerSessionProofAcquisitionBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const evidencePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-hosted-rehearsal-evidence.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-customer-session-proof-acquisition-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Record the real customer-observed session only when the owner attends.",
      detail:
        "Hosted rehearsal evidence does not claim customer attendance or session completion.",
      id: "customer_observed_handoff_gate",
      state: "blocked",
      title: "Customer-observed session proof",
    },
    {
      command:
        "Import and prove the sanitized customer-session digest in hosted Neon after the real session record exists.",
      detail:
        "Hosted proof remains blocked until the customer session record is real and inspected.",
      id: "hosted_customer_session_proof",
      state: "blocked",
      title: "Hosted customer-session proof",
    },
    {
      command:
        "Prepare first-gym go/no-go after hosted rehearsal and customer-session proof both exist.",
      detail:
        "First-gym run stays blocked until the go/no-go bundle is green.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "First-gym go/no-go bundle",
    },
    {
      command:
        "Keep public self-serve, invite delivery, providers, billing, POS, access control, and member-ledger writes blocked.",
      detail:
        "Live-provider and revenue/member-system work remains separate proof.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Public/live-provider gates",
    },
  ];

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH=${shellSingleQuote(
            evidencePath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_CUSTOMER_SESSION_PROOF_ACQUISITION_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-request-customer-session:proof-acquisition",
        ].join(" \\\n "),
        detail:
          "Packages the current-chain customer-session proof command path from hosted rehearsal evidence without recording customer proof.",
        label: "Prepare customer-session proof acquisition",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_CUSTOMER_SESSION_PROOF_ACQUISITION_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-request-customer-session:proof-acquisition:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA, hosted rehearsal evidence, customer-session proof still blocked, and all no-live-provider gates.",
        label: "Inspect customer-session proof acquisition",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires the current-chain public request hosted rehearsal evidence artifact.",
        label: "Hosted rehearsal evidence prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The real owner-observed session record remains a separate terminal command with explicit owner presence confirmations.",
        label: "Customer session record",
        state: "blocked",
      },
      {
        detail:
          "Hosted customer-session import, first-gym go/no-go, first-gym run, public launch, and live-provider work remain separate gates.",
        label: "Downstream proof gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the customer-session proof command path without claiming customer-observed completion, hosted proof, go/no-go, first-gym run, or public/live-provider readiness."
      : "Public request customer-session proof acquisition waits protected Preview URL and hosted Neon branch context.",
    title: "Public request customer-session proof acquisition",
  };
}

export function founderAdminPublicRequestFirstGymGoNoGoReadinessBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const parentPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-hosted-rehearsal-readiness-batch.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-go-no-go-readiness-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run approved-gym hosted browser rehearsal evidence and real customer-observed session, then prepare the first-gym go/no-go bundle.",
      detail:
        "This readiness artifact does not itself record the bundle or approve the first-gym run.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "First-gym go/no-go bundle",
    },
    {
      command:
        "Keep public self-serve launch preflight blocked until limited beta review is green.",
      detail:
        "Public signup, browser approvals, Auth creation, automatic grants, and invite delivery remain blocked.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve launch gate",
    },
    {
      command:
        "Keep phone/email providers, revenue systems, POS, access control, and member-ledger writes blocked.",
      detail:
        "Live provider and revenue-member-system work remains outside this readiness batch.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_READINESS_BATCH_PATH=${shellSingleQuote(
            parentPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-request-first-gym:go-no-go:batch",
        ].join(" \\\n "),
        detail:
          "Packages the current-chain first-gym go/no-go prerequisites while real hosted rehearsal evidence and customer-observed session remain required.",
        label: "Prepare public request first-gym go/no-go readiness",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-request-first-gym:go-no-go:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA, real-evidence-required flags, bundle blocked state, and all no-live-provider gates.",
        label: "Inspect public request first-gym go/no-go readiness",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires the current-chain public request hosted rehearsal readiness batch.",
        label: "Hosted rehearsal readiness prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Hosted rehearsal evidence and real customer-observed session must exist before the actual first-gym go/no-go bundle.",
        label: "Real evidence required",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages current-chain first-gym go/no-go prerequisites while the real hosted rehearsal evidence, customer session, and go/no-go bundle remain separate gates."
      : "Public request first-gym go/no-go readiness waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym go/no-go readiness",
  };
}

export function founderAdminPublicRequestFirstGymEvidenceAcquisitionBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const parentPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-go-no-go-readiness-batch.json`;
  const batchPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-evidence-acquisition-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run the real hosted rehearsal evidence command after operator/browser proof.",
      detail:
        "This packet only prepares the command path; it does not record evidence.",
      id: "approved_gym_hosted_rehearsal_evidence",
      state: "blocked",
      title: "Hosted rehearsal evidence",
    },
    {
      command:
        "Run the real customer-observed session record and hosted digest proof when the owner attends.",
      detail:
        "Customer-observed completion stays outside this packet.",
      id: "customer_observed_handoff_gate",
      state: "blocked",
      title: "Customer-observed session proof",
    },
    {
      command:
        "Prepare the first-gym go/no-go bundle and first operator-assisted run record only after both evidence records exist.",
      detail:
        "This remains operator-assisted beta, not public self-serve launch.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "First-gym run evidence",
    },
    {
      command:
        "Keep public self-serve, invite delivery, providers, billing, POS, access control, and member-ledger writes blocked.",
      detail:
        "Live-provider and revenue/member-system work remains separate proof.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Public/live-provider gates",
    },
  ];

  return {
    artifactPath: batchPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_READINESS_BATCH_PATH=${shellSingleQuote(
            parentPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-request-first-gym:evidence-acquisition",
        ].join(" \\\n "),
        detail:
          "Packages the current-chain command sequence for hosted rehearsal evidence, customer-observed proof, hosted import, go/no-go, and first-gym run without recording any of them.",
        label: "Prepare public request first-gym evidence acquisition",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH=${shellSingleQuote(
            batchPath,
          )}`,
          "npm run admin:public-request-first-gym:evidence-acquisition:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA, evidence command sequence, all unrecorded proof flags, and blocked public/live-provider gates.",
        label: "Inspect public request first-gym evidence acquisition",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires the current-chain public request first-gym go/no-go readiness batch.",
        label: "Go/no-go readiness prerequisite",
        state: "blocked",
      },
      {
        detail:
          "This packet lists the real commands but does not record hosted rehearsal, customer, hosted import, go/no-go, or run proof.",
        label: "Evidence remains unrecorded",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages current-chain first-gym evidence acquisition commands while every real proof record and public/live-provider gate remains blocked."
      : "Public request first-gym evidence acquisition waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym evidence acquisition",
  };
}

export function founderAdminPublicRequestFirstGymGoNoGoBundle(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const evidencePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-hosted-rehearsal-evidence.json`;
  const customerSessionPath = `artifacts/admin-launch-readiness/${branchSlug}-customer-observed-session-record.json`;
  const bundlePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-go-no-go-bundle.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command: "npm run admin:public-request-first-gym:run",
      detail:
        "Record only after the operator-assisted first-gym run actually completes.",
      id: "first_gym_operator_assisted_run",
      state: "pending",
      title: "Public-request first-gym run",
    },
    {
      command: "npm run admin:limited-beta:operator-review",
      detail:
        "Limited beta review waits for the first-gym run evidence, not just the bundle.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "blocked",
      title: "Limited beta operator review",
    },
    {
      command:
        "Keep public signup, invites, providers, billing, POS, access control, and member-ledger writes blocked.",
      detail:
        "Live-provider and revenue/member-system work remains separate proof.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Public/live-provider gates",
    },
  ];

  return {
    artifactPath: bundlePath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH=${shellSingleQuote(
            evidencePath,
          )}`,
          `OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH=${shellSingleQuote(
            customerSessionPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH=${shellSingleQuote(
            bundlePath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PREVIEW_URL=${shellSingleQuote(
            previewUrl,
          )}`,
          `OUTPOST_NEON_BRANCH_NAME=${shellSingleQuote(branchName)}`,
          "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_PASSED='yes'",
          "OUTPOST_ADMIN_CUSTOMER_SESSION_HOSTED_PROOF_OPERATOR='<operator-name>'",
          "npm run admin:public-request-first-gym:go-no-go:bundle",
        ].join(" \\\n "),
        detail:
          "Bundles current-chain hosted rehearsal evidence, real customer session proof, and hosted customer-session proof confirmation.",
        label: "Prepare public request first-gym go/no-go bundle",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH=${shellSingleQuote(
            bundlePath,
          )}`,
          "npm run admin:public-request-first-gym:go-no-go:bundle:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA links, hosted proof confirmation, first-gym readiness, and blocked public/live-provider gates.",
        label: "Inspect public request first-gym go/no-go bundle",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires current-chain hosted rehearsal evidence and customer-observed session record.",
        label: "Current-chain evidence required",
        state: "blocked",
      },
      {
        detail:
          "Requires hosted customer-session proof to pass before packaging the bundle.",
        label: "Hosted proof required",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages current-chain first-gym go/no-go evidence without approving public self-serve or live-provider work."
      : "Public request first-gym go/no-go bundle waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym go/no-go bundle",
  };
}

export function founderAdminPublicRequestFirstGymProofRunwayBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const evidencePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-evidence-acquisition-batch.json`;
  const runwayPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-runway-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run the real first-gym proof commands in sequence when customer/hosted evidence exists.",
      detail:
        "The runway does not record proof; it keeps the next execution batch explicit.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Real first-gym proof execution",
    },
    {
      command:
        "Review first-gym run evidence before expanding to another approved beta gym.",
      detail: "Owner access stays operator-managed.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "blocked",
      title: "Limited beta operator review",
    },
    {
      command:
        "Keep public self-serve, invite, provider, revenue, POS, access-control, and member-ledger gates separate.",
      detail: "This runway does not authorize public launch.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Public/live-provider gates",
    },
  ];

  return {
    artifactPath: runwayPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_ACQUISITION_BATCH_PATH=${shellSingleQuote(
            evidencePath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH=${shellSingleQuote(
            runwayPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-runway",
        ].join(" \\\n "),
        detail:
          "Packages the next real proof execution sequence without recording customer, hosted, go/no-go, run, limited-beta, or launch proof.",
        label: "Prepare public request first-gym proof runway",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH=${shellSingleQuote(
            runwayPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-runway:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies parent SHA, terminal-only mode, required command sequence, and blocked public/live-provider gates.",
        label: "Inspect public request first-gym proof runway",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires the current-chain first-gym evidence acquisition packet.",
        label: "Evidence acquisition prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The runway lists proof commands but does not record customer, hosted, go/no-go, run, or limited-beta proof.",
        label: "Proof remains unrecorded",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the current-chain first-gym proof execution runway while every proof-recording and public/live-provider gate remains blocked."
      : "Public request first-gym proof runway waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym proof runway",
  };
}

export function founderAdminPublicRequestFirstGymExecutionLedger(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const runwayPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-runway-batch.json`;
  const ledgerPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-execution-ledger.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command: "Run missing proof commands until their artifacts inspect cleanly.",
      detail:
        "The ledger re-inspects present artifacts and leaves missing proof explicit.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Real first-gym proof execution",
    },
    {
      command:
        "Review limited beta only after first-gym operator-run evidence exists.",
      detail: "Owner access remains operator-managed.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "blocked",
      title: "Limited beta operator review",
    },
    {
      command:
        "Keep public self-serve, invite, provider, revenue, POS, access-control, and member-ledger gates separate.",
      detail: "This ledger does not authorize public launch.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Public/live-provider gates",
    },
  ];

  return {
    artifactPath: ledgerPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_RUNWAY_BATCH_PATH=${shellSingleQuote(
            runwayPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH=${shellSingleQuote(
            ledgerPath,
          )}`,
          "npm run admin:public-request-first-gym:execution-ledger",
        ].join(" \\\n "),
        detail:
          "Writes a status-only ledger that re-inspects any present first-gym proof artifacts and lists missing proof without claiming completion.",
        label: "Prepare public request first-gym execution ledger",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH=${shellSingleQuote(
            ledgerPath,
          )}`,
          "npm run admin:public-request-first-gym:execution-ledger:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies the proof runway SHA, child artifact states, and blocked public/live-provider gates.",
        label: "Inspect public request first-gym execution ledger",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires the proof runway packet; it does not replace customer or hosted proof.",
        label: "Proof runway prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Present child artifacts must pass their own inspectors; missing proof remains visible.",
        label: "Child proof re-inspection",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Tracks which current-chain first-gym proof artifacts are missing or inspectable while public/live-provider gates remain blocked."
      : "Public request first-gym execution ledger waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym execution ledger",
  };
}

export function founderAdminPublicRequestFirstGymMissingProofPacket(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const ledgerPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-execution-ledger.json`;
  const packetPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-missing-proof-packet.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run the packet's first missing command, regenerate the execution ledger, then regenerate this packet.",
      detail:
        "The packet is a queue over real proof artifacts; it does not record completion.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Execute next missing proof",
    },
    {
      command: "npm run admin:public-request-first-gym:completion-gate",
      detail:
        "The completion gate stays blocked until every execution-ledger child artifact inspects cleanly.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "First-gym completion gate",
    },
    {
      command:
        "Only after completion gate readiness, prepare limited beta review and public self-serve preflight as separate blocked tracks.",
      detail: "Public/live-provider/revenue/member-system gates remain separate.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Downstream gated review",
    },
  ];

  return {
    artifactPath: packetPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH=${shellSingleQuote(
            ledgerPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH=${shellSingleQuote(
            packetPath,
          )}`,
          "npm run admin:public-request-first-gym:missing-proof",
        ].join(" \\\n "),
        detail:
          "Builds an ordered terminal command packet from whatever proof artifacts the execution ledger still marks missing.",
        label: "Prepare public request first-gym missing proof packet",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH=${shellSingleQuote(
            packetPath,
          )}`,
          "npm run admin:public-request-first-gym:missing-proof:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies the execution-ledger SHA, missing command order, and blocked public/live-provider gates.",
        label: "Inspect public request first-gym missing proof packet",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current execution ledger.",
        label: "Execution ledger prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The packet only queues missing terminal commands; it cannot claim proof or limited beta readiness.",
        label: "Command packet only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Turns the execution ledger's missing proof into an ordered terminal command queue without recording completion."
      : "Public request first-gym missing proof packet waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym missing proof packet",
  };
}

export function founderAdminPublicRequestFirstGymCompletionGate(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const ledgerPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-execution-ledger.json`;
  const gatePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-completion-gate.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command: "npm run admin:public-request-first-gym:run",
      detail:
        "Only use the real first-gym run recorder once the go/no-go bundle and customer proof exist.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "First-gym operator run evidence",
    },
    {
      command: "npm run admin:public-request:limited-beta:operator-review",
      detail:
        "Limited beta review remains blocked until the first-gym run artifact is inspectable.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "blocked",
      title: "Limited beta operator review",
    },
    {
      command:
        "Keep public self-serve launch and live-provider/revenue/member-system gates separate.",
      detail: "The completion gate cannot authorize launch.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Public/live-provider gates",
    },
  ];

  return {
    artifactPath: gatePath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EXECUTION_LEDGER_PATH=${shellSingleQuote(
            ledgerPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH=${shellSingleQuote(
            gatePath,
          )}`,
          "npm run admin:public-request-first-gym:completion-gate",
        ].join(" \\\n "),
        detail:
          "Derives a blocked-or-ready completion gate from the execution ledger without enabling public launch.",
        label: "Prepare public request first-gym completion gate",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH=${shellSingleQuote(
            gatePath,
          )}`,
          "npm run admin:public-request-first-gym:completion-gate:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies the execution-ledger SHA, derived gate state, and blocked public/live-provider gates.",
        label: "Inspect public request first-gym completion gate",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current execution ledger with all child proof states.",
        label: "Execution ledger prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The gate becomes ready only when every real proof artifact is inspectable.",
        label: "All proof artifacts inspectable",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Derives the first-gym proof completion gate from the execution ledger while public/live-provider gates remain blocked."
      : "Public request first-gym completion gate waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym completion gate",
  };
}

export function founderAdminPublicRequestFirstGymProofSessionRunbook(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const packetPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-missing-proof-packet.json`;
  const gatePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-completion-gate.json`;
  const runbookPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-runbook.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Use the runbook to execute missing proof commands with the owner present.",
      detail:
        "The runbook is customer-safe guidance only; proof still comes from dedicated record commands.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Customer-observed proof session",
    },
    {
      command:
        "Regenerate the execution ledger, missing-proof packet, completion gate, and runbook after each proof command.",
      detail:
        "This keeps the operator packet aligned with the latest inspected artifacts.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Refresh proof state",
    },
    {
      command:
        "Only after real first-gym run evidence, prepare limited beta review.",
      detail: "Public self-serve and live-provider gates remain separate.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "blocked",
      title: "Limited beta review",
    },
  ];

  return {
    artifactPath: runbookPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_MISSING_PROOF_PACKET_PATH=${shellSingleQuote(
            packetPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_COMPLETION_GATE_PATH=${shellSingleQuote(
            gatePath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH=${shellSingleQuote(
            runbookPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-runbook",
        ].join(" \\\n "),
        detail:
          "Builds a customer-safe operator runbook from the missing-proof packet and completion gate.",
        label: "Prepare public request first-gym proof session runbook",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH=${shellSingleQuote(
            runbookPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-runbook:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies packet/gate SHA lineage, command sequence, stop conditions, and blocked public/live-provider gates.",
        label: "Inspect public request first-gym proof session runbook",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current missing-proof packet and completion gate.",
        label: "Execution control prerequisites",
        state: "blocked",
      },
      {
        detail:
          "The runbook cannot record customer completion, first-gym run success, or limited beta review.",
        label: "Runbook only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the current first-gym proof session commands and stop conditions without recording proof or enabling launch gates."
      : "Public request first-gym proof session runbook waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym proof session runbook",
  };
}

export function founderAdminPublicRequestFirstGymProofSessionExecutionPack(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const runbookPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-runbook.json`;
  const packPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-execution-pack.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Use the execution pack as the operator worksheet during the proof session.",
      detail:
        "The pack lists preflight observations and expected evidence without recording any proof.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Run proof session with owner present",
    },
    {
      command:
        "Run the dedicated proof command for the next missing evidence item, then regenerate ledger/control/runbook/pack.",
      detail:
        "Each proof claim must come from its own inspected artifact, not this execution pack.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Refresh after each proof command",
    },
    {
      command:
        "Prepare limited beta review only after first-gym operator-run evidence is inspectable.",
      detail: "Public self-serve and live-provider gates remain separate.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "blocked",
      title: "Limited beta review",
    },
  ];

  return {
    artifactPath: packPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RUNBOOK_PATH=${shellSingleQuote(
            runbookPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH=${shellSingleQuote(
            packPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-execution-pack",
        ].join(" \\\n "),
        detail:
          "Builds the customer-safe preflight, worksheet, and expected evidence manifest from the runbook.",
        label: "Prepare public request first-gym proof session execution pack",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH=${shellSingleQuote(
            packPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-execution-pack:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies runbook SHA lineage, worksheet/evidence ordering, and blocked public/live-provider gates.",
        label: "Inspect public request first-gym proof session execution pack",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current proof-session runbook.",
        label: "Runbook prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The execution pack cannot record customer completion, first-gym run success, or limited beta review.",
        label: "Execution pack only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the operator preflight, worksheet, and expected evidence manifest for the proof session without recording proof."
      : "Public request first-gym proof session execution pack waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym proof session execution pack",
  };
}

export function founderAdminPublicRequestFirstGymProofSessionProgressBatch(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const packPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-execution-pack.json`;
  const progressPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-progress-batch.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run the next missing dedicated proof command from the progress batch, then regenerate progress.",
      detail:
        "The progress batch is status-only; each proof claim still comes from its own inspected artifact.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Run next missing proof command",
    },
    {
      command:
        "When every expected evidence item is inspectable, run the dedicated first-gym follow-up commands.",
      detail:
        "Completion here only means the follow-up commands can be considered; it does not approve launch.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Check proof session completion",
    },
    {
      command:
        "Keep public self-serve, live-provider, and revenue/member-system gates separate until their own proof tracks are green.",
      detail:
        "No public launch decision, provider activation, billing, POS, access-control, or member-ledger write is enabled here.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Keep launch gates separate",
    },
  ];

  return {
    artifactPath: progressPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_EXECUTION_PACK_PATH=${shellSingleQuote(
            packPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH=${shellSingleQuote(
            progressPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-progress",
        ].join(" \\\n "),
        detail:
          "Re-inspects expected proof-session evidence, marks missing artifacts, and writes the next-step packet.",
        label: "Prepare public request first-gym proof session progress",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH=${shellSingleQuote(
            progressPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-progress:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies execution-pack SHA lineage, evidence states, next command, completion state, and blocked launch/live-provider gates.",
        label: "Inspect public request first-gym proof session progress",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current proof-session execution pack.",
        label: "Execution pack prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Progress is refreshed from inspected evidence artifacts and cannot record proof by itself.",
        label: "Status-only progress",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Refreshes first-gym proof session progress from expected evidence artifacts and exposes the next missing command without recording proof."
      : "Public request first-gym proof session progress waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym proof session progress",
  };
}

export function founderAdminPublicRequestFirstGymProofSessionResumePacket(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const progressPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-progress-batch.json`;
  const resumePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-resume-packet.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run the next missing proof command from the resume packet, then regenerate progress and resume.",
      detail:
        "The resume packet is a snapshot; regenerate it after any evidence command changes state.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Resume proof session",
    },
    {
      command:
        "If every expected evidence item is inspectable, move to dedicated first-gym follow-up commands.",
      detail:
        "The follow-up commands record go/no-go and operator-run evidence; this packet only guides the handoff.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Dedicated follow-up commands",
    },
    {
      command:
        "Keep public launch, invite, live-provider, and revenue/member-system gates separate.",
      detail:
        "No public launch, provider activation, billing, POS, access-control, or member-ledger readiness is recorded here.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Keep launch gates separate",
    },
  ];

  return {
    artifactPath: resumePath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_PROGRESS_BATCH_PATH=${shellSingleQuote(
            progressPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH=${shellSingleQuote(
            resumePath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-resume",
        ].join(" \\\n "),
        detail:
          "Builds an operator resume packet from the current progress snapshot, evidence inventory, next command, and support recovery checklist.",
        label: "Prepare public request first-gym proof session resume",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH=${shellSingleQuote(
            resumePath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-resume:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies progress SHA lineage, evidence inventory, resume commands, support checklist, and blocked launch/live-provider gates.",
        label: "Inspect public request first-gym proof session resume",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current proof-session progress batch.",
        label: "Progress prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The packet is an operator resume snapshot and cannot record proof, launch, provider, billing, POS, or member-system readiness.",
        label: "Resume only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the current proof-session progress snapshot into an operator resume and recovery packet without recording proof."
      : "Public request first-gym proof session resume waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym proof session resume",
  };
}

export function founderAdminPublicRequestFirstGymProofSessionDiagnostics(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const resumePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-resume-packet.json`;
  const diagnosticsPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-diagnostics.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run the next missing dedicated proof command, then regenerate progress, resume, and diagnostics.",
      detail:
        "Diagnostics is a chain summary and must be regenerated after any proof evidence changes.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Advance proof session",
    },
    {
      command:
        "If diagnostics reports every expected evidence item inspectable, use the dedicated first-gym follow-up commands.",
      detail:
        "The follow-up commands record go/no-go, operator-run, and limited beta evidence; diagnostics only verifies readiness.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Dedicated follow-up commands",
    },
    {
      command:
        "Keep public launch, invite, live-provider, and revenue/member-system gates separate.",
      detail:
        "No public launch, provider activation, billing, POS, access-control, or member-ledger readiness is recorded here.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Keep launch gates separate",
    },
  ];

  return {
    artifactPath: diagnosticsPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_RESUME_PACKET_PATH=${shellSingleQuote(
            resumePath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH=${shellSingleQuote(
            diagnosticsPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-diagnostics",
        ].join(" \\\n "),
        detail:
          "Builds a chain diagnostic from runbook, execution pack, progress, and resume so operators can see exactly what remains.",
        label: "Prepare public request first-gym proof session diagnostics",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH=${shellSingleQuote(
            diagnosticsPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-diagnostics:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies runbook, execution pack, progress, resume lineage, next operator actions, diagnostics guard, and blocked gates.",
        label: "Inspect public request first-gym proof session diagnostics",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current proof-session resume packet.",
        label: "Resume prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The diagnostic summarizes the proof-session chain and cannot record proof or launch readiness.",
        label: "Diagnostics only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Summarizes the proof-session chain, missing evidence, and next operator actions without recording proof."
      : "Public request first-gym proof session diagnostics waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym proof session diagnostics",
  };
}

export function founderAdminPublicRequestFirstGymProofSessionFollowupPreflight(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const diagnosticsPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-diagnostics.json`;
  const preflightPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-followup-preflight.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run the next missing dedicated proof command, then regenerate progress, resume, diagnostics, and follow-up preflight.",
      detail:
        "The follow-up preflight blocks until diagnostics says every expected evidence item is inspectable.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Complete missing proof evidence",
    },
    {
      command:
        "Once all expected evidence is inspectable, run the dedicated first-gym go/no-go bundle and operator-run commands.",
      detail:
        "This preflight only sequences those commands; the dedicated scripts remain the only writers for proof claims.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Run dedicated first-gym follow-up",
    },
    {
      command:
        "Keep public launch, invite, live-provider, and revenue/member-system gates separate.",
      detail:
        "No public launch, provider activation, billing, POS, access-control, or member-ledger readiness is recorded here.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Keep launch gates separate",
    },
  ];

  return {
    artifactPath: preflightPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_DIAGNOSTICS_PATH=${shellSingleQuote(
            diagnosticsPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-followup-preflight",
        ].join(" \\\n "),
        detail:
          "Converts diagnostics into a current follow-up decision: still blocked on evidence or ready for dedicated follow-up commands.",
        label:
          "Prepare public request first-gym proof session follow-up preflight",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-followup-preflight:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies diagnostics lineage, command sequencing, evidence summaries, follow-up guard, and blocked gates.",
        label:
          "Inspect public request first-gym proof session follow-up preflight",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current proof-session diagnostics artifact.",
        label: "Diagnostics prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The preflight can only sequence follow-up commands; it cannot record proof, launch, provider, billing, POS, or member-system readiness.",
        label: "Preflight only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Turns diagnostics into a safe follow-up preflight without recording proof or enabling launch gates."
      : "Public request first-gym proof session follow-up preflight waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym proof session follow-up preflight",
  };
}

export function founderAdminPublicRequestFirstGymProofSessionLaunchCheckpoint(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const preflightPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-followup-preflight.json`;
  const checkpointPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-launch-checkpoint.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run missing dedicated proof evidence, then regenerate progress, resume, diagnostics, follow-up preflight, and launch checkpoint.",
      detail:
        "The checkpoint remains blocked until follow-up preflight says all expected evidence is inspectable.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Complete proof evidence",
    },
    {
      command:
        "Use the existing go/no-go, first-gym run, and limited beta review scripts only with real hosted/customer evidence.",
      detail:
        "The checkpoint lists required operator inputs but does not record proof itself.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Run real proof commands",
    },
    {
      command:
        "Keep public launch, invite, live-provider, and revenue/member-system gates separate.",
      detail:
        "No public launch, provider activation, billing, POS, access-control, or member-ledger readiness is recorded here.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Keep launch gates separate",
    },
  ];

  return {
    artifactPath: checkpointPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_FOLLOWUP_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH=${shellSingleQuote(
            checkpointPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-launch-checkpoint",
        ].join(" \\\n "),
        detail:
          "Packages the current follow-up preflight into a real-session proof-command launch checkpoint without recording proof.",
        label:
          "Prepare public request first-gym proof session launch checkpoint",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH=${shellSingleQuote(
            checkpointPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-session-launch-checkpoint:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies follow-up preflight lineage, required operator inputs, command sequencing, checkpoint guard, and blocked gates.",
        label:
          "Inspect public request first-gym proof session launch checkpoint",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current proof-session follow-up preflight artifact.",
        label: "Follow-up preflight prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The checkpoint can only list stop/continue instructions and required inputs; it cannot record proof or launch readiness.",
        label: "Checkpoint only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the follow-up preflight into a proof-command launch checkpoint without recording proof or enabling public launch."
      : "Public request first-gym proof session launch checkpoint waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym proof session launch checkpoint",
  };
}

export function founderAdminPublicRequestFirstGymProofCommandExecutionEnvelope(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const checkpointPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-session-launch-checkpoint.json`;
  const envelopePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-command-execution-envelope.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Use this envelope only after launch checkpoint inspection is current and every expected evidence item is inspectable.",
      detail:
        "The envelope prepares command templates; the real proof writers still require real hosted/customer inputs.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Run real proof commands",
    },
    {
      command:
        "After each evidence-producing command, regenerate progress, resume, diagnostics, follow-up preflight, launch checkpoint, and this envelope.",
      detail:
        "The chain stays SHA-pinned so operators cannot accidentally use stale proof packets.",
      id: "public_request_first_gym_go_no_go_readiness_batch",
      state: "blocked",
      title: "Regenerate proof chain",
    },
    {
      command:
        "Keep public self-serve, invite delivery, providers, billing, POS, access control, and member-ledger writes blocked until separate proof tracks pass.",
      detail:
        "This batch intentionally stops before launch approval or live-provider/revenue activation.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Keep launch gates separate",
    },
  ];

  return {
    artifactPath: envelopePath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_SESSION_LAUNCH_CHECKPOINT_PATH=${shellSingleQuote(
            checkpointPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH=${shellSingleQuote(
            envelopePath,
          )}`,
          "npm run admin:public-request-first-gym:proof-command-execution-envelope",
        ].join(" \\\n "),
        detail:
          "Packages the launch checkpoint into command templates for a real proof-command run without recording proof.",
        label:
          "Prepare public request first-gym proof-command execution envelope",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH=${shellSingleQuote(
            envelopePath,
          )}`,
          "npm run admin:public-request-first-gym:proof-command-execution-envelope:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies launch-checkpoint lineage, command templates, evidence summaries, execution guard, and blocked gates.",
        label:
          "Inspect public request first-gym proof-command execution envelope",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current proof-session launch checkpoint artifact.",
        label: "Launch checkpoint prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The envelope only prepares exact command templates; it cannot record proof, run success, beta approval, or launch readiness.",
        label: "Execution envelope only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the launch checkpoint into proof-command templates without recording proof or enabling public launch."
      : "Public request first-gym proof-command execution envelope waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym proof-command execution envelope",
  };
}

export function founderAdminPublicRequestFirstGymProofEvidenceIntakeManifest(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const envelopePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-command-execution-envelope.json`;
  const manifestPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-evidence-intake-manifest.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Collect hosted rehearsal evidence and customer-observed session records from the protected Preview and hosted Neon proof branch.",
      detail:
        "This manifest lists required evidence rows but still records no proof itself.",
      id: "hosted_customer_session_proof",
      state: "blocked",
      title: "Collect real evidence",
    },
    {
      command:
        "Regenerate progress, resume, diagnostics, follow-up preflight, launch checkpoint, execution envelope, and intake manifest after each evidence-producing command.",
      detail:
        "The full chain must remain current before first-gym go/no-go, operator-run, and limited-beta review commands run.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Regenerate proof chain",
    },
    {
      command:
        "Keep public self-serve, invite delivery, providers, billing, POS, access control, and member-ledger writes blocked until separate proof tracks pass.",
      detail:
        "Evidence intake is not launch approval or live-provider readiness.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Keep launch gates separate",
    },
  ];

  return {
    artifactPath: manifestPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_COMMAND_EXECUTION_ENVELOPE_PATH=${shellSingleQuote(
            envelopePath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH=${shellSingleQuote(
            manifestPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-evidence-intake-manifest",
        ].join(" \\\n "),
        detail:
          "Turns the execution envelope missing-evidence list into operator intake rows without recording proof.",
        label:
          "Prepare public request first-gym proof evidence intake manifest",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH=${shellSingleQuote(
            manifestPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-evidence-intake-manifest:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies execution-envelope lineage, evidence intake rows, command templates, regeneration sequence, and blocked gates.",
        label:
          "Inspect public request first-gym proof evidence intake manifest",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current proof-command execution envelope artifact.",
        label: "Execution envelope prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The manifest can only list evidence intake rows; it cannot record proof, run success, beta approval, or launch readiness.",
        label: "Evidence intake only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Turns the execution envelope into evidence intake rows without recording proof or enabling public launch."
      : "Public request first-gym proof evidence intake manifest waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym proof evidence intake manifest",
  };
}

export function founderAdminPublicRequestFirstGymProofEvidenceSessionHandoff(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const manifestPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-evidence-intake-manifest.json`;
  const handoffPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-evidence-session-handoff.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Use the protected Preview and hosted Neon proof branch to run the evidence session; record proof only through the dedicated proof commands.",
      detail:
        "This packet is a customer-safe handoff surface and still records no proof itself.",
      id: "hosted_customer_session_proof",
      state: "blocked",
      title: "Run evidence session",
    },
    {
      command:
        "Regenerate progress, resume, diagnostics, follow-up preflight, launch checkpoint, execution envelope, intake manifest, and session handoff after every evidence-producing command.",
      detail:
        "The handoff stays useful only when it reflects the latest inspectable proof chain.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Refresh handoff after proof",
    },
    {
      command:
        "Keep public self-serve, invite delivery, providers, billing, POS, access control, and member-ledger writes blocked until separate proof tracks pass.",
      detail:
        "Session handoff is not launch approval, live-provider readiness, or revenue readiness.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Keep launch gates separate",
    },
  ];

  return {
    artifactPath: handoffPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_INTAKE_MANIFEST_PATH=${shellSingleQuote(
            manifestPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH=${shellSingleQuote(
            handoffPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-evidence-session-handoff",
        ].join(" \\\n "),
        detail:
          "Turns the evidence intake manifest into a customer-safe operator handoff packet without recording proof.",
        label:
          "Prepare public request first-gym proof evidence session handoff",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH=${shellSingleQuote(
            handoffPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-evidence-session-handoff:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies intake-manifest lineage, session handoff rows, command templates, regeneration sequence, and blocked gates.",
        label:
          "Inspect public request first-gym proof evidence session handoff",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current proof evidence intake manifest artifact.",
        label: "Evidence intake prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The handoff can only prepare the operator session; it cannot record proof, run success, beta approval, or launch readiness.",
        label: "Session handoff only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the evidence intake manifest into a customer-safe session handoff without recording proof or enabling public launch."
      : "Public request first-gym proof evidence session handoff waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym proof evidence session handoff",
  };
}

export function founderAdminPublicRequestFirstGymProofEvidenceSessionLedger(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const handoffPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-evidence-session-handoff.json`;
  const ledgerPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-evidence-session-ledger.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Record the next missing evidence artifact with its dedicated proof command, then regenerate this ledger.",
      detail:
        "Present artifacts must pass their own inspectors before the ledger marks them inspectable.",
      id: "hosted_customer_session_proof",
      state: "blocked",
      title: "Record missing proof",
    },
    {
      command:
        "Run first-gym go/no-go and operator-run commands only after hosted and customer evidence inspect clean.",
      detail:
        "The ledger can show readiness but cannot approve the run or record completion itself.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Run first-gym proof commands",
    },
    {
      command:
        "Keep public self-serve, invite delivery, providers, billing, POS, access control, and member-ledger writes blocked until separate proof tracks pass.",
      detail:
        "Session ledger is not public launch, live-provider, or revenue readiness.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Keep launch gates separate",
    },
  ];

  return {
    artifactPath: ledgerPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_HANDOFF_PATH=${shellSingleQuote(
            handoffPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH=${shellSingleQuote(
            ledgerPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-evidence-session-ledger",
        ].join(" \\\n "),
        detail:
          "Re-inspects evidence artifacts listed by the session handoff and marks them missing or inspectable without recording proof.",
        label:
          "Prepare public request first-gym proof evidence session ledger",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH=${shellSingleQuote(
            ledgerPath,
          )}`,
          "npm run admin:public-request-first-gym:proof-evidence-session-ledger:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies handoff lineage, evidence ledger states, dedicated inspectors, completion flags, and blocked gates.",
        label:
          "Inspect public request first-gym proof evidence session ledger",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current proof evidence session handoff artifact.",
        label: "Session handoff prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The ledger can only report missing vs inspectable evidence; it cannot record proof, run success, beta approval, or launch readiness.",
        label: "Session ledger only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Re-inspects session evidence artifacts from the handoff without recording proof or enabling public launch."
      : "Public request first-gym proof evidence session ledger waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym proof evidence session ledger",
  };
}

export function founderAdminPublicRequestFirstGymEvidenceExecutionReadiness(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const ledgerPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-proof-evidence-session-ledger.json`;
  const readinessPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-evidence-execution-readiness.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Use the readiness packet to run the next missing hosted or customer evidence command, then regenerate the session ledger.",
      detail:
        "The packet is a stop/continue surface; hosted rehearsal and customer-session proof remain dedicated commands.",
      id: "hosted_customer_session_proof",
      state: "blocked",
      title: "Run real evidence path",
    },
    {
      command:
        "Run first-gym go/no-go only when hosted rehearsal and customer-observed session rows are inspectable; hosted digest proof confirmation still belongs to the go/no-go command.",
      detail:
        "This readiness packet never claims hosted digest proof or go/no-go approval.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Gate first-gym go/no-go",
    },
    {
      command:
        "Keep public self-serve, invite delivery, providers, billing, POS, access control, and member-ledger writes blocked until separate proof tracks pass.",
      detail:
        "Execution readiness is not launch approval, live-provider readiness, or revenue readiness.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Keep launch gates separate",
    },
  ];

  return {
    artifactPath: readinessPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROOF_EVIDENCE_SESSION_LEDGER_PATH=${shellSingleQuote(
            ledgerPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH=${shellSingleQuote(
            readinessPath,
          )}`,
          "npm run admin:public-request-first-gym:evidence-execution-readiness",
        ].join(" \\\n "),
        detail:
          "Derives the next admissible evidence command and go/no-go gate from the session ledger without recording proof.",
        label:
          "Prepare public request first-gym evidence execution readiness",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH=${shellSingleQuote(
            readinessPath,
          )}`,
          "npm run admin:public-request-first-gym:evidence-execution-readiness:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies session ledger lineage, hosted/customer evidence readiness, next operator action, and blocked public/live/revenue gates.",
        label:
          "Inspect public request first-gym evidence execution readiness",
        state: commandState,
      },
    ],
    gates: [
      {
        detail: "Requires a current proof evidence session ledger artifact.",
        label: "Session ledger prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Hosted rehearsal and customer-observed rows must be inspectable before first-gym go/no-go can be prepared.",
        label: "Inspectable evidence gate",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Turns the session ledger into real evidence execution stop/continue guidance without recording proof or enabling public launch."
      : "Public request first-gym evidence execution readiness waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym evidence execution readiness",
  };
}

export function founderAdminPublicRequestFirstGymEvidenceRunCoordinator(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const readinessPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-evidence-execution-readiness.json`;
  const coordinatorPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-evidence-run-coordinator.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run hosted rehearsal, customer-observed session, hosted digest proof, ledger/readiness regeneration, go/no-go, first-gym run, and limited beta review only through their dedicated commands.",
      detail:
        "This coordinator is the continuous run sheet; it does not record any of those proof claims.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Coordinate real evidence execution",
    },
    {
      command:
        "Regenerate session ledger, evidence execution readiness, and this coordinator after every evidence artifact changes.",
      detail:
        "Every downstream decision must be based on inspectable hosted/customer artifacts and pinned SHA lineage.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Refresh readiness after proof changes",
    },
    {
      command:
        "Keep public self-serve, invite delivery, providers, billing, POS, access control, and member-ledger writes blocked until separate proof tracks pass.",
      detail:
        "First-gym evidence and limited beta review do not automatically unlock public/live/revenue gates.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Keep public/live/revenue gates separate",
    },
  ];

  return {
    artifactPath: coordinatorPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_EXECUTION_READINESS_PATH=${shellSingleQuote(
            readinessPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH=${shellSingleQuote(
            coordinatorPath,
          )}`,
          "npm run admin:public-request-first-gym:evidence-run-coordinator",
        ].join(" \\\n "),
        detail:
          "Builds a continuous operator run coordinator across hosted evidence, customer evidence, hosted digest proof, go/no-go, first-gym run, and limited beta review.",
        label: "Prepare public request first-gym evidence run coordinator",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH=${shellSingleQuote(
            coordinatorPath,
          )}`,
          "npm run admin:public-request-first-gym:evidence-run-coordinator:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies readiness lineage, exact command lanes, stop conditions, regeneration sequence, and blocked public/live/revenue gates.",
        label: "Inspect public request first-gym evidence run coordinator",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires an inspected evidence execution readiness artifact with pinned session ledger lineage.",
        label: "Execution readiness prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The coordinator lists the full real proof path but cannot record hosted proof, customer proof, go/no-go approval, first-gym run, or limited beta review.",
        label: "Coordinator only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Coordinates the full real-evidence run path after execution readiness while keeping all proof and launch gates separate."
      : "Public request first-gym evidence run coordinator waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym evidence run coordinator",
  };
}

export function founderAdminPublicRequestFirstGymProtectedPreviewEvidencePreflight(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const coordinatorPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-evidence-run-coordinator.json`;
  const preflightPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-protected-preview-evidence-preflight.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run protected Preview hosted rehearsal evidence, customer-observed session, hosted digest proof, and full ledger/readiness/coordinator/preflight regeneration through the dedicated commands.",
      detail:
        "This preflight makes the real evidence run inspectable; it does not record proof or unlock go/no-go.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Execute real protected Preview evidence session",
    },
    {
      command:
        "Only run first-gym go/no-go, first-gym operator run, and limited beta review after hosted/customer rows and hosted digest proof are inspectable.",
      detail:
        "The preflight keeps these downstream proof claims held until the real evidence artifacts pass their dedicated inspectors.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Hold first-gym and beta proof commands",
    },
    {
      command:
        "Keep public self-serve, invite delivery, providers, billing, POS, access control, and member-ledger writes blocked until separate proof tracks pass.",
      detail:
        "A successful protected Preview/customer session does not automatically authorize public, live-provider, or revenue/member-system gates.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Keep public/live/revenue gates separate",
    },
  ];

  return {
    artifactPath: preflightPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_EVIDENCE_RUN_COORDINATOR_PATH=${shellSingleQuote(
            coordinatorPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          "npm run admin:public-request-first-gym:protected-preview-evidence-preflight",
        ].join(" \\\n "),
        detail:
          "Builds the real protected Preview evidence-session preflight with inputs, sequence, artifact replacement policy, stop conditions, and downstream holds.",
        label:
          "Prepare public request first-gym protected Preview evidence preflight",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          "npm run admin:public-request-first-gym:protected-preview-evidence-preflight:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies coordinator lineage, exact evidence commands, artifact replacement policy, stop conditions, and blocked public/live/revenue gates.",
        label:
          "Inspect public request first-gym protected Preview evidence preflight",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires an inspected evidence run coordinator with pinned execution-readiness lineage.",
        label: "Coordinator prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The preflight can prepare the real hosted/customer evidence run, but only dedicated proof commands can record hosted evidence, customer completion, digest proof, go/no-go, first-gym run, or beta review.",
        label: "Preflight only",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Prepares the full protected Preview/customer evidence run path with artifact replacement guidance, hosted digest holds, regeneration commands, and blocked public/live/revenue gates."
      : "Public request first-gym protected Preview evidence preflight waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym protected Preview evidence preflight",
  };
}

export function founderAdminPublicRequestFirstGymRealEvidenceAttemptReadiness(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const preflightPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-protected-preview-evidence-preflight.json`;
  const attemptPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-real-evidence-attempt-readiness.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run the next_real_command from the attempt-readiness artifact only when the listed real observations can honestly be confirmed.",
      detail:
        "The attempt-readiness artifact names the next dedicated proof writer, but it does not set observation env vars or record evidence.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Run only the next real evidence command",
    },
    {
      command:
        "After any hosted or customer evidence artifact changes, regenerate proof evidence session ledger, evidence execution readiness, run coordinator, protected Preview preflight, and attempt readiness.",
      detail:
        "The regeneration loop is required so go/no-go sees inspected evidence instead of stale chat memory.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Regenerate the evidence status chain",
    },
    {
      command:
        "Keep go/no-go, first-gym run, limited beta review, public self-serve, live providers, and revenue/member-system gates blocked until their dedicated artifacts inspect.",
      detail:
        "Attempt readiness is a stop/continue control surface, not a downstream approval.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Hold downstream proof and launch gates",
    },
  ];

  return {
    artifactPath: attemptPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_PROTECTED_PREVIEW_EVIDENCE_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH=${shellSingleQuote(
            attemptPath,
          )}`,
          "npm run admin:public-request-first-gym:real-evidence-attempt-readiness",
        ].join(" \\\n "),
        detail:
          "Builds the stop/continue artifact for the next real hosted/customer evidence attempt without recording proof.",
        label:
          "Prepare public request first-gym real evidence attempt readiness",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH=${shellSingleQuote(
            attemptPath,
          )}`,
          "npm run admin:public-request-first-gym:real-evidence-attempt-readiness:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies protected Preview preflight lineage, next-command derivation, operator input names, stop conditions, and blocked public/live/revenue gates.",
        label:
          "Inspect public request first-gym real evidence attempt readiness",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires an inspected protected Preview evidence preflight with pinned coordinator lineage.",
        label: "Preflight prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The artifact can name the next real evidence command and required inputs, but only dedicated proof commands can record hosted evidence, customer completion, or hosted digest proof.",
        label: "Attempt-readiness only",
        state: "blocked",
      },
      {
        detail:
          "Go/no-go, first-gym run, beta review, public self-serve, providers, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "Downstream gates held",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Derives the next safe real evidence command from the protected Preview preflight, lists required real-session inputs, and keeps proof/live/revenue gates blocked."
      : "Public request first-gym real evidence attempt readiness waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym real evidence attempt readiness",
  };
}

export function founderAdminPublicRequestFirstGymRealEvidenceExecutionPacket(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const attemptPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-real-evidence-attempt-readiness.json`;
  const packetPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-real-evidence-execution-packet.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run the packet's next real evidence command only after the listed real observation inputs can honestly be confirmed.",
      detail:
        "The execution packet carries the run sheet and input names, but dedicated proof writers remain the only place where observations become proof.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Execute real evidence lane",
    },
    {
      command:
        "Run the packet's regenerate_full_chain checklist row after every hosted or customer evidence change.",
      detail:
        "This keeps the ledger, readiness, coordinator, preflight, attempt readiness, and execution packet fresh before go/no-go.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Regenerate after evidence changes",
    },
    {
      command:
        "Keep go/no-go, first-gym run, limited beta review, public self-serve, providers, billing, POS, access control, and member-ledger writes blocked until their dedicated artifacts inspect.",
      detail:
        "The execution packet is an operator-session control surface, not an approval or launch record.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Hold downstream gates",
    },
  ];

  return {
    artifactPath: packetPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_ATTEMPT_READINESS_PATH=${shellSingleQuote(
            attemptPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH=${shellSingleQuote(
            packetPath,
          )}`,
          "npm run admin:public-request-first-gym:real-evidence-execution-packet",
        ].join(" \\\n "),
        detail:
          "Builds the real-evidence operator execution packet from inspected attempt readiness without recording observations or proof.",
        label:
          "Prepare public request first-gym real evidence execution packet",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH=${shellSingleQuote(
            packetPath,
          )}`,
          "npm run admin:public-request-first-gym:real-evidence-execution-packet:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies attempt-readiness lineage, run lanes, checklist, artifact write policy, stop conditions, and blocked public/live/revenue gates.",
        label:
          "Inspect public request first-gym real evidence execution packet",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires an inspected real-evidence attempt-readiness artifact with pinned protected Preview preflight lineage.",
        label: "Attempt-readiness prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The packet gives operators a no-secret run sheet; only dedicated proof commands can record hosted evidence, customer completion, or hosted digest proof.",
        label: "Execution-packet only",
        state: "blocked",
      },
      {
        detail:
          "Go/no-go, first-gym run, beta review, public self-serve, providers, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "Downstream gates held",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Packages the real hosted/customer evidence attempt into inspectable run lanes, refresh rules, artifact write policy, and stop conditions without storing observations."
      : "Public request first-gym real evidence execution packet waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym real evidence execution packet",
  };
}

export function founderAdminPublicRequestFirstGymRealEvidenceExecutionGuard(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const packetPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-real-evidence-execution-packet.json`;
  const guardPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-real-evidence-execution-guard.json`;
  const hostedEvidencePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-hosted-rehearsal-evidence.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Set the packet's required real observation env vars, then run the guard immediately before the next real evidence command.",
      detail:
        "The guard checks input names and create-only output path risk, but stores no observation values.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Guard next real evidence command",
    },
    {
      command:
        "Run the manual command only when guard_state is ready_to_run_next_real_command.",
      detail:
        "The proof writer remains manual and must be followed by its dedicated inspector before any chain refresh.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Run hosted proof writer manually",
    },
    {
      command:
        "Regenerate the full chain, including this guard, after the new proof artifact inspects.",
      detail:
        "Go/no-go, first-gym run, beta review, public self-serve, providers, billing, POS, access control, and member-ledger writes remain blocked.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Refresh after inspected proof",
    },
  ];

  return {
    artifactPath: guardPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_PACKET_PATH=${shellSingleQuote(
            packetPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH=${shellSingleQuote(
            guardPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_HOSTED_REHEARSAL_EVIDENCE_PATH=${shellSingleQuote(
            hostedEvidencePath,
          )}`,
          "npm run admin:public-request-first-gym:real-evidence-execution-guard",
        ].join(" \\\n "),
        detail:
          "Checks the next real command's required input names and create-only evidence output path without running proof or storing observations.",
        label:
          "Prepare public request first-gym real evidence execution guard",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH=${shellSingleQuote(
            guardPath,
          )}`,
          "npm run admin:public-request-first-gym:real-evidence-execution-guard:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies execution-packet lineage, input-check shape, output path policy, stop conditions, and blocked public/live/revenue gates.",
        label:
          "Inspect public request first-gym real evidence execution guard",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires an inspected real-evidence execution packet with pinned attempt-readiness lineage.",
        label: "Execution-packet prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The guard can mark the manual command ready or blocked, but it cannot execute proof writers or record observations.",
        label: "Pre-run guard only",
        state: "blocked",
      },
      {
        detail:
          "Go/no-go, first-gym run, beta review, public self-serve, providers, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "Downstream gates held",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Checks real-evidence input names and create-only output path risk immediately before the manual proof command without storing observations."
      : "Public request first-gym real evidence execution guard waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym real evidence execution guard",
  };
}

export function founderAdminPublicRequestFirstGymRealEvidenceRefreshCoordinator(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const guardPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-real-evidence-execution-guard.json`;
  const coordinatorPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-real-evidence-refresh-coordinator.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Run the manual proof command only when the coordinator says ready_for_manual_proof_then_refresh.",
      detail:
        "The coordinator names the manual proof command and post-manual verification commands without executing proof.",
      id: "first_gym_go_no_go_bundle",
      state: "blocked",
      title: "Run manual proof and verification",
    },
    {
      command:
        "Run the coordinator's refresh sequence in order after the new proof artifact inspects.",
      detail:
        "Refresh runbook, execution pack, progress, resume, diagnostics, follow-up preflight, launch checkpoint, execution envelope, intake manifest, handoff, session ledger, readiness, coordinator, preflight, attempt, packet, guard, and this coordinator before the next real step.",
      id: "first_gym_operator_assisted_run",
      state: "blocked",
      title: "Refresh full evidence chain",
    },
    {
      command:
        "Prepare go/no-go only after hosted and customer evidence rows are inspectable in the refreshed ledger.",
      detail:
        "Public self-serve, providers, billing, POS, access control, and member-ledger writes remain blocked.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Hold downstream gates",
    },
  ];

  return {
    artifactPath: coordinatorPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_EXECUTION_GUARD_PATH=${shellSingleQuote(
            guardPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH=${shellSingleQuote(
            coordinatorPath,
          )}`,
          "npm run admin:public-request-first-gym:real-evidence-refresh-coordinator",
        ].join(" \\\n "),
        detail:
          "Pins the inspected execution guard and writes the manual proof, post-manual verification, and post-proof refresh sequence without running proof.",
        label:
          "Prepare public request first-gym real evidence refresh coordinator",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_REAL_EVIDENCE_REFRESH_COORDINATOR_PATH=${shellSingleQuote(
            coordinatorPath,
          )}`,
          "npm run admin:public-request-first-gym:real-evidence-refresh-coordinator:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies guard lineage, manual proof command, post-manual verification commands, refresh sequence, and blocked public/live/revenue gates.",
        label:
          "Inspect public request first-gym real evidence refresh coordinator",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires an inspected real-evidence execution guard with current real-input and create-only path state.",
        label: "Execution-guard prerequisite",
        state: "blocked",
      },
      {
        detail:
          "The coordinator can describe manual proof and refresh steps, but it cannot execute proof writers or record observations.",
        label: "Refresh coordinator only",
        state: "blocked",
      },
      {
        detail:
          "Go/no-go, first-gym run, beta review, public self-serve, providers, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "Downstream gates held",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Pins the execution guard and gives operators the manual proof, post-manual verification, and refresh sequence without running proof or storing observations."
      : "Public request first-gym real evidence refresh coordinator waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym real evidence refresh coordinator",
  };
}

export function founderAdminPublicRequestFirstGymOperatorRunRecord(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const bundlePath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-go-no-go-bundle.json`;
  const recordPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-operator-run-record.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command: "npm run admin:public-request:limited-beta:operator-review",
      detail:
        "Use the real first-gym run record before expanding to another operator-assisted beta gym.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "pending",
      title: "Limited beta operator review",
    },
    {
      command: "npm run admin:public-request:self-serve:launch-preflight",
      detail:
        "Public self-serve remains blocked until limited beta review is green.",
      id: "public_self_serve_preflight",
      state: "blocked",
      title: "Public self-serve launch preflight",
    },
    {
      command:
        "Plan live-provider and revenue/member-system gates as separate proof tracks.",
      detail:
        "Phone/email providers, billing, POS, access control, and member-ledger writes remain blocked.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: recordPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_GO_NO_GO_BUNDLE_PATH=${shellSingleQuote(
            bundlePath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH=${shellSingleQuote(
            recordPath,
          )}`,
          "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR='<operator-name>'",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OWNER_WORKSPACE_COMPLETED='yes'",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_STAFF_WORKBOARD_COMPLETED='yes'",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_SOURCE_TO_ANSWER_TO_TASK_COMPLETED='yes'",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_RESET_ROLLBACK_EXERCISED='yes'",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_SUPPORT_HANDOFF_REVIEWED='yes'",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_UNEXPECTED_DATA_NOT_OBSERVED='yes'",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_LIVE_PROVIDER_CLAIMS_NOT_OBSERVED='yes'",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_INVITE_DELIVERY_NOT_OBSERVED='yes'",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_BILLING_POS_MEMBER_WRITES_NOT_OBSERVED='yes'",
          "npm run admin:public-request-first-gym:run",
        ].join(" \\\n "),
        detail:
          "Records the real operator-assisted first-gym run only after every observation is complete.",
        label: "Record public request first-gym run",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH=${shellSingleQuote(
            recordPath,
          )}`,
          "npm run admin:public-request-first-gym:run:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies the bundle SHA, operator observations, limited-beta readiness, and blocked public/live-provider gates.",
        label: "Inspect public request first-gym run",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires the public-request first-gym go/no-go bundle.",
        label: "Go/no-go bundle required",
        state: "blocked",
      },
      {
        detail:
          "Every owner/staff/source/reset/support/no-live-provider observation must be explicit.",
        label: "Operator observations required",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Records the current-chain first-gym operator-assisted run and prepares limited beta review while public/live-provider gates remain blocked."
      : "Public request first-gym run waits protected Preview URL and hosted Neon branch context.",
    title: "Public request first-gym operator run",
  };
}

export function founderAdminPublicRequestLimitedBetaOperatorReviewPacket(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const runRecordPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-first-gym-operator-run-record.json`;
  const reviewPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-limited-beta-operator-review-packet.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command: "npm run admin:public-request:self-serve:launch-preflight",
      detail:
        "This packages public self-serve launch prerequisites without enabling signup, invites, or providers.",
      id: "public_self_serve_preflight",
      state: "pending",
      title: "Public-request self-serve launch preflight",
    },
    {
      command:
        "Run another operator-assisted beta onboarding before public launch.",
      detail:
        "Owner access remains operator-managed until a separate launch gate is green.",
      id: "limited_operator_assisted_beta_onboarding",
      state: "pending",
      title: "Next approved gym limited beta",
    },
    {
      command:
        "Keep invite/Auth/provider/revenue/member-system gates separate.",
      detail:
        "Invite delivery, Auth admin APIs, providers, billing, POS, access control, and member-ledger writes remain blocked.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Public/live-provider gates",
    },
  ];

  return {
    artifactPath: reviewPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_FIRST_GYM_OPERATOR_RUN_RECORD_PATH=${shellSingleQuote(
            runRecordPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH=${shellSingleQuote(
            reviewPath,
          )}`,
          "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_REVIEWED_FIRST_GYM_RUN='yes'",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR='<operator-name>'",
          "OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_CANDIDATE_GYM='Next approved beta gym'",
          "npm run admin:public-request:limited-beta:operator-review",
        ].join(" \\\n "),
        detail:
          "Packages the public-request first-gym run into limited beta operator review evidence.",
        label: "Prepare public request limited beta review",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH=${shellSingleQuote(
            reviewPath,
          )}`,
          "npm run admin:public-request:limited-beta:operator-review:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies the public-request first-gym run SHA, operator-managed access, and blocked public/live-provider gates.",
        label: "Inspect public request limited beta review",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires public-request first-gym operator-run evidence, not just go/no-go readiness.",
        label: "First-gym run prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Owner access remains operator-managed; no browser approvals, public signup, or invite delivery are introduced.",
        label: "Operator-managed access",
        state: "blocked",
      },
      {
        detail:
          "Public self-serve, invites, notifications, providers, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Turns the public-request first-gym run into limited beta review evidence without opening public or live-provider gates."
      : "Public request limited beta review waits protected Preview URL and hosted Neon branch context.",
    title: "Public request limited beta review",
  };
}

export function founderAdminPublicRequestSelfServeLaunchPreflight(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminApprovedGymHostedRehearsalReadinessBatch {
  const branchName = proofLedger?.branchName ?? "Neon branch missing";
  const previewUrl = proofLedger?.previewUrl ?? "Preview URL missing";
  const branchConfigured = !isMissingLedgerValue(branchName);
  const previewConfigured =
    !isMissingLedgerValue(previewUrl) && !isLocalOrigin(previewUrl);
  const branchSlug = branchConfigured
    ? slugifyLedgerValue(branchName)
    : "neon-branch-missing";
  const reviewPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-limited-beta-operator-review-packet.json`;
  const preflightPath = `artifacts/admin-launch-readiness/${branchSlug}-public-request-self-serve-launch-preflight.json`;
  const hostedContextReady = branchConfigured && previewConfigured;
  const commandState: FounderAdminChannelPreflightState = hostedContextReady
    ? "pending"
    : "blocked";
  const nextReadinessBatches: FounderAdminDemoOnboardingRunwaySlice[] = [
    {
      command:
        "Design public request intake as request-only and human-reviewed.",
      detail:
        "No browser approval buttons, automatic provisioning, invite delivery, or Auth user creation.",
      id: "public_request_intake_dry_run",
      state: "pending",
      title: "Public request intake dry-run",
    },
    {
      command:
        "Prepare invite/Auth no-send and no-create dry-run artifacts.",
      detail:
        "No email sending, notifications, magic links, Auth users, or automatic grants.",
      id: "invite_auth_dry_run_gates",
      state: "blocked",
      title: "Invite/Auth no-send gates",
    },
    {
      command:
        "Keep provider and revenue/member-system gates as separate proof tracks.",
      detail:
        "Phone/email providers, billing, POS, access control, and member-ledger writes remain blocked.",
      id: "live_provider_revenue_gates",
      state: "blocked",
      title: "Live-provider and revenue gates",
    },
  ];

  return {
    artifactPath: preflightPath,
    commands: [
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH=${shellSingleQuote(
            reviewPath,
          )}`,
          `OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          "npm run admin:public-request:self-serve:launch-preflight",
        ].join(" \\\n "),
        detail:
          "Prepares public self-serve launch prerequisites from public-request limited beta review while launch remains disabled.",
        label: "Prepare public request self-serve preflight",
        state: commandState,
      },
      {
        command: [
          `OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH=${shellSingleQuote(
            preflightPath,
          )}`,
          "npm run admin:public-request:self-serve:launch-preflight:inspect",
        ].join(" \\\n "),
        detail:
          "Verifies limited beta parent SHA and confirms launch, invites, providers, and revenue/member-system gates remain blocked.",
        label: "Inspect public request self-serve preflight",
        state: commandState,
      },
    ],
    gates: [
      {
        detail:
          "Requires public-request limited beta review; this preflight does not itself authorize launch.",
        label: "Limited beta prerequisite",
        state: "blocked",
      },
      {
        detail:
          "Public request intake must stay request-only and human-reviewed until a separate launch gate is green.",
        label: "Public request boundary",
        state: "blocked",
      },
      {
        detail:
          "Invites, Auth admin APIs, providers, billing, POS, access control, and member-ledger writes remain blocked.",
        label: "No-live-provider gates",
        state: "blocked",
      },
    ],
    nextReadinessBatches,
    nextTwoSlices: nextReadinessBatches,
    summary: hostedContextReady
      ? "Prepares public self-serve launch requirements from the public-request chain without enabling signup, invites, providers, or revenue/member-system writes."
      : "Public request self-serve launch preflight waits protected Preview URL and hosted Neon branch context.",
    title: "Public request self-serve launch preflight",
  };
}

export function founderAdminProofFreshnessSummary(
  proofLedger?: FounderAdminProofStatusLedger,
): FounderAdminProofFreshnessSummary {
  const previewConfigured = Boolean(
    proofLedger &&
    !isMissingLedgerValue(proofLedger.previewUrl) &&
    !isLocalOrigin(proofLedger.previewUrl),
  );
  const branchConfigured = Boolean(
    proofLedger && !isMissingLedgerValue(proofLedger.branchName),
  );
  const previewUrl = previewConfigured
    ? (proofLedger?.previewUrl ?? "<protected-preview-url>")
    : "<protected-preview-url>";
  const branchName = branchConfigured
    ? (proofLedger?.branchName ?? "<neon-proof-branch>")
    : "<neon-proof-branch>";
  const contextReady = previewConfigured && branchConfigured;
  const exportPath = contextReady
    ? `artifacts/admin-launch-readiness/${slugifyLedgerValue(branchName)}-proof-freshness.json`
    : "artifacts/admin-launch-readiness/neon-branch-missing-proof-freshness.json";
  const contextBlockedDetail =
    "Set protected Preview URL and hosted Neon branch before using proof freshness.";
  const items: FounderAdminProofFreshnessItem[] = [
    freshnessItem({
      command: "npm run vercel:preview:verify",
      currentBranchName: branchName,
      currentPreviewUrl: previewUrl,
      id: "protected_preview",
      label: "Protected Preview proof",
      record: proofLedger?.proofRuns.find(
        (record) =>
          record.proof_kind === "vercel_preview_verify" &&
          record.status === "passed",
      ),
      timestampKey: "completed_at",
      unavailableDetail:
        "Protected Preview URL and hosted Neon branch are required before proof freshness can be evaluated.",
    }),
    freshnessItem({
      command: "npm run hosted:admin-portal-readiness",
      currentBranchName: branchName,
      currentPreviewUrl: previewUrl,
      id: "admin_portal",
      label: "Admin portal proof",
      record: proofLedger?.proofRuns.find(
        (record) =>
          record.proof_kind === "hosted_founder_admin_readiness" &&
          record.status === "passed",
      ),
      timestampKey: "completed_at",
      unavailableDetail:
        "Admin portal proof needs hosted Preview and Neon branch context.",
    }),
    freshnessItem({
      command: "npm run hosted:beta-proof-run:record-proof",
      currentBranchName: branchName,
      currentPreviewUrl: previewUrl,
      id: "beta_proof_summary",
      label: "Beta proof-run summary",
      record: proofLedger?.betaProofRunSummaryRecords[0],
      timestampKey: "recorded_at",
      unavailableDetail:
        "Beta proof-run digest needs hosted Preview and Neon branch context.",
    }),
    freshnessItem({
      command: "npm run beta:owner-handoff:record",
      currentBranchName: branchName,
      currentPreviewUrl: previewUrl,
      id: "customer_handoff",
      label: "Customer-observed handoff",
      record: proofLedger?.customerHandoffGateRecords[0],
      timestampKey: "recorded_at",
      unavailableDetail:
        "Customer-observed handoff record needs hosted Preview and Neon branch context.",
    }),
    freshnessItem({
      command: "npm run hosted:launch-package:record-proof",
      currentBranchName: branchName,
      currentPreviewUrl: previewUrl,
      id: "launch_package",
      label: "Launch package record",
      record: proofLedger?.launchPackageRecords[0],
      timestampKey: "recorded_at",
      unavailableDetail:
        "Launch package record needs hosted Preview and Neon branch context.",
    }),
    freshnessItem({
      command: "npm run admin:launch-decision:record",
      currentBranchName: branchName,
      currentPreviewUrl: previewUrl,
      id: "launch_decision",
      label: "Launch decision record",
      record: proofLedger?.launchDecisionRecords[0],
      timestampKey: "recorded_at",
      unavailableDetail:
        "Launch decision record needs hosted Preview and Neon branch context.",
    }),
    freshnessItem({
      command: "npm run admin:self-serve-rehearsal:record",
      currentBranchName: branchName,
      currentPreviewUrl: previewUrl,
      id: "operator_rehearsal",
      label: "Operator rehearsal record",
      record: proofLedger?.operatorSelfServeRehearsalRecords[0],
      timestampKey: "recorded_at",
      unavailableDetail:
        "Operator rehearsal record needs hosted Preview and Neon branch context.",
    }),
  ].map((item) =>
    contextReady || item.state === "fresh"
      ? item
      : {
          ...item,
          command:
            "Rerun or import the matching terminal proof for current Preview and Neon branch.",
          detail: contextBlockedDetail,
          state: "blocked",
        },
  );
  const freshCount = items.filter((item) => item.state === "fresh").length;
  const staleCount = items.filter((item) => item.state === "stale").length;
  const missingCount = items.filter((item) => item.state === "missing").length;
  const blockedCount = items.filter((item) => item.state === "blocked").length;
  const overallState: FounderAdminProofFreshnessState =
    blockedCount > 0
      ? "blocked"
      : staleCount > 0
        ? "stale"
        : missingCount > 0
          ? "missing"
          : "fresh";
  const exportCommandValue = [
    `OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH=${shellSingleQuote(exportPath)}`,
    `OUTPOST_ADMIN_PROOF_FRESHNESS_PREVIEW_URL=${shellSingleQuote(previewUrl)}`,
    `OUTPOST_NEON_BRANCH_NAME=${shellSingleQuote(branchName)}`,
    `OUTPOST_ADMIN_PROOF_FRESHNESS_OVERALL=${shellSingleQuote(overallState)}`,
    `OUTPOST_ADMIN_PROOF_FRESHNESS_FRESH_COUNT=${shellSingleQuote(String(freshCount))}`,
    `OUTPOST_ADMIN_PROOF_FRESHNESS_STALE_COUNT=${shellSingleQuote(String(staleCount))}`,
    `OUTPOST_ADMIN_PROOF_FRESHNESS_MISSING_COUNT=${shellSingleQuote(String(missingCount))}`,
    `OUTPOST_ADMIN_PROOF_FRESHNESS_BLOCKED_COUNT=${shellSingleQuote(String(blockedCount))}`,
    `OUTPOST_ADMIN_PROOF_FRESHNESS_NEXT_COMMAND=${shellSingleQuote(
      items.find((item) => item.state !== "fresh")?.command ?? "none",
    )}`,
    "npm run admin:proof-freshness:export",
  ].join(" \\\n  ");
  const inspectCommandValue = [
    `OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH=${shellSingleQuote(exportPath)}`,
    "npm run admin:proof-freshness:inspect",
  ].join(" \\\n  ");

  return {
    blockedGates: [
      "Browser approval buttons",
      "Public owner self-signup",
      "Invite delivery",
      "Notification sending",
      "Phone/email providers",
      "Billing",
      "POS/access control/member-ledger writes",
    ],
    exportCommand: {
      command: exportCommandValue,
      detail: contextReady
        ? "Writes sanitized current proof freshness snapshot under ignored artifacts/."
        : "Requires protected Preview URL and hosted Neon branch context before export.",
      label: "Write proof freshness export",
      state: contextReady ? "ready" : "blocked",
    },
    exportPath,
    freshCount,
    inspectCommand: {
      command: inspectCommandValue,
      detail:
        "Fails closed unless proof freshness is current and live-provider gates stay blocked.",
      label: "Inspect proof freshness export",
      state: contextReady ? "pending" : "blocked",
    },
    items,
    missingCount,
    overallState,
    staleCount,
    summary:
      overallState === "fresh"
        ? "All tracked proof evidence matches current Preview and hosted Neon branch."
        : `${freshCount} fresh, ${staleCount} stale, ${missingCount} missing for current Preview and Neon branch.`,
    title: "Proof freshness",
  };
}

export function founderAdminOperatorActionQueue({
  betaAccessRequestReport = emptyFounderAdminBetaAccessRequestReport,
  proofLedger,
  report,
}: {
  betaAccessRequestReport?: FounderAdminBetaAccessRequestReport;
  proofLedger?: FounderAdminProofStatusLedger;
  report: FounderAdminOwnerReadinessReport;
}): FounderAdminOperatorActionQueue {
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
  const proofFreshness = founderAdminProofFreshnessSummary(proofLedger);
  const previewConfigured = Boolean(
    proofLedger &&
    !isMissingLedgerValue(proofLedger.previewUrl) &&
    !isLocalOrigin(proofLedger.previewUrl),
  );
  const branchConfigured = Boolean(
    proofLedger && !isMissingLedgerValue(proofLedger.branchName),
  );
  const hostedWorkflowReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.hostedBetaWorkflow,
  );
  const adminProofReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.founderAdmin,
  );
  const customerHandoffReady = proofLedgerGateReady(
    proofLedger,
    FOUNDER_ADMIN_PROOF_GATE_LABELS.customerHandoff,
  );
  const betaProofDigestReady = Boolean(
    proofLedger?.betaProofRunSummaryRecords[0],
  );
  const launchDecisionReady = Boolean(
    launchDecisionPacketReadiness.latestDecisionRecord,
  );
  const rehearsalComplete = Boolean(
    operatorSelfServeRehearsalReadiness.latestRecord,
  );
  const previewCommandValue = previewConfigured
    ? (proofLedger?.previewUrl ?? "<protected-preview-url>")
    : "<protected-preview-url>";
  const branchCommandValue = branchConfigured
    ? (proofLedger?.branchName ?? "<neon-proof-branch>")
    : "<neon-proof-branch>";
  const exportPath = `artifacts/admin-launch-readiness/${slugifyLedgerValue(
    proofLedger?.branchName ?? "pending-branch",
  )}-operator-next-actions.json`;
  const actions: FounderAdminOperatorAction[] = [
    proofAction({
      command: "npm run vercel:preview:verify",
      complete: hostedWorkflowReady,
      detail: hostedWorkflowReady
        ? "Protected Preview proof is recorded for this Admin session."
        : "Run full protected Preview proof before downstream launch artifacts.",
      id: "protected_preview_proof",
      label: "Run protected Preview proof",
      rank: 10,
      runnable: previewConfigured && branchConfigured,
      source: "Hosted proof",
    }),
    proofAction({
      command: "npm run hosted:admin-portal-readiness",
      complete: adminProofReady,
      detail: adminProofReady
        ? "Admin portal proof is recorded."
        : "Prove founder-admin RPC access and owner/staff/anonymous denial.",
      id: "admin_portal_proof",
      label: "Run Admin portal proof",
      rank: 20,
      runnable: hostedWorkflowReady,
      source: "Hosted proof",
    }),
    proofAction({
      command: "npm run hosted:beta-proof-run:record-proof",
      complete: betaProofDigestReady,
      detail: betaProofDigestReady
        ? "Browser plus request-chain digest is visible through founder-admin RPC."
        : "Re-inspect, import, and verify the hosted beta proof-run digest.",
      id: "beta_proof_digest",
      label: "Verify beta proof-run digest",
      rank: 30,
      runnable: hostedWorkflowReady && adminProofReady,
      source: "Hosted proof digest",
    }),
    proofAction({
      command: proofFreshness.exportCommand.command,
      complete: proofFreshness.overallState === "fresh",
      detail:
        proofFreshness.overallState === "fresh"
          ? "Tracked proof evidence is fresh for current Preview and hosted Neon branch."
          : "Resolve stale or missing proof freshness before downstream launch or handoff artifacts.",
      id: "proof_freshness",
      label: "Resolve proof freshness",
      rank: 35,
      runnable: proofFreshness.exportCommand.state === "ready",
      source: "Proof freshness",
    }),
    proofAction({
      command: "npm run beta:owner-handoff:record",
      complete: customerHandoffReady,
      detail: customerHandoffReady
        ? "Customer-observed handoff record is present."
        : "Import customer-observed handoff only after real external observation.",
      id: "customer_handoff_record",
      label: "Import customer handoff proof",
      rank: 40,
      runnable: betaProofDigestReady,
      source: "Customer handoff",
    }),
    commandAction(launchReadinessExport.commands[0], {
      complete: false,
      id: "launch_readiness_export",
      rank: 50,
      source: "Launch readiness",
    }),
    commandAction(launchReadinessExport.commands[1], {
      complete: false,
      id: "launch_readiness_inspect",
      rank: 60,
      source: "Launch readiness",
    }),
    commandAction(launchPromotionGate.commands[0], {
      complete: false,
      id: "launch_promotion_candidate",
      rank: 70,
      source: "Launch package",
    }),
    commandAction(launchPackageReadiness.command, {
      complete: Boolean(launchPackageReadiness.latestRecord),
      id: "launch_package_record",
      rank: 80,
      source: "Launch package",
    }),
    commandAction(launchDecisionPacketReadiness.commands[0], {
      complete: launchDecisionReady,
      id: "launch_decision_packet",
      rank: 90,
      source: "Launch decision",
    }),
    commandAction(launchDecisionPacketReadiness.recordCommand, {
      complete: launchDecisionReady,
      id: "launch_decision_record",
      rank: 100,
      source: "Launch decision",
    }),
    commandAction(launchFollowThroughReadiness.command, {
      complete: false,
      id: "launch_followthrough",
      rank: 110,
      source: "Launch follow-through",
    }),
    commandAction(operatorSelfServeRehearsalReadiness.packetCommand, {
      complete: rehearsalComplete,
      id: "self_serve_rehearsal_packet",
      rank: 120,
      source: "Operator rehearsal",
    }),
    commandAction(operatorSelfServeRehearsalReadiness.recordCommand, {
      complete: rehearsalComplete,
      id: "self_serve_rehearsal_record",
      rank: 130,
      source: "Operator rehearsal",
    }),
  ].sort((left, right) => left.rank - right.rank);
  const nextAction =
    actions.find((action) => action.state === "next") ??
    actions.find((action) => action.state === "waiting") ??
    actions.find((action) => action.state === "blocked") ??
    actions.find((action) => action.state === "done");
  const blockedGates = [
    "Public self-serve launch",
    "Browser approval buttons",
    "Invite delivery",
    "Notification sending",
    "Phone/email providers",
    "Billing",
    "POS/access control/member-ledger writes",
  ];
  const exportCommand = [
    `OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH=${shellSingleQuote(exportPath)}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_PREVIEW_URL=${shellSingleQuote(previewCommandValue)}`,
    `OUTPOST_NEON_BRANCH_NAME=${shellSingleQuote(branchCommandValue)}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_STATE=${shellSingleQuote(nextAction?.state ?? "blocked")}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_LABEL=${shellSingleQuote(nextAction?.label ?? "No operator action available")}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_COMMAND=${shellSingleQuote(nextAction?.command ?? "none")}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_DETAIL=${shellSingleQuote(nextAction?.detail ?? "No runnable action is available.")}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STATE=${shellSingleQuote(proofFreshness.overallState)}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_FRESH_COUNT=${shellSingleQuote(String(proofFreshness.freshCount))}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STALE_COUNT=${shellSingleQuote(String(proofFreshness.staleCount))}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_MISSING_COUNT=${shellSingleQuote(String(proofFreshness.missingCount))}`,
    "npm run admin:next-actions:export",
  ].join(" \\\n  ");
  const inspectCommand = [
    `OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH=${shellSingleQuote(exportPath)}`,
    "npm run admin:next-actions:inspect",
  ].join(" \\\n  ");

  return {
    actions,
    blockedGates,
    exportCommand: {
      command: exportCommand,
      detail:
        previewConfigured && branchConfigured
          ? "Writes the current Admin next-action snapshot under ignored artifacts/."
          : "Requires protected Preview URL and hosted Neon branch context before export.",
      label: "Write Admin next-action queue",
      state: previewConfigured && branchConfigured ? "ready" : "blocked",
    },
    exportPath,
    inspectCommand: {
      command: inspectCommand,
      detail:
        "Verifies the next-action artifact keeps public self-serve and live-provider gates blocked.",
      label: "Inspect Admin next-action queue",
      state: previewConfigured && branchConfigured ? "pending" : "blocked",
    },
    nextAction,
    nonGoals: [
      "No browser approval buttons.",
      "No public owner self-signup.",
      "No invite delivery or notification sending.",
      "No phone/email provider activation.",
      "No billing, POS, access control, or member-ledger writes.",
    ],
    summary: nextAction
      ? `${operatorActionStateLabel(nextAction.state)}: ${nextAction.label}.`
      : "No operator action can be derived from current Admin proof state.",
    title: "Operator next-action queue",
  };
}

export function founderAdminHandoffReadinessPacket({
  betaAccessRequestReport = emptyFounderAdminBetaAccessRequestReport,
  proofLedger,
  report,
}: {
  betaAccessRequestReport?: FounderAdminBetaAccessRequestReport;
  proofLedger?: FounderAdminProofStatusLedger;
  report: FounderAdminOwnerReadinessReport;
}): FounderAdminHandoffReadinessPacket {
  const proofFreshness = founderAdminProofFreshnessSummary(proofLedger);
  const operatorActionQueue = founderAdminOperatorActionQueue({
    betaAccessRequestReport,
    proofLedger,
    report,
  });
  const launchReadinessExport = founderAdminLaunchReadinessExport({
    betaAccessRequestReport,
    proofLedger,
    report,
  });
  const previewConfigured = Boolean(
    proofLedger &&
    !isMissingLedgerValue(proofLedger.previewUrl) &&
    !isLocalOrigin(proofLedger.previewUrl),
  );
  const branchConfigured = Boolean(
    proofLedger && !isMissingLedgerValue(proofLedger.branchName),
  );
  const branchName = branchConfigured
    ? (proofLedger?.branchName ?? "<hosted-neon-branch>")
    : "<hosted-neon-branch>";
  const previewUrl = previewConfigured
    ? (proofLedger?.previewUrl ?? "<protected-preview-url>")
    : "<protected-preview-url>";
  const packetPath =
    previewConfigured && branchConfigured
      ? `artifacts/admin-launch-readiness/${slugifyLedgerValue(branchName)}-handoff-readiness-packet.json`
      : "artifacts/admin-launch-readiness/neon-branch-missing-handoff-readiness-packet.json";
  const queueReady = operatorActionQueue.nextAction?.state === "done";
  const launchReadinessReady = launchReadinessExport.gates.some(
    (gate) =>
      gate.label === "Protected Preview proof" && gate.state === "ready",
  );
  const contextReady = previewConfigured && branchConfigured;
  const state: FounderAdminHandoffReadinessPacketState = !contextReady
    ? "blocked"
    : proofFreshness.overallState === "fresh" &&
        queueReady &&
        launchReadinessReady
      ? "ready"
      : "action_required";
  const exportState: FounderAdminLaunchReadinessExportState = !contextReady
    ? "blocked"
    : proofFreshness.overallState === "fresh"
      ? "ready"
      : "pending";
  const prerequisites: FounderAdminHandoffReadinessPacketGate[] = [
    {
      detail: contextReady
        ? "Protected Preview URL and hosted Neon branch are present."
        : "Set protected Preview URL and hosted Neon branch before writing packet.",
      label: "Hosted context",
      state: contextReady ? "ready" : "blocked",
    },
    {
      detail:
        proofFreshness.overallState === "fresh"
          ? "Tracked proof evidence is fresh for current Preview and branch."
          : "Resolve proof freshness before treating handoff packet as ready.",
      label: "Proof freshness",
      state:
        proofFreshness.overallState === "fresh"
          ? "ready"
          : contextReady
            ? "pending"
            : "blocked",
    },
    {
      detail: queueReady
        ? "Operator queue has no earlier pending terminal action."
        : `Next terminal action remains: ${operatorActionQueue.nextAction?.label ?? "unavailable"}.`,
      label: "Operator next action",
      state: queueReady ? "ready" : contextReady ? "pending" : "blocked",
    },
    {
      detail: launchReadinessReady
        ? "Launch-readiness export has protected Preview proof context."
        : "Run and inspect launch-readiness export before relying on packet.",
      label: "Launch-readiness export",
      state: launchReadinessReady
        ? "ready"
        : contextReady
          ? "pending"
          : "blocked",
    },
    {
      detail:
        "Public self-serve, invites, providers, billing, POS, access control, and member-ledger writes remain blocked.",
      label: "No-live-provider gates",
      state: "ready",
    },
  ];
  const exportCommand = [
    `OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH=${shellSingleQuote(packetPath)}`,
    `OUTPOST_ADMIN_HANDOFF_READINESS_PREVIEW_URL=${shellSingleQuote(previewUrl)}`,
    `OUTPOST_NEON_BRANCH_NAME=${shellSingleQuote(branchName)}`,
    `OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH=${shellSingleQuote(proofFreshness.exportPath)}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH=${shellSingleQuote(operatorActionQueue.exportPath)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH=${shellSingleQuote(launchReadinessExport.exportPath)}`,
    "npm run admin:handoff-readiness:packet",
  ].join(" \\\n  ");
  const inspectCommand = [
    `OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH=${shellSingleQuote(packetPath)}`,
    "npm run admin:handoff-readiness:inspect",
  ].join(" \\\n  ");
  const recordCommand = [
    `OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH=${shellSingleQuote(packetPath)}`,
    `OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH=${shellSingleQuote(proofFreshness.exportPath)}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH=${shellSingleQuote(operatorActionQueue.exportPath)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH=${shellSingleQuote(launchReadinessExport.exportPath)}`,
    `OUTPOST_ADMIN_HANDOFF_READINESS_REVIEWER=${shellSingleQuote("<reviewer-name>")}`,
    "npm run admin:handoff-readiness:record",
  ].join(" \\\n  ");
  const replayCommand = [
    `OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH=${shellSingleQuote(packetPath)}`,
    `OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH=${shellSingleQuote(proofFreshness.exportPath)}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH=${shellSingleQuote(operatorActionQueue.exportPath)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH=${shellSingleQuote(launchReadinessExport.exportPath)}`,
    "npm run admin:handoff-readiness:replay",
  ].join(" \\\n  ");

  const hostedProofCommand = [
    `OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH=${shellSingleQuote(packetPath)}`,
    `OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH=${shellSingleQuote(proofFreshness.exportPath)}`,
    `OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH=${shellSingleQuote(operatorActionQueue.exportPath)}`,
    `OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH=${shellSingleQuote(launchReadinessExport.exportPath)}`,
    `OUTPOST_ADMIN_HANDOFF_READINESS_REVIEWER=${shellSingleQuote("<reviewer-name>")}`,
    "npm run admin:handoff-readiness:hosted-proof",
  ].join(" \\\n ");

  return {
    exportCommand: {
      command: exportCommand,
      detail:
        "Composes existing Admin artifacts into one customer-safe go/no-go packet without mutating hosted data.",
      label: "Write handoff readiness packet",
      state: exportState,
    },
    hostedProofCommand: {
      command: hostedProofCommand,
      detail:
        "Runs replay and digest import, then writes a sanitized hosted proof summary.",
      label: "Verify hosted handoff packet proof",
      state: contextReady ? "pending" : "blocked",
    },
    inspectCommand: {
      command: inspectCommand,
      detail:
        "Verifies packet keeps public self-serve and live-provider gates blocked.",
      label: "Inspect handoff readiness packet",
      state: contextReady ? "pending" : "blocked",
    },
    packetPath,
    prerequisites,
    recordCommand: {
      command: recordCommand,
      detail:
        "Imports reviewed packet digest metadata into hosted Neon without storing packet contents.",
      label: "Record handoff packet digest",
      state: contextReady ? "pending" : "blocked",
    },
    replayCommand: {
      command: replayCommand,
      detail:
        "Replays packet against current source artifacts before scheduling handoff.",
      label: "Replay handoff packet proof",
      state: contextReady ? "pending" : "blocked",
    },
    state,
    stillBlocked: [
      "No browser approval buttons.",
      "No public owner self-signup.",
      "No invite delivery or notification sending.",
      "No phone/email provider activation.",
      "No billing, POS, access control, or member-ledger writes.",
    ],
    summary:
      state === "ready"
        ? "Handoff readiness packet can summarize current proof without enabling launch."
        : state === "action_required"
          ? "Packet can be written as a go/no-go summary, but earlier terminal proof work remains."
          : "Packet needs hosted Preview and Neon branch context before export.",
    title: "Handoff readiness packet",
  };
}

function proofLedgerGateReady(
  proofLedger: FounderAdminProofStatusLedger | undefined,
  label: string,
) {
  return (
    proofLedger?.gates.some(
      (gate) => gate.label === label && gate.state === "ready",
    ) ?? false
  );
}

function rollbackTimelineStep(
  ownerReadinessRow: FounderAdminOwnerReadinessRow | undefined,
  workspaceBootstrapped: boolean,
  archived: boolean,
): FounderAdminOwnerOnboardingTimelineStep {
  if (archived) {
    return {
      id: "reset_rollback",
      label: "Reset or rollback",
      state: "blocked",
      detail:
        "Archived requests should stay closed unless a new request starts a new handoff.",
    };
  }

  if (!workspaceBootstrapped) {
    return {
      id: "reset_rollback",
      label: "Reset or rollback",
      state: "blocked",
      detail:
        "Rollback classification appears after a workspace exists in the admin readiness projection.",
    };
  }

  if (!ownerReadinessRow) {
    return {
      id: "reset_rollback",
      label: "Reset or rollback",
      state: "attention",
      detail:
        "Workspace exists, but the matching owner readiness row is not visible in this projection.",
    };
  }

  if (ownerReadinessRow.rollback_readiness.state === "dry_run_rollback_ready") {
    return {
      id: "reset_rollback",
      label: "Reset or rollback",
      state: "ready",
      detail: ownerReadinessRow.rollback_readiness.reason,
    };
  }

  if (ownerReadinessRow.rollback_readiness.state === "blocked_seeded_tenant") {
    return {
      id: "reset_rollback",
      label: "Reset or rollback",
      state: "blocked",
      detail: ownerReadinessRow.rollback_readiness.reason,
    };
  }

  return {
    id: "reset_rollback",
    label: "Reset or rollback",
    state: "attention",
    detail: ownerReadinessRow.rollback_readiness.reason,
  };
}

function shellSingleQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function normalizeLedgerValue(
  value: string | null | undefined,
  fallback: string,
) {
  return value?.trim() ? value : fallback;
}

function isLocalOrigin(value: string) {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/iu.test(value);
}

function isMissingLedgerValue(value: string) {
  return /^(preview url missing|neon branch missing)$/iu.test(value.trim());
}

function slugifyLedgerValue(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 72) || "pending"
  );
}

function latestPassedProofRun(
  proofRuns: FounderAdminProofRunRecord[],
  proofKind: FounderAdminProofRunKind,
) {
  return proofRuns.find(
    (proofRun) =>
      proofRun.proof_kind === proofKind && proofRun.status === "passed",
  );
}

function latestMatchingPassedProofRun(
  proofRuns: FounderAdminProofRunRecord[],
  proofKind: FounderAdminProofRunKind,
  appOrigin: string | null | undefined,
) {
  const normalizedOrigin = normalizeOrigin(appOrigin);

  if (!normalizedOrigin) {
    return undefined;
  }

  return proofRuns.find(
    (proofRun) =>
      proofRun.proof_kind === proofKind &&
      proofRun.status === "passed" &&
      normalizeOrigin(proofRun.app_origin) === normalizedOrigin,
  );
}

function latestMatchingCustomerHandoffGateRecord(
  records: FounderAdminCustomerHandoffGateRecord[],
  appOrigin: string | null | undefined,
  branchName: string | null | undefined,
) {
  const normalizedOrigin = normalizeOrigin(appOrigin);
  const normalizedBranch = branchName?.trim();

  if (!normalizedOrigin || !normalizedBranch) {
    return undefined;
  }

  return records.find(
    (record) =>
      record.status === "customer_observed_beta_handoff_gate_passed" &&
      typeof record.admin_handoff_packet_sha256 === "string" &&
      /^[a-f0-9]{64}$/u.test(record.admin_handoff_packet_sha256) &&
      normalizeOrigin(record.app_origin) === normalizedOrigin &&
      record.neon_branch_name === normalizedBranch,
  );
}

function latestMatchingLaunchPackageRecord(
  records: FounderAdminLaunchPackageRecord[],
  appOrigin: string | null | undefined,
  branchName: string | null | undefined,
) {
  const normalizedOrigin = normalizeOrigin(appOrigin);
  const normalizedBranch = branchName?.trim();

  if (!normalizedOrigin || !normalizedBranch) {
    return undefined;
  }

  return records.find(
    (record) =>
      record.status === "admin_launch_package_recorded" &&
      normalizeOrigin(record.app_origin) === normalizedOrigin &&
      record.neon_branch_name === normalizedBranch &&
      record.customer_handoff_recorded === true &&
      record.public_self_serve_launch_allowed === false,
  );
}

function latestMatchingLaunchDecisionRecord(
  records: FounderAdminLaunchDecisionRecord[],
  appOrigin: string | null | undefined,
  branchName: string | null | undefined,
) {
  const normalizedOrigin = normalizeOrigin(appOrigin);
  const normalizedBranch = branchName?.trim();

  if (!normalizedOrigin || !normalizedBranch) {
    return undefined;
  }

  return records.find(
    (record) =>
      record.status === "admin_launch_decision_recorded" &&
      normalizeOrigin(record.app_origin) === normalizedOrigin &&
      record.neon_branch_name === normalizedBranch &&
      record.public_self_serve_launch_allowed === false &&
      record.launch_enablement_allowed === false,
  );
}

function displayDecisionValue(value: FounderAdminLaunchDecisionValue) {
  if (value === "reviewed_for_next_launch_slice") {
    return "reviewed for next launch slice";
  }

  if (value === "changes_requested") {
    return "changes requested";
  }

  return "deferred";
}

function displayTriageDecision(
  value: FounderAdminBetaAccessRequestTriageDecision,
) {
  if (value === "ready_for_operator_fulfillment") {
    return "ready for operator fulfillment";
  }

  if (value === "needs_followup") {
    return "needs follow-up";
  }

  return "not a fit";
}

function displayFollowThroughOutcome(
  value: FounderAdminBetaAccessRequestFollowThroughOutcome,
) {
  if (value === "operator_handoff_completed") {
    return "operator handoff completed";
  }

  if (value === "followup_required") {
    return "follow-up required";
  }

  return "deferred, not ready";
}

export function operatorActionStateLabel(
  value: FounderAdminOperatorActionState,
) {
  if (value === "next") {
    return "Next";
  }

  if (value === "waiting") {
    return "Waiting";
  }

  if (value === "done") {
    return "Done";
  }

  return "Blocked";
}

function commandAction(
  command:
    | {
        command: string;
        detail: string;
        label: string;
        state: "blocked" | "pending" | "ready";
      }
    | undefined,
  options: { complete: boolean; id: string; rank: number; source: string },
): FounderAdminOperatorAction {
  if (!command) {
    return {
      command: "none",
      detail: "Command unavailable in current Admin proof state.",
      id: options.id,
      label: "Command unavailable",
      rank: options.rank,
      source: options.source,
      state: "blocked",
    };
  }

  return {
    command: command.command,
    detail: options.complete
      ? "This evidence is already present for the current Preview and hosted Neon branch."
      : command.detail,
    id: options.id,
    label: command.label,
    rank: options.rank,
    source: options.source,
    state: options.complete
      ? "done"
      : command.state === "ready"
        ? "next"
        : command.state === "pending"
          ? "waiting"
          : "blocked",
  };
}

function proofAction(options: {
  command: string;
  complete: boolean;
  detail: string;
  id: string;
  label: string;
  rank: number;
  runnable: boolean;
  source: string;
}): FounderAdminOperatorAction {
  return {
    command: options.command,
    detail: options.detail,
    id: options.id,
    label: options.label,
    rank: options.rank,
    source: options.source,
    state: options.complete ? "done" : options.runnable ? "next" : "waiting",
  };
}

function freshnessItem({
  command,
  currentBranchName,
  currentPreviewUrl,
  id,
  label,
  record,
  timestampKey,
  unavailableDetail,
}: {
  command: string;
  currentBranchName: string;
  currentPreviewUrl: string;
  id: string;
  label: string;
  record:
    | {
        app_origin: string;
        launch_enablement_allowed?: boolean;
        live_provider_enablement_allowed?: boolean;
        neon_branch_name: string;
        public_self_serve_launch_allowed?: boolean;
      }
    | undefined;
  timestampKey: string;
  unavailableDetail: string;
}): FounderAdminProofFreshnessItem {
  if (!record) {
    return {
      command,
      detail: unavailableDetail,
      id,
      label,
      state: "missing",
    };
  }

  const recordPreviewUrl = record.app_origin;
  const recordBranchName = record.neon_branch_name;
  const launchAllowed =
    record.public_self_serve_launch_allowed === true ||
    record.live_provider_enablement_allowed === true ||
    record.launch_enablement_allowed === true;

  if (launchAllowed) {
    return {
      command,
      detail:
        "Record contains launch-enabling or live-provider metadata; treat it blocked until reviewed.",
      id,
      label,
      recordBranchName,
      recordPreviewUrl,
      state: "blocked",
      timestamp: readRecordTimestamp(record, timestampKey),
    };
  }

  const matchesContext =
    normalizeOrigin(recordPreviewUrl) === normalizeOrigin(currentPreviewUrl) &&
    recordBranchName === currentBranchName;

  return {
    command,
    detail: matchesContext
      ? `${label} matches current Preview and Neon branch.`
      : `${label} points to ${recordPreviewUrl} / ${recordBranchName}; rerun or import for current context.`,
    id,
    label,
    recordBranchName,
    recordPreviewUrl,
    state: matchesContext ? "fresh" : "stale",
    timestamp: readRecordTimestamp(record, timestampKey),
  };
}

function readRecordTimestamp(record: unknown, timestampKey: string) {
  if (!record || typeof record !== "object") {
    return undefined;
  }

  const value = (record as Record<string, unknown>)[timestampKey];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeOrigin(value: string | null | undefined) {
  return value?.trim().replace(/\/+$/u, "") || "";
}

function latestGeneratedAt(...values: Array<string | null | undefined>) {
  return (
    values
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      )
      .sort((left, right) => right.localeCompare(left))[0] ?? null
  );
}
