import type { AuditEvent } from "@/domain/audit";
import type { TenantMember, TenantMembership, User } from "@/domain/tenancy";
import type {
  DisableTenantStaffMemberTransactionResult,
  StaffAccessRepository,
  TransactionalDisableTenantStaffMemberInput,
  TransactionalUpsertTenantStaffMemberInput,
  UpsertTenantStaffMemberTransactionResult
} from "./ports";

export interface StaffAccessPersistenceState {
  auditEvents: AuditEvent[];
  memberships: TenantMembership[];
  users: User[];
}

function mapTenantMember(membership: TenantMembership, user: User): TenantMember {
  return {
    membershipId: membership.id,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: membership.role,
    inviteStatus: membership.inviteStatus,
    authLinked: Boolean(user.externalAuthId),
    createdAt: membership.createdAt ?? user.createdAt,
    updatedAt: membership.updatedAt
  };
}

export class InMemoryStaffAccessRepository implements StaffAccessRepository {
  private failAfterUserUpsert = false;
  private state: StaffAccessPersistenceState;

  constructor(seed: StaffAccessPersistenceState) {
    this.state = {
      auditEvents: seed.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      memberships: seed.memberships.map((membership) => ({ ...membership })),
      users: seed.users.map((user) => ({ ...user }))
    };
  }

  requestFailureAfterUserUpsert() {
    this.failAfterUserUpsert = true;
  }

  snapshot(): StaffAccessPersistenceState {
    return {
      auditEvents: this.state.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      memberships: this.state.memberships.map((membership) => ({ ...membership })),
      users: this.state.users.map((user) => ({ ...user }))
    };
  }

  async listTenantMembers(tenantId: string) {
    return this.state.memberships
      .filter((membership) => membership.tenantId === tenantId && membership.role === "staff")
      .map((membership) => {
        const user = this.state.users.find((candidate) => candidate.id === membership.userId);
        return user ? mapTenantMember(membership, user) : undefined;
      })
      .filter((member): member is TenantMember => member !== undefined)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async disableTenantStaffMemberTransaction(
    input: TransactionalDisableTenantStaffMemberInput
  ): Promise<DisableTenantStaffMemberTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();

    try {
      const existingMembership = this.state.memberships.find(
        (membership) => membership.tenantId === input.tenantId && membership.id === input.membershipId
      );

      if (!existingMembership || existingMembership.role !== "staff") {
        throw new Error("Tenant staff membership is required.");
      }

      const user = this.state.users.find((candidate) => candidate.id === existingMembership.userId);

      if (!user) {
        throw new Error("Staff user row is required.");
      }

      if (existingMembership.inviteStatus === "disabled") {
        return { member: mapTenantMember(existingMembership, user) };
      }

      const membership: TenantMembership = {
        ...existingMembership,
        inviteStatus: "disabled",
        updatedAt: now
      };

      this.state.memberships = this.state.memberships.map((candidate) =>
        candidate.id === membership.id ? membership : candidate
      );

      this.state.auditEvents.push({
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "tenant_membership",
        subjectId: membership.id,
        action: "tenant_membership.staff_disabled",
        metadata: {
          user_id: user.id,
          email: user.email,
          previous_invite_status: existingMembership.inviteStatus,
          next_invite_status: membership.inviteStatus,
          role: membership.role
        },
        occurredAt: now
      });

      return { member: mapTenantMember(membership, user) };
    } catch (error) {
      this.state = rollback;
      throw error;
    }
  }

  async upsertTenantStaffMemberTransaction(
    input: TransactionalUpsertTenantStaffMemberInput
  ): Promise<UpsertTenantStaffMemberTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();

    try {
      let user = this.state.users.find((candidate) => candidate.email.toLowerCase() === input.staffEmail);

      if (user) {
        user = { ...user };
      } else {
        user = {
          id: `user_staff_${this.state.users.length + 1}`,
          email: input.staffEmail,
          name: input.staffName,
          createdAt: now
        };
        this.state.users.push(user);
      }

      if (this.failAfterUserUpsert) {
        throw new Error("Injected failure after staff user upsert.");
      }

      const existingMembership = this.state.memberships.find(
        (membership) => membership.tenantId === input.tenantId && membership.userId === user?.id
      );

      if (existingMembership && existingMembership.role !== "staff") {
        throw new Error("Only staff memberships can be managed through staff access.");
      }

      if (existingMembership) {
        user = { ...user, name: input.staffName };
        this.state.users = this.state.users.map((candidate) => (candidate.id === user?.id ? user : candidate));
      }

      const membership: TenantMembership = existingMembership
        ? {
            ...existingMembership,
            role: "staff",
            inviteStatus: "active",
            updatedAt: now
          }
        : {
            id: `member_staff_${this.state.memberships.length + 1}`,
            tenantId: input.tenantId,
            userId: user.id,
            role: "staff",
            inviteStatus: "active",
            createdAt: now,
            updatedAt: now
          };

      if (existingMembership) {
        this.state.memberships = this.state.memberships.map((candidate) =>
          candidate.id === membership.id ? membership : candidate
        );
      } else {
        this.state.memberships.push(membership);
      }

      this.state.auditEvents.push({
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "tenant_membership",
        subjectId: membership.id,
        action: "tenant_membership.staff_upserted",
        metadata: {
          user_id: user.id,
          email: user.email,
          previous_invite_status: existingMembership?.inviteStatus ?? null,
          next_invite_status: membership.inviteStatus,
          previous_role: existingMembership?.role ?? null,
          next_role: membership.role
        },
        occurredAt: now
      });

      return { member: mapTenantMember(membership, user) };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterUserUpsert = false;
    }
  }
}
