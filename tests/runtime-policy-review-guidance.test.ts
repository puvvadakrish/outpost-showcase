import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type {
  RuntimePolicyCandidateReviewManifestView,
  RuntimePolicyReviewCurrentnessRecord,
  RuntimePolicySnapshotRecord,
} from "@/domain/runtime-policy-records";
import {
  ownerRuntimePolicyReviewGuidance,
  type RuntimePolicyReviewGuidance,
  type RuntimePolicyReviewGuidanceInput,
} from "@/domain/runtime-policy-review-guidance";

const ownerPageSource = readFileSync("src/app/owner/page.tsx", "utf8");
const ownerWorkspaceSource = readFileSync(
  "src/components/owner/OwnerSetupWorkspaceClient.tsx",
  "utf8",
);
const staffPageSource = readFileSync("src/app/staff/tasks/page.tsx", "utf8");
const staffWorkboardSource = readFileSync(
  "src/components/staff/StaffTaskWorkspaceClient.tsx",
  "utf8",
);

const locations: RuntimePolicyReviewGuidanceInput["locations"] = [
  { id: "location_b", name: "South", status: "active" },
  { id: "location_a", name: "North", status: "active" },
];

const candidate: RuntimePolicySnapshotRecord = {
  answerTopicCount: 3,
  candidateCount: 2,
  compilerRevision: 1,
  createdAt: "2026-07-15T12:00:00.000Z",
  decisionCount: 1,
  handoffCount: 2,
  id: "candidate_a",
  latestDecision: "accepted",
  latestDecisionAt: "2026-07-15T12:01:00.000Z",
  locationId: "location_a",
  policyDigest: "b".repeat(64),
  schemaVersion: 1,
  snapshotVersion: 2,
  sourceDigest: "a".repeat(64),
  tenantId: "tenant_a",
  warningCount: 0,
};

const exactCurrentness: RuntimePolicyReviewCurrentnessRecord = {
  candidateId: candidate.id,
  checkedAt: "2026-07-15T12:02:00.000Z",
  locationId: candidate.locationId,
  outcome: "matches_current_source",
  reason: "accepted_exact",
};

const exactManifest: RuntimePolicyCandidateReviewManifestView = {
  answerTopicCount: candidate.answerTopicCount,
  answerTopics: [],
  answerTopicsHasMore: false,
  candidateId: candidate.id,
  defaultBehavior: "create_staff_task",
  handoffCount: candidate.handoffCount,
  handoffs: [],
  handoffsHasMore: false,
  locationId: candidate.locationId,
  snapshotVersion: candidate.snapshotVersion,
  status: "available",
};

function input(
  overrides: Partial<RuntimePolicyReviewGuidanceInput> = {},
): RuntimePolicyReviewGuidanceInput {
  return {
    candidateManifests: [exactManifest],
    candidateSummaries: [candidate],
    candidateSummariesAvailable: true,
    locations: [locations[1]!],
    reviewCurrentness: [exactCurrentness],
    ...overrides,
  };
}

function onlyGuidance(
  overrides: Partial<RuntimePolicyReviewGuidanceInput> = {},
): RuntimePolicyReviewGuidance {
  const result = ownerRuntimePolicyReviewGuidance(input(overrides));
  expect(result).toHaveLength(1);
  return result[0]!;
}

describe("ownerRuntimePolicyReviewGuidance", () => {
  it("makes candidate-summary failure the first fail-closed state for every location", () => {
    const result = ownerRuntimePolicyReviewGuidance(
      input({
        candidateSummariesAvailable: false,
        locations: [
          locations[0]!,
          { ...locations[1]!, status: "paused" },
        ],
      }),
    );

    expect(result.map(({ status }) => status)).toEqual([
      "candidate_evidence_unavailable",
      "candidate_evidence_unavailable",
    ]);
    expect(result[0]).toEqual({
      explanation:
        "Candidate evidence could not be loaded, so no review step can be inferred.",
      label: "Candidate evidence unavailable",
      locationCardAnchor: "runtime-policy-candidate-location_b",
      locationId: "location_b",
      locationName: "South",
      status: "candidate_evidence_unavailable",
    });
  });

  it("prioritizes inactive location state over candidate and review evidence", () => {
    expect(
      onlyGuidance({
        locations: [{ ...locations[1]!, status: "paused" }],
      }),
    ).toMatchObject({
      candidateId: candidate.id,
      label: "Location unavailable for walkthrough",
      status: "location_unavailable",
    });
  });

  it("distinguishes no candidate, rejected review, and unreviewed routing", () => {
    const noCandidate = onlyGuidance({
      candidateSummaries: [],
      candidateManifests: [],
      reviewCurrentness: [],
    });
    expect(noCandidate).toMatchObject({
      label: "Record candidate",
      status: "record_candidate",
    });
    expect(noCandidate).not.toHaveProperty("candidateId");

    expect(
      onlyGuidance({
        candidateSummaries: [{ ...candidate, latestDecision: "rejected" }],
      }),
    ).toMatchObject({
      label: "Revisit rejected candidate",
      status: "revisit_rejected_candidate",
    });

    expect(
      onlyGuidance({
        candidateSummaries: [{ ...candidate, latestDecision: null }],
      }),
    ).toMatchObject({
      label: "Review recorded routing",
      status: "review_recorded_routing",
    });
  });

  it.each([
    ["missing", []],
    [
      "wrong candidate",
      [{ ...exactCurrentness, candidateId: "candidate_foreign" }],
    ],
    [
      "wrong location",
      [{ ...exactCurrentness, locationId: "location_foreign" }],
    ],
    [
      "not accepted",
      [
        {
          ...exactCurrentness,
          outcome: "review_required" as const,
          reason: "not_accepted" as const,
        },
      ],
    ],
    [
      "inconsistent exact outcome",
      [{ ...exactCurrentness, outcome: "review_required" as const }],
    ],
  ])("fails closed when currentness is %s", (_case, reviewCurrentness) => {
    expect(onlyGuidance({ reviewCurrentness })).toMatchObject({
      label: "Current-source check unavailable",
      status: "current_source_check_unavailable",
    });
  });

  it.each([
    [
      "verification_unavailable",
      "check_unavailable",
      "current_source_check_unavailable",
      "Current-source check unavailable",
    ],
    [
      "compiler_blocked",
      "review_required",
      "resolve_source_setup",
      "Resolve source setup",
    ],
    [
      "source_or_candidate_changed",
      "review_required",
      "record_and_review_fresh_candidate",
      "Record and review a fresh candidate",
    ],
  ] as const)(
    "maps %s currentness to its ordered corrective state",
    (reason, outcome, status, label) => {
      expect(
        onlyGuidance({
          reviewCurrentness: [{ ...exactCurrentness, outcome, reason }],
        }),
      ).toMatchObject({ label, status });
    },
  );

  it.each([
    ["missing", []],
    ["unavailable", [{ candidateId: candidate.id, status: "unavailable" as const }]],
    [
      "wrong candidate",
      [{ ...exactManifest, candidateId: "candidate_foreign" }],
    ],
    ["wrong location", [{ ...exactManifest, locationId: "location_foreign" }]],
    ["wrong version", [{ ...exactManifest, snapshotVersion: 1 }]],
    ["wrong answer count", [{ ...exactManifest, answerTopicCount: 4 }]],
    ["wrong handoff count", [{ ...exactManifest, handoffCount: 3 }]],
  ])("fails closed when the routing manifest is %s", (_case, candidateManifests) => {
    expect(onlyGuidance({ candidateManifests })).toMatchObject({
      label: "Routing outline unavailable for walkthrough",
      status: "routing_outline_unavailable",
    });
  });

  it("returns positive guidance only for exact accepted currentness and manifest evidence", () => {
    const result = onlyGuidance();

    expect(result).toEqual({
      candidateId: candidate.id,
      explanation:
        "Accepted review evidence and the routing outline match this candidate. Guided walkthrough only; this does not authorize execution.",
      label: "Ready for guided owner walkthrough",
      locationCardAnchor: "runtime-policy-candidate-location_a",
      locationId: "location_a",
      locationName: "North",
      status: "ready_for_guided_owner_walkthrough",
    });
    expect(Object.keys(result).sort()).toEqual(
      [
        "candidateId",
        "explanation",
        "label",
        "locationCardAnchor",
        "locationId",
        "locationName",
        "status",
      ].sort(),
    );
  });

  it("fails closed when candidate, currentness, or manifest evidence is duplicated", () => {
    expect(
      onlyGuidance({ candidateSummaries: [candidate, { ...candidate }] }),
    ).toMatchObject({ status: "candidate_evidence_unavailable" });
    expect(
      onlyGuidance({ reviewCurrentness: [exactCurrentness, { ...exactCurrentness }] }),
    ).toMatchObject({ status: "current_source_check_unavailable" });
    expect(
      onlyGuidance({ candidateManifests: [exactManifest, { ...exactManifest }] }),
    ).toMatchObject({ status: "routing_outline_unavailable" });
  });

  it("keeps activation-shaped vocabulary out of every guidance state", () => {
    const results = [
      onlyGuidance({ candidateSummariesAvailable: false }),
      onlyGuidance({ locations: [{ ...locations[1]!, status: "paused" }] }),
      onlyGuidance({ candidateSummaries: [] }),
      onlyGuidance({ candidateSummaries: [{ ...candidate, latestDecision: "rejected" }] }),
      onlyGuidance({ candidateSummaries: [{ ...candidate, latestDecision: null }] }),
      onlyGuidance({ reviewCurrentness: [] }),
      onlyGuidance({
        reviewCurrentness: [
          { ...exactCurrentness, outcome: "review_required", reason: "compiler_blocked" },
        ],
      }),
      onlyGuidance({
        reviewCurrentness: [
          {
            ...exactCurrentness,
            outcome: "review_required",
            reason: "source_or_candidate_changed",
          },
        ],
      }),
      onlyGuidance({ candidateManifests: [] }),
      onlyGuidance(),
    ];
    const visibleCopy = results
      .flatMap(({ explanation, label }) => [label, explanation])
      .join(" ");

    expect(visibleCopy).not.toMatch(
      /\b(?:active|approved|deployable|live|ready to activate)\b/iu,
    );
  });

  it("ignores irrelevant records, preserves location order, and does not mutate inputs", () => {
    const currentness = [
      { ...exactCurrentness, candidateId: "candidate_foreign", locationId: "location_foreign" },
      exactCurrentness,
    ];
    const manifests: RuntimePolicyCandidateReviewManifestView[] = [
      { ...exactManifest, candidateId: "candidate_foreign", locationId: "location_foreign" },
      exactManifest,
    ];
    const candidates = [
      { ...candidate, id: "candidate_foreign", locationId: "location_foreign" },
      candidate,
    ];
    const allLocations = [...locations];
    const before = structuredClone({
      candidates,
      currentness,
      locations: allLocations,
      manifests,
    });

    const result = ownerRuntimePolicyReviewGuidance({
      candidateManifests: manifests,
      candidateSummaries: candidates,
      candidateSummariesAvailable: true,
      locations: allLocations,
      reviewCurrentness: currentness,
    });

    expect(result.map(({ locationId }) => locationId)).toEqual([
      "location_b",
      "location_a",
    ]);
    expect(result.map(({ status }) => status)).toEqual([
      "record_candidate",
      "ready_for_guided_owner_walkthrough",
    ]);
    expect({ candidates, currentness, locations: allLocations, manifests }).toEqual(before);
  });

  it("returns an empty projection when no authorized locations are loaded", () => {
    expect(ownerRuntimePolicyReviewGuidance(input({ locations: [] }))).toEqual([]);
  });

  it("keeps summary failure wiring and walkthrough guidance owner-only", () => {
    expect(ownerPageSource).toContain("runtimePolicyBackendUnavailable = true");
    expect(ownerPageSource).toMatch(
      /runtimePolicyPersistenceMode=\{[\s\S]*?runtimePolicyBackendUnavailable[\s\S]*?"backend_unavailable"/u,
    );
    expect(ownerWorkspaceSource).toContain("<RuntimePolicyCandidatePanel");
    for (const staffSource of [staffPageSource, staffWorkboardSource]) {
      expect(staffSource).not.toMatch(
        /RuntimePolicyCandidatePanel|ownerRuntimePolicyReviewGuidance|runtime-policy-review-guidance|Guided walkthrough next step/u,
      );
    }
  });
});
