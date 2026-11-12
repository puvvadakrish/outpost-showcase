import type { Id, LocationStatus, MembershipRole, TenantStatus } from "./models";

export interface Plan {
  id: Id;
  name: string;
  public: boolean;
  includedLocations: number;
  includedVoiceMinutes: number;
  includedEmails: number;
  includedUsers: number;
  overageVoiceMinuteCents: number;
}

export interface PlanEntitlement {
  id: Id;
  planId: Id;
  key: string;
  value: boolean | number | string;
}

export interface Tenant {
  id: Id;
  name: string;
  slug: string;
  status: TenantStatus;
  planId: Id;
  billingMode: "pilot" | "self_serve" | "contract";
  supportTier: "standard" | "concierge";
  createdAt: string;
}

export interface User {
  id: Id;
  email: string;
  name: string;
  externalAuthId?: string;
  createdAt: string;
}

export interface TenantMembership {
  id: Id;
  tenantId: Id;
  userId: Id;
  role: MembershipRole;
  inviteStatus: "invited" | "active" | "disabled";
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantMember {
  membershipId: Id;
  userId: Id;
  email: string;
  name: string;
  role: MembershipRole;
  inviteStatus: "invited" | "active" | "disabled";
  authLinked?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface StaffRosterClaim {
  tenantId: Id;
  tenantName: string;
  membershipId: Id;
  userId: Id;
  email: string;
  name: string;
  role: "staff";
  inviteStatus: "active";
}

export interface Location {
  id: Id;
  tenantId: Id;
  name: string;
  address: string;
  publicPhone?: string;
  routingPhone?: string;
  timezone: string;
  status: LocationStatus;
  updatedAt?: string;
}

export interface LocationRevision {
  id: Id;
  tenantId: Id;
  locationId: Id;
  actorUserId?: Id;
  previousName: string;
  nextName: string;
  previousAddress: string;
  nextAddress: string;
  previousPublicPhone?: string;
  nextPublicPhone?: string;
  previousRoutingPhone?: string;
  nextRoutingPhone?: string;
  previousTimezone: string;
  nextTimezone: string;
  previousStatus: LocationStatus;
  nextStatus: LocationStatus;
  note: string;
  createdAt: string;
}

export interface FounderAdmin {
  id: Id;
  userId: Id;
  status: "active" | "disabled";
  createdAt: string;
}

export interface SupportAccessGrant {
  id: Id;
  tenantId: Id;
  founderAdminId: Id;
  reason: string;
  status: "requested" | "active" | "expired" | "revoked";
  startsAt: string;
  expiresAt: string;
  approvedByUserId?: Id;
  auditEventId?: Id;
}

export function supportAccessReadiness(grants: SupportAccessGrant[]) {
  const active = grants.filter((grant) => grant.status === "active");

  return {
    active: active.length,
    auditReady: active.length === 0 || active.every((grant) => Boolean(grant.auditEventId)),
    hasTenantMembershipAuthority: false,
    readyForLiveSupport: false
  };
}
