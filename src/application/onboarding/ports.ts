import type { Id } from "@/domain/models";
import type { AuditEvent } from "@/domain/audit";
import type { Location, Tenant, TenantMembership, User } from "@/domain/tenancy";
import type { HandoffRule } from "@/domain/handoff-rules";
import type { NotificationDestination } from "@/domain/notifications";
import type { ProviderConnection } from "@/domain/channels";
import type { SourceDocument } from "@/domain/sources";

export interface BootstrapOwnerTenantCommand {
  ownerEmail: string;
  ownerName: string;
  tenantName: string;
  locationName: string;
  locationAddress: string;
  timezone: string;
  publicPhone?: string;
}

export interface BootstrappedOwnerTenant {
  tenantId: Id;
  tenantName: string;
  tenantSlug: string;
  locationId: Id;
  locationName: string;
}

export interface BootstrapOwnerTenantTransactionResult {
  result: BootstrappedOwnerTenant;
}

export interface OnboardingRepository {
  bootstrapOwnerTenantTransaction(
    input: BootstrapOwnerTenantCommand
  ): Promise<BootstrapOwnerTenantTransactionResult>;
}

export interface OnboardingPersistenceState {
  auditEvents: AuditEvent[];
  handoffRules: HandoffRule[];
  locations: Location[];
  memberships: TenantMembership[];
  notificationDestinations: NotificationDestination[];
  providerConnections: ProviderConnection[];
  sourceDocuments: SourceDocument[];
  tenants: Tenant[];
  users: User[];
}
