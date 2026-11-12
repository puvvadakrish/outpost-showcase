import type { BetaRehearsalChecklist } from "@/domain/beta-loop";

interface OwnerBetaRehearsalPanelProps {
  checklist: BetaRehearsalChecklist;
}

export function OwnerBetaRehearsalPanel({ checklist }: OwnerBetaRehearsalPanelProps) {
  return (
    <section className="panel beta-rehearsal-panel" aria-label="Local beta readiness">
      <div className="beta-rehearsal-summary">
        <div>
          <span className="rail-title">Operator runbook</span>
          <h2>{checklist.heading}</h2>
          <p>{checklist.nextAction}</p>
        </div>
        <div className="beta-rehearsal-actions">
          <span className="runbook-path">
            <span>Runbook</span>
            <code>{checklist.docsHref.replace(/^\//u, "")}</code>
          </span>
          <span className="channel-pill quiet">{checklist.stateLabel}</span>
        </div>
      </div>

      <div className="beta-runbook-layout">
        <div className="beta-runbook-column">
          <span className="rail-title">Operator sequence</span>
          {checklist.operatorSteps.map((step, index) => (
            <div className="beta-runbook-step" key={step.label}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="beta-runbook-column beta-readiness-column">
          <span className="rail-title">Beta readiness checklist</span>
          {checklist.readinessChecks.map((check) => (
            <div className={`beta-readiness-check ${check.done ? "done" : "blocked"}`} key={check.label}>
              <span aria-hidden="true" />
              <div>
                <span className="beta-readiness-status">{check.done ? "Met" : "Blocked"}</span>
                <strong>{check.label}</strong>
                <p>{check.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <details className="beta-rehearsal-command" aria-label="Local beta rehearsal commands">
        <summary>
          <span>Neon branch commands</span>
          <strong>Show commands</strong>
        </summary>
        <div className="beta-rehearsal-command-list">
          {checklist.commands.map((item) => (
            <div className="beta-rehearsal-command-row" key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              <code>{item.command}</code>
            </div>
          ))}
        </div>
      </details>

      <div className="beta-rehearsal-steps" aria-label="Owner rehearsal checkpoints">
        {checklist.steps.map((step, index) => (
          <div className="beta-rehearsal-step" key={step.label}>
            <span>{index + 1}</span>
            <div>
              <strong>{step.label}</strong>
              <p>{step.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="beta-rehearsal-blockers">
        {checklist.blockers.map((blocker) => (
          <span key={blocker}>{blocker}</span>
        ))}
      </div>
    </section>
  );
}
