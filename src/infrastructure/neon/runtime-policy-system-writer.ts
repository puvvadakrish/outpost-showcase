import "server-only";

import type {
  RecordRuntimePolicyCandidateInput,
  RuntimePolicyCandidateWriter,
} from "@/application/runtime-policy/ports";
import type { RuntimePolicySnapshotRecord } from "@/domain/runtime-policy-records";
import {
  assertPolicyDbAuthority,
  type PolicyDbClient,
} from "@/server/policy-db";

interface RuntimePolicySummaryRow {
  summary: {
    answer_topic_count: number;
    compiler_revision: number;
    created_at: string;
    handoff_count: number;
    id: string;
    location_id: string;
    policy_digest: string;
    schema_version: number;
    snapshot_version: number;
    source_digest: string;
    tenant_id: string;
    warning_count: number;
  };
}

export class RuntimePolicySystemWriter implements RuntimePolicyCandidateWriter {
  constructor(private readonly client: PolicyDbClient) {}

  async recordCandidateTransaction(input: RecordRuntimePolicyCandidateInput) {
    await assertPolicyDbAuthority(this.client);
    const result = await this.client.query<RuntimePolicySummaryRow>(
      `select public.record_runtime_policy_candidate($1, $2::jsonb, $3::jsonb) as summary`,
      [
        input.intentToken,
        JSON.stringify(input.policyBody),
        JSON.stringify(input.sourceState),
      ],
    );
    const row = result.rows[0]?.summary;
    if (!row)
      throw new Error("Runtime policy writer returned no candidate summary.");

    return {
      answerTopicCount: Number(row.answer_topic_count),
      candidateCount: Number(row.snapshot_version),
      compilerRevision: Number(row.compiler_revision),
      createdAt: row.created_at,
      decisionCount: 0,
      handoffCount: Number(row.handoff_count),
      id: row.id,
      latestDecision: null,
      latestDecisionAt: null,
      locationId: row.location_id,
      policyDigest: row.policy_digest,
      schemaVersion: Number(row.schema_version),
      snapshotVersion: Number(row.snapshot_version),
      sourceDigest: row.source_digest,
      tenantId: row.tenant_id,
      warningCount: Number(row.warning_count),
    } satisfies RuntimePolicySnapshotRecord;
  }
}
