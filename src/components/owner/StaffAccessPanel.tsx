"use client";

import { useActionState, useState } from "react";
import type {
  OwnerSetupActionState,
  PersistenceMode,
} from "@/application/owner-setup/action-result";
import type { TenantMember } from "@/domain/tenancy";

interface StaffAccessPanelProps {
  members: TenantMember[];
  onDisableTenantStaffMember: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onUpsertTenantStaffMember: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  persistenceMode: PersistenceMode;
  tenantId: string;
}

const initialState: OwnerSetupActionState = {
  ok: false,
  message: ""
};

function roleLabel(role: TenantMember["role"]) {
  if (role === "founder_admin") {
    return "Admin";
  }

  return role === "owner" ? "Owner" : "Staff";
}

function statusLabel(status: TenantMember["inviteStatus"]) {
  if (status === "active") {
    return "Roster active";
  }

  return status === "disabled" ? "Disabled" : "Invite pending";
}

function claimLabel(member: TenantMember) {
  if (member.inviteStatus === "disabled") {
    return "Access disabled";
  }

  if (member.inviteStatus === "invited") {
    return "Needs activation";
  }

  return member.authLinked ? "Claimed" : "Needs claim";
}

export function StaffAccessPanel({
  members,
  onDisableTenantStaffMember,
  onUpsertTenantStaffMember,
  persistenceMode,
  tenantId
}: StaffAccessPanelProps) {
  const [state, formAction, isPending] = useActionState(onUpsertTenantStaffMember, initialState);
  const [disableState, disableFormAction, isDisabling] = useActionState(
    onDisableTenantStaffMember,
    initialState
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const canSubmit = persistenceMode === "backend" && !isPending;
  const canDisable = persistenceMode === "backend" && !isDisabling;
  const activeStaffCount = members.filter(
    (member) => member.role === "staff" && member.inviteStatus === "active"
  ).length;
  const claimedStaffCount = members.filter(
    (member) => member.role === "staff" && member.inviteStatus === "active" && member.authLinked
  ).length;

  async function copyStaffSignInLink() {
    const signInPath = "/staff/sign-in";
    const signInUrl = `${window.location.origin}${signInPath}`;

    try {
      await navigator.clipboard.writeText(signInUrl);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section className="panel setup-editor staff-access-panel" id="staff-access">
      <div className="panel-header">
        <div>
          <h2>Staff access</h2>
          <p>Manage local roster access and give staff the manual claim path.</p>
        </div>
        <span className="channel-pill">
          {claimedStaffCount}/{activeStaffCount} claimed
        </span>
      </div>

      <div className="staff-access-body">
        <div className="staff-roster" aria-label="Tenant staff roster">
          {members.length > 0 ? (
            members.map((member) => (
              <article className="staff-roster-row" key={member.membershipId}>
                <div className="staff-identity">
                  <span className="staff-avatar" aria-hidden="true">
                    {member.name
                      .split(/\s+/u)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("") || "S"}
                  </span>
                  <div>
                    <strong>{member.name}</strong>
                    <span>{member.email}</span>
                  </div>
                </div>
                <div className="staff-access-meta">
                  <span>{roleLabel(member.role)}</span>
                  <strong>{statusLabel(member.inviteStatus)}</strong>
                </div>
                <div className="staff-claim-state">
                  <span>Auth claim</span>
                  <strong>{claimLabel(member)}</strong>
                </div>
                <div className="staff-lifecycle-actions">
                  {member.inviteStatus === "disabled" ? (
                    <span>Save this email again to reactivate</span>
                  ) : member.role !== "staff" ? (
                    <span>Owner and admin rows stay managed outside staff access</span>
                  ) : (
                    <form action={disableFormAction}>
                      <input name="tenantId" type="hidden" value={tenantId} />
                      <input name="membershipId" type="hidden" value={member.membershipId} />
                      <button className="mini-button danger" disabled={!canDisable} type="submit">
                        {isDisabling ? "Disabling" : "Disable access"}
                      </button>
                    </form>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="empty-inline">
              <strong>No staff roster rows yet.</strong>
              <p>Add staff locally so assignments and workboard ownership can use real people.</p>
            </div>
          )}
        </div>

        <form action={formAction} className="staff-access-form">
          <input name="tenantId" type="hidden" value={tenantId} />
          <div className="form-field">
            <label htmlFor="staff-name">Staff name</label>
            <input
              autoComplete="name"
              disabled={!canSubmit}
              id="staff-name"
              name="staffName"
              placeholder="Front desk lead"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="staff-email">Staff email</label>
            <input
              autoComplete="email"
              disabled={!canSubmit}
              id="staff-email"
              name="staffEmail"
              placeholder="frontdesk@gym.com"
              required
              type="email"
            />
          </div>
          <p className="staff-access-boundary">
            This saves roster access only. It does not send an invite email, create a Neon Auth
            account, or enable live phone/email providers.
          </p>
          <button className="button button-primary" disabled={!canSubmit} type="submit">
            {isPending ? "Saving staff" : "Save staff access"}
          </button>
          {state.message ? (
            <p className={`form-status ${state.ok ? "success" : "error"}`} role="status">
              {state.message}
            </p>
          ) : null}
          {disableState.message ? (
            <p
              className={`form-status ${disableState.ok ? "success" : "error"}`}
              role="status"
            >
              {disableState.message}
            </p>
          ) : null}
        </form>
      </div>

      <div className="staff-claim-handoff" aria-label="Staff claim handoff">
        <div className="staff-claim-copy">
          <span className="rail-title">Manual staff handoff</span>
          <strong>Send staff to /staff/sign-in after their roster row is active.</strong>
          <p>
            They sign in or create an account with the same email the owner added. The claim RPC
            links only active roster rows. Disable access to block staff claims or workboard access,
            then save the same email again to reactivate. Invite email and live provider delivery
            remain off.
          </p>
        </div>
        <div className="staff-claim-actions">
          <code>/staff/sign-in</code>
          <button className="button" onClick={copyStaffSignInLink} type="button">
            Copy sign-in link
          </button>
          <span aria-live="polite" className={`copy-status ${copyState}`}>
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed; use /staff/sign-in"
                : "Local manual handoff"}
          </span>
        </div>
      </div>
      <div className="staff-claim-proof" aria-label="Staff claim rehearsal command">
        <div>
          <span className="rail-title">Local claim rehearsal</span>
          <strong>Run the Neon verifier while full staff claim proof is rebuilt.</strong>
          <p>
            This command currently delegates to the Neon Auth/Data API verifier; staff roster claim
            mutation proof remains a blocked beta gate.
          </p>
        </div>
        <code>
          NEXT_PUBLIC_NEON_AUTH_URL=&lt;Neon Auth URL&gt; NEXT_PUBLIC_NEON_DATA_API_URL=&lt;Neon Data API
          URL&gt; npm run staff:claim:rehearsal:local
        </code>
      </div>
    </section>
  );
}
