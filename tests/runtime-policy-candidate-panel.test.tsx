import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RuntimePolicyCandidatePanel } from "@/components/owner/RuntimePolicyCandidatePanel";

const action = async () => ({ ok: false, message: "" });

describe("RuntimePolicyCandidatePanel", () => {
  it("renders a semantic guided-walkthrough queue in location order", () => {
    const acceptedSnapshot = {
      answerTopicCount: 1,
      candidateCount: 1,
      compilerRevision: 1,
      createdAt: "2026-07-15T12:00:00.000Z",
      decisionCount: 1,
      handoffCount: 0,
      latestDecision: "accepted" as const,
      latestDecisionAt: "2026-07-15T12:05:00.000Z",
      policyDigest: "b".repeat(64),
      schemaVersion: 1,
      snapshotVersion: 1,
      sourceDigest: "a".repeat(64),
      tenantId: "tenant_a",
      warningCount: 0,
    };
    const rendered = renderToStaticMarkup(
      <RuntimePolicyCandidatePanel
        candidateLineage={[]}
        candidateManifests={[
          {
            answerTopicCount: 1,
            answerTopics: [{ behavior: "answer", topic: "Hours" }],
            answerTopicsHasMore: false,
            candidateId: "candidate_ready",
            defaultBehavior: "create_staff_task",
            handoffCount: 0,
            handoffs: [],
            handoffsHasMore: false,
            locationId: "location_ready",
            snapshotVersion: 1,
            status: "available",
          },
        ]}
        locations={[
          { id: "location_ready", name: "North", status: "active" },
          { id: "location_rejected", name: "South", status: "active" },
          { id: "location_paused", name: "West", status: "paused" },
          { id: "location_empty", name: "East", status: "active" },
          { id: "location_source", name: "Central", status: "active" },
          { id: "location_changed", name: "Harbor", status: "active" },
        ]}
        onRecordRuntimePolicyCandidate={action}
        onReviewRuntimePolicyCandidate={action}
        persistenceMode="backend"
        policyWriterAvailable
        reviewCurrentness={[
          {
            candidateId: "candidate_ready",
            checkedAt: "2026-07-15T12:10:00.000Z",
            locationId: "location_ready",
            outcome: "matches_current_source",
            reason: "accepted_exact",
          },
          {
            candidateId: "candidate_source",
            checkedAt: "2026-07-15T12:11:00.000Z",
            locationId: "location_source",
            outcome: "review_required",
            reason: "compiler_blocked",
          },
          {
            candidateId: "candidate_changed",
            checkedAt: "2026-07-15T12:12:00.000Z",
            locationId: "location_changed",
            outcome: "review_required",
            reason: "source_or_candidate_changed",
          },
        ]}
        reviewHistory={[]}
        snapshots={[
          {
            ...acceptedSnapshot,
            id: "candidate_ready",
            locationId: "location_ready",
          },
          {
            ...acceptedSnapshot,
            decisionCount: 1,
            id: "candidate_rejected",
            latestDecision: "rejected",
            locationId: "location_rejected",
          },
          {
            ...acceptedSnapshot,
            id: "candidate_paused",
            locationId: "location_paused",
          },
          {
            ...acceptedSnapshot,
            id: "candidate_source",
            locationId: "location_source",
          },
          {
            ...acceptedSnapshot,
            id: "candidate_changed",
            locationId: "location_changed",
          },
        ]}
        tenantId="tenant_a"
      />,
    );

    expect(rendered).toContain(
      'aria-labelledby="runtime-policy-guided-walkthrough-heading"',
    );
    expect(rendered).toContain(
      '<ol class="runtime-policy-guided-walkthrough-list" role="list">',
    );
    expect(rendered).toContain(
      '<div class="runtime-policy-guided-walkthrough-links">',
    );
    expect(rendered).not.toContain("<nav");
    expect(rendered).toContain("Guided walkthrough next step");
    expect(rendered).toContain("Ready for guided owner walkthrough");
    expect(rendered).toContain("Revisit rejected candidate");
    expect(rendered).toContain("Location unavailable for walkthrough");
    expect(rendered).toContain("Record candidate");
    expect(rendered).toContain("Resolve source setup");
    expect(rendered).toContain(
      "This guidance does not activate, select, evaluate, or execute a runtime policy.",
    );
    expect(rendered).toContain(
      'href="#runtime-policy-candidate-location_ready"',
    );
    expect(rendered).toContain(
      'href="#runtime-policy-candidate-location_rejected"',
    );
    expect(rendered).toContain('href="#location-profile"');
    expect(rendered).toContain('href="#manual-source-intake"');
    expect(rendered).toContain('href="#answers"');
    expect(rendered).toContain('href="#handoff-rules"');
    expect(rendered).toContain(
      'href="#runtime-policy-candidate-location_changed"',
    );
    expect(rendered).toContain(
      ">Central: Review source facts<",
    );
    expect(rendered).toContain(">Central: Review answers<");
    expect(rendered).toContain(">Central: Review handoff rules<");
    expect(rendered).toContain(
      'id="runtime-policy-candidate-location_ready" tabindex="-1"',
    );
    expect(rendered).toContain(">North: Ready for guided owner walkthrough<");
    expect(rendered.indexOf("North: Ready")).toBeLessThan(
      rendered.indexOf("South: Revisit"),
    );
    expect(rendered.indexOf("South: Revisit")).toBeLessThan(
      rendered.indexOf("West: Review location profile"),
    );
    expect(rendered.indexOf("West: Review location profile")).toBeLessThan(
      rendered.indexOf("East: Record"),
    );
  });

  it("renders privacy-minimal candidate summaries without activation controls", () => {
    const rendered = renderToStaticMarkup(
      <RuntimePolicyCandidatePanel
        candidateLineage={[
          {
            anchorCandidateId: "snapshot_a",
            anchorSnapshotVersion: 3,
            entries: [],
            hasMore: false,
            locationId: "location_active",
            status: "available",
          },
        ]}
        candidateManifests={[]}
        locations={[
          { id: "location_active", name: "North", status: "active" },
          { id: "location_paused", name: "South", status: "paused" },
        ]}
        onRecordRuntimePolicyCandidate={action}
        onReviewRuntimePolicyCandidate={action}
        persistenceMode="backend"
        policyWriterAvailable
        reviewHistory={[
          {
            candidateId: "snapshot_a",
            entries: [],
            hasMore: false,
            locationId: "location_active",
            snapshotVersion: 3,
            status: "available",
            totalDecisionCount: 0,
          },
        ]}
        reviewCurrentness={[
          {
            candidateId: "snapshot_a",
            checkedAt: "2026-07-14T09:10:11.000Z",
            locationId: "location_active",
            outcome: "matches_current_source",
            reason: "accepted_exact",
          },
        ]}
        snapshots={[
          {
            answerTopicCount: 4,
            candidateCount: 3,
            compilerRevision: 1,
            createdAt: "2026-07-13T12:34:56.000Z",
            decisionCount: 0,
            handoffCount: 2,
            id: "snapshot_a",
            latestDecision: null,
            latestDecisionAt: null,
            locationId: "location_active",
            policyDigest: "b".repeat(64),
            schemaVersion: 1,
            snapshotVersion: 3,
            sourceDigest: "a".repeat(64),
            tenantId: "tenant_a",
            warningCount: 1,
          },
        ]}
        tenantId="tenant_a"
      />,
    );

    expect(rendered).toContain('aria-label="Runtime policy candidates"');
    expect(rendered).toContain("Not active");
    expect(rendered).toContain(
      "does not activate, execute, or send anything",
    );
    expect(rendered).toContain("v3");
    expect(rendered).toContain("Compiler r1");
    expect(rendered).toContain("aaaaaaaaaaaa");
    expect(rendered).toContain("bbbbbbbbbbbb");
    expect(rendered).toContain("2026-07-13 12:34 UTC");
    expect(rendered).toContain("Recent decisions for this candidate");
    expect(rendered).toContain("No decisions recorded for this candidate");
    expect(rendered).toContain("Earlier recorded candidates");
    expect(rendered).toContain("No earlier candidates recorded.");
    expect(rendered).toContain(
      "No candidate shown here is active or selected.",
    );
    expect(rendered).toContain("Matches current source");
    expect(rendered).toContain("Review guidance only");
    expect(rendered).toContain('dateTime="2026-07-14T09:10:11.000Z"');
    expect(rendered).not.toContain('aria-live="polite"');
    expect(rendered).toContain("Accept review");
    expect(rendered).toContain("Reject review");
    const reviewForms = rendered
      .split("</form>")
      .filter((form) => form.includes('name="candidateId"'));
    expect(reviewForms).toHaveLength(2);
    for (const reviewForm of reviewForms) {
      expect(reviewForm).toContain('name="candidateId"');
      expect(reviewForm).toContain('name="creationKey"');
      expect(reviewForm).toContain('name="decision"');
      expect(reviewForm).not.toContain('name="tenantId"');
      expect(reviewForm).not.toContain('name="ownerId"');
      expect(reviewForm).not.toContain('name="locationId"');
      expect(reviewForm).not.toContain('name="policyBody"');
      expect(reviewForm).not.toContain('name="sourceDigest"');
      expect(reviewForm).not.toContain('name="policyDigest"');
      expect(reviewForm).not.toContain('name="activationState"');
    }
    expect(rendered).toContain("Only active locations can produce candidates.");
    expect(rendered).not.toContain("Approve candidate");
    expect(rendered).not.toContain("Activate candidate");
    expect(rendered).not.toContain("owner@example.com");
    expect(rendered).not.toContain("configured destination");
  });

  it("renders one bounded recent-decision hierarchy without duplicating the latest summary", () => {
    const rendered = renderToStaticMarkup(
      <RuntimePolicyCandidatePanel
        candidateLineage={[
          {
            anchorCandidateId: "snapshot_a",
            anchorSnapshotVersion: 7,
            entries: [6, 5, 4, 3, 2].map((snapshotVersion) => ({
              compilerRevision: snapshotVersion % 2 === 0 ? 2 : 1,
              createdAt: `2026-07-14T07:0${snapshotVersion}:00.000Z`,
              snapshotVersion,
            })),
            hasMore: true,
            locationId: "location_a",
            status: "available",
          },
        ]}
        candidateManifests={[]}
        locations={[{ id: "location_a", name: "North", status: "active" }]}
        onRecordRuntimePolicyCandidate={action}
        onReviewRuntimePolicyCandidate={action}
        persistenceMode="backend"
        policyWriterAvailable={false}
        reviewHistory={[
          {
            candidateId: "snapshot_a",
            entries: [7, 6, 5, 4, 3].map((decisionSequence) => ({
              createdAt:
                decisionSequence === 7
                  ? "2026-07-14T08:09:10.000Z"
                  : `2026-07-14T08:0${decisionSequence}:00.000Z`,
              decision:
                decisionSequence % 2 === 0
                  ? ("accepted" as const)
                  : ("rejected" as const),
              decisionSequence,
            })),
            hasMore: true,
            locationId: "location_a",
            snapshotVersion: 7,
            status: "available",
            totalDecisionCount: 7,
          },
        ]}
        reviewCurrentness={[]}
        snapshots={[
          {
            answerTopicCount: 4,
            candidateCount: 7,
            compilerRevision: 1,
            createdAt: "2026-07-13T12:34:56.000Z",
            decisionCount: 7,
            handoffCount: 2,
            id: "snapshot_a",
            latestDecision: "rejected",
            latestDecisionAt: "2026-07-14T08:09:10.000Z",
            locationId: "location_a",
            policyDigest: "b".repeat(64),
            schemaVersion: 1,
            snapshotVersion: 7,
            sourceDigest: "a".repeat(64),
            tenantId: "tenant_a",
            warningCount: 1,
          },
        ]}
        tenantId="tenant_a"
      />,
    );

    expect(rendered).toContain("Rejected");
    expect(rendered).toContain("Accepted");
    expect(rendered).toContain("Decision 7");
    expect(rendered).toContain("Showing 5 of 7 decisions");
    expect(rendered).toContain("Older evidence is not shown");
    expect(rendered).toContain("Version v6");
    expect(rendered).toContain("Compiler r2");
    expect(rendered).toContain("2026-07-14 07:06 UTC");
    expect(rendered).toContain(
      "Showing the five newest earlier candidates",
    );
    expect(rendered).toContain("Additional earlier evidence is not shown");
    expect(rendered.indexOf("Version v6")).toBeLessThan(
      rendered.indexOf("Version v2"),
    );
    const lineageSection = rendered.match(
      /<section aria-label="Earlier recorded candidates before v7"[\s\S]*?<\/section>/u,
    )?.[0];
    expect(lineageSection).toBeDefined();
    expect(lineageSection).toContain(
      '<ol class="runtime-policy-candidate-lineage-list" role="list">',
    );
    expect(lineageSection?.match(/<li/gu)).toHaveLength(5);
    expect(lineageSection).not.toMatch(
      /<button|<a |snapshot_a|Accepted|Rejected|fingerprint/u,
    );
    expect(rendered).toContain("2026-07-14 08:09 UTC");
    expect(rendered.match(/Recent decisions for this candidate/gu)).toHaveLength(1);
    expect(rendered).toContain(
      "Owner review evidence remains available.",
    );
    expect(rendered).not.toContain("owner@example.com");
    expect(rendered).not.toContain("review note");
    expect(rendered).not.toContain("previous reviewer");
  });

  it("binds review retry keys to the immutable candidate across locations", () => {
    const baseSnapshot = {
      answerTopicCount: 0,
      candidateCount: 1,
      compilerRevision: 1,
      createdAt: "2026-07-14T12:00:00.000Z",
      decisionCount: 0,
      handoffCount: 0,
      latestDecision: null,
      latestDecisionAt: null,
      policyDigest: "b".repeat(64),
      schemaVersion: 1,
      snapshotVersion: 1,
      sourceDigest: "a".repeat(64),
      tenantId: "tenant_a",
      warningCount: 0,
    } as const;
    const rendered = renderToStaticMarkup(
      <RuntimePolicyCandidatePanel
        candidateLineage={[
          {
            anchorCandidateId: "candidate_location_a",
            anchorSnapshotVersion: 1,
            entries: [],
            hasMore: false,
            locationId: "location_a",
            status: "available",
          },
          {
            anchorCandidateId: "candidate_location_b",
            anchorSnapshotVersion: 1,
            entries: [],
            hasMore: false,
            locationId: "location_b",
            status: "available",
          },
        ]}
        candidateManifests={[]}
        locations={[
          { id: "location_a", name: "North", status: "active" },
          { id: "location_b", name: "South", status: "active" },
        ]}
        onRecordRuntimePolicyCandidate={action}
        onReviewRuntimePolicyCandidate={action}
        persistenceMode="backend"
        policyWriterAvailable
        reviewHistory={[
          {
            candidateId: "candidate_location_a",
            entries: [],
            hasMore: false,
            locationId: "location_a",
            snapshotVersion: 1,
            status: "available",
            totalDecisionCount: 0,
          },
          {
            candidateId: "candidate_location_b",
            entries: [],
            hasMore: false,
            locationId: "location_b",
            snapshotVersion: 1,
            status: "available",
            totalDecisionCount: 0,
          },
        ]}
        reviewCurrentness={[]}
        snapshots={[
          { ...baseSnapshot, id: "candidate_location_a", locationId: "location_a" },
          { ...baseSnapshot, id: "candidate_location_b", locationId: "location_b" },
        ]}
        tenantId="tenant_a"
      />,
    );

    expect(rendered).toContain(
      'value="review:candidate_location_a:d1:accepted"',
    );
    expect(rendered).toContain(
      'value="review:candidate_location_b:d1:accepted"',
    );
  });

  it("keeps recording disabled without backend owner access", () => {
    const rendered = renderToStaticMarkup(
      <RuntimePolicyCandidatePanel
        candidateLineage={[]}
        candidateManifests={[]}
        locations={[{ id: "location_a", name: "North", status: "active" }]}
        onRecordRuntimePolicyCandidate={action}
        onReviewRuntimePolicyCandidate={action}
        persistenceMode="setup_required"
        policyWriterAvailable={false}
        reviewHistory={[]}
        reviewCurrentness={[]}
        snapshots={[]}
        tenantId="tenant_a"
      />,
    );

    expect(rendered).not.toContain("No candidate recorded.");
    expect(rendered).toContain("Candidate evidence unavailable");
    expect(rendered).toContain("Candidate evidence is unavailable.");
    expect(rendered).toContain("Protected policy persistence is required.");
    expect(rendered).toMatch(
      /<button[^>]*aria-label="Record runtime policy candidate for North"[^>]*disabled=""[^>]*>Record candidate<\/button>/u,
    );
  });

  it("renders a bounded walkthrough empty state without tenant locations", () => {
    const rendered = renderToStaticMarkup(
      <RuntimePolicyCandidatePanel
        candidateLineage={[]}
        candidateManifests={[]}
        locations={[]}
        onRecordRuntimePolicyCandidate={action}
        onReviewRuntimePolicyCandidate={action}
        persistenceMode="backend"
        policyWriterAvailable
        reviewCurrentness={[]}
        reviewHistory={[]}
        snapshots={[]}
        tenantId="tenant_a"
      />,
    );

    expect(rendered).toContain("No tenant locations are available.");
    expect(rendered).not.toContain(
      'class="runtime-policy-guided-walkthrough-item',
    );
  });

  it("renders the bounded review-required and unavailable reason copy", () => {
    const snapshot = {
      answerTopicCount: 0,
      candidateCount: 1,
      compilerRevision: 1,
      createdAt: "2026-07-14T12:00:00.000Z",
      decisionCount: 1,
      handoffCount: 0,
      latestDecision: "accepted" as const,
      latestDecisionAt: "2026-07-14T12:05:00.000Z",
      policyDigest: "b".repeat(64),
      schemaVersion: 1,
      snapshotVersion: 2,
      sourceDigest: "a".repeat(64),
      tenantId: "tenant_a",
      warningCount: 0,
    };
    const rendered = renderToStaticMarkup(
      <RuntimePolicyCandidatePanel
        candidateLineage={[
          {
            anchorCandidateId: "candidate_a",
            anchorSnapshotVersion: 2,
            entries: [
              {
                compilerRevision: 1,
                createdAt: "2026-07-14T11:00:00.000Z",
                snapshotVersion: 1,
              },
            ],
            hasMore: false,
            locationId: "location_a",
            status: "available",
          },
          {
            anchorCandidateId: "candidate_b",
            anchorSnapshotVersion: 2,
            entries: [],
            hasMore: false,
            locationId: "location_other",
            status: "available",
          },
        ]}
        candidateManifests={[
          {
            answerTopicCount: 0,
            answerTopics: [],
            answerTopicsHasMore: false,
            candidateId: "candidate_a",
            defaultBehavior: "create_staff_task",
            handoffCount: 0,
            handoffs: [],
            handoffsHasMore: false,
            locationId: "location_a",
            snapshotVersion: 2,
            status: "available",
          },
          { candidateId: "candidate_b", status: "unavailable" },
        ]}
        locations={[
          { id: "location_a", name: "North", status: "active" },
          { id: "location_b", name: "South", status: "active" },
        ]}
        onRecordRuntimePolicyCandidate={action}
        onReviewRuntimePolicyCandidate={action}
        persistenceMode="backend"
        policyWriterAvailable
        reviewHistory={[
          {
            candidateId: "candidate_a",
            entries: [
              {
                createdAt: "2026-07-14T12:05:00.000Z",
                decision: "accepted",
                decisionSequence: 1,
              },
            ],
            hasMore: false,
            locationId: "location_a",
            snapshotVersion: 2,
            status: "available",
            totalDecisionCount: 1,
          },
          { candidateId: "candidate_b", status: "unavailable" },
        ]}
        reviewCurrentness={[
          {
            candidateId: "candidate_a",
            checkedAt: "2026-07-14T12:10:00.000Z",
            locationId: "location_a",
            outcome: "review_required",
            reason: "source_or_candidate_changed",
          },
          {
            candidateId: "candidate_b",
            checkedAt: "2026-07-14T12:11:00.000Z",
            locationId: "location_b",
            outcome: "check_unavailable",
            reason: "verification_unavailable",
          },
        ]}
        snapshots={[
          { ...snapshot, id: "candidate_a", locationId: "location_a" },
          { ...snapshot, id: "candidate_b", locationId: "location_b" },
        ]}
        tenantId="tenant_a"
      />,
    );

    expect(rendered).toContain("Review required");
    expect(rendered).toContain(
      "no longer exactly matches current source and candidate state",
    );
    expect(rendered).toContain("Check unavailable");
    expect(rendered).toContain("A positive match could not be verified");
    expect(rendered).toContain("Recent decision evidence is unavailable");
    expect(rendered).toContain("Earlier candidate evidence is unavailable");
    expect(rendered).toContain("No recorded answer routes in this candidate.");
    expect(rendered).toContain("No recorded handoffs in this candidate.");
    expect(rendered).toContain("Recorded routing evidence is unavailable");
    expect(rendered).toContain(
      "Review of the newest candidate remains available",
    );
    expect(rendered).toContain("Accept review");
    expect(rendered).toContain("Reject review");
    expect(rendered).not.toContain("policy body");
    expect(rendered).not.toContain("actor_user_id");
    expect(rendered).not.toContain("Activate policy");
  });

  it("renders bounded recorded routes with semantic lists and fixed human labels", () => {
    const answerBehaviorLabels = {
      answer: "Use approved answer",
      create_staff_task: "Create staff task",
    } as const;
    const answerTopics = Array.from({ length: 10 }, (_, index) => ({
      behavior:
        index % 2 === 0 ? ("answer" as const) : ("create_staff_task" as const),
      topic: `Answer topic ${String(index + 1).padStart(2, "0")}`,
    }));
    const triggers = [
      "topic",
      "low_confidence",
      "always_human",
      "explicit_human_request",
      "missing_fact",
      "conflict",
    ] as const;
    const triggerLabels = {
      always_human: "Always route to staff",
      conflict: "Conflicting fact",
      explicit_human_request: "Explicit human request",
      low_confidence: "Low confidence",
      missing_fact: "Missing fact",
      topic: "Topic match",
    } as const;
    const actions = [
      "create_task",
      "notify_staff",
      "transfer_when_live",
      "block_automation",
    ] as const;
    const actionLabels = {
      block_automation: "Block automation",
      create_task: "Create staff task",
      notify_staff: "Notify staff",
      transfer_when_live: "Transfer when live",
    } as const;
    const handoffs = Array.from({ length: 10 }, (_, index) => ({
      action: actions[index % actions.length]!,
      priority: index + 1,
      topic: `Handoff topic ${String(index + 1).padStart(2, "0")}`,
      trigger: triggers[index % triggers.length]!,
    }));
    const rendered = renderToStaticMarkup(
      <RuntimePolicyCandidatePanel
        candidateLineage={[
          {
            anchorCandidateId: "candidate_manifest",
            anchorSnapshotVersion: 1,
            entries: [],
            hasMore: false,
            locationId: "location_manifest",
            status: "available",
          },
        ]}
        candidateManifests={[
          {
            answerTopicCount: 15,
            answerTopics,
            answerTopicsHasMore: true,
            candidateId: "candidate_manifest",
            defaultBehavior: "create_staff_task",
            handoffCount: 12,
            handoffs,
            handoffsHasMore: true,
            locationId: "location_manifest",
            snapshotVersion: 1,
            status: "available",
          },
        ]}
        locations={[
          { id: "location_manifest", name: "North", status: "active" },
        ]}
        onRecordRuntimePolicyCandidate={action}
        onReviewRuntimePolicyCandidate={action}
        persistenceMode="backend"
        policyWriterAvailable
        reviewCurrentness={[]}
        reviewHistory={[
          {
            candidateId: "candidate_manifest",
            entries: [],
            hasMore: false,
            locationId: "location_manifest",
            snapshotVersion: 1,
            status: "available",
            totalDecisionCount: 0,
          },
        ]}
        snapshots={[
          {
            answerTopicCount: 15,
            candidateCount: 1,
            compilerRevision: 1,
            createdAt: "2026-07-15T12:00:00.000Z",
            decisionCount: 0,
            handoffCount: 12,
            id: "candidate_manifest",
            latestDecision: null,
            latestDecisionAt: null,
            locationId: "location_manifest",
            policyDigest: "b".repeat(64),
            schemaVersion: 1,
            snapshotVersion: 1,
            sourceDigest: "a".repeat(64),
            tenantId: "tenant_manifest",
            warningCount: 0,
          },
        ]}
        tenantId="tenant_manifest"
      />,
    );

    expect(rendered).toContain("Recorded routing outline");
    for (const answerTopic of answerTopics) {
      expect(rendered).toContain(
        `<li><strong>${answerTopic.topic}</strong><span>${answerBehaviorLabels[answerTopic.behavior]}</span></li>`,
      );
    }
    for (const handoff of handoffs) {
      expect(rendered).toContain(
        `<li><strong>${handoff.topic}</strong><span>Priority ${handoff.priority}</span><span>${triggerLabels[handoff.trigger]} · ${actionLabels[handoff.action]}</span></li>`,
      );
    }
    expect(rendered).toContain(
      "When no recorded route applies, create a staff task.",
    );
    expect(rendered).toContain("Additional recorded answer routes are not shown.");
    expect(rendered).toContain("Additional recorded handoffs are not shown.");
    expect(rendered).toContain(
      '<ul class="runtime-policy-candidate-manifest-list" role="list">',
    );
    expect(rendered.match(/runtime-policy-candidate-manifest-list/gu)).toHaveLength(2);
    expect(rendered).not.toMatch(
      /low_confidence|always_human|explicit_human_request|missing_fact|create_task|notify_staff|transfer_when_live|block_automation|create_staff_task/u,
    );
    expect(rendered).not.toMatch(/answer text|destination|active window|topic key/u);
  });
});
