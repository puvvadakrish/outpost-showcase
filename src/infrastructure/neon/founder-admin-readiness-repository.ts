import "server-only";

import {
  emptyFounderAdminBetaAccessRequestFollowThroughOutcomeReport,
  emptyFounderAdminBetaAccessRequestReport,
  emptyFounderAdminBetaAccessRequestTriageReceiptReport,
  emptyFounderAdminBetaProofRunSummaryRecordReport,
  emptyFounderAdminCustomerHandoffGateReport,
  emptyFounderAdminCustomerSessionRecordReport,
  emptyFounderAdminHandoffPacketRecordReport,
  emptyFounderAdminLaunchDecisionRecordReport,
  emptyFounderAdminLaunchPackageRecordReport,
  emptyFounderAdminOperatorSelfServeRehearsalReport,
  emptyFounderAdminProofRunReport,
  emptyFounderAdminOwnerReadinessReport,
  type FounderAdminBetaAccessRequestFollowThroughOutcomeReport,
  type FounderAdminBetaAccessRequestReport,
  type FounderAdminBetaAccessRequestTriageReceiptReport,
  type FounderAdminBetaProofRunSummaryRecordReport,
  type FounderAdminCustomerHandoffGateReport,
  type FounderAdminCustomerSessionRecordReport,
  type FounderAdminHandoffPacketRecordReport,
  type FounderAdminLaunchDecisionRecordReport,
  type FounderAdminLaunchPackageRecordReport,
  type FounderAdminOperatorSelfServeRehearsalReport,
  type FounderAdminProofRunReport,
  type FounderAdminOwnerReadinessReport,
} from "@/domain/founder-admin-readiness";
import {
  emptyProviderNormalizedDigestReport,
  type ProviderNormalizedDigestReport,
} from "@/domain/provider-normalized-digest";
import type { OutpostNeonClient } from "@/server/neon/server-client";

function normalizeReport(value: unknown): FounderAdminOwnerReadinessReport {
  if (!value || typeof value !== "object") {
    return emptyFounderAdminOwnerReadinessReport;
  }

  const candidate = value as Partial<FounderAdminOwnerReadinessReport>;

  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as FounderAdminOwnerReadinessReport;
}

function normalizeProofRunReport(value: unknown): FounderAdminProofRunReport {
  if (!value || typeof value !== "object") {
    return emptyFounderAdminProofRunReport;
  }

  const candidate = value as Partial<FounderAdminProofRunReport>;

  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as FounderAdminProofRunReport;
}

function normalizeCustomerHandoffGateReport(
  value: unknown,
): FounderAdminCustomerHandoffGateReport {
  if (!value || typeof value !== "object") {
    return emptyFounderAdminCustomerHandoffGateReport;
  }

  const candidate = value as Partial<FounderAdminCustomerHandoffGateReport>;

  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as FounderAdminCustomerHandoffGateReport;
}

function normalizeCustomerSessionRecordReport(
  value: unknown,
): FounderAdminCustomerSessionRecordReport {
  if (!value || typeof value !== "object") {
    return emptyFounderAdminCustomerSessionRecordReport;
  }
  const candidate = value as Partial<FounderAdminCustomerSessionRecordReport>;
  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as FounderAdminCustomerSessionRecordReport;
}
function normalizeLaunchPackageRecordReport(
  value: unknown,
): FounderAdminLaunchPackageRecordReport {
  if (!value || typeof value !== "object") {
    return emptyFounderAdminLaunchPackageRecordReport;
  }

  const candidate = value as Partial<FounderAdminLaunchPackageRecordReport>;

  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as FounderAdminLaunchPackageRecordReport;
}

function normalizeBetaProofRunSummaryRecordReport(
  value: unknown,
): FounderAdminBetaProofRunSummaryRecordReport {
  if (!value || typeof value !== "object") {
    return emptyFounderAdminBetaProofRunSummaryRecordReport;
  }

  const candidate =
    value as Partial<FounderAdminBetaProofRunSummaryRecordReport>;

  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as FounderAdminBetaProofRunSummaryRecordReport;
}

function normalizeLaunchDecisionRecordReport(
  value: unknown,
): FounderAdminLaunchDecisionRecordReport {
  if (!value || typeof value !== "object") {
    return emptyFounderAdminLaunchDecisionRecordReport;
  }

  const candidate = value as Partial<FounderAdminLaunchDecisionRecordReport>;

  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as FounderAdminLaunchDecisionRecordReport;
}

function normalizeHandoffPacketRecordReport(
  value: unknown,
): FounderAdminHandoffPacketRecordReport {
  if (!value || typeof value !== "object") {
    return emptyFounderAdminHandoffPacketRecordReport;
  }

  const candidate = value as Partial<FounderAdminHandoffPacketRecordReport>;

  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as FounderAdminHandoffPacketRecordReport;
}

function normalizeOperatorSelfServeRehearsalReport(
  value: unknown,
): FounderAdminOperatorSelfServeRehearsalReport {
  if (!value || typeof value !== "object") {
    return emptyFounderAdminOperatorSelfServeRehearsalReport;
  }

  const candidate =
    value as Partial<FounderAdminOperatorSelfServeRehearsalReport>;

  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as FounderAdminOperatorSelfServeRehearsalReport;
}

function normalizeBetaAccessRequestReport(
  value: unknown,
): FounderAdminBetaAccessRequestReport {
  if (!value || typeof value !== "object") {
    return emptyFounderAdminBetaAccessRequestReport;
  }

  const candidate = value as Partial<FounderAdminBetaAccessRequestReport>;

  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as FounderAdminBetaAccessRequestReport;
}

function normalizeBetaAccessRequestTriageReceiptReport(
  value: unknown,
): FounderAdminBetaAccessRequestTriageReceiptReport {
  if (!value || typeof value !== "object") {
    return emptyFounderAdminBetaAccessRequestTriageReceiptReport;
  }

  const candidate =
    value as Partial<FounderAdminBetaAccessRequestTriageReceiptReport>;

  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as FounderAdminBetaAccessRequestTriageReceiptReport;
}

function normalizeBetaAccessRequestFollowThroughOutcomeReport(
  value: unknown,
): FounderAdminBetaAccessRequestFollowThroughOutcomeReport {
  if (!value || typeof value !== "object") {
    return emptyFounderAdminBetaAccessRequestFollowThroughOutcomeReport;
  }

  const candidate =
    value as Partial<FounderAdminBetaAccessRequestFollowThroughOutcomeReport>;

  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as FounderAdminBetaAccessRequestFollowThroughOutcomeReport;
}

function normalizeProviderNormalizedDigestReport(
  value: unknown,
): ProviderNormalizedDigestReport {
  if (!value || typeof value !== "object") {
    return emptyProviderNormalizedDigestReport;
  }

  const candidate = value as Partial<ProviderNormalizedDigestReport>;

  return {
    authorized: candidate.authorized === true,
    generated_at:
      typeof candidate.generated_at === "string"
        ? candidate.generated_at
        : null,
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
  } as ProviderNormalizedDigestReport;
}

export class NeonFounderAdminReadinessRepository {
  constructor(private readonly neon: OutpostNeonClient) {}

  async loadOwnerReadiness(): Promise<FounderAdminOwnerReadinessReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_owner_readiness",
    );

    if (error) {
      throw new Error(
        `Unable to load admin portal owner readiness: ${error.message}`,
      );
    }

    return normalizeReport(data);
  }

  async loadProofRuns(): Promise<FounderAdminProofRunReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_proof_runs",
    );

    if (error) {
      throw new Error(
        `Unable to load admin portal proof runs: ${error.message}`,
      );
    }

    return normalizeProofRunReport(data);
  }

  async loadCustomerHandoffGateRecords(): Promise<FounderAdminCustomerHandoffGateReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_customer_handoff_gate_records",
    );

    if (error) {
      throw new Error(
        `Unable to load admin portal customer handoff gate records: ${error.message}`,
      );
    }

    return normalizeCustomerHandoffGateReport(data);
  }

  async loadCustomerSessionRecords(): Promise<FounderAdminCustomerSessionRecordReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_customer_session_records",
    );
    if (error) {
      throw new Error(
        `Unable load admin portal customer session records: ${error.message}`,
      );
    }
    return normalizeCustomerSessionRecordReport(data);
  }
  async loadLaunchPackageRecords(): Promise<FounderAdminLaunchPackageRecordReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_launch_package_records",
    );

    if (error) {
      throw new Error(
        `Unable to load admin portal launch package records: ${error.message}`,
      );
    }

    return normalizeLaunchPackageRecordReport(data);
  }

  async loadBetaProofRunSummaryRecords(): Promise<FounderAdminBetaProofRunSummaryRecordReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_beta_proof_run_summary_records",
    );

    if (error) {
      throw new Error(
        `Unable load admin portal beta proof-run summary records: ${error.message}`,
      );
    }

    return normalizeBetaProofRunSummaryRecordReport(data);
  }

  async loadLaunchDecisionRecords(): Promise<FounderAdminLaunchDecisionRecordReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_launch_decision_records",
    );

    if (error) {
      throw new Error(
        `Unable to load admin portal launch decision records: ${error.message}`,
      );
    }

    return normalizeLaunchDecisionRecordReport(data);
  }

  async loadHandoffPacketRecords(): Promise<FounderAdminHandoffPacketRecordReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_handoff_packet_records",
    );

    if (error) {
      throw new Error(
        `Unable load admin portal handoff packet records: ${error.message}`,
      );
    }

    return normalizeHandoffPacketRecordReport(data);
  }

  async loadOperatorSelfServeRehearsalRecords(): Promise<FounderAdminOperatorSelfServeRehearsalReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_operator_self_serve_rehearsal_records",
    );

    if (error) {
      throw new Error(
        `Unable to load admin portal operator self-serve rehearsal records: ${error.message}`,
      );
    }

    return normalizeOperatorSelfServeRehearsalReport(data);
  }

  async loadBetaAccessRequests(): Promise<FounderAdminBetaAccessRequestReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_beta_access_requests",
    );

    if (error) {
      throw new Error(
        `Unable to load admin portal beta access requests: ${error.message}`,
      );
    }

    return normalizeBetaAccessRequestReport(data);
  }

  async loadBetaAccessRequestTriageReceipts(): Promise<FounderAdminBetaAccessRequestTriageReceiptReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_beta_access_request_triage_receipts",
    );

    if (error) {
      throw new Error(
        `Unable to load admin portal beta access request triage receipts: ${error.message}`,
      );
    }

    return normalizeBetaAccessRequestTriageReceiptReport(data);
  }

  async loadBetaAccessRequestFollowThroughOutcomes(): Promise<FounderAdminBetaAccessRequestFollowThroughOutcomeReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_beta_access_request_followthrough_outcomes",
    );

    if (error) {
      throw new Error(
        `Unable load admin portal beta access request follow-through outcomes: ${error.message}`,
      );
    }

    return normalizeBetaAccessRequestFollowThroughOutcomeReport(data);
  }

  async loadProviderNormalizedDigest(): Promise<ProviderNormalizedDigestReport> {
    const { data, error } = await this.neon.rpc(
      "list_founder_admin_provider_normalized_digest",
    );

    if (error) {
      throw new Error(
        `Unable to load admin portal provider normalized digest: ${error.message}`,
      );
    }

    return normalizeProviderNormalizedDigestReport(data);
  }
}
