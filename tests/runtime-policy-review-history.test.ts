import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  RuntimePolicyReviewHistoryReader,
  RuntimePolicySummaryRepository,
} from "@/application/runtime-policy/ports";
import { RuntimePolicyApplicationService } from "@/application/runtime-policy/service";
import type {
  RuntimePolicyReviewHistoryRecord,
  RuntimePolicySnapshotRecord,
} from "@/domain/runtime-policy-records";
import { NeonRuntimePolicyRepository } from "@/infrastructure/neon/runtime-policy-repository";

vi.mock("server-only", () => ({}));

const migration = readFileSync(
  "neon/migrations/20260714020000_runtime_policy_review_history.sql",
  "utf8",
);
const ownerActionSource = readFileSync("src/app/owner/actions.ts", "utf8");
const ownerPageSource = readFileSync("src/app/owner/page.tsx", "utf8");
const ownerWorkspaceSource = readFileSync(
  "src/components/owner/OwnerSetupWorkspaceClient.tsx",
  "utf8",
);
const staffPageSource = readFileSync("src/app/staff/tasks/page.tsx", "utf8");

const candidate: RuntimePolicySnapshotRecord = {
  answerTopicCount: 1,
  candidateCount: 1,
  compilerRevision: 1,
  createdAt: "2026-07-14T12:00:00.000Z",
  decisionCount: 7,
  handoffCount: 1,
  id: "runtime_policy_snapshot_1",
  latestDecision: "accepted",
  latestDecisionAt: "2026-07-14T12:07:00.000Z",
  locationId: "location_a",
  policyDigest: "b".repeat(64),
  schemaVersion: 1,
  snapshotVersion: 1,
  sourceDigest: "a".repeat(64),
  tenantId: "tenant_a",
  warningCount: 0,
};

const history: RuntimePolicyReviewHistoryRecord = {
  candidateId: candidate.id,
  entries: [7, 6, 5, 4, 3].map((decisionSequence) => ({
    createdAt: `2026-07-14T12:0${decisionSequence}:00.000Z`,
    decision: decisionSequence % 2 === 0 ? "rejected" : "accepted",
    decisionSequence,
  })),
  hasMore: true,
  locationId: candidate.locationId,
  snapshotVersion: candidate.snapshotVersion,
  totalDecisionCount: 7,
};

class FakeHistoryBoundary
  implements RuntimePolicySummaryRepository, RuntimePolicyReviewHistoryReader
{
  candidateIds: string[] = [];

  async listOwnerCandidateSummaries() {
    return [candidate];
  }

  async getOwnerReviewHistory(candidateId: string) {
    this.candidateIds.push(candidateId);
    return history;
  }
}

describe("RuntimePolicyApplicationService review history", () => {
  it("loads history only for the server-authorized candidate relationship", async () => {
    const boundary = new FakeHistoryBoundary();
    const service = new RuntimePolicyApplicationService(boundary);

    await expect(
      service.loadOwnerReviewHistory(
        { candidate, tenantId: candidate.tenantId },
        boundary,
      ),
    ).resolves.toEqual(history);
    expect(boundary.candidateIds).toEqual([candidate.id]);
  });

  it("rejects missing tenant and foreign candidate relationships before the read", async () => {
    const boundary = new FakeHistoryBoundary();
    const service = new RuntimePolicyApplicationService(boundary);

    await expect(
      service.loadOwnerReviewHistory(
        { candidate, tenantId: " " },
        boundary,
      ),
    ).rejects.toThrow("tenant identifier is required");
    await expect(
      service.loadOwnerReviewHistory(
        {
          candidate: { ...candidate, tenantId: "tenant_foreign" },
          tenantId: candidate.tenantId,
        },
        boundary,
      ),
    ).rejects.toThrow("candidate is unavailable");
    expect(boundary.candidateIds).toEqual([]);
  });

  it("rejects a mismatched database envelope", async () => {
    const boundary = new FakeHistoryBoundary();
    boundary.getOwnerReviewHistory = async () => ({
      ...history,
      locationId: "location_foreign",
    });
    const service = new RuntimePolicyApplicationService(boundary);

    await expect(
      service.loadOwnerReviewHistory(
        { candidate, tenantId: candidate.tenantId },
        boundary,
      ),
    ).rejects.toThrow("history is unavailable");
  });
});

describe("runtime policy review history adapter", () => {
  it("maps the fixed envelope and submits only the candidate identifier", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        candidate_id: history.candidateId,
        entries: history.entries.map((entry) => ({
          created_at: entry.createdAt,
          decision: entry.decision,
          decision_sequence: entry.decisionSequence,
        })),
        has_more: history.hasMore,
        location_id: history.locationId,
        snapshot_version: history.snapshotVersion,
        total_decision_count: history.totalDecisionCount,
      },
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository({ rpc } as never);

    await expect(repository.getOwnerReviewHistory(candidate.id)).resolves.toEqual(
      history,
    );
    expect(rpc).toHaveBeenCalledWith("get_runtime_policy_review_history", {
      p_candidate_id: candidate.id,
    });
    expect(Object.keys(rpc.mock.calls[0]?.[1] ?? {})).toEqual([
      "p_candidate_id",
    ]);
  });

  it.each([
    { ...history, entries: [...history.entries, history.entries[0]] },
    { ...history, hasMore: false },
    { ...history, totalDecisionCount: 4 },
    {
      ...history,
      entries: history.entries.map((entry, index) =>
        index === 0 ? { ...entry, decision: "approved" } : entry,
      ),
    },
    {
      ...history,
      entries: history.entries.map((entry, index) =>
        index === 1 ? { ...entry, decisionSequence: 9 } : entry,
      ),
    },
    {
      ...history,
      entries: history.entries.map((entry, index) =>
        index === 0 ? { ...entry, createdAt: "not-a-time" } : entry,
      ),
    },
  ])("rejects malformed or overbroad history envelopes", async (invalid) => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        candidate_id: invalid.candidateId,
        entries: invalid.entries.map((entry) => ({
          created_at: entry.createdAt,
          decision: entry.decision,
          decision_sequence: entry.decisionSequence,
        })),
        has_more: invalid.hasMore,
        location_id: invalid.locationId,
        snapshot_version: invalid.snapshotVersion,
        total_decision_count: invalid.totalDecisionCount,
      },
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository({ rpc } as never);

    await expect(repository.getOwnerReviewHistory(candidate.id)).rejects.toThrow(
      "invalid result",
    );
  });

  it.each([
    { entrySequence: history.entries[0]?.decisionSequence, total: null },
    { entrySequence: history.entries[0]?.decisionSequence, total: true },
    { entrySequence: history.entries[0]?.decisionSequence, total: "" },
    { entrySequence: true, total: history.totalDecisionCount },
  ])("rejects coercible malformed numeric values", async ({ entrySequence, total }) => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        candidate_id: history.candidateId,
        entries: history.entries.map((entry, index) => ({
          created_at: entry.createdAt,
          decision: entry.decision,
          decision_sequence: index === 0 ? entrySequence : entry.decisionSequence,
        })),
        has_more: history.hasMore,
        location_id: history.locationId,
        snapshot_version: history.snapshotVersion,
        total_decision_count: total,
      },
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository({ rpc } as never);

    await expect(repository.getOwnerReviewHistory(candidate.id)).rejects.toThrow(
      "invalid result",
    );
  });

  it("surfaces an RPC failure without a fallback write", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "denied" },
    });
    const repository = new NeonRuntimePolicyRepository({ rpc } as never);

    await expect(repository.getOwnerReviewHistory(candidate.id)).rejects.toThrow(
      "Unable to load runtime policy review history",
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("runtime policy review history boundaries", () => {
  it("keeps the migration read-only, fixed-bound, and owner-derived", () => {
    expect(migration).toContain("get_runtime_policy_review_history");
    expect(migration).toContain("limit 5");
    expect(migration).toContain("public.is_active_tenant_owner(candidate.tenant_id)");
    expect(migration).not.toContain("select candidate.*");
    expect(migration).not.toContain("p_limit");
    expect(migration).not.toContain("p_tenant_id");
    expect(migration).not.toContain("insert into");
    expect(migration).not.toContain("for update");
    expect(migration).not.toContain("activation");
  });

  it("adds no browser history or authority action input", () => {
    expect(ownerActionSource).not.toContain('formData.get("history")');
    expect(ownerActionSource).not.toContain('formData.get("historyLimit")');
    expect(ownerActionSource).not.toContain('formData.get("ownerId")');
    expect(ownerActionSource).not.toContain('formData.get("activationState")');
  });

  it("composes optional history on the owner server without adding a staff surface", () => {
    expect(ownerPageSource).toContain("runtimePolicyService.loadOwnerReviewHistory");
    expect(ownerPageSource).toMatch(
      /reportServerFailure\(\s*"owner\.runtime-policy-review-history\.load",\s*error\s*\)/u,
    );
    expect(ownerPageSource).toContain('status: "unavailable" as const');
    expect(ownerWorkspaceSource).toContain(
      "reviewHistory={runtimePolicyReviewHistory}",
    );
    expect(staffPageSource).not.toContain("RuntimePolicyReviewHistory");
    expect(staffPageSource).not.toContain("get_runtime_policy_review_history");
  });

  it("keeps the read model privacy minimal", () => {
    expect(JSON.stringify(history)).not.toMatch(
      /owner|actor|email|creationKey|previousDecision|policyBody|sourceDigest|audit|activation/u,
    );
  });
});
