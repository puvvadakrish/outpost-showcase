import Link from "next/link";
import type { OwnerSetupStep } from "@/domain/answer-bank";
import { displayLabel } from "@/domain/formatting";
import type { HandoffRule } from "@/domain/handoff-rules";
import type { NotificationDestination } from "@/domain/notifications";
import type { SourceDocument } from "@/domain/sources";
import type { AnswerApprovalStatus } from "@/domain/models";

interface ApprovalSummary {
  status: AnswerApprovalStatus;
  count: number;
}

interface OwnerSetupRailProps {
  approvalSummaries: ApprovalSummary[];
  handoffRules: HandoffRule[];
  notificationDestinations: NotificationDestination[];
  readyForLiveAnswers: boolean;
  setupSteps: OwnerSetupStep[];
  sourceDocuments: SourceDocument[];
}

export function OwnerSetupRail({
  approvalSummaries,
  handoffRules,
  notificationDestinations,
  readyForLiveAnswers,
  setupSteps,
  sourceDocuments
}: OwnerSetupRailProps) {
  return (
    <aside className="rail" aria-label="Owner setup context">
      <section className="rail-section">
        <div className="rail-title">Setup checklist</div>
        <ol className="setup-list">
          {setupSteps.map((step) => (
            <li className={`setup-step ${step.state}`} key={step.id}>
              <span className="check-dot" aria-hidden="true" />
              <div>
                <Link href={step.href}>{step.label}</Link>
                <span>{step.detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="rail-section">
        <div className="rail-title">Approval mix</div>
        {approvalSummaries
          .filter((summary) => summary.count > 0)
          .map((summary) => (
            <div className="readiness-row" key={summary.status}>
              <span>{displayLabel(summary.status)}</span>
              <strong>{summary.count}</strong>
            </div>
          ))}
      </section>
      <section className="rail-section">
        <div className="rail-title">Import review</div>
        {sourceDocuments.map((source) => (
          <div className="quiet-strip source-strip" key={source.id}>
            <div>
              <strong>{source.label}</strong>
              <span className={`status-pill source-status-${source.status}`}>
                {displayLabel(source.status)}
              </span>
            </div>
            <span className="muted">
              {source.factsFound} facts, {source.conflictsFound} conflicts
              {source.url ? ` from ${source.url}` : ""}.
            </span>
          </div>
        ))}
      </section>
      <section className="rail-section">
        <div className="rail-title">Readiness</div>
        <div className="quiet-strip">
          <strong>{readyForLiveAnswers ? "Ready for future live answers" : "Owner review required"}</strong>
          <span className="muted">
            Draft or conflicting facts create review work before phone and email channels go live.
          </span>
        </div>
      </section>
      <section className="rail-section">
        <div className="rail-title">Human handoff rules</div>
        {handoffRules.map((rule) => (
          <div className="quiet-strip" key={rule.id}>
            <strong>{displayLabel(rule.topic)}</strong>
            <span className="muted">
              {displayLabel(rule.trigger)}: {displayLabel(rule.action)} to {rule.destination} during{" "}
              {rule.activeWindow}.
            </span>
          </div>
        ))}
      </section>
      <section className="rail-section">
        <div className="rail-title">Notification destinations</div>
        {notificationDestinations.map((destination) => (
          <div className="quiet-strip" key={destination.id}>
            <strong>{destination.label}</strong>
            <span className="muted">
              {displayLabel(destination.type)}: {destination.destination}
            </span>
            <span className={`status-pill destination-status-${destination.status}`}>
              {displayLabel(destination.status)}
            </span>
          </div>
        ))}
      </section>
    </aside>
  );
}
