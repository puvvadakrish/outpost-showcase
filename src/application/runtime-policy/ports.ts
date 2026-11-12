import type {
  RuntimePolicyCandidateLineageRecord,
  RuntimePolicyCandidateBody,
  RuntimePolicyCandidateReviewManifestRecord,
  RuntimePolicyReviewCurrentnessRecord,
  RuntimePolicyReviewDecisionRecord,
  RuntimePolicyReviewHistoryRecord,
  RuntimePolicySnapshotRecord,
} from "@/domain/runtime-policy-records";
import type { RuntimePolicySourceState } from "@/server/runtime-policy-source-digest";

export interface RecordRuntimePolicyCandidateInput {
  intentToken: string;
  policyBody: RuntimePolicyCandidateBody;
  sourceState: RuntimePolicySourceState;
}

export interface IssueRuntimePolicyCandidateIntentInput {
  compilerRevision: number;
  locationId: string;
  policyBody: RuntimePolicyCandidateBody;
  tenantId: string;
}

export interface RecordRuntimePolicyAcceptanceInput {
  candidateId: string;
  creationKey: string;
  policyBody: RuntimePolicyCandidateBody;
  sourceState: RuntimePolicySourceState;
}

export interface RecordRuntimePolicyRejectionInput {
  candidateId: string;
  creationKey: string;
}

export interface CheckRuntimePolicyReviewCurrentnessInput {
  candidateId: string;
  policyBody: RuntimePolicyCandidateBody;
  sourceState: RuntimePolicySourceState;
}

export interface RuntimePolicySummaryRepository {
  listOwnerCandidateSummaries(
    tenantId: string,
  ): Promise<RuntimePolicySnapshotRecord[]>;
}

export interface RuntimePolicyCandidateReader {
  getOwnerCandidateSummary(
    candidateId: string,
  ): Promise<RuntimePolicySnapshotRecord | null>;
}

export interface RuntimePolicyCandidateWriter {
  recordCandidateTransaction(
    input: RecordRuntimePolicyCandidateInput,
  ): Promise<RuntimePolicySnapshotRecord>;
}

export interface RuntimePolicyIntentIssuer {
  issueCandidateIntent(
    input: IssueRuntimePolicyCandidateIntentInput,
  ): Promise<string>;
}

export interface RuntimePolicyAcceptanceWriter {
  recordAcceptance(
    input: RecordRuntimePolicyAcceptanceInput,
  ): Promise<RuntimePolicyReviewDecisionRecord>;
}

export interface RuntimePolicyRejectionWriter {
  recordRejection(
    input: RecordRuntimePolicyRejectionInput,
  ): Promise<RuntimePolicyReviewDecisionRecord>;
}

export interface RuntimePolicyReviewCurrentnessChecker {
  checkReviewCurrentness(
    input: CheckRuntimePolicyReviewCurrentnessInput,
  ): Promise<RuntimePolicyReviewCurrentnessRecord>;
}

export interface RuntimePolicyReviewHistoryReader {
  getOwnerReviewHistory(
    candidateId: string,
  ): Promise<RuntimePolicyReviewHistoryRecord>;
}

export interface RuntimePolicyCandidateLineageReader {
  getOwnerCandidateLineage(
    anchorCandidateId: string,
  ): Promise<RuntimePolicyCandidateLineageRecord>;
}

export interface RuntimePolicyCandidateReviewManifestReader {
  getOwnerCandidateReviewManifest(
    candidateId: string,
  ): Promise<RuntimePolicyCandidateReviewManifestRecord>;
}
