import { AppShell } from "@/components/AppShell";
import type { OwnerSetupActionState } from "@/application/owner-setup/action-result";
import { betaOwnerPreflight } from "@/domain/beta-owner-preflight";
import { OwnerBetaPreflightPanel } from "./OwnerBetaPreflightPanel";
import { OwnerOnboardingBootstrapForm } from "./OwnerOnboardingBootstrapForm";

interface OwnerOnboardingBootstrapProps {
  action: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  ownerEmail: string;
}

export function OwnerOnboardingBootstrap({ action, ownerEmail }: OwnerOnboardingBootstrapProps) {
  const preflight = betaOwnerPreflight();

  return (
    <AppShell
      activeNav="owner"
      milestoneLabel="Seedless setup"
      metrics={[
        { label: "Locations", value: 0 },
        { label: "Approved", value: 0 },
        { attention: true, label: "Review queue", value: 0 }
      ]}
      tenantName="New Outpost workspace"
      subtitle="Owner onboarding"
    >
      <section className="page-header owner-page-header">
        <div>
          <h1>Create your owner workspace</h1>
          <p>
            Start with a gym, first location, owner membership, task queue, and
            safe default handoff rules. Phone and email providers stay off.
          </p>
        </div>
      </section>

      <OwnerBetaPreflightPanel preflight={preflight} />

      <section className="panel setup-bootstrap-panel">
        <div className="panel-header">
          <div>
            <h2>Seedless setup</h2>
            <p>
              This creates tenant-owned setup rows through Neon Auth, RLS,
              and one audited database transaction.
            </p>
          </div>
          <span className="channel-pill">Providers off</span>
        </div>
        <div className="setup-bootstrap-body">
          <OwnerOnboardingBootstrapForm action={action} ownerEmail={ownerEmail} />
          <aside className="setup-bootstrap-path" aria-label="First-run local beta path">
            <div>
              <span className="rail-title">Creates</span>
              <strong>Tenant, owner membership, first location, task queue, safe handoff defaults.</strong>
            </div>
            <ol>
              <li>
                <span>1</span>
                <strong>Stage source facts</strong>
              </li>
              <li>
                <span>2</span>
                <strong>Approve safe answers</strong>
              </li>
              <li>
                <span>3</span>
                <strong>Create staff-task proof</strong>
              </li>
              <li>
                <span>4</span>
                <strong>Keep live gates closed</strong>
              </li>
            </ol>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
