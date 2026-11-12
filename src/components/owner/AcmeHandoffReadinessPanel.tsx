import type { HandoffReadinessLedger } from "@/domain/acme-handoff-readiness";

interface AcmeHandoffReadinessPanelProps {
  ledger: HandoffReadinessLedger;
}

export function AcmeHandoffReadinessPanel({ ledger }: AcmeHandoffReadinessPanelProps) {
  return (
    <section className="panel acme-handoff-ledger" aria-label="Acme Fitness handoff readiness">
      <div className="acme-handoff-summary">
        <div>
          <span className="rail-title">Customer-zero gate</span>
          <h2>{ledger.heading}</h2>
          <p>{ledger.summary}</p>
        </div>
        <span className="channel-pill quiet">{ledger.stateLabel}</span>
      </div>

      <div className="acme-handoff-gates">
        {ledger.gates.map((gate, index) => (
          <div className={`acme-handoff-gate ${gate.state}`} key={gate.label}>
            <span>{index + 1}</span>
            <div>
              <span className="acme-handoff-state">{gate.state}</span>
              <strong>{gate.label}</strong>
              <p>{gate.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="acme-handoff-next">
        <strong>Next operator action</strong>
        <p>{ledger.nextAction}</p>
      </div>

      <details className="acme-handoff-commands" aria-label="Acme Fitness handoff commands">
        <summary>
          <span>Proof commands</span>
          <strong>Show commands</strong>
        </summary>
        <div className="acme-handoff-command-list">
          {ledger.commands.map((item) => (
            <div className="acme-handoff-command-row" key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              <code>{item.command}</code>
            </div>
          ))}
        </div>
      </details>

      <div className="acme-handoff-non-goals">
        {ledger.nonGoals.map((nonGoal) => (
          <span key={nonGoal}>{nonGoal}</span>
        ))}
      </div>
    </section>
  );
}
