import { AppShell } from "@/components/AppShell";
import { WrongAccountState } from "@/components/auth/WrongAccountState";
import { LocationProfileEditor } from "@/components/owner/LocationProfileEditor";
import { LocationApplicationService } from "@/application/locations/service";
import type { PersistenceMode } from "@/application/owner-setup/action-result";
import { signOutOwnerAction } from "@/app/auth/actions";
import { getCustomerZeroTenant } from "@/domain/app-data";
import { displayLabel } from "@/domain/formatting";
import { NeonLocationRepository } from "@/infrastructure/neon/location-repository";
import { NeonOwnerContextRepository } from "@/infrastructure/neon/owner-context-repository";
import { isNeonConfigured } from "@/server/neon/env";
import { createOutpostServerNeonClient } from "@/server/neon/server-client";
import { resolveMembershipSession } from "@/server/session-context";
import { redirect } from "next/navigation";
import { createLocationDraftAction, updateLocationProfileAction } from "../actions";
import type { SessionAccountContext } from "@/server/session-context";
import { reportServerFailure } from "@/server/observability";

export const dynamic = "force-dynamic";

export default async function OwnerLocationsPage() {
  let { tenant, locations, plan } = getCustomerZeroTenant();
  let backendLocations = locations;
  let account: SessionAccountContext | null = null;
  let ownerAccessDenied = false;
  let ownerBackendUnavailable = false;
  let signedInEmail: string | undefined;
  let persistenceMode: PersistenceMode = "setup_required";
  let persistenceMessage =
    "Neon env values are not configured, so backend location edits are disabled.";

  const neonConfigured = isNeonConfigured();

  if (!neonConfigured && process.env.NODE_ENV === "production") {
    return (
      <WrongAccountState
        activeNav="locations"
        expectedRole="owner"
        milestoneLabel="Neon beta proof"
        signOutAction={signOutOwnerAction}
        signOutLabel="Clear session"
        subtitle="Location setup"
        tenantName="Outpost"
        variant="unavailable"
      />
    );
  }

  if (neonConfigured) {
    const neon = await createOutpostServerNeonClient();
    const {
      data: { user }
    } = await neon.auth.getUser();

    if (!user) {
      redirect("/owner/sign-in");
    } else {
      signedInEmail = user.email ?? undefined;
      try {
        const sessionResolution = await resolveMembershipSession(neon);

        if (sessionResolution.state === "no_active_membership") {
          return (
            <WrongAccountState
              activeNav="locations"
              alternateHref="/owner"
              alternateLabel="Go to owner setup"
              expectedRole="owner"
              signedInEmail={signedInEmail}
              signOutAction={signOutOwnerAction}
              signOutLabel="Sign out"
              subtitle="Location setup"
              tenantName="Outpost"
            />
          );
        } else if (sessionResolution.state !== "resolved") {
          ownerAccessDenied = true;
        } else {
          tenant = sessionResolution.session.tenant;
          account = sessionResolution.session.account;
          if (account?.role === "owner") {
            const locationService = new LocationApplicationService(new NeonLocationRepository(neon));
            [backendLocations, plan] = await Promise.all([
              locationService.loadOwnerLocations(tenant.id),
              new NeonOwnerContextRepository(neon).loadPlan(tenant.planId)
            ]);

            if (backendLocations.length === 0) {
              persistenceMode = "tenant_access_required";
              persistenceMessage = "This signed-in user does not have backend location rows yet.";
            } else {
              persistenceMode = "backend";
              persistenceMessage = "Backend location rows loaded through Neon Auth and RLS.";
            }
          } else {
            ownerAccessDenied = true;
          }
        }
      } catch (error) {
        reportServerFailure("owner.locations.load", error);
        ownerBackendUnavailable = true;
        persistenceMode = "backend_unavailable";
        persistenceMessage = "Neon is configured, but owner location rows could not be loaded.";
      }
    }
  }

  if (ownerBackendUnavailable) {
    return (
      <WrongAccountState
        account={account ?? undefined}
        activeNav="locations"
        expectedRole="owner"
        signedInEmail={signedInEmail}
        signOutAction={signOutOwnerAction}
        signOutLabel="Sign out"
        subtitle="Location setup"
        tenantName={tenant.name}
        variant="unavailable"
      />
    );
  }

  if (ownerAccessDenied) {
    return (
      <WrongAccountState
        account={account ?? undefined}
        activeNav="locations"
        alternateHref={account?.role === "staff" ? "/staff/tasks" : undefined}
        alternateLabel={account?.role === "staff" ? "Go to staff workboard" : undefined}
        expectedRole="owner"
        signedInEmail={signedInEmail}
        signOutAction={signOutOwnerAction}
        signOutLabel="Sign out for owner access"
        subtitle="Location setup"
        tenantName={tenant.name}
      />
    );
  }

  const draftLocations = backendLocations.filter((location) => location.status === "draft").length;

  return (
    <AppShell
      account={account ? { ...account, signOutAction: signOutOwnerAction } : undefined}
      activeNav="locations"
      metrics={[
        { label: "Locations", value: backendLocations.length },
        { label: "Ready", value: backendLocations.length - draftLocations },
        { attention: true, label: "Draft", value: draftLocations }
      ]}
      tenantName={tenant.name}
      subtitle="Location setup"
    >
      <section className="page-header">
        <div>
          <h1>Locations</h1>
          <p>
            Location records hold routing, public contact, and timezone context
            needed before phone or email channels are connected.
          </p>
        </div>
        <div className="page-actions">
          <span className="button">Setup mode</span>
        </div>
      </section>

      <div className="inline-note">
        {persistenceMessage}
      </div>

      <div className="location-grid">
        <section className="panel table-wrap">
          <div className="panel-header">
            <div>
              <h2>Gym locations</h2>
              <p>Medium-density setup data for repeatable SaaS onboarding.</p>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Public phone</th>
                <th>Routing phone</th>
                <th>Timezone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {backendLocations.map((location) => (
                <tr key={location.id}>
                  <td>
                    <strong>{location.name}</strong>
                  </td>
                  <td>{location.address}</td>
                  <td>{location.publicPhone ?? "Not set"}</td>
                  <td>{location.routingPhone ?? "Not set"}</td>
                  <td className="mono">{location.timezone}</td>
                  <td>
                    <span className="status-pill approval-draft">{displayLabel(location.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="location-card-list" aria-label="Gym locations">
            {backendLocations.map((location) => (
              <article className="location-card" key={location.id}>
                <div className="location-card-header">
                  <div>
                    <span className="rail-title">Location</span>
                    <strong>{location.name}</strong>
                  </div>
                  <span className="status-pill approval-draft">{displayLabel(location.status)}</span>
                </div>
                <dl className="location-card-details">
                  <div>
                    <dt>Address</dt>
                    <dd>{location.address}</dd>
                  </div>
                  <div>
                    <dt>Public phone</dt>
                    <dd>{location.publicPhone ?? "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Routing phone</dt>
                    <dd>{location.routingPhone ?? "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Timezone</dt>
                    <dd className="mono">{location.timezone}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <aside className="location-callout">
          <span>Location readiness</span>
          <strong>Routing context before provider configuration.</strong>
          <p>
            This screen proves the SaaS foundation without implying live calls,
            email automation, Club OS, POS, or member-account writes.
          </p>
          <div className="readiness-row">
            <span>Phone channel</span>
            <strong>Stub</strong>
          </div>
          <div className="readiness-row">
            <span>Email channel</span>
            <strong>Stub</strong>
          </div>
        </aside>
      </div>

      <div className="section-gap">
        <LocationProfileEditor
          includedLocations={plan?.includedLocations ?? backendLocations.length}
          locations={backendLocations}
          onCreateLocationDraft={createLocationDraftAction}
          onUpdateLocationProfile={updateLocationProfileAction}
          persistenceMode={persistenceMode}
          tenantId={tenant.id}
        />
      </div>

      <div className="inline-note section-gap">
        Live calls, email automation, provider config, billing, Club OS, POS, and
        member-account writes remain outside the current product boundary.
      </div>
    </AppShell>
  );
}
