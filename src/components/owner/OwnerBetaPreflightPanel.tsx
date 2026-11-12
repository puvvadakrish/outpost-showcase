import type { BetaOwnerPreflight } from "@/domain/beta-owner-preflight";
import { displayLabel } from "@/domain/formatting";

interface OwnerBetaPreflightPanelProps {
  preflight: BetaOwnerPreflight;
}

export function OwnerBetaPreflightPanel({ preflight }: OwnerBetaPreflightPanelProps) {
  return (
    <section className="panel owner-beta-preflight" aria-label="Beta owner access preflight">
      <div className="owner-beta-preflight-summary">
        <div>
          <span className="rail-title">Beta access</span>
          <h2>{preflight.heading}</h2>
          <p>{preflight.summary}</p>
        </div>
        <span className="channel-pill quiet">{preflight.stateLabel}</span>
      </div>

      <div className="owner-beta-preflight-steps">
        {preflight.steps.map((step, index) => (
          <div className={`owner-beta-preflight-step ${step.state}`} key={step.label}>
            <span>{index + 1}</span>
            <div>
              <span className={`owner-beta-preflight-state state-${step.state}`}>
                {displayLabel(step.state)}
              </span>
              <strong>{step.label}</strong>
              <p>{step.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="owner-beta-preflight-next">
        <strong>Next owner action</strong>
        <p>{preflight.nextAction}</p>
      </div>

      <div className="owner-beta-preflight-blockers">
        {preflight.blockedGates.map((gate) => (
          <span key={gate}>{gate}</span>
        ))}
      </div>
    </section>
  );
}
