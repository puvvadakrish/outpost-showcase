import { displayLabel } from "@/domain/formatting";
import type {
  LocationRuntimeGuardrailPreview,
  RuntimeGuardrailReviewReason,
  RuntimeGuardrailTopic
} from "@/domain/runtime-guardrails";

interface RuntimeGuardrailPreviewPanelProps {
  previews: LocationRuntimeGuardrailPreview[];
}

function countLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

const reviewReasonLabels: Record<RuntimeGuardrailReviewReason, string> = {
  duplicate_answers: "Multiple answer rows apply",
  eligible_answer_handoff_overlap: "Eligible answer overlaps an active handoff"
};

function TopicList({ emptyLabel, topics }: { emptyLabel: string; topics: RuntimeGuardrailTopic[] }) {
  if (topics.length === 0) {
    return <span className="runtime-guardrail-empty">{emptyLabel}</span>;
  }

  return (
    <ul className="runtime-guardrail-topic-list">
      {topics.map((topic) => (
        <li key={topic.id}>
          <span>{topic.topic}</span>
          <small>{topic.scope === "global" ? "All locations" : "This location"}</small>
        </li>
      ))}
    </ul>
  );
}

export function RuntimeGuardrailPreviewPanel({ previews }: RuntimeGuardrailPreviewPanelProps) {
  return (
    <section className="panel runtime-guardrail-preview" aria-label="Future runtime guardrail preview">
      <div className="panel-header">
        <div>
          <span className="rail-title">Setup preview</span>
          <h2>Future runtime guardrails by location</h2>
          <p>Owner-approved topic inventory. No phone, email, transfer, or reply behavior runs here.</p>
        </div>
        <span className="channel-pill">No provider execution</span>
      </div>

      {previews.length === 0 ? (
        <div className="quiet-strip">
          <strong>No locations available</strong>
          <span className="muted">Add a tenant location before reviewing future guardrails.</span>
        </div>
      ) : (
        <div className="runtime-guardrail-locations">
          {previews.map((preview) => (
            <article className="runtime-guardrail-location" key={preview.locationId}>
              <div className="runtime-guardrail-location-header">
                <div>
                  <span>Location</span>
                  <h3>{preview.locationName}</h3>
                </div>
                <small>
                  {countLabel(preview.retiredAnswerCount, "retired answer")} ·{" "}
                  {countLabel(preview.inactiveHandoffRuleCount, "inactive rule")}
                </small>
              </div>

              <div className="runtime-guardrail-counts" aria-label={`${preview.locationName} guardrail counts`}>
                <div className="eligible">
                  <span>Eligible answers</span>
                  <strong>{preview.eligibleAnswerTopics.length}</strong>
                </div>
                <div className="routed">
                  <span>Staff routed</span>
                  <strong>{preview.staffRoutedAnswerTopics.length}</strong>
                </div>
                <div className="blocked">
                  <span>Blocked answers</span>
                  <strong>{preview.blockedAnswerTopics.length}</strong>
                </div>
                <div className="handoff">
                  <span>Active handoffs</span>
                  <strong>{preview.activeHandoffTopics.length}</strong>
                </div>
                <div className="review">
                  <span>Review needed</span>
                  <strong>{preview.reviewTopics.length}</strong>
                </div>
              </div>

              <div className="runtime-guardrail-topic-columns">
                <div>
                  <h4>Eligible answer topics</h4>
                  <TopicList emptyLabel="No eligible topics" topics={preview.eligibleAnswerTopics} />
                </div>
                <div>
                  <h4>Staff-routed topics</h4>
                  <TopicList emptyLabel="No routed topics" topics={preview.staffRoutedAnswerTopics} />
                </div>
                <div>
                  <h4>Blocked topics</h4>
                  <TopicList emptyLabel="No blocked topics" topics={preview.blockedAnswerTopics} />
                </div>
              </div>

              <div className="runtime-guardrail-review">
                <h4>Guardrail review</h4>
                {preview.reviewTopics.length === 0 ? (
                  <span className="runtime-guardrail-empty">No topic ambiguity detected</span>
                ) : (
                  <ul className="runtime-guardrail-topic-list">
                    {preview.reviewTopics.map((topic) => (
                      <li key={topic.key}>
                        <span>{topic.topic}</span>
                        <small>
                          {countLabel(topic.answerCount, "answer")} ·{" "}
                          {countLabel(topic.activeHandoffCount, "active handoff")} ·{" "}
                          {topic.reasons.map((reason) => reviewReasonLabels[reason]).join(" · ")}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="runtime-guardrail-handoffs">
                <h4>Applied handoff topics</h4>
                {preview.activeHandoffTopics.length === 0 ? (
                  <span className="runtime-guardrail-empty">No active handoff topics</span>
                ) : (
                  <ul className="runtime-guardrail-topic-list">
                    {preview.activeHandoffTopics.map((topic) => (
                      <li key={topic.id}>
                        <span>{topic.topic}</span>
                        <small>
                          {displayLabel(topic.action)} · Priority {topic.priority} · {topic.scope === "global" ? "All locations" : "This location"}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
