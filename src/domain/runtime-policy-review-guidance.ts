import type {
  RuntimePolicyCandidateReviewManifestView,
  RuntimePolicyReviewCurrentnessRecord,
  RuntimePolicySnapshotRecord,
} from "./runtime-policy-records";
import type { Location } from "./tenancy";

export type RuntimePolicyReviewGuidanceStatus =
  | "candidate_evidence_unavailable"
  | "location_unavailable"
  | "record_candidate"
  | "revisit_rejected_candidate"
  | "review_recorded_routing"
  | "current_source_check_unavailable"
  | "resolve_source_setup"
  | "record_and_review_fresh_candidate"
  | "routing_outline_unavailable"
  | "ready_for_guided_owner_walkthrough";

export interface RuntimePolicyReviewGuidance {
  readonly candidateId?: string;
  readonly explanation: string;
  readonly label: string;
  readonly locationCardAnchor: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly status: RuntimePolicyReviewGuidanceStatus;
}

export interface RuntimePolicyReviewGuidanceInput {
  readonly candidateManifests: readonly RuntimePolicyCandidateReviewManifestView[];
  readonly candidateSummaries: readonly RuntimePolicySnapshotRecord[];
  readonly candidateSummariesAvailable: boolean;
  readonly locations: readonly Pick<Location, "id" | "name" | "status">[];
  readonly reviewCurrentness: readonly RuntimePolicyReviewCurrentnessRecord[];
}

type GuidanceCopy = Pick<RuntimePolicyReviewGuidance, "explanation" | "label">;

const guidanceCopy: Record<RuntimePolicyReviewGuidanceStatus, GuidanceCopy> = {
  candidate_evidence_unavailable: {
    explanation:
      "Candidate evidence could not be loaded, so no review step can be inferred.",
    label: "Candidate evidence unavailable",
  },
  current_source_check_unavailable: {
    explanation:
      "A current-source result could not be verified for this candidate. Review evidence remains available.",
    label: "Current-source check unavailable",
  },
  location_unavailable: {
    explanation:
      "This location is unavailable, so candidate review cannot begin here.",
    label: "Location unavailable for walkthrough",
  },
  ready_for_guided_owner_walkthrough: {
    explanation:
      "Accepted review evidence and the routing outline match this candidate. Guided walkthrough only; this does not authorize execution.",
    label: "Ready for guided owner walkthrough",
  },
  record_and_review_fresh_candidate: {
    explanation:
      "Current source or candidate state changed. Review setup before recording and reviewing fresh evidence.",
    label: "Record and review a fresh candidate",
  },
  record_candidate: {
    explanation:
      "Record an immutable candidate before beginning owner review.",
    label: "Record candidate",
  },
  resolve_source_setup: {
    explanation:
      "Current owner setup cannot compile exactly. Resolve the source setup before recording fresh evidence.",
    label: "Resolve source setup",
  },
  revisit_rejected_candidate: {
    explanation:
      "Review this exact candidate again. Append a new decision if the rejection no longer applies, or revise setup before recording a fresh candidate.",
    label: "Revisit rejected candidate",
  },
  review_recorded_routing: {
    explanation:
      "Review the recorded routing outline before appending an owner decision.",
    label: "Review recorded routing",
  },
  routing_outline_unavailable: {
    explanation:
      "Accepted evidence matches current source, but the recorded routing outline cannot be shown for a guided walkthrough.",
    label: "Routing outline unavailable for walkthrough",
  },
};

export function runtimePolicyLocationCardAnchor(locationId: string) {
  return `runtime-policy-candidate-${locationId.replace(/[^A-Za-z0-9_-]/gu, "-")}`;
}

function guidance(
  location: RuntimePolicyReviewGuidanceInput["locations"][number],
  status: RuntimePolicyReviewGuidanceStatus,
  candidateId?: string,
): RuntimePolicyReviewGuidance {
  return {
    ...guidanceCopy[status],
    ...(candidateId ? { candidateId } : {}),
    locationCardAnchor: runtimePolicyLocationCardAnchor(location.id),
    locationId: location.id,
    locationName: location.name,
    status,
  };
}

function exactCurrentness(
  candidate: RuntimePolicySnapshotRecord,
  records: readonly RuntimePolicyReviewCurrentnessRecord[],
) {
  const matches = records.filter(
    (record) =>
      record.candidateId === candidate.id &&
      record.locationId === candidate.locationId,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function manifestMatches(
  candidate: RuntimePolicySnapshotRecord,
  manifests: readonly RuntimePolicyCandidateReviewManifestView[],
) {
  const matches = manifests.filter(
    (manifest) => manifest.candidateId === candidate.id,
  );
  if (matches.length !== 1) return false;
  const manifest = matches[0];
  return (
    manifest.status === "available" &&
    manifest.locationId === candidate.locationId &&
    manifest.snapshotVersion === candidate.snapshotVersion &&
    manifest.answerTopicCount === candidate.answerTopicCount &&
    manifest.handoffCount === candidate.handoffCount
  );
}

export function ownerRuntimePolicyReviewGuidance({
  candidateManifests,
  candidateSummaries,
  candidateSummariesAvailable,
  locations,
  reviewCurrentness,
}: RuntimePolicyReviewGuidanceInput): RuntimePolicyReviewGuidance[] {
  return locations.map((location) => {
    if (!candidateSummariesAvailable) {
      return guidance(location, "candidate_evidence_unavailable");
    }
    const candidates = candidateSummaries.filter(
      (candidate) => candidate.locationId === location.id,
    );
    if (candidates.length > 1) {
      return guidance(location, "candidate_evidence_unavailable");
    }
    const candidate = candidates[0];

    if (location.status !== "active") {
      return guidance(location, "location_unavailable", candidate?.id);
    }
    if (!candidate) return guidance(location, "record_candidate");
    if (candidate.latestDecision === "rejected") {
      return guidance(location, "revisit_rejected_candidate", candidate.id);
    }
    if (candidate.latestDecision !== "accepted") {
      return guidance(location, "review_recorded_routing", candidate.id);
    }

    const currentness = exactCurrentness(candidate, reviewCurrentness);
    if (!currentness) {
      return guidance(
        location,
        "current_source_check_unavailable",
        candidate.id,
      );
    }
    if (
      currentness.outcome === "check_unavailable" &&
      currentness.reason === "verification_unavailable"
    ) {
      return guidance(
        location,
        "current_source_check_unavailable",
        candidate.id,
      );
    }
    if (
      currentness.outcome === "review_required" &&
      currentness.reason === "compiler_blocked"
    ) {
      return guidance(location, "resolve_source_setup", candidate.id);
    }
    if (
      currentness.outcome === "review_required" &&
      currentness.reason === "source_or_candidate_changed"
    ) {
      return guidance(
        location,
        "record_and_review_fresh_candidate",
        candidate.id,
      );
    }
    if (
      currentness.outcome !== "matches_current_source" ||
      currentness.reason !== "accepted_exact"
    ) {
      return guidance(
        location,
        "current_source_check_unavailable",
        candidate.id,
      );
    }
    if (!manifestMatches(candidate, candidateManifests)) {
      return guidance(location, "routing_outline_unavailable", candidate.id);
    }
    return guidance(
      location,
      "ready_for_guided_owner_walkthrough",
      candidate.id,
    );
  });
}
