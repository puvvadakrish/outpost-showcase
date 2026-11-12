import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  RuntimePolicyCandidateLineageReader,
  RuntimePolicySummaryRepository,
} from "@/application/runtime-policy/ports";
import { RuntimePolicyApplicationService } from "@/application/runtime-policy/service";
import type {
  RuntimePolicyCandidateLineageRecord,
  RuntimePolicySnapshotRecord,
} from "@/domain/runtime-policy-records";
import { NeonRuntimePolicyRepository } from "@/infrastructure/neon/runtime-policy-repository";

vi.mock("server-only", () => ({}));

const ownerPageSource = readFileSync("src/app/owner/page.tsx", "utf8");
const ownerWorkspaceSource = readFileSync(
  "src/components/owner/OwnerSetupWorkspaceClient.tsx",
  "utf8",
);
const staffPageSource = readFileSync("src/app/staff/tasks/page.tsx", "utf8");

const candidate: RuntimePolicySnapshotRecord = {
  answerTopicCount: 1,
  candidateCount: 7,
  compilerRevision: 2,
  createdAt: "2026-07-15T12:07:00.000Z",
  decisionCount: 1,
  handoffCount: 1,
  id: "runtime_policy_snapshot_7",
  latestDecision: "accepted",
  latestDecisionAt: "2026-07-15T12:08:00.000Z",
  locationId: "location_a",
  policyDigest: "b".repeat(64),
  schemaVersion: 1,
  snapshotVersion: 7,
  sourceDigest: "a".repeat(64),
  tenantId: "tenant_a",
  warningCount: 0,
};

const lineage: RuntimePolicyCandidateLineageRecord = {
  anchorCandidateId: candidate.id,
  anchorSnapshotVersion: candidate.snapshotVersion,
  entries: [6, 5, 4, 3, 2].map((snapshotVersion) => ({
    compilerRevision: snapshotVersion % 2 === 0 ? 2 : 1,
    createdAt: `2026-07-15T12:0${snapshotVersion}:00.000Z`,
    snapshotVersion,
  })),
  hasMore: true,
  locationId: candidate.locationId,
};

class FakeLineageBoundary
  implements RuntimePolicySummaryRepository, RuntimePolicyCandidateLineageReader
{
  candidateIds: string[] = [];

  async listOwnerCandidateSummaries() {
    return [candidate];
  }

  async getOwnerCandidateLineage(candidateId: string) {
    this.candidateIds.push(candidateId);
    return lineage;
  }
}

describe("RuntimePolicyApplicationService candidate lineage", () => {
  it("loads lineage only for the server-authorized newest candidate", async () => {
    const boundary = new FakeLineageBoundary();
    const service = new RuntimePolicyApplicationService(boundary);

    await expect(
      service.loadOwnerCandidateLineage(
        { candidate, tenantId: candidate.tenantId },
        boundary,
      ),
    ).resolves.toEqual(lineage);
    expect(boundary.candidateIds).toEqual([candidate.id]);
  });

  it("rejects a foreign candidate before reading", async () => {
    const boundary = new FakeLineageBoundary();
    const service = new RuntimePolicyApplicationService(boundary);

    await expect(
      service.loadOwnerCandidateLineage(
        {
          candidate: { ...candidate, tenantId: "tenant_foreign" },
          tenantId: candidate.tenantId,
        },
        boundary,
      ),
    ).rejects.toThrow("candidate is unavailable");
    expect(boundary.candidateIds).toEqual([]);
  });

  it.each([
    { anchorCandidateId: "runtime_policy_snapshot_other" },
    { locationId: "location_other" },
    { anchorSnapshotVersion: candidate.snapshotVersion + 1 },
  ])("rejects a mismatched lineage relationship: %o", async (mismatch) => {
    const boundary = new FakeLineageBoundary();
    const service = new RuntimePolicyApplicationService(boundary);

    boundary.getOwnerCandidateLineage = async (candidateId) => {
      boundary.candidateIds.push(candidateId);
      return { ...lineage, ...mismatch };
    };
    await expect(
      service.loadOwnerCandidateLineage(
        { candidate, tenantId: candidate.tenantId },
        boundary,
      ),
    ).rejects.toThrow("lineage is unavailable");
    expect(boundary.candidateIds).toEqual([candidate.id]);
  });
});

describe("runtime policy candidate lineage adapter", () => {
  function rpcBoundary(response: { data: unknown; error: unknown }) {
    const abortSignal = vi.fn().mockResolvedValue(response);
    return {
      abortSignal,
      rpc: vi.fn().mockReturnValue({ abortSignal }),
    };
  }

  function databaseEnvelope(value: RuntimePolicyCandidateLineageRecord) {
    return {
      anchor_candidate_id: value.anchorCandidateId,
      anchor_snapshot_version: value.anchorSnapshotVersion,
      entries: value.entries.map((entry) => ({
        compiler_revision: entry.compilerRevision,
        created_at: entry.createdAt,
        snapshot_version: entry.snapshotVersion,
      })),
      has_more: value.hasMore,
      location_id: value.locationId,
    };
  }

  it("maps the fixed envelope and submits only the anchor candidate identifier", async () => {
    const boundary = rpcBoundary({
      data: databaseEnvelope(lineage),
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository(boundary as never);

    await expect(
      repository.getOwnerCandidateLineage(candidate.id),
    ).resolves.toEqual(lineage);
    expect(boundary.rpc).toHaveBeenCalledWith("get_runtime_policy_candidate_lineage", {
      p_anchor_candidate_id: candidate.id,
    });
    expect(boundary.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it.each([
    { ...lineage, entries: [...lineage.entries, lineage.entries[0]!] },
    { ...lineage, entries: lineage.entries.slice(0, 4), hasMore: true },
    { ...lineage, entries: [], hasMore: false },
    { ...lineage, entries: lineage.entries, hasMore: false },
    {
      ...lineage,
      entries: lineage.entries.map((entry, index) =>
        index === 1 ? { ...entry, snapshotVersion: 8 } : entry,
      ),
    },
    {
      ...lineage,
      entries: lineage.entries.map((entry, index) =>
        index === 1 ? { ...entry, snapshotVersion: 4 } : entry,
      ),
    },
    {
      ...lineage,
      entries: lineage.entries.map((entry, index) =>
        index === 0 ? { ...entry, compilerRevision: 0 } : entry,
      ),
    },
    {
      ...lineage,
      entries: lineage.entries.map((entry, index) =>
        index === 0 ? { ...entry, createdAt: "not-a-time" } : entry,
      ),
    },
  ])("rejects malformed or overbroad lineage envelopes", async (invalid) => {
    const boundary = rpcBoundary({
      data: databaseEnvelope(invalid),
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository(boundary as never);

    await expect(
      repository.getOwnerCandidateLineage(candidate.id),
    ).rejects.toThrow("invalid result");
  });

  it("surfaces an RPC failure without a fallback write", async () => {
    const boundary = rpcBoundary({
      data: null,
      error: { message: "denied" },
    });
    const repository = new NeonRuntimePolicyRepository(boundary as never);

    await expect(
      repository.getOwnerCandidateLineage(candidate.id),
    ).rejects.toThrow("Unable to load runtime policy candidate lineage");
    expect(boundary.rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects a successful RPC with no lineage result", async () => {
    const boundary = rpcBoundary({ data: null, error: null });
    const repository = new NeonRuntimePolicyRepository(boundary as never);

    await expect(
      repository.getOwnerCandidateLineage(candidate.id),
    ).rejects.toThrow("returned no result");
    expect(boundary.rpc).toHaveBeenCalledTimes(1);
  });

  it("surfaces an aborted bounded read for candidate-local degradation", async () => {
    const abortSignal = vi
      .fn()
      .mockRejectedValue(new DOMException("bounded read elapsed", "AbortError"));
    const rpc = vi.fn().mockReturnValue({ abortSignal });
    const repository = new NeonRuntimePolicyRepository({ rpc } as never);

    await expect(
      repository.getOwnerCandidateLineage(candidate.id),
    ).rejects.toThrow("bounded read elapsed");
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(ownerPageSource).toContain(
      'status: "unavailable" as const',
    );
  });
});

describe("runtime policy candidate lineage boundaries", () => {
  it("keeps the read model privacy minimal", () => {
    expect(JSON.stringify(lineage)).not.toMatch(
      /decision|actor|owner|email|candidateBody|policyDigest|sourceDigest|audit|activation|totalCount/u,
    );
  });

  it("composes optional lineage only on the owner server", () => {
    expect(ownerPageSource).toContain(
      "runtimePolicyService.loadOwnerCandidateLineage",
    );
    expect(ownerPageSource).toMatch(
      /reportServerFailure\(\s*"owner\.runtime-policy-candidate-lineage\.load",\s*error\s*\)/u,
    );
    expect(ownerPageSource).toContain('status: "unavailable" as const');
    expect(ownerWorkspaceSource).toContain(
      "candidateLineage={runtimePolicyCandidateLineage}",
    );
    expect(staffPageSource).not.toContain("RuntimePolicyCandidateLineage");
    expect(staffPageSource).not.toContain("get_runtime_policy_candidate_lineage");
  });
});
