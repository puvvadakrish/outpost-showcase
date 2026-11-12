import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { OwnerBetaPreflightPanel } from "@/components/owner/OwnerBetaPreflightPanel";
import { betaOwnerPreflight } from "@/domain/beta-owner-preflight";
import { isNeonConfigured } from "@/server/neon/env";
import { createOutpostServerNeonClient } from "@/server/neon/server-client";
import { resolveMembershipSession } from "@/server/session-context";
import { redirect } from "next/navigation";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

export default async function OwnerSignInPage() {
  const neonConfigured = isNeonConfigured();
  const preflight = betaOwnerPreflight();

  if (!neonConfigured && process.env.NODE_ENV === "production") {
    return (
      <AppShell
        activeNav="owner"
        milestoneLabel="Neon beta proof"
        metrics={[
          { label: "Auth", value: "Config", attention: true },
          { label: "Workspace", value: "Blocked" },
          { label: "Live providers", value: "Off" }
        ]}
        tenantName="Outpost"
        subtitle="Owner sign-in"
      >
        <section className="page-header owner-page-header">
          <div>
            <h1>Owner sign-in unavailable</h1>
            <p>Neon Auth is not configured for this environment, so owner sign-in is blocked.</p>
          </div>
        </section>

        <section className="panel auth-panel">
          <div className="panel-header">
            <div>
              <h2>Backend configuration required</h2>
              <p>Set the Neon Auth and Data API env values before loading owner beta accounts.</p>
            </div>
            <span className="channel-pill">No live providers</span>
          </div>
        </section>
      </AppShell>
    );
  }

  if (neonConfigured) {
    const neon = await createOutpostServerNeonClient();
    const sessionResolution = await resolveMembershipSession(neon);

    if (
      sessionResolution.state === "resolved" &&
      sessionResolution.session.account.role === "owner"
    ) {
      redirect("/owner");
    }
  }

  return (
    <AppShell
      activeNav="owner"
      milestoneLabel="Operator-assisted beta"
      metrics={[
        { label: "Access", value: "Request" },
        { label: "Live providers", value: "Off" },
        { label: "Self-serve", value: "Blocked", attention: true }
      ]}
      tenantName="Outpost"
      subtitle="Owner sign-in"
    >
      <section className="page-header owner-page-header">
        <div>
          <h1>Owner sign-in</h1>
          <p>Owners with operator-provisioned beta access can sign in. New gyms can request access for manual review.</p>
        </div>
        <div className="page-actions">
          <Link className="button" href="/owner">
            Owner workspace
          </Link>
        </div>
      </section>

      <section className="panel auth-panel">
        <div className="panel-header">
          <div>
            <h2>Operator-assisted owner access</h2>
            <p>Sign in if an operator already provisioned your owner account, or request beta access for manual review.</p>
          </div>
          <span className="channel-pill">No live providers</span>
        </div>
        <SignInForm />
      </section>

      <OwnerBetaPreflightPanel preflight={preflight} />
    </AppShell>
  );
}
