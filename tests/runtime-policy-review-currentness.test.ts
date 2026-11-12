import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  CheckRuntimePolicyReviewCurrentnessInput,
  RuntimePolicyReviewCurrentnessChecker,
  RuntimePolicySummaryRepository,
} from "@/application/runtime-policy/ports";
import { RuntimePolicyApplicationService } from "@/application/runtime-policy/service";
import type { AnswerBankEntry } from "@/domain/answer-bank";
import type { HandoffRule } from "@/domain/handoff-rules";
import type {
  RuntimePolicyReviewCurrentnessRecord,
  RuntimePolicySnapshotRecord,
} from "@/domain/runtime-policy-records";
import type { Location } from "@/domain/tenancy";
import { NeonRuntimePolicyRepository } from "@/infrastructure/neon/runtime-policy-repository";

vi.mock("server-only", () => ({}));

const migrationPath =
  "neon/migrations/20260714010000_runtime_policy_review_currentness.sql";
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";
const ownerPageSource = readFileSync("src/app/owner/page.tsx", "utf8");
const ownerActionSource = readFileSync("src/app/owner/actions.ts", "utf8");
const ownerWorkspaceSource = readFileSync(
  "src/components/owner/OwnerSetupWorkspaceClient.tsx",
  "utf8",
);

const candidate: RuntimePolicySnapshotRecord = {
  answerTopicCount: 1,
  candidateCount: 1,
  compilerRevision: 1,
  createdAt: "2026-07-14T12:00:00.000Z",
  decisionCount: 1,
  handoffCount: 1,
  id: "runtime_policy_snapshot_1",
  latestDecision: "accepted",
  latestDecisionAt: "2026-07-14T12:05:00.000Z",
  locationId: "location_a",
  policyDigest: "b".repeat(64),
  schemaVersion: 1,
  snapshotVersion: 1,
  sourceDigest: "a".repeat(64),
  tenantId: "tenant_a",
  warningCount: 0,
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

const exactRecord: RuntimePolicyReviewCurrentnessRecord = {
  candidateId: candidate.id,
  checkedAt: "2026-07-14T12:10:00.000Z",
  locationId: candidate.locationId,
  outcome: "matches_current_source",
  reason: "accepted_exact",
};

class FakeCurrentnessBoundary
  implements RuntimePolicySummaryRepository, RuntimePolicyReviewCurrentnessChecker
{
  checks: CheckRuntimePolicyReviewCurrentnessInput[] = [];

  async listOwnerCandidateSummaries() {
    return [candidate];
  }

  async checkReviewCurrentness(input: CheckRuntimePolicyReviewCurrentnessInput) {
    this.checks.push(input);
    return exactRecord;
  }
}

describe("RuntimePolicyApplicationService review currentness", () => {
  it("recompiles an accepted candidate and submits only exact server-derived evidence", async () => {
    const boundary = new FakeCurrentnessBoundary();
    const service = new RuntimePolicyApplicationService(boundary);

    await expect(
      service.checkReviewCurrentness(
        {
          answerBankEntries: [answer],
          candidate,
          handoffRules: [handoff],
          locations: [location],
          tenantId: candidate.tenantId,
        },
        boundary,
      ),
    ).resolves.toEqual(exactRecord);

    expect(boundary.checks).toHaveLength(1);
    expect(boundary.checks[0]).toMatchObject({ candidateId: candidate.id });
    expect(boundary.checks[0]?.sourceState).toMatchObject({
      location: { id: candidate.locationId, status: "active" },
      tenantId: candidate.tenantId,
    });
    expect(JSON.stringify(boundary.checks[0])).not.toContain("Owner-only");
  });

  it.each([
    [null, "not_accepted"],
    ["rejected", "not_accepted"],
  ] as const)(
    "returns review-required for %s review without calling the checker",
    async (latestDecision, reason) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-14T12:15:00.000Z"));
      const boundary = new FakeCurrentnessBoundary();
      const service = new RuntimePolicyApplicationService(boundary);

      await expect(
        service.checkReviewCurrentness(
          {
            answerBankEntries: [answer],
            candidate: { ...candidate, latestDecision },
            handoffRules: [handoff],
            locations: [location],
            tenantId: candidate.tenantId,
          },
          boundary,
        ),
      ).resolves.toEqual({
        candidateId: candidate.id,
        checkedAt: "2026-07-14T12:15:00.000Z",
        locationId: candidate.locationId,
        outcome: "review_required",
        reason,
      });
      expect(boundary.checks).toEqual([]);
      vi.useRealTimers();
    },
  );

  it("collapses compiler diagnostics without sending policy or source content", async () => {
    const boundary = new FakeCurrentnessBoundary();
    const service = new RuntimePolicyApplicationService(boundary);
    const result = await service.checkReviewCurrentness(
      {
        answerBankEntries: [answer, { ...answer, id: "answer_duplicate" }],
        candidate,
        handoffRules: [],
        locations: [location],
        tenantId: candidate.tenantId,
      },
      boundary,
    );

    expect(result).toMatchObject({
      candidateId: candidate.id,
      outcome: "review_required",
      reason: "compiler_blocked",
    });
    expect(boundary.checks).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("duplicate");
  });

  it("fails inactive, missing, and foreign location relationships closed", async () => {
    const boundary = new FakeCurrentnessBoundary();
    const service = new RuntimePolicyApplicationService(boundary);

    for (const locations of [
      [{ ...location, status: "paused" as const }],
      [],
      [{ ...location, tenantId: "tenant_foreign" }],
    ]) {
      await expect(
        service.checkReviewCurrentness(
          {
            answerBankEntries: [answer],
            candidate,
            handoffRules: [handoff],
            locations,
            tenantId: candidate.tenantId,
          },
          boundary,
        ),
      ).resolves.toMatchObject({
        outcome: "review_required",
        reason: "source_or_candidate_changed",
      });
    }
    expect(boundary.checks).toEqual([]);
  });

  it("rejects a candidate summary from another tenant", async () => {
    const boundary = new FakeCurrentnessBoundary();
    const service = new RuntimePolicyApplicationService(boundary);

    await expect(
      service.checkReviewCurrentness(
        {
          answerBankEntries: [answer],
          candidate: { ...candidate, tenantId: "tenant_foreign" },
          handoffRules: [handoff],
          locations: [location],
          tenantId: candidate.tenantId,
        },
        boundary,
      ),
    ).rejects.toThrow("candidate is unavailable");
  });
});

describe("runtime policy currentness adapter", () => {
  it("maps the bounded RPC result without submitting tenant or actor identity", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        candidate_id: candidate.id,
        checked_at: exactRecord.checkedAt,
        location_id: candidate.locationId,
        outcome: exactRecord.outcome,
        reason: exactRecord.reason,
      },
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository({ rpc } as never);
    const input: CheckRuntimePolicyReviewCurrentnessInput = {
      candidateId: candidate.id,
      policyBody: {
        answerTopics: [],
        defaultPolicy: { kind: "create_staff_task" },
        handoffs: [],
        warnings: [],
      },
      sourceState: {
        answers: [],
        handoffs: [],
        location: {
          id: candidate.locationId,
          status: "active",
          tenantId: candidate.tenantId,
        },
        tenantId: candidate.tenantId,
      },
    };

    await expect(repository.checkReviewCurrentness(input)).resolves.toEqual(
      exactRecord,
    );
    expect(rpc).toHaveBeenCalledWith(
      "check_runtime_policy_review_currentness",
      {
        p_candidate_id: candidate.id,
        p_policy_body: input.policyBody,
        p_source_state: input.sourceState,
      },
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("actor_user_id");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("tenant_id");
  });

  it("rejects an invalid outcome and reason pairing from the RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        candidate_id: candidate.id,
        checked_at: exactRecord.checkedAt,
        location_id: candidate.locationId,
        outcome: "matches_current_source",
        reason: "verification_unavailable",
      },
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository({ rpc } as never);

    await expect(
      repository.checkReviewCurrentness({
        candidateId: candidate.id,
        policyBody: {
          answerTopics: [],
          defaultPolicy: { kind: "create_staff_task" },
          handoffs: [],
          warnings: [],
        },
        sourceState: {
          answers: [],
          handoffs: [],
          location: {
            id: candidate.locationId,
            status: "active",
            tenantId: candidate.tenantId,
          },
          tenantId: candidate.tenantId,
        },
      }),
    ).rejects.toThrow("invalid result");
  });
});

describe("owner currentness composition", () => {
  it("derives the observation on the authenticated server and contains failures per candidate", () => {
    expect(ownerPageSource).toContain("runtimePolicyService.checkReviewCurrentness");
    expect(ownerPageSource).toContain(
      'reportServerFailure("owner.runtime-policy-currentness.check", error)',
    );
    expect(ownerPageSource).toContain('outcome: "check_unavailable" as const');
    expect(ownerPageSource).toContain(
      "runtimePolicyReviewCurrentness={backendRuntimePolicyReviewCurrentness}",
    );
    expect(ownerWorkspaceSource).toContain(
      "reviewCurrentness={runtimePolicyReviewCurrentness}",
    );
  });

  it("adds no browser currentness or authority input", () => {
    expect(ownerActionSource).not.toContain('formData.get("currentness")');
    expect(ownerActionSource).not.toContain('formData.get("compilerRevision")');
    expect(ownerActionSource).not.toContain('formData.get("policyBody")');
    expect(ownerActionSource).not.toContain('formData.get("activationState")');
  });
});

describe("runtime policy currentness migration contract", () => {
  it("adds one side-effect-free authenticated comparison with bounded inputs", () => {
    expect(migration).toContain("check_runtime_policy_review_currentness");
    expect(migration).toContain("runtime_policy_candidate_body_is_valid(p_policy_body)");
    expect(migration).toContain("octet_length(p_source_state::text) > 4194304");
    expect(migration).toContain("runtime_policy_current_source_state");
    expect(migration).toContain("candidate.policy_body <> p_policy_body");
    expect(migration).toContain("v_latest_decision <> 'accepted'");
    expect(migration).toContain("candidate.snapshot_version");
    expect(migration).not.toContain("insert into public.runtime_policy_review_decisions");
    expect(migration).not.toContain("insert into public.audit_events");
  });

  it("keeps the compiler capability exact and staff or public authority absent", () => {
    expect(migration).toContain(
      "grant execute on function check_runtime_policy_review_currentness(text, jsonb, jsonb)\n  to authenticated",
    );
    expect(migration).toContain(
      "revoke execute on function check_runtime_policy_review_currentness(text, jsonb, jsonb)\n  from public, anonymous, outpost_policy_compiler",
    );
    expect(migration).not.toContain("grant execute on function check_runtime_policy_review_currentness(text, jsonb, jsonb)\n  to outpost_policy_compiler");
    expect(migration).not.toContain("activation");
  });
});
