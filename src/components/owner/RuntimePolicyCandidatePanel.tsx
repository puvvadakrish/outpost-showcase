"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type {
  OwnerSetupActionState,
  PersistenceMode,
} from "@/application/owner-setup/action-result";
import type {
  RuntimePolicyCandidateLineageView,
  RuntimePolicyCandidateReviewManifestAnswerBehavior,
  RuntimePolicyCandidateReviewManifestHandoff,
  RuntimePolicyCandidateReviewManifestView,
  RuntimePolicyReviewCurrentnessReason,
  RuntimePolicyReviewCurrentnessRecord,
  RuntimePolicyReviewDecision,
  RuntimePolicyReviewHistoryView,
  RuntimePolicySnapshotRecord,
} from "@/domain/runtime-policy-records";
import {
  ownerRuntimePolicyReviewGuidance,
  runtimePolicyLocationCardAnchor,
  type RuntimePolicyReviewGuidance,
} from "@/domain/runtime-policy-review-guidance";
import type { Location } from "@/domain/tenancy";

interface RuntimePolicyCandidatePanelProps {
  candidateLineage: RuntimePolicyCandidateLineageView[];
  candidateManifests: RuntimePolicyCandidateReviewManifestView[];
  locations: Pick<Location, "id" | "name" | "status">[];
  onRecordRuntimePolicyCandidate: (
    previousState: OwnerSetupActionState,
    formData: FormData,
  ) => Promise<OwnerSetupActionState>;
  onReviewRuntimePolicyCandidate: (
    previousState: OwnerSetupActionState,
    formData: FormData,
  ) => Promise<OwnerSetupActionState>;
  persistenceMode: PersistenceMode;
  policyWriterAvailable: boolean;
  reviewCurrentness: RuntimePolicyReviewCurrentnessRecord[];
  reviewHistory: RuntimePolicyReviewHistoryView[];
  snapshots: RuntimePolicySnapshotRecord[];
  tenantId: string;
}

const initialState: OwnerSetupActionState = { ok: false, message: "" };

function recordedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recorded time unavailable";
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

function shortDigest(value: string) {
  return value.slice(0, 12);
}

function ReviewHistory({
  candidate,
  history,
}: {
  candidate: RuntimePolicySnapshotRecord;
  history: RuntimePolicyReviewHistoryView | undefined;
}) {
  const available =
    history?.status === "available" &&
    history.locationId === candidate.locationId &&
    history.snapshotVersion === candidate.snapshotVersion
      ? history
      : undefined;

  return (
    <section
      aria-label={`Recent decisions for candidate v${candidate.snapshotVersion}`}
      className="runtime-policy-review-history"
    >
      <div className="runtime-policy-review-history-heading">
        <div>
          <span>Recent decisions for this candidate</span>
          <strong>Review evidence only</strong>
        </div>
        <p>These decisions do not activate or select a runtime policy.</p>
      </div>
      {!available ? (
        <p className="runtime-policy-review-history-empty">
          Recent decision evidence is unavailable. Existing candidate review
          remains available.
        </p>
      ) : available.entries.length === 0 ? (
        <p className="runtime-policy-review-history-empty">
          No decisions recorded for this candidate.
        </p>
      ) : (
        <ol className="runtime-policy-review-history-list">
          {available.entries.map((entry) => (
            <li key={entry.decisionSequence}>
              <strong>
                {entry.decision === "accepted" ? "Accepted" : "Rejected"}
              </strong>
              <span>Decision {entry.decisionSequence}</span>
              <time dateTime={entry.createdAt}>{recordedAt(entry.createdAt)}</time>
            </li>
          ))}
        </ol>
      )}
      {available ? (
        <p className="runtime-policy-review-history-total">
          {available.hasMore
            ? `Showing ${available.entries.length} of ${available.totalDecisionCount} decisions. Older evidence is not shown.`
            : `${available.totalDecisionCount} ${available.totalDecisionCount === 1 ? "decision" : "decisions"} recorded for this candidate.`}
        </p>
      ) : null}
    </section>
  );
}

function CandidateLineage({
  candidate,
  lineage,
}: {
  candidate: RuntimePolicySnapshotRecord;
  lineage: RuntimePolicyCandidateLineageView | undefined;
}) {
  const available =
    lineage?.status === "available" &&
    lineage.locationId === candidate.locationId &&
    lineage.anchorSnapshotVersion === candidate.snapshotVersion
      ? lineage
      : undefined;

  return (
    <section
      aria-label={`Earlier recorded candidates before v${candidate.snapshotVersion}`}
      className="runtime-policy-candidate-lineage"
    >
      <div className="runtime-policy-candidate-lineage-heading">
        <h4>Earlier recorded candidates</h4>
        <p>
          Preserved review evidence only. No candidate shown here is active or
          selected.
        </p>
      </div>
      {!available ? (
        <p className="runtime-policy-candidate-lineage-empty">
          Earlier candidate evidence is unavailable. Review of the newest
          candidate remains available.
        </p>
      ) : available.entries.length === 0 ? (
        <p className="runtime-policy-candidate-lineage-empty">
          No earlier candidates recorded.
        </p>
      ) : (
        <ol className="runtime-policy-candidate-lineage-list" role="list">
          {available.entries.map((entry) => (
            <li key={entry.snapshotVersion}>
              <strong>Version v{entry.snapshotVersion}</strong>
              <span>Compiler r{entry.compilerRevision}</span>
              <time dateTime={entry.createdAt}>{recordedAt(entry.createdAt)}</time>
            </li>
          ))}
        </ol>
      )}
      {available?.hasMore ? (
        <p className="runtime-policy-candidate-lineage-truncated">
          Showing the five newest earlier candidates. Additional earlier
          evidence is not shown.
        </p>
      ) : null}
    </section>
  );
}

const answerBehaviorLabels: Record<
  RuntimePolicyCandidateReviewManifestAnswerBehavior,
  string
> = {
  answer: "Use approved answer",
  create_staff_task: "Create staff task",
};

const handoffActionLabels: Record<
  RuntimePolicyCandidateReviewManifestHandoff["action"],
  string
> = {
  block_automation: "Block automation",
  create_task: "Create staff task",
  notify_staff: "Notify staff",
  transfer_when_live: "Transfer when live",
};

const handoffTriggerLabels: Record<
  RuntimePolicyCandidateReviewManifestHandoff["trigger"],
  string
> = {
  always_human: "Always route to staff",
  conflict: "Conflicting fact",
  explicit_human_request: "Explicit human request",
  low_confidence: "Low confidence",
  missing_fact: "Missing fact",
  topic: "Topic match",
};

function CandidateReviewManifest({
  candidate,
  headingId,
  manifest,
}: {
  candidate: RuntimePolicySnapshotRecord;
  headingId: string;
  manifest: RuntimePolicyCandidateReviewManifestView | undefined;
}) {
  const available =
    manifest?.status === "available" &&
    manifest.candidateId === candidate.id &&
    manifest.locationId === candidate.locationId &&
    manifest.snapshotVersion === candidate.snapshotVersion &&
    manifest.answerTopicCount === candidate.answerTopicCount &&
    manifest.handoffCount === candidate.handoffCount
      ? manifest
      : undefined;
  const answerHeadingId = `${headingId}-recorded-answer-routes`;
  const handoffHeadingId = `${headingId}-recorded-handoffs`;

  return (
    <section
      aria-label={`Recorded routing outline for candidate v${candidate.snapshotVersion}`}
      className="runtime-policy-candidate-manifest"
    >
      <div className="runtime-policy-candidate-manifest-heading">
        <div>
          <span>Exact candidate evidence</span>
          <h4>Recorded routing outline</h4>
        </div>
        <p>
          This describes the recorded candidate only. It does not activate,
          select, or prove a match with current source.
        </p>
      </div>
      {!available ? (
        <p className="runtime-policy-candidate-manifest-unavailable">
          Recorded routing evidence is unavailable. Existing candidate review
          remains available.
        </p>
      ) : (
        <div className="runtime-policy-candidate-manifest-grid">
          <section
            aria-labelledby={answerHeadingId}
            className="runtime-policy-candidate-manifest-lane"
          >
            <h5 id={answerHeadingId}>Answer routes</h5>
            {available.answerTopics.length === 0 ? (
              <p className="runtime-policy-candidate-manifest-empty">
                No recorded answer routes in this candidate.
              </p>
            ) : (
              <ul className="runtime-policy-candidate-manifest-list" role="list">
                {available.answerTopics.map((entry) => (
                  <li key={entry.topic}>
                    <strong>{entry.topic}</strong>
                    <span>{answerBehaviorLabels[entry.behavior]}</span>
                  </li>
                ))}
              </ul>
            )}
            {available.answerTopicsHasMore ? (
              <p className="runtime-policy-candidate-manifest-truncated">
                Additional recorded answer routes are not shown.
              </p>
            ) : null}
          </section>
          <section
            aria-labelledby={handoffHeadingId}
            className="runtime-policy-candidate-manifest-lane"
          >
            <h5 id={handoffHeadingId}>Handoffs</h5>
            {available.handoffs.length === 0 ? (
              <p className="runtime-policy-candidate-manifest-empty">
                No recorded handoffs in this candidate.
              </p>
            ) : (
              <ul className="runtime-policy-candidate-manifest-list" role="list">
                {available.handoffs.map((entry) => (
                  <li key={entry.priority}>
                    <strong>{entry.topic}</strong>
                    <span>Priority {entry.priority}</span>
                    <span>
                      {handoffTriggerLabels[entry.trigger]} ·{" "}
                      {handoffActionLabels[entry.action]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {available.handoffsHasMore ? (
              <p className="runtime-policy-candidate-manifest-truncated">
                Additional recorded handoffs are not shown.
              </p>
            ) : null}
          </section>
          <div className="runtime-policy-candidate-manifest-default">
            <span>Default behavior</span>
            <strong>
              When no recorded route applies, create a staff task.
            </strong>
          </div>
        </div>
      )}
    </section>
  );
}

const currentnessCopy: Record<
  RuntimePolicyReviewCurrentnessReason,
  { explanation: string; label: string }
> = {
  accepted_exact: {
    explanation:
      "The latest accepted review still matches the current owner-authorized source. Review guidance only; this does not authorize execution.",
    label: "Matches current source",
  },
  compiler_blocked: {
    explanation: "Current owner setup cannot produce an exact comparison.",
    label: "Review required",
  },
  not_accepted: {
    explanation:
      "The latest candidate does not have current accepted review evidence.",
    label: "Review required",
  },
  source_or_candidate_changed: {
    explanation:
      "The latest accepted evidence no longer exactly matches current source and candidate state.",
    label: "Review required",
  },
  verification_unavailable: {
    explanation:
      "A positive match could not be verified. Existing candidate review remains available.",
    label: "Check unavailable",
  },
};

function RecordCandidateButton({
  canRecord,
  locationName,
}: {
  canRecord: boolean;
  locationName: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-label={`Record runtime policy candidate for ${locationName}`}
      className="button"
      disabled={!canRecord || pending}
      type="submit"
    >
      {pending ? "Recording" : "Record candidate"}
    </button>
  );
}

function ReviewDecisionForm({
  canSubmit,
  candidate,
  decision,
  formAction,
}: {
  canSubmit: boolean;
  candidate: RuntimePolicySnapshotRecord;
  decision: RuntimePolicyReviewDecision;
  formAction: (formData: FormData) => void;
}) {
  const label = decision === "accepted" ? "Accept review" : "Reject review";

  return (
    <form action={formAction}>
      <input name="candidateId" type="hidden" value={candidate.id} />
      <input
        name="creationKey"
        type="hidden"
        value={`review:${candidate.id.slice(-64)}:d${candidate.decisionCount + 1}:${decision}`}
      />
      <ReviewDecisionButton
        canSubmit={canSubmit}
        candidate={candidate}
        decision={decision}
        label={label}
      />
    </form>
  );
}

function ReviewDecisionButton({
  canSubmit,
  candidate,
  decision,
  label,
}: {
  canSubmit: boolean;
  candidate: RuntimePolicySnapshotRecord;
  decision: RuntimePolicyReviewDecision;
  label: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-label={`${label} for candidate v${candidate.snapshotVersion}`}
      className={decision === "accepted" ? "button button-primary" : "button"}
      disabled={!canSubmit || pending}
      name="decision"
      type="submit"
      value={decision}
    >
      {pending ? "Recording review" : label}
    </button>
  );
}

interface WalkthroughGuidanceLink {
  readonly href: string;
  readonly label: string;
}

function walkthroughGuidanceLinks(
  guidance: RuntimePolicyReviewGuidance,
): WalkthroughGuidanceLink[] {
  if (guidance.status === "location_unavailable") {
    return [
      {
        href: "#location-profile",
        label: `${guidance.locationName}: Review location profile`,
      },
    ];
  }
  if (guidance.status === "resolve_source_setup") {
    return [
      {
        href: "#manual-source-intake",
        label: `${guidance.locationName}: Review source facts`,
      },
      {
        href: "#answers",
        label: `${guidance.locationName}: Review answers`,
      },
      {
        href: "#handoff-rules",
        label: `${guidance.locationName}: Review handoff rules`,
      },
    ];
  }
  return [
    {
      href: `#${guidance.locationCardAnchor}`,
      label: `${guidance.locationName}: ${guidance.label}`,
    },
  ];
}

export function RuntimePolicyCandidatePanel({
  candidateLineage,
  candidateManifests,
  locations,
  onRecordRuntimePolicyCandidate,
  onReviewRuntimePolicyCandidate,
  persistenceMode,
  policyWriterAvailable,
  reviewCurrentness,
  reviewHistory,
  snapshots,
  tenantId,
}: RuntimePolicyCandidatePanelProps) {
  const [state, formAction] = useActionState(
    onRecordRuntimePolicyCandidate,
    initialState,
  );
  const [reviewState, reviewFormAction] = useActionState(
    onReviewRuntimePolicyCandidate,
    initialState,
  );
  const candidateSummariesAvailable = persistenceMode === "backend";
  const walkthroughGuidance = ownerRuntimePolicyReviewGuidance({
    candidateManifests,
    candidateSummaries: snapshots,
    candidateSummariesAvailable,
    locations,
    reviewCurrentness,
  });

  return (
    <section
      className="panel runtime-policy-candidates"
      aria-label="Runtime policy candidates"
    >
      <div className="panel-header">
        <div>
          <span className="rail-title">Review candidates</span>
          <h2>Preserve a compiled policy for owner review</h2>
          <p>
            Recording creates an append-only review artifact. It does not
            activate, execute, or send anything to a provider. Accepting or
            rejecting adds review evidence only.
          </p>
        </div>
        <span className="channel-pill quiet">Not active</span>
      </div>

      <section
        aria-labelledby="runtime-policy-guided-walkthrough-heading"
        className="runtime-policy-guided-walkthrough"
      >
        <div className="runtime-policy-guided-walkthrough-heading">
          <div>
            <span>Guided walkthrough next step</span>
            <h3 id="runtime-policy-guided-walkthrough-heading">
              Review each location’s next safe step
            </h3>
          </div>
          <p>
            This guidance does not activate, select, evaluate, or execute a
            runtime policy.
          </p>
        </div>
        {walkthroughGuidance.length === 0 ? (
          <p className="runtime-policy-guided-walkthrough-empty">
            No tenant locations are available.
          </p>
        ) : (
          <ol className="runtime-policy-guided-walkthrough-list" role="list">
            {walkthroughGuidance.map((guidance) => (
              <li
                className={`runtime-policy-guided-walkthrough-item ${guidance.status}`}
                key={guidance.locationId}
              >
                <div>
                  <span>{guidance.locationName}</span>
                  <strong>{guidance.label}</strong>
                  <p>{guidance.explanation}</p>
                </div>
                <div className="runtime-policy-guided-walkthrough-links">
                  {walkthroughGuidanceLinks(guidance).map((link) => (
                    <a className="mini-button quiet" href={link.href} key={link.href}>
                      {link.label}
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="runtime-policy-candidate-locations">
        {locations.length === 0 ? (
          <p className="runtime-policy-candidate-empty">
            No tenant locations are available.
          </p>
        ) : (
          locations.map((location) => {
            const latest = snapshots.find(
              (record) => record.locationId === location.id,
            );
            const currentness = latest
              ? reviewCurrentness.find(
                  (record) => record.candidateId === latest.id,
                )
              : undefined;
            const manifest = latest
              ? candidateManifests.find(
                  (record) => record.candidateId === latest.id,
                )
              : undefined;
            const lineage = latest
              ? candidateLineage.find(
                  (record) => record.anchorCandidateId === latest.id,
                )
              : undefined;
            const history = latest
              ? reviewHistory.find(
                  (record) => record.candidateId === latest.id,
                )
              : undefined;
            const headingId = runtimePolicyLocationCardAnchor(location.id);
            const canRecord =
              persistenceMode === "backend" &&
              policyWriterAvailable &&
              location.status === "active";
            const canReview = persistenceMode === "backend" && Boolean(latest);
            const canAccept =
              canReview && location.status === "active";
            const showFeedback =
              state.message && state.targetId === location.id;
            const showReviewFeedback =
              latest &&
              reviewState.message &&
              reviewState.targetId === latest.id;

            return (
              <article
                className="runtime-policy-candidate-location"
                key={location.id}
              >
                <div className="runtime-policy-candidate-heading">
                  <div>
                    <span>
                      {location.status === "active"
                        ? "Active location"
                        : "Location unavailable"}
                    </span>
                    <h3 id={headingId} tabIndex={-1}>
                      {location.name}
                    </h3>
                  </div>
                  <div className="runtime-policy-candidate-version">
                    <strong>
                      {latest ? `v${latest.snapshotVersion}` : "None"}
                    </strong>
                    <span>
                      {latest ? `Compiler r${latest.compilerRevision} · ` : ""}
                      {latest?.candidateCount ?? 0} recorded
                    </span>
                  </div>
                </div>

                {latest ? (
                  <div className="runtime-policy-candidate-summary">
                    <div>
                      <span>Answer topics</span>
                      <strong>{latest.answerTopicCount}</strong>
                    </div>
                    <div>
                      <span>Handoffs</span>
                      <strong>{latest.handoffCount}</strong>
                    </div>
                    <div>
                      <span>Warnings</span>
                      <strong>{latest.warningCount}</strong>
                    </div>
                    <div className="runtime-policy-candidate-fingerprints">
                      <span>Source fingerprint</span>
                      <code>{shortDigest(latest.sourceDigest)}</code>
                      <span>Policy fingerprint</span>
                      <code>{shortDigest(latest.policyDigest)}</code>
                    </div>
                    <time dateTime={latest.createdAt}>
                      {recordedAt(latest.createdAt)}
                    </time>
                    <CandidateReviewManifest
                      candidate={latest}
                      headingId={headingId}
                      manifest={manifest}
                    />
                    <ReviewHistory candidate={latest} history={history} />
                    {currentness ? (
                      <section
                        aria-labelledby={headingId}
                        className={`runtime-policy-review-currentness ${currentness.outcome}`}
                      >
                        <span>Review currentness</span>
                        <strong>{currentnessCopy[currentness.reason].label}</strong>
                        <p>{currentnessCopy[currentness.reason].explanation}</p>
                        <time dateTime={currentness.checkedAt}>
                          Checked {recordedAt(currentness.checkedAt)}
                        </time>
                      </section>
                    ) : null}
                    <CandidateLineage candidate={latest} lineage={lineage} />
                  </div>
                ) : (
                  <p className="runtime-policy-candidate-empty">
                    {candidateSummariesAvailable
                      ? "No candidate recorded."
                      : "Candidate evidence is unavailable."}
                  </p>
                )}

                <form
                  action={formAction}
                  className="runtime-policy-candidate-form"
                >
                  <input name="tenantId" type="hidden" value={tenantId} />
                  <input name="locationId" type="hidden" value={location.id} />
                  <RecordCandidateButton
                    canRecord={canRecord}
                    locationName={location.name}
                  />
                  {!canRecord ? (
                    <span>
                      {persistenceMode !== "backend"
                        ? "Protected policy persistence is required."
                        : !policyWriterAvailable
                          ? "Candidate recording is unavailable."
                          : "Only active locations can produce candidates."}
                    </span>
                  ) : null}
                </form>
                {latest ? (
                  <div className="runtime-policy-review-actions">
                    <div>
                      <strong>Owner review evidence</strong>
                      <span>
                        Acceptance is recompiled and checked against the exact
                        latest candidate. Neither decision authorizes execution.
                      </span>
                    </div>
                    <div className="runtime-policy-review-buttons">
                      <ReviewDecisionForm
                        canSubmit={canAccept}
                        candidate={latest}
                        decision="accepted"
                        formAction={reviewFormAction}
                      />
                      <ReviewDecisionForm
                        canSubmit={canReview}
                        candidate={latest}
                        decision="rejected"
                        formAction={reviewFormAction}
                      />
                    </div>
                    {!policyWriterAvailable ? (
                      <span>
                        Protected policy persistence is unavailable for recording
                        another candidate. Owner review evidence remains available.
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {showFeedback ? (
                  <p
                    className={`inline-form-status ${state.ok ? "success" : "error"}`}
                    role="status"
                  >
                    {state.message}
                  </p>
                ) : null}
                {showReviewFeedback ? (
                  <p
                    className={`inline-form-status ${reviewState.ok ? "success" : "error"}`}
                    role="status"
                  >
                    {reviewState.message}
                  </p>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
