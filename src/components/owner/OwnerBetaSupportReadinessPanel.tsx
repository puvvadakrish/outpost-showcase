import type { BetaSupportReadinessLedger } from "@/domain/beta-support-readiness";
import { displayLabel } from "@/domain/formatting";

interface OwnerBetaSupportReadinessPanelProps {
  ledger: BetaSupportReadinessLedger;
}

export function OwnerBetaSupportReadinessPanel({ ledger }: OwnerBetaSupportReadinessPanelProps) {
  return (
    <section className="panel owner-beta-support-ledger" aria-label="Beta support handoff readiness">
      <div className="owner-beta-support-summary">
        <div>
          <span className="rail-title">Beta support</span>
          <h2>{ledger.heading}</h2>
          <p>{ledger.summary}</p>
        </div>
        <span className="channel-pill quiet">{ledger.stateLabel}</span>
      </div>

      <div className="owner-beta-support-gates">
        {ledger.gates.map((gate, index) => (
          <div className={`owner-beta-support-gate ${gate.state}`} key={gate.label}>
            <span>{index + 1}</span>
            <div>
              <span className={`owner-beta-support-state state-${gate.state}`}>
                {displayLabel(gate.state)}
              </span>
              <strong>{gate.label}</strong>
              <p>{gate.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="owner-beta-support-next">
        <strong>Next operator action</strong>
        <p>{ledger.nextAction}</p>
      </div>

      <div className="owner-beta-support-guide" aria-label="Beta owner handoff guide">
        <div className="owner-beta-support-guide-heading">
          <strong>Owner handoff guide</strong>
          <p>What the beta owner should expect before completion is recorded.</p>
        </div>
        <div className="owner-beta-support-guide-list">
          {ledger.handoffGuide.map((step, index) => (
            <div className="owner-beta-support-guide-row" key={step.label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <span className={`owner-beta-support-state state-${step.state}`}>
                  {displayLabel(step.state)}
                </span>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <details className="owner-beta-support-commands" aria-label="Beta support handoff commands">
        <summary>
          <span>Support commands</span>
          <strong>Show commands</strong>
        </summary>
        <div className="owner-beta-support-command-list">
          {ledger.commands.map((item) => (
            <div className="owner-beta-support-command-row" key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              <code>{item.command}</code>
            </div>
          ))}
        </div>
      </details>

      <div className="owner-beta-support-non-goals">
        {ledger.nonGoals.map((nonGoal) => (
          <span key={nonGoal}>{nonGoal}</span>
        ))}
      </div>
    </section>
  );
}
