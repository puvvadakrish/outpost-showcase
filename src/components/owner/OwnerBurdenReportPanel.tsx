import type { OwnerBurdenReport } from "@/domain/burden-report";
import { displayLabel } from "@/domain/formatting";

interface OwnerBurdenReportPanelProps {
  report: OwnerBurdenReport;
}

export function OwnerBurdenReportPanel({ report }: OwnerBurdenReportPanelProps) {
  return (
    <section className="panel owner-burden-report" aria-label="Local burden reduction report">
      <div className="owner-burden-hero">
        <div>
          <span className="rail-title">Burden reduction</span>
          <h2>{report.headline}</h2>
          <p>{report.subheadline}</p>
        </div>
        <div className="owner-burden-proof">
          <span>{report.localProofPercent}%</span>
          <strong>Local proof</strong>
          <div
            aria-label="Burden report local proof completion"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={report.localProofPercent}
            className="owner-burden-proof-track"
            role="progressbar"
          >
            <span aria-hidden="true" style={{ width: `${report.localProofPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="owner-burden-metrics" aria-label="Burden report metrics">
        {report.metrics.map((metric) => (
          <div className={`owner-burden-metric ${metric.id}`} key={metric.id}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="owner-burden-channel-workload" aria-label="Burden by request channel">
        <div className="owner-burden-section-copy">
          <span className="rail-title">Request workload</span>
          <strong>Current task demand by channel</strong>
        </div>
        <div className="owner-burden-channel-rows">
          {report.channelRows.map((row) => (
            <div className={`owner-burden-channel-row ${row.channel}`} key={row.channel}>
              <span>{displayLabel(row.label)}</span>
              <strong>{row.unresolvedCount}</strong>
              <small>{row.totalCount} total</small>
            </div>
          ))}
        </div>
      </div>

      <div className="owner-burden-common-requests" aria-label="Common request pressure">
        <div className="owner-burden-section-copy">
          <span className="rail-title">Request themes</span>
          <strong>Common task intent pressure</strong>
        </div>
        {report.commonRequestRows.length > 0 ? (
          <div className="owner-burden-common-request-rows">
            {report.commonRequestRows.map((row) => (
              <div className="owner-burden-common-request-row" key={row.fullLabel} title={row.fullLabel}>
                <span>{row.label}</span>
                <strong>{row.unresolvedCount}</strong>
                <small>{row.totalCount} total</small>
              </div>
            ))}
          </div>
        ) : (
          <span className="owner-burden-empty">No task intents captured yet.</span>
        )}
      </div>

      <div className="owner-burden-staff-intake" aria-label="Human intake contribution">
        <div className="owner-burden-section-copy">
          <span className="rail-title">Human intake</span>
          <strong>Submitted work by staff actor</strong>
        </div>
        {report.staffIntakeRows.length > 0 ? (
          <div className="owner-burden-staff-intake-rows">
            {report.staffIntakeRows.map((row) => (
              <div className="owner-burden-staff-intake-row" key={row.actorUserId ?? "unknown"}>
                <span>{row.label}</span>
                <strong>{row.unresolvedCount} open</strong>
                <small>{row.resolvedCount} resolved · {row.totalCount} submitted</small>
              </div>
            ))}
          </div>
        ) : (
          <span className="owner-burden-empty">No human intake events captured yet.</span>
        )}
      </div>

      <div className="owner-burden-pressure" aria-label="Location workload pressure">
        <div className="owner-burden-section-copy">
          <span className="rail-title">Location workload</span>
          <strong>Current task demand by location</strong>
        </div>
        <div className="owner-burden-pressure-rows">
          {report.locationRows.map((row) => (
            <div className="owner-burden-pressure-row" key={row.locationId}>
              <span>{row.label}</span>
              <strong>{row.unresolvedCount} open</strong>
              <small>{row.totalCount} total</small>
            </div>
          ))}
        </div>
      </div>

      <div className="owner-burden-pressure" aria-label="Workflow-stage pressure">
        <div className="owner-burden-section-copy">
          <span className="rail-title">Workflow pressure</span>
          <strong>Current task demand by stage</strong>
        </div>
        <div className="owner-burden-pressure-rows">
          {report.workflowRows.map((row) => (
            <div className={`owner-burden-pressure-row ${row.stage}`} key={row.stage}>
              <span>{row.label}</span>
              <strong>{row.unresolvedCount} open</strong>
              <small>{row.totalCount} total · {row.detail}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="owner-burden-pressure" aria-label="Task age pressure">
        <div className="owner-burden-section-copy">
          <span className="rail-title">Waiting pressure</span>
          <strong>Current task demand by age</strong>
        </div>
        <div className="owner-burden-pressure-rows owner-burden-age-rows">
          {report.ageRows.map((row) => (
            <div className={`owner-burden-pressure-row ${row.ageBucket}`} key={row.ageBucket}>
              <span>{row.label}</span>
              <strong>{row.unresolvedCount} open</strong>
              <small>{row.totalCount} total · {row.detail}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="owner-burden-rows" aria-label="Burden report status rows">
        {report.rows.map((row) => (
          <div className={`owner-burden-row ${row.state}`} key={row.label}>
            <span className="owner-burden-state">{displayLabel(row.state)}</span>
            <div>
              <strong>{row.label}</strong>
              <p>{row.detail}</p>
            </div>
            <span className="owner-burden-value">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="owner-burden-gates">
        {report.blockedGates.map((gate) => (
          <span key={gate}>{gate}</span>
        ))}
      </div>
    </section>
  );
}
