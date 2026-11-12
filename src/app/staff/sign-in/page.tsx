import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { isNeonConfigured } from "@/server/neon/env";
import { createOutpostServerNeonClient } from "@/server/neon/server-client";
import { resolveMembershipSession } from "@/server/session-context";
import { redirect } from "next/navigation";
import { StaffSignInForm } from "./StaffSignInForm";

export const dynamic = "force-dynamic";

export default async function StaffSignInPage() {
  const neonConfigured = isNeonConfigured();

  if (!neonConfigured && process.env.NODE_ENV === "production") {
    return (
      <AppShell
        activeNav="tasks"
        milestoneLabel="Neon beta proof"
        metrics={[
          { label: "Auth", value: "Config", attention: true },
          { label: "Claim", value: "Blocked" },
          { label: "Live providers", value: "Off" }
        ]}
        tenantName="Outpost"
        subtitle="Staff sign-in"
      >
        <section className="page-header staff-page-header">
          <div>
            <h1>Staff sign-in unavailable</h1>
            <p>Neon Auth is not configured for this environment, so staff roster claims are blocked.</p>
          </div>
        </section>

        <section className="panel auth-panel staff-auth-panel">
          <div className="panel-header">
            <div>
              <h2>Backend configuration required</h2>
              <p>Set the Neon Auth and Data API env values before loading staff beta accounts.</p>
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
      sessionResolution.session.account.role === "staff"
    ) {
      redirect("/staff/tasks");
    }
  }

  return (
    <AppShell
      activeNav="tasks"
      metrics={[
        { label: "Auth", value: "Claim" },
        { label: "Invite", value: "Manual" },
        { label: "Live providers", value: "Off", attention: true }
      ]}
      tenantName="Acme Fitness"
      subtitle="Staff sign-in"
    >
      <section className="page-header staff-page-header">
        <div>
          <h1>Staff sign-in</h1>
          <p>Use the same email the owner added to staff access, then claim the roster row.</p>
        </div>
        <div className="page-actions">
          <Link className="button" href="/staff/tasks">
            Front-desk workboard
          </Link>
        </div>
      </section>

      <section className="panel auth-panel staff-auth-panel">
        <div className="panel-header">
          <div>
            <h2>Claim staff access</h2>
            <p>
              This local beta path links your authenticated account to an existing active roster row. The
              result state below tells you what to do next if the claim does not complete.
            </p>
          </div>
          <span className="channel-pill">No live providers</span>
        </div>
        <div className="auth-proof-strip" aria-label="Staff claim steps">
          <span>1. Owner adds staff access</span>
          <span>2. Staff uses matching email</span>
          <span>3. Outpost links the roster row</span>
        </div>
        <StaffSignInForm />
      </section>
    </AppShell>
  );
}
