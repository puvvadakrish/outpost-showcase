import type { Id } from "@/domain/models";
import type { TenantMember } from "@/domain/tenancy";

export interface UpsertTenantStaffMemberCommand {
  tenantId: Id;
  actorUserId: Id;
  staffEmail: string;
  staffName: string;
}

export interface DisableTenantStaffMemberCommand {
  tenantId: Id;
  actorUserId: Id;
  membershipId: Id;
}

export interface TransactionalUpsertTenantStaffMemberInput
  extends UpsertTenantStaffMemberCommand {}

export interface TransactionalDisableTenantStaffMemberInput
  extends DisableTenantStaffMemberCommand {}

export interface UpsertTenantStaffMemberTransactionResult {
  member: TenantMember;
}

export interface DisableTenantStaffMemberTransactionResult {
  member: TenantMember;
}

export interface StaffAccessRepository {
  listTenantMembers(tenantId: Id): Promise<TenantMember[]>;
  disableTenantStaffMemberTransaction(
    input: TransactionalDisableTenantStaffMemberInput
  ): Promise<DisableTenantStaffMemberTransactionResult>;
  upsertTenantStaffMemberTransaction(
    input: TransactionalUpsertTenantStaffMemberInput
  ): Promise<UpsertTenantStaffMemberTransactionResult>;
}
