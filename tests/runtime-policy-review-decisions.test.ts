import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  RecordRuntimePolicyAcceptanceInput,
  RecordRuntimePolicyRejectionInput,
  RuntimePolicyAcceptanceWriter,
  RuntimePolicyCandidateReader,
  RuntimePolicyRejectionWriter,
  RuntimePolicySummaryRepository,
} from "@/application/runtime-policy/ports";
import { RuntimePolicyApplicationService } from "@/application/runtime-policy/service";
import type { AnswerBankEntry } from "@/domain/answer-bank";
import type { HandoffRule } from "@/domain/handoff-rules";
import type {
  RuntimePolicyReviewDecisionRecord,
  RuntimePolicySnapshotRecord,
} from "@/domain/runtime-policy-records";
import type { Location } from "@/domain/tenancy";
import { NeonRuntimePolicyRepository } from "@/infrastructure/neon/runtime-policy-repository";

vi.mock("server-only", () => ({}));

const migration = readFileSync(
  "neon/migrations/20260714000000_runtime_policy_review_decisions.sql",
  "utf8",
);
const ownerActionSource = readFileSync("src/app/owner/actions.ts", "utf8");

const candidate: RuntimePolicySnapshotRecord = {
  answerTopicCount: 1,
  candidateCount: 1,
  compilerRevision: 1,
  createdAt: "2026-07-14T12:00:00.000Z",
  decisionCount: 0,
  handoffCount: 1,
  id: "runtime_policy_snapshot_1",
  latestDecision: null,
  latestDecisionAt: null,
  locationId: "location_a",
  policyDigest: "b".repeat(64),
  schemaVersion: 1,
  snapshotVersion: 1,
  sourceDigest: "a".repeat(64),
  tenantId: "tenant_a",
  warningCount: 0,
};

const decisionRecord: RuntimePolicyReviewDecisionRecord = {
  candidateId: candidate.id,
  createdAt: "2026-07-14T12:05:00.000Z",
  decision: "accepted",
  decisionCount: 1,
  decisionSequence: 1,
  id: "runtime_policy_review_1",
  locationId: candidate.locationId,
  snapshotVersion: candidate.snapshotVersion,
  tenantId: candidate.tenantId,
};

const location: Location = {
  address: "North",
  id: candidate.locationId,
  name: "North",
  status: "active",
  tenantId: candidate.tenantId,
  timezone: "America/Chicago",
};

const answer: AnswerBankEntry = {
  answer: "Open weekdays",
  approvalStatus: "approved",
  id: "answer_hours",
  ownerAction: "approve",
  question: "When are you open?",
  reviewNote: "Owner-only note",
  runtimeBehavior: "answer_live",
  sourceLabel: "Owner-only source",
  tenantId: candidate.tenantId,
  topic: "Hours",
  updatedAt: "2026-07-14T00:00:00.000Z",
};

const handoff: HandoffRule = {
  action: "create_task",
  activeWindow: "always",
  destination: "front desk queue",
  id: "rule_freeze",
  priority: 10,
  status: "active",
  tenantId: candidate.tenantId,
  topic: "Freeze",
  trigger: "topic",
};

class FakeReviewBoundary
  implements
    RuntimePolicySummaryRepository,
    RuntimePolicyCandidateReader,
    RuntimePolicyRejectionWriter,
    RuntimePolicyAcceptanceWriter
{
  acceptances: RecordRuntimePolicyAcceptanceInput[] = [];
  rejections: RecordRuntimePolicyRejectionInput[] = [];

  async listOwnerCandidateSummaries() {
    return [candidate];
  }

  async getOwnerCandidateSummary(candidateId: string) {
    return candidateId === candidate.id ? candidate : null;
  }

  async recordRejection(input: RecordRuntimePolicyRejectionInput) {
    this.rejections.push(input);
    return { ...decisionRecord, decision: "rejected" as const };
  }

  async recordAcceptance(input: RecordRuntimePolicyAcceptanceInput) {
    this.acceptances.push(input);
    return decisionRecord;
  }
}

describe("RuntimePolicyApplicationService review decisions", () => {
  it("records rejection without compiling or invoking protected acceptance authority", async () => {
    const boundary = new FakeReviewBoundary();
    const service = new RuntimePolicyApplicationService(boundary);

    await expect(
      service.recordReviewDecision(
        {
          candidateId: candidate.id,
          creationKey: "review:rejected:1",
          decision: "rejected",
          tenantId: candidate.tenantId,
        },
        boundary,
        boundary,
        undefined,
      ),
    ).resolves.toMatchObject({
      diagnostics: [],
      ok: true,
      record: { decision: "rejected" },
    });
    expect(boundary.rejections).toEqual([
      { candidateId: candidate.id, creationKey: "review:rejected:1" },
    ]);
    expect(boundary.acceptances).toEqual([]);
  });

  it("freshly compiles acceptance and sends only exact body-bound evidence", async () => {
    const boundary = new FakeReviewBoundary();
    const service = new RuntimePolicyApplicationService(boundary);

    await expect(
      service.recordReviewDecision(
        {
          answerBankEntries: [answer],
          candidateId: candidate.id,
          creationKey: "review:accepted:1",
          decision: "accepted",
          handoffRules: [handoff],
          locations: [location],
          tenantId: candidate.tenantId,
        },
        boundary,
        boundary,
        boundary,
      ),
    ).resolves.toEqual({ diagnostics: [], ok: true, record: decisionRecord });
    expect(boundary.rejections).toEqual([]);
    expect(boundary.acceptances).toHaveLength(1);
    expect(boundary.acceptances[0]).toMatchObject({
      candidateId: candidate.id,
      creationKey: "review:accepted:1",
    });
    expect(boundary.acceptances[0]?.sourceState).toMatchObject({
      location: { id: candidate.locationId, status: "active" },
      tenantId: candidate.tenantId,
    });
    expect(JSON.stringify(boundary.acceptances[0])).not.toContain("Owner-only");
  });

  it("fails closed before acceptance persistence when current compilation is ambiguous", async () => {
    const boundary = new FakeReviewBoundary();
    const service = new RuntimePolicyApplicationService(boundary);
    const result = await service.recordReviewDecision(
      {
        answerBankEntries: [answer, { ...answer, id: "answer_duplicate" }],
        candidateId: candidate.id,
        creationKey: "review:accepted:2",
        decision: "accepted",
        handoffRules: [],
        locations: [location],
        tenantId: candidate.tenantId,
      },
      boundary,
      boundary,
      boundary,
    );

    expect(result.ok).toBe(false);
    expect(boundary.acceptances).toEqual([]);
  });

  it("rejects invalid retry keys, missing candidates, and cross-tenant summaries", async () => {
    const boundary = new FakeReviewBoundary();
    const service = new RuntimePolicyApplicationService(boundary);
    const base = {
      candidateId: candidate.id,
      creationKey: "review:rejected:3",
      decision: "rejected" as const,
      tenantId: candidate.tenantId,
    };

    await expect(
      service.recordReviewDecision(
        { ...base, creationKey: "bad" },
        boundary,
        boundary,
        undefined,
      ),
    ).rejects.toThrow("retry key is invalid");
    await expect(
      service.recordReviewDecision(
        { ...base, candidateId: "missing" },
        boundary,
        boundary,
        undefined,
      ),
    ).rejects.toThrow("candidate is unavailable");
    await expect(
      service.recordReviewDecision(
        { ...base, tenantId: "tenant_foreign" },
        boundary,
        boundary,
        undefined,
      ),
    ).rejects.toThrow("candidate is unavailable");
  });
});

describe("runtime policy review adapters", () => {
  it("maps bounded summaries and keeps decision actor/history out of the client record", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        answer_topic_count: 1,
        candidate_count: 1,
        compiler_revision: 1,
        created_at: candidate.createdAt,
        decision_count: 2,
        handoff_count: 1,
        id: candidate.id,
        latest_decision: "rejected",
        latest_decision_at: decisionRecord.createdAt,
        location_id: candidate.locationId,
        policy_digest: candidate.policyDigest,
        schema_version: 1,
        snapshot_version: 1,
        source_digest: candidate.sourceDigest,
        tenant_id: candidate.tenantId,
        warning_count: 0,
      }],
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository({ rpc } as never);

    await expect(repository.getOwnerCandidateSummary(candidate.id)).resolves.toMatchObject({
      decisionCount: 2,
      latestDecision: "rejected",
      latestDecisionAt: decisionRecord.createdAt,
    });
    expect(rpc).toHaveBeenCalledWith("get_runtime_policy_candidate_summary", {
      p_candidate_id: candidate.id,
    });
  });

  it("records acceptance and rejection without submitted tenant or actor identity", async () => {
    const acceptedRow = {
      candidate_id: candidate.id,
      created_at: decisionRecord.createdAt,
      decision: "accepted",
      decision_count: 1,
      decision_sequence: 1,
      id: decisionRecord.id,
      location_id: candidate.locationId,
      snapshot_version: 1,
      tenant_id: candidate.tenantId,
    };
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: acceptedRow, error: null })
      .mockResolvedValueOnce({
        data: { ...acceptedRow, decision: "rejected" },
        error: null,
      });
    const repository = new NeonRuntimePolicyRepository({ rpc } as never);
    const policyBody = {
      answerTopics: [],
      defaultPolicy: { kind: "create_staff_task" as const },
      handoffs: [],
      warnings: [],
    };

    const sourceState = {
      answers: [],
      handoffs: [],
      location: {
        id: candidate.locationId,
        status: "active" as const,
        tenantId: candidate.tenantId,
      },
      tenantId: candidate.tenantId,
    };

    await repository.recordAcceptance({
      candidateId: candidate.id,
      creationKey: "review:accepted:adapter",
      policyBody,
      sourceState,
    });
    await repository.recordRejection({
      candidateId: candidate.id,
      creationKey: "review:rejected:adapter",
    });
    expect(rpc.mock.calls[0]).toEqual([
      "record_runtime_policy_acceptance",
      {
        p_candidate_id: candidate.id,
        p_creation_key: "review:accepted:adapter",
        p_policy_body: policyBody,
        p_source_state: sourceState,
      },
    ]);
    expect(rpc.mock.calls[1]).toEqual([
      "record_runtime_policy_rejection",
      {
        p_candidate_id: candidate.id,
        p_creation_key: "review:rejected:adapter",
      },
    ]);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("actor_user_id");
  });
});

describe("runtime policy review migration contract", () => {
  it("creates immutable review evidence with exact candidate and actor relations", () => {
    expect(migration).toContain("create table runtime_policy_review_decisions");
    expect(migration).toContain("before update or delete on runtime_policy_review_decisions");
    expect(migration).toContain("references runtime_policy_snapshots(tenant_id, location_id, id)");
    expect(migration).toContain("references tenant_memberships(tenant_id, user_id)");
    expect(migration).toContain("previous_decision_id");
    expect(migration).toContain("unique (tenant_id, decided_by_user_id, creation_key)");
  });

  it("keeps both decisions on authenticated owner authority with exact-current acceptance", () => {
    expect(migration).toContain("record_runtime_policy_rejection");
    expect(migration).toContain("record_runtime_policy_acceptance");
    expect(migration).toContain("runtime policy acceptance requires the latest candidate");
    expect(migration).toContain("v_candidate.policy_body <> p_policy_body");
    expect(migration).toContain("v_candidate.source_digest <> v_source_digest");
    expect(migration).toContain(
      "grant execute on function record_runtime_policy_acceptance(text, jsonb, jsonb, text)\n  to authenticated",
    );
    expect(migration).not.toContain("runtime_policy_review_intents");
    expect(migration).not.toContain("issue_runtime_policy_acceptance_intent");
  });

  it("serializes decisions, replays exact work, and emits minimal owner-only audit", () => {
    const locationLockAt = migration.indexOf("from public.locations location");
    const lockAt = migration.indexOf("and snapshot.id = p_candidate_id\n   for update");
    const latestAt = migration.indexOf("order by decision_row.decision_sequence desc");
    const insertAt = migration.indexOf("insert into public.runtime_policy_review_decisions");
    expect(locationLockAt).toBeGreaterThan(0);
    expect(lockAt).toBeGreaterThan(locationLockAt);
    expect(latestAt).toBeGreaterThan(lockAt);
    expect(insertAt).toBeGreaterThan(latestAt);
    expect(migration).toContain("retry key conflicts with different work");
    expect(migration).toContain("v_latest.decided_by_user_id = p_actor_user_id");
    expect(migration).toContain("candidate_was_latest");
    expect(migration).toContain("'visibility', 'owner_only'");
    expect(migration).not.toContain("answer_text");
    expect(migration).not.toContain("destination_text");
  });

  it("keeps the browser decision contract free of authority and policy fields", () => {
    const reviewAction = ownerActionSource.slice(
      ownerActionSource.indexOf("export async function reviewRuntimePolicyCandidateAction"),
    );
    expect(reviewAction).toContain('formData.get("candidateId")');
    expect(reviewAction).toContain('formData.get("creationKey")');
    expect(reviewAction).toContain('formData.get("decision")');
    expect(reviewAction).not.toContain('formData.get("tenantId")');
    expect(reviewAction).not.toContain('formData.get("ownerId")');
    expect(reviewAction).not.toContain('formData.get("policyBody")');
    expect(reviewAction).not.toContain('formData.get("sourceDigest")');
    expect(reviewAction).not.toContain('formData.get("policyDigest")');
    expect(reviewAction).not.toContain('formData.get("activationState")');
  });
});
