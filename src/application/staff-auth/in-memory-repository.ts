import type { AuditEvent } from "@/domain/audit";
import type { StaffRosterClaim, Tenant, TenantMembership, User } from "@/domain/tenancy";
import type { StaffAuthRepository } from "./ports";

export interface StaffAuthPersistenceState {
  auditEvents: AuditEvent[];
  authEmail: string | null;
  authEmailConfirmed?: boolean;
  authUserId: string | null;
  memberships: TenantMembership[];
  tenants: Tenant[];
  users: User[];
}

export class InMemoryStaffAuthRepository implements StaffAuthRepository {
  private failAfterUserLink = false;
  private state: StaffAuthPersistenceState;

  constructor(seed: StaffAuthPersistenceState) {
    this.state = {
      auditEvents: seed.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      authEmail: seed.authEmail,
      authEmailConfirmed: seed.authEmailConfirmed ?? true,
      authUserId: seed.authUserId,
      memberships: seed.memberships.map((membership) => ({ ...membership })),
      tenants: seed.tenants.map((tenant) => ({ ...tenant })),
      users: seed.users.map((user) => ({ ...user }))
    };
  }

  requestFailureAfterUserLink() {
    this.failAfterUserLink = true;
  }

  snapshot(): StaffAuthPersistenceState {
    return {
      auditEvents: this.state.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      authEmail: this.state.authEmail,
      authEmailConfirmed: this.state.authEmailConfirmed,
      authUserId: this.state.authUserId,
      memberships: this.state.memberships.map((membership) => ({ ...membership })),
      tenants: this.state.tenants.map((tenant) => ({ ...tenant })),
      users: this.state.users.map((user) => ({ ...user }))
    };
  }

  async claimStaffRosterMembershipTransaction(): Promise<StaffRosterClaim> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const authEmail = this.state.authEmail?.trim().toLowerCase();
    const authUserId = this.state.authUserId?.trim();

    try {
      if (!authUserId) {
        throw new Error("Authenticated user is required.");
      }

      if (!authEmail) {
        throw new Error("Authenticated email claim is required.");
      }

      if (!this.state.authEmailConfirmed) {
        throw new Error("Confirmed authenticated email claim is required.");
      }

      const user = this.state.users.find((candidate) => candidate.email.toLowerCase() === authEmail);

      if (!user) {
        throw new Error("Staff roster membership is required before sign-in.");
      }

      if (user.externalAuthId && user.externalAuthId !== authUserId) {
        throw new Error("Staff roster user is already linked to another authenticated account.");
      }

      const membership = this.state.memberships.find(
        (candidate) => candidate.userId === user.id && candidate.role === "staff" && candidate.inviteStatus === "active"
      );

      if (!membership) {
        throw new Error("Active staff roster membership is required before sign-in.");
      }

      const tenant = this.state.tenants.find((candidate) => candidate.id === membership.tenantId);

      if (!tenant) {
        throw new Error("Tenant not found for staff roster membership.");
      }

      const linkedUser: User = { ...user, externalAuthId: authUserId };
      this.state.users = this.state.users.map((candidate) => (candidate.id === user.id ? linkedUser : candidate));

      if (this.failAfterUserLink) {
        throw new Error("Injected failure after staff roster user link.");
      }

      this.state.auditEvents.push({
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: membership.tenantId,
        actorUserId: user.id,
        subjectType: "tenant_membership",
        subjectId: membership.id,
        action: "tenant_membership.staff_claimed",
        metadata: {
          user_id: user.id,
          email: user.email,
          auth_user_id: authUserId
        },
        occurredAt: now
      });

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        membershipId: membership.id,
        userId: linkedUser.id,
        email: linkedUser.email,
        name: linkedUser.name,
        role: "staff",
        inviteStatus: "active"
      };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterUserLink = false;
    }
  }
}
