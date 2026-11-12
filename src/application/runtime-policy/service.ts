import type { AnswerBankEntry } from "@/domain/answer-bank";
import type { HandoffRule } from "@/domain/handoff-rules";
import {
  compileRuntimePolicyCandidate,
  runtimePolicyCompilerRevision,
  type RuntimePolicyDiagnostic,
} from "@/domain/runtime-policy";
import {
  runtimePolicyCandidateBody,
  type RuntimePolicyCandidateLineageRecord,
  type RuntimePolicyCandidateReviewManifestRecord,
  type RuntimePolicyReviewCurrentnessRecord,
  type RuntimePolicyReviewDecision,
  type RuntimePolicyReviewDecisionRecord,
  type RuntimePolicyReviewHistoryRecord,
  type RuntimePolicySnapshotRecord,
} from "@/domain/runtime-policy-records";
import type { Location } from "@/domain/tenancy";
import { runtimePolicySourceState } from "@/server/runtime-policy-source-digest";
import type {
  RuntimePolicyAcceptanceWriter,
  RuntimePolicyCandidateLineageReader,
  RuntimePolicyCandidateReader,
  RuntimePolicyCandidateReviewManifestReader,
  RuntimePolicyCandidateWriter,
  RuntimePolicyIntentIssuer,
  RuntimePolicyRejectionWriter,
  RuntimePolicyReviewCurrentnessChecker,
  RuntimePolicyReviewHistoryReader,
  RuntimePolicySummaryRepository,
} from "./ports";

interface RecordRuntimePolicyCandidateCommand {
  answerBankEntries: readonly AnswerBankEntry[];
  handoffRules: readonly HandoffRule[];
  locationId: string;
  locations: readonly Location[];
  tenantId: string;
}

interface RecordRuntimePolicyReviewCommand {
  answerBankEntries?: readonly AnswerBankEntry[];
  candidateId: string;
  creationKey: string;
  decision: RuntimePolicyReviewDecision;
  handoffRules?: readonly HandoffRule[];
  locations?: readonly Location[];
  tenantId: string;
}

interface CheckRuntimePolicyReviewCurrentnessCommand {
  answerBankEntries: readonly AnswerBankEntry[];
  candidate: RuntimePolicySnapshotRecord;
  handoffRules: readonly HandoffRule[];
  locations: readonly Location[];
  tenantId: string;
}

interface LoadRuntimePolicyReviewHistoryCommand {
  candidate: RuntimePolicySnapshotRecord;
  tenantId: string;
}

interface LoadRuntimePolicyCandidateLineageCommand {
  candidate: RuntimePolicySnapshotRecord;
  tenantId: string;
}

interface LoadRuntimePolicyCandidateReviewManifestCommand {
  candidate: RuntimePolicySnapshotRecord;
  tenantId: string;
}

export type RecordRuntimePolicyCandidateResult =
  | {
      diagnostics: readonly RuntimePolicyDiagnostic[];
      ok: false;
    }
  | {
      diagnostics: readonly RuntimePolicyDiagnostic[];
      ok: true;
      record: RuntimePolicySnapshotRecord;
    };

export type RecordRuntimePolicyReviewResult =
  | {
      diagnostics: readonly RuntimePolicyDiagnostic[];
      ok: false;
    }
  | {
      diagnostics: readonly RuntimePolicyDiagnostic[];
      ok: true;
      record: RuntimePolicyReviewDecisionRecord;
    };

export class RuntimePolicyApplicationService {
  constructor(private readonly repository: RuntimePolicySummaryRepository) {}

  async listOwnerCandidateSummaries(tenantId: string) {
    const normalizedTenantId = tenantId.trim();
    if (!normalizedTenantId)
      throw new Error("Runtime policy tenant identifier is required.");
    return this.repository.listOwnerCandidateSummaries(normalizedTenantId);
  }

  async loadOwnerReviewHistory(
    command: LoadRuntimePolicyReviewHistoryCommand,
    reader: RuntimePolicyReviewHistoryReader,
  ): Promise<RuntimePolicyReviewHistoryRecord> {
    const tenantId = command.tenantId.trim();
    if (!tenantId)
      throw new Error("Runtime policy tenant identifier is required.");
    if (command.candidate.tenantId !== tenantId) {
      throw new Error("Runtime policy candidate is unavailable to this owner.");
    }

    const history = await reader.getOwnerReviewHistory(command.candidate.id);
    if (
      history.candidateId !== command.candidate.id ||
      history.locationId !== command.candidate.locationId ||
      history.snapshotVersion !== command.candidate.snapshotVersion
    ) {
      throw new Error("Runtime policy review history is unavailable.");
    }
    return history;
  }

  async loadOwnerCandidateLineage(
    command: LoadRuntimePolicyCandidateLineageCommand,
    reader: RuntimePolicyCandidateLineageReader,
  ): Promise<RuntimePolicyCandidateLineageRecord> {
    const tenantId = command.tenantId.trim();
    if (!tenantId)
      throw new Error("Runtime policy tenant identifier is required.");
    if (command.candidate.tenantId !== tenantId) {
      throw new Error("Runtime policy candidate is unavailable to this owner.");
    }

    const lineage = await reader.getOwnerCandidateLineage(command.candidate.id);
    if (
      lineage.anchorCandidateId !== command.candidate.id ||
      lineage.locationId !== command.candidate.locationId ||
      lineage.anchorSnapshotVersion !== command.candidate.snapshotVersion
    ) {
      throw new Error("Runtime policy candidate lineage is unavailable.");
    }
    return lineage;
  }

  async loadOwnerCandidateReviewManifest(
    command: LoadRuntimePolicyCandidateReviewManifestCommand,
    reader: RuntimePolicyCandidateReviewManifestReader,
  ): Promise<RuntimePolicyCandidateReviewManifestRecord> {
    const tenantId = command.tenantId.trim();
    if (!tenantId)
      throw new Error("Runtime policy tenant identifier is required.");
    if (command.candidate.tenantId !== tenantId) {
      throw new Error("Runtime policy candidate is unavailable to this owner.");
    }

    const manifest = await reader.getOwnerCandidateReviewManifest(
      command.candidate.id,
    );
    if (
      manifest.candidateId !== command.candidate.id ||
      manifest.locationId !== command.candidate.locationId ||
      manifest.snapshotVersion !== command.candidate.snapshotVersion ||
      manifest.answerTopicCount !== command.candidate.answerTopicCount ||
      manifest.handoffCount !== command.candidate.handoffCount ||
      manifest.answerTopics.length !==
        Math.min(command.candidate.answerTopicCount, 10) ||
      manifest.answerTopicsHasMore !==
        (command.candidate.answerTopicCount > 10) ||
      manifest.handoffs.length !== Math.min(command.candidate.handoffCount, 10) ||
      manifest.handoffsHasMore !== (command.candidate.handoffCount > 10)
    ) {
      throw new Error("Runtime policy candidate review manifest is unavailable.");
    }
    return manifest;
  }

  async checkReviewCurrentness(
    command: CheckRuntimePolicyReviewCurrentnessCommand,
    checker: RuntimePolicyReviewCurrentnessChecker,
  ): Promise<RuntimePolicyReviewCurrentnessRecord> {
    const tenantId = command.tenantId.trim();
    if (!tenantId)
      throw new Error("Runtime policy tenant identifier is required.");
    if (command.candidate.tenantId !== tenantId) {
      throw new Error("Runtime policy candidate is unavailable to this owner.");
    }

    const checkedAt = new Date().toISOString();
    const localResult = (
      reason: RuntimePolicyReviewCurrentnessRecord["reason"],
    ): RuntimePolicyReviewCurrentnessRecord => ({
      candidateId: command.candidate.id,
      checkedAt,
      locationId: command.candidate.locationId,
      outcome: "review_required",
      reason,
    });

    if (command.candidate.latestDecision !== "accepted") {
      return localResult("not_accepted");
    }

    const location = command.locations.find(
      (row) =>
        row.id === command.candidate.locationId && row.tenantId === tenantId,
    );
    if (!location || location.status !== "active") {
      return localResult("source_or_candidate_changed");
    }

    const compiled = compileRuntimePolicyCandidate({
      answerBankEntries: command.answerBankEntries,
      handoffRules: command.handoffRules,
      location,
      tenantId,
    });
    if (!compiled.ok) return localResult("compiler_blocked");

    return checker.checkReviewCurrentness({
      candidateId: command.candidate.id,
      policyBody: runtimePolicyCandidateBody(compiled.candidate),
      sourceState: runtimePolicySourceState({
        answerBankEntries: command.answerBankEntries,
        handoffRules: command.handoffRules,
        location,
        tenantId,
      }),
    });
  }

  async recordReviewDecision(
    command: RecordRuntimePolicyReviewCommand,
    candidateReader: RuntimePolicyCandidateReader,
    rejectionWriter: RuntimePolicyRejectionWriter,
    acceptanceWriter: RuntimePolicyAcceptanceWriter | undefined,
  ): Promise<RecordRuntimePolicyReviewResult> {
    const tenantId = command.tenantId.trim();
    const candidateId = command.candidateId.trim();
    const creationKey = command.creationKey.trim();
    if (!tenantId)
      throw new Error("Runtime policy tenant identifier is required.");
    if (!candidateId)
      throw new Error("Runtime policy candidate identifier is required.");
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(creationKey))
      throw new Error("Runtime policy review retry key is invalid.");

    const candidate = await candidateReader.getOwnerCandidateSummary(candidateId);
    if (!candidate || candidate.tenantId !== tenantId) {
      throw new Error("Runtime policy candidate is unavailable to this owner.");
    }

    if (command.decision === "rejected") {
      const record = await rejectionWriter.recordRejection({
        candidateId,
        creationKey,
      });
      return { diagnostics: [], ok: true, record };
    }

    const locations = command.locations ?? [];
    const location = locations.find(
      (row) => row.id === candidate.locationId && row.tenantId === tenantId,
    );
    if (!location) {
      throw new Error("Runtime policy location is unavailable to this tenant.");
    }

    const answerBankEntries = command.answerBankEntries ?? [];
    const handoffRules = command.handoffRules ?? [];
    const compiled = compileRuntimePolicyCandidate({
      answerBankEntries,
      handoffRules,
      location,
      tenantId,
    });
    if (!compiled.ok) {
      return { diagnostics: compiled.diagnostics, ok: false };
    }
    if (!acceptanceWriter) {
      throw new Error("Runtime policy acceptance writer is unavailable.");
    }

    const policyBody = runtimePolicyCandidateBody(compiled.candidate);
    const record = await acceptanceWriter.recordAcceptance({
      candidateId,
      creationKey,
      policyBody,
      sourceState: runtimePolicySourceState({
        answerBankEntries,
        handoffRules,
        location,
        tenantId,
      }),
    });
    return { diagnostics: compiled.diagnostics, ok: true, record };
  }

  async recordCandidate(
    command: RecordRuntimePolicyCandidateCommand,
    intentIssuer: RuntimePolicyIntentIssuer,
    writer: RuntimePolicyCandidateWriter,
  ): Promise<RecordRuntimePolicyCandidateResult> {
    const tenantId = command.tenantId.trim();
    const locationId = command.locationId.trim();

    if (!tenantId)
      throw new Error("Runtime policy tenant identifier is required.");
    if (!locationId)
      throw new Error("Runtime policy location identifier is required.");

    const location = command.locations.find(
      (candidate) =>
        candidate.id === locationId && candidate.tenantId === tenantId,
    );
    if (!location)
      throw new Error("Runtime policy location is unavailable to this tenant.");

    const compiled = compileRuntimePolicyCandidate({
      answerBankEntries: command.answerBankEntries,
      handoffRules: command.handoffRules,
      location,
      tenantId,
    });
    if (!compiled.ok) {
      return { diagnostics: compiled.diagnostics, ok: false };
    }

    const policyBody = runtimePolicyCandidateBody(compiled.candidate);
    const intentToken = await intentIssuer.issueCandidateIntent({
      compilerRevision: runtimePolicyCompilerRevision,
      locationId,
      policyBody,
      tenantId,
    });
    const record = await writer.recordCandidateTransaction({
      intentToken,
      policyBody,
      sourceState: runtimePolicySourceState({
        answerBankEntries: command.answerBankEntries,
        handoffRules: command.handoffRules,
        location,
        tenantId,
      }),
    });

    return { diagnostics: compiled.diagnostics, ok: true, record };
  }
}
