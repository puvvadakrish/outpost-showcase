import Link from "next/link";
import { AppShell, type AppShellAccount } from "@/components/AppShell";
import type { MembershipRole } from "@/domain/models";

interface WrongAccountStateProps {
  account?: AppShellAccount;
  activeNav: string;
  alternateHref?: string;
  alternateLabel?: string;
  expectedRole: Extract<MembershipRole, "owner" | "staff">;
  milestoneLabel?: string;
  signedInEmail?: string;
  signOutAction: () => Promise<void>;
  signOutLabel: string;
  subtitle: string;
  tenantName: string;
  variant?: "wrong_account" | "unavailable";
}

function roleLabel(role: MembershipRole) {
  if (role === "owner") {
    return "owner";
  }

  if (role === "staff") {
    return "staff";
  }

  return "admin";
}

function currentAccountLabel(account: AppShellAccount | undefined, signedInEmail: string | undefined) {
  if (account) {
    return `${account.name} (${account.email})`;
  }

  return signedInEmail ?? "This authenticated account";
}

export function WrongAccountState({
  account,
  activeNav,
  alternateHref,
  alternateLabel,
  expectedRole,
  milestoneLabel,
  signedInEmail,
  signOutAction,
  signOutLabel,
  subtitle,
  tenantName,
  variant = "wrong_account"
}: WrongAccountStateProps) {
  const expectedRoleLabel = roleLabel(expectedRole);
  const currentRoleLabel = account?.role ? roleLabel(account.role) : null;
  const isUnavailable = variant === "unavailable";
  const title = isUnavailable
    ? "Workspace temporarily unavailable"
    : `Use the ${expectedRoleLabel} account for this workspace`;
  const intro = isUnavailable
    ? "Outpost could not verify and load this workspace right now. No live providers were enabled and no workspace data was shown."
    : `${currentAccountLabel(account, signedInEmail)} is signed in${currentRoleLabel ? ` as ${currentRoleLabel}` : ""}. This route stays locked until the matching role is active.`;
  const summary = isUnavailable
    ? "The backend configuration or read needed for this workspace failed. Try again after the Neon backend is configured and healthy."
    : "Outpost keeps owner setup and staff task work separate during beta so a signed-in account cannot accidentally operate in the wrong workspace.";
  const metrics = isUnavailable
    ? [
        { attention: true, label: "Access", value: "Retry" },
        { label: "Session", value: "Signed in" },
        { label: "Live", value: "Off" }
      ]
    : [
        { attention: true, label: "Access", value: "Role" },
        { label: "Session", value: "Signed in" },
        { label: "Live", value: "Off" }
      ];

  return (
    <AppShell
      account={account}
      activeNav={activeNav}
      metrics={metrics}
      milestoneLabel={milestoneLabel}
      tenantName={tenantName}
      subtitle={subtitle}
    >
      <section className="page-header access-state-header">
        <div>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
      </section>

      <section className="panel access-state-panel" aria-label="Access state">
        <div className="access-state-summary">
          <span className="rail-title">Account check</span>
          <h2>{isUnavailable ? "Backend read unavailable" : "Route protected by role"}</h2>
          <p>{summary}</p>
        </div>
        <dl className="access-state-details">
          <div>
            <dt>Signed in</dt>
            <dd>{isUnavailable && !account && !signedInEmail ? "Not verified" : currentAccountLabel(account, signedInEmail)}</dd>
          </div>
          <div>
            <dt>{isUnavailable ? "Status" : "Required role"}</dt>
            <dd>{isUnavailable ? "Unavailable" : expectedRoleLabel}</dd>
          </div>
          <div>
            <dt>Live providers</dt>
            <dd>Off</dd>
          </div>
        </dl>
        <div className="access-state-actions">
          <form action={signOutAction}>
            <button className="button button-primary" type="submit">
              {signOutLabel}
            </button>
          </form>
          {alternateHref && alternateLabel ? (
            <Link className="button" href={alternateHref}>
              {alternateLabel}
            </Link>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
