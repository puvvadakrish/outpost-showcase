import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getCustomerZeroTenant } from "@/domain/app-data";

export default function HomePage() {
  const { tenant, answerBankEntries, unresolvedTasks, tasks } = getCustomerZeroTenant();
  const needsHuman = tasks.filter((task) => task.status === "needs_human").length;
  const approvedAnswers = answerBankEntries.filter(
    (entry) => entry.approvalStatus === "approved"
  ).length;

  return (
    <AppShell
      activeNav="overview"
      metrics={[
        { label: "Unresolved", value: unresolvedTasks.length },
        { attention: true, label: "Needs human", value: needsHuman },
        { label: "Approved", value: approvedAnswers }
      ]}
      tenantName={tenant.name}
      subtitle="Front Desk Command"
    >
      <section className="page-header">
        <div>
          <h1>Take repetitive front-desk work off your staff.</h1>
          <p>
            Neutral customer-zero overview for the SaaS foundation, owner setup,
            answer boundaries, handoff rules, and staff task visibility.
          </p>
        </div>
      </section>

      <div className="grid grid-3">
        <Link className="panel metric surface-link" href="/staff/tasks">
          <span>Unresolved staff tasks</span>
          <strong>{unresolvedTasks.length}</strong>
          <small>Today's queue starts here.</small>
        </Link>
        <Link className="panel metric surface-link" href="/owner">
          <span>Needs human</span>
          <strong>{needsHuman}</strong>
          <small>Routed instead of answered live.</small>
        </Link>
        <Link className="panel metric surface-link" href="/owner">
          <span>Approved answers</span>
          <strong>{approvedAnswers}</strong>
          <small>Owner approval required before live use.</small>
        </Link>
      </div>

      <section className="panel section-gap">
        <div className="panel-header">
          <div>
            <h2>Current operating surfaces</h2>
            <p>Phone and email are v1 channels; live provider wiring remains out of scope.</p>
          </div>
        </div>
        <ul className="checklist">
          <li>
            <span className="check-dot done" />
            Tenant, users, roles, plans, and entitlements are represented.
          </li>
          <li>
            <span className="check-dot done" />
            Location setup carries routing and timezone shape.
          </li>
          <li>
            <span className="check-dot done" />
            Staff work starts from the front-desk workboard.
          </li>
          <li>
            <span className="check-dot" />
            Live calls, email automation, billing, and provider config are not connected.
          </li>
        </ul>
      </section>
    </AppShell>
  );
}
