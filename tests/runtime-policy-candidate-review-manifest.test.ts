import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  RuntimePolicyCandidateReviewManifestReader,
  RuntimePolicySummaryRepository,
} from "@/application/runtime-policy/ports";
import { RuntimePolicyApplicationService } from "@/application/runtime-policy/service";
import type {
  RuntimePolicyCandidateReviewManifestRecord,
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
  answerTopicCount: 15,
  candidateCount: 2,
  compilerRevision: 1,
  createdAt: "2026-07-15T12:00:00.000Z",
  decisionCount: 0,
  handoffCount: 12,
  id: "runtime_policy_snapshot_manifest_2",
  latestDecision: null,
  latestDecisionAt: null,
  locationId: "location_manifest",
  policyDigest: "b".repeat(64),
  schemaVersion: 1,
  snapshotVersion: 2,
  sourceDigest: "a".repeat(64),
  tenantId: "tenant_manifest",
  warningCount: 0,
};

const answerTopics = Array.from({ length: 10 }, (_, index) => ({
  behavior: index % 2 === 0 ? ("answer" as const) : ("create_staff_task" as const),
  topic: `Topic ${String(index + 1).padStart(2, "0")}`,
}));

const handoffs = Array.from({ length: 10 }, (_, index) => ({
  action: index % 2 === 0 ? ("create_task" as const) : ("notify_staff" as const),
  priority: index + 1,
  topic: `Handoff ${String(index + 1).padStart(2, "0")}`,
  trigger: index % 2 === 0 ? ("topic" as const) : ("always_human" as const),
}));

function answerTopicsWithFirst(entry: { behavior: string; topic: string }) {
  return answerTopics.map((current, index) => (index === 0 ? entry : current));
}

function handoffsWithFirst(entry: {
  action: string;
  priority: number;
  topic: string;
  trigger: string;
}) {
  return handoffs.map((current, index) => (index === 0 ? entry : current));
}

const manifest: RuntimePolicyCandidateReviewManifestRecord = {
  answerTopicCount: candidate.answerTopicCount,
  answerTopics,
  answerTopicsHasMore: true,
  candidateId: candidate.id,
  defaultBehavior: "create_staff_task",
  handoffCount: candidate.handoffCount,
  handoffs,
  handoffsHasMore: true,
  locationId: candidate.locationId,
  snapshotVersion: candidate.snapshotVersion,
};

class FakeManifestBoundary
  implements
    RuntimePolicySummaryRepository,
    RuntimePolicyCandidateReviewManifestReader
{
  candidateIds: string[] = [];

  async listOwnerCandidateSummaries() {
    return [candidate];
  }

  async getOwnerCandidateReviewManifest(candidateId: string) {
    this.candidateIds.push(candidateId);
    return manifest;
  }
}

describe("RuntimePolicyApplicationService candidate review manifest", () => {
  it("loads the exact complete window for the server-authorized newest candidate", async () => {
    const boundary = new FakeManifestBoundary();
    const service = new RuntimePolicyApplicationService(boundary);

    await expect(
      service.loadOwnerCandidateReviewManifest(
        { candidate, tenantId: candidate.tenantId },
        boundary,
      ),
    ).resolves.toEqual(manifest);
    expect(boundary.candidateIds).toEqual([candidate.id]);
  });

  it("rejects a foreign candidate before reading", async () => {
    const boundary = new FakeManifestBoundary();
    const service = new RuntimePolicyApplicationService(boundary);

    await expect(
      service.loadOwnerCandidateReviewManifest(
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
    { candidateId: "runtime_policy_snapshot_other" },
    { locationId: "location_other" },
    { snapshotVersion: candidate.snapshotVersion + 1 },
    { answerTopicCount: candidate.answerTopicCount + 1 },
    { handoffCount: candidate.handoffCount + 1 },
    { answerTopics: answerTopics.slice(0, 9) },
    { answerTopicsHasMore: false },
    { handoffs: handoffs.slice(0, 9) },
    { handoffsHasMore: false },
  ])("rejects a mismatched manifest relationship or window: %o", async (mismatch) => {
    const boundary = new FakeManifestBoundary();
    const service = new RuntimePolicyApplicationService(boundary);
    boundary.getOwnerCandidateReviewManifest = async (candidateId) => {
      boundary.candidateIds.push(candidateId);
      return { ...manifest, ...mismatch } as RuntimePolicyCandidateReviewManifestRecord;
    };

    await expect(
      service.loadOwnerCandidateReviewManifest(
        { candidate, tenantId: candidate.tenantId },
        boundary,
      ),
    ).rejects.toThrow("manifest is unavailable");
    expect(boundary.candidateIds).toEqual([candidate.id]);
  });
});

describe("runtime policy candidate review manifest adapter", () => {
  function rpcBoundary(response: { data: unknown; error: unknown }) {
    const abortSignal = vi.fn().mockResolvedValue(response);
    return {
      abortSignal,
      rpc: vi.fn().mockReturnValue({ abortSignal }),
    };
  }

  function databaseEnvelope(value: RuntimePolicyCandidateReviewManifestRecord) {
    return {
      answer_topic_count: value.answerTopicCount,
      answer_topics: value.answerTopics,
      answer_topics_has_more: value.answerTopicsHasMore,
      candidate_id: value.candidateId,
      default_behavior: value.defaultBehavior,
      handoff_count: value.handoffCount,
      handoffs: value.handoffs,
      handoffs_has_more: value.handoffsHasMore,
      location_id: value.locationId,
      snapshot_version: value.snapshotVersion,
    };
  }

  it("maps the fixed envelope, submits only the anchor, and applies the two-second timeout", async () => {
    const boundary = rpcBoundary({ data: databaseEnvelope(manifest), error: null });
    const repository = new NeonRuntimePolicyRepository(boundary as never);
    const timeoutSignal = new AbortController().signal;
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutSignal);

    await expect(
      repository.getOwnerCandidateReviewManifest(candidate.id),
    ).resolves.toEqual(manifest);
    expect(boundary.rpc).toHaveBeenCalledWith(
      "get_runtime_policy_candidate_review_manifest",
      { p_candidate_id: candidate.id },
    );
    expect(timeout).toHaveBeenCalledWith(2_000);
    expect(boundary.abortSignal).toHaveBeenCalledWith(timeoutSignal);
    timeout.mockRestore();
  });

  it("drops forbidden extra fields instead of propagating them", async () => {
    const envelope = databaseEnvelope(manifest);
    const boundary = rpcBoundary({
      data: {
        ...envelope,
        answer_topics: envelope.answer_topics.map((entry) => ({
          ...entry,
          answer: "private answer text",
          source_answer_id: "private_source",
          topic_key: "private_topic_key",
        })),
        policy_body: { private: true },
      },
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository(boundary as never);

    const result = await repository.getOwnerCandidateReviewManifest(candidate.id);
    expect(result).toEqual(manifest);
    expect(JSON.stringify(result)).not.toMatch(
      /answer text|source_answer|topic_key|policy_body/u,
    );
  });

  it("counts bounded display topics by Unicode code point", async () => {
    const unicodeManifest: RuntimePolicyCandidateReviewManifestRecord = {
      ...manifest,
      answerTopicCount: 1,
      answerTopics: [{ behavior: "answer", topic: "😀".repeat(81) }],
      answerTopicsHasMore: false,
      handoffCount: 0,
      handoffs: [],
      handoffsHasMore: false,
    };
    const boundary = rpcBoundary({
      data: databaseEnvelope(unicodeManifest),
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository(boundary as never);

    await expect(
      repository.getOwnerCandidateReviewManifest(candidate.id),
    ).resolves.toEqual(unicodeManifest);

    const overlongManifest: RuntimePolicyCandidateReviewManifestRecord = {
      ...unicodeManifest,
      answerTopics: [{ behavior: "answer", topic: "😀".repeat(161) }],
    };
    const overlongBoundary = rpcBoundary({
      data: databaseEnvelope(overlongManifest),
      error: null,
    });
    const overlongRepository = new NeonRuntimePolicyRepository(
      overlongBoundary as never,
    );

    await expect(
      overlongRepository.getOwnerCandidateReviewManifest(candidate.id),
    ).rejects.toThrow("invalid result");
  });

  it("requires PostgreSQL C and UTF-8 byte order for Unicode topic keys", async () => {
    const orderedTopics = [
      { behavior: "answer" as const, topic: "Ａ" },
      { behavior: "create_staff_task" as const, topic: "😀" },
    ];
    const unicodeManifest: RuntimePolicyCandidateReviewManifestRecord = {
      ...manifest,
      answerTopicCount: orderedTopics.length,
      answerTopics: orderedTopics,
      answerTopicsHasMore: false,
      handoffCount: 0,
      handoffs: [],
      handoffsHasMore: false,
    };
    const boundary = rpcBoundary({
      data: databaseEnvelope(unicodeManifest),
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository(boundary as never);

    await expect(
      repository.getOwnerCandidateReviewManifest(candidate.id),
    ).resolves.toEqual(unicodeManifest);

    const reversedManifest: RuntimePolicyCandidateReviewManifestRecord = {
      ...unicodeManifest,
      answerTopics: [...orderedTopics].reverse(),
    };
    const reversedBoundary = rpcBoundary({
      data: databaseEnvelope(reversedManifest),
      error: null,
    });
    const reversedRepository = new NeonRuntimePolicyRepository(
      reversedBoundary as never,
    );

    await expect(
      reversedRepository.getOwnerCandidateReviewManifest(candidate.id),
    ).rejects.toThrow("invalid result");
  });

  it.each([
    {
      answer_topics: [
        ...databaseEnvelope(manifest).answer_topics,
        { behavior: "answer", topic: "Topic 11" },
      ],
    },
    {
      handoffs: [
        ...databaseEnvelope(manifest).handoffs,
        { action: "create_task", priority: 11, topic: "Handoff 11", trigger: "topic" },
      ],
    },
    {
      answer_topics: answerTopicsWithFirst({
        behavior: "unknown",
        topic: "Topic 01",
      }),
    },
    {
      answer_topics: answerTopicsWithFirst({ behavior: "answer", topic: " " }),
    },
    {
      answer_topics: answerTopics.map((entry, index) =>
        index === 1 ? { ...entry, topic: "Topic 00" } : entry,
      ),
    },
    { default_behavior: "answer" },
    {
      handoffs: handoffsWithFirst({
        action: "unknown",
        priority: 1,
        topic: "Handoff 01",
        trigger: "topic",
      }),
    },
    {
      handoffs: handoffsWithFirst({
        action: "create_task",
        priority: 0,
        topic: "Handoff 01",
        trigger: "topic",
      }),
    },
    {
      handoffs: handoffsWithFirst({
        action: "create_task",
        priority: 1.5,
        topic: "Handoff 01",
        trigger: "topic",
      }),
    },
    {
      handoffs: handoffsWithFirst({
        action: "create_task",
        priority: 1,
        topic: "Handoff 01",
        trigger: "unknown",
      }),
    },
    {
      handoffs: handoffs.map((entry, index) =>
        index === 1 ? { ...entry, priority: 1 } : entry,
      ),
    },
    { answer_topic_count: -1 },
    { handoff_count: Number.MAX_SAFE_INTEGER + 1 },
    { answer_topics_has_more: false },
    { handoffs_has_more: false },
  ])("rejects malformed or overbroad manifest envelopes: %o", async (override) => {
    const boundary = rpcBoundary({
      data: { ...databaseEnvelope(manifest), ...override },
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository(boundary as never);

    await expect(
      repository.getOwnerCandidateReviewManifest(candidate.id),
    ).rejects.toThrow("invalid result");
  });

  it("surfaces an RPC failure without fallback data", async () => {
    const boundary = rpcBoundary({ data: null, error: { message: "denied" } });
    const repository = new NeonRuntimePolicyRepository(boundary as never);

    await expect(
      repository.getOwnerCandidateReviewManifest(candidate.id),
    ).rejects.toThrow("Unable to load runtime policy candidate review manifest");
    expect(boundary.rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects a successful RPC with no manifest result", async () => {
    const boundary = rpcBoundary({ data: null, error: null });
    const repository = new NeonRuntimePolicyRepository(boundary as never);

    await expect(
      repository.getOwnerCandidateReviewManifest(candidate.id),
    ).rejects.toThrow("returned no result");
    expect(boundary.rpc).toHaveBeenCalledTimes(1);
  });

  it("surfaces an aborted bounded read", async () => {
    const abortSignal = vi
      .fn()
      .mockRejectedValue(new DOMException("bounded read elapsed", "AbortError"));
    const rpc = vi.fn().mockReturnValue({ abortSignal });
    const repository = new NeonRuntimePolicyRepository({ rpc } as never);

    await expect(
      repository.getOwnerCandidateReviewManifest(candidate.id),
    ).rejects.toThrow("bounded read elapsed");
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});

describe("runtime policy candidate review manifest privacy", () => {
  it("keeps the read model bounded and privacy minimal", () => {
    expect(JSON.stringify(manifest)).not.toMatch(
      /answerText|destination|activeWindow|sourceId|topicKey|warning|fingerprint|policyBody|sourceBody|reviewer|retry|audit|decision|historical/u,
    );
  });

  it("composes the optional read only after owner-authorized summaries", () => {
    expect(ownerPageSource).toContain(
      "runtimePolicyService.loadOwnerCandidateReviewManifest",
    );
    expect(ownerPageSource).toMatch(
      /reportServerFailure\(\s*"owner\.runtime-policy-candidate-review-manifest\.load",\s*error\s*\)/u,
    );
    expect(ownerPageSource).toContain('status: "unavailable" as const');
    const summariesIndex = ownerPageSource.indexOf("listOwnerCandidateSummaries");
    const manifestIndex = ownerPageSource.indexOf(
      "loadOwnerCandidateReviewManifest",
    );
    expect(summariesIndex).toBeGreaterThanOrEqual(0);
    expect(manifestIndex).toBeGreaterThanOrEqual(0);
    expect(summariesIndex).toBeLessThan(manifestIndex);
    expect(ownerWorkspaceSource).toContain(
      "candidateManifests={runtimePolicyCandidateReviewManifests}",
    );
    expect(staffPageSource).not.toContain("CandidateReviewManifest");
    expect(staffPageSource).not.toContain(
      "get_runtime_policy_candidate_review_manifest",
    );
  });
});
