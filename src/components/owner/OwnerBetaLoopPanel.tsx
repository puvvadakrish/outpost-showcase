import Link from "next/link";
import type { PersistenceMode } from "@/application/owner-setup/action-result";
import { betaWalkthroughSteps, type BetaLoopSummary } from "@/domain/beta-loop";
import { displayLabel } from "@/domain/formatting";

interface OwnerBetaLoopPanelProps {
  persistenceMode: PersistenceMode;
  summary: BetaLoopSummary;
}

export function OwnerBetaLoopPanel({ persistenceMode, summary }: OwnerBetaLoopPanelProps) {
  const isBackendMode = persistenceMode === "backend";
  const walkthroughSteps = betaWalkthroughSteps(summary);

  return (
    <section className="panel beta-loop-panel" aria-label="Local beta loop">
      <div className="panel-header beta-loop-header">
        <div>
          <span className="rail-title">Proof path</span>
          <h2>{summary.readyForLocalBeta ? "Ready to exercise locally" : "Next proof step"}</h2>
          <p>
            {summary.currentFocus.detail} Live phone, email, hosted preview, and billing behavior
            remain blocked until hosted proof and provider setup are complete.
          </p>
        </div>
        <span className={`channel-pill ${isBackendMode ? "" : "quiet"}`}>
          {isBackendMode ? "Backend-backed" : "Local proof mode"}
        </span>
      </div>

      <div className="beta-loop-current">
        <div>
          <span className="rail-title">Current checkpoint</span>
          <strong>{summary.currentFocus.label}</strong>
          <p>{summary.currentFocus.detail}</p>
        </div>
        <div className="beta-loop-progress">
          <span>{summary.completedSteps} of {summary.totalLocalProofSteps}</span>
          <div
            aria-label="Local beta proof progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={summary.localProofPercent}
            className="beta-loop-progress-track"
            role="progressbar"
          >
            <span aria-hidden="true" style={{ width: `${summary.localProofPercent}%` }} />
          </div>
          <Link className="button button-primary" href={summary.primaryActionHref}>
            {summary.primaryActionLabel}
          </Link>
        </div>
      </div>

      <div className="beta-walkthrough-route" aria-label="Local beta proof route">
        {walkthroughSteps.map((step, index) => (
          <Link className={`beta-walkthrough-step ${step.state}`} href={step.href} key={step.label}>
            <span className="beta-loop-index">{index + 1}</span>
            <span className="beta-walkthrough-copy">
              <strong>{step.label}</strong>
              <span>{step.detail}</span>
            </span>
            <span className={`beta-walkthrough-state beta-loop-state-${step.state}`}>
              {displayLabel(step.state)}
            </span>
          </Link>
        ))}
      </div>

      <div className="beta-loop-footer">
        <div>
          <strong>{summary.blockedReasons.length} readiness gate{summary.blockedReasons.length === 1 ? "" : "s"}</strong>
        </div>
        <div className="beta-loop-blockers">
          {summary.blockedReasons.slice(0, 3).map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
