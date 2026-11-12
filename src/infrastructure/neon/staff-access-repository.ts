import "server-only";

import type {
  DisableTenantStaffMemberTransactionResult,
  StaffAccessRepository,
  TransactionalDisableTenantStaffMemberInput,
  TransactionalUpsertTenantStaffMemberInput,
  UpsertTenantStaffMemberTransactionResult
} from "@/application/staff-access/ports";
import type { TenantMember } from "@/domain/tenancy";
import type { OutpostNeonClient } from "@/server/neon/server-client";

interface TenantMemberRow {
  membership_id?: string;
  user_id?: string;
  id?: string;
  email: string;
  auth_linked?: boolean | null;
  name: string;
  role?: TenantMember["role"];
  invite_status?: TenantMember["inviteStatus"];
  created_at: string;
  updated_at?: string | null;
}

function mapTenantMember(row: TenantMemberRow): TenantMember {
  return {
    membershipId: row.membership_id ?? row.id ?? row.user_id ?? "",
    userId: row.user_id ?? row.id ?? "",
    email: row.email,
    name: row.name,
    role: row.role ?? "staff",
    inviteStatus: row.invite_status ?? "active",
    authLinked: Boolean(row.auth_linked),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined
  };
}

export class NeonStaffAccessRepository implements StaffAccessRepository {
  constructor(private readonly neon: OutpostNeonClient) {}

  async listTenantMembers(tenantId: string) {
    const { data, error } = await this.neon.rpc("list_tenant_staff_access_members", {
      p_tenant_id: tenantId
    });

    if (error) {
      throw new Error(`Unable to load tenant staff access roster: ${error.message}`);
    }

    return ((data ?? []) as unknown as TenantMemberRow[]).map(mapTenantMember);
  }

  async upsertTenantStaffMemberTransaction(
    input: TransactionalUpsertTenantStaffMemberInput
  ): Promise<UpsertTenantStaffMemberTransactionResult> {
    // The RPC derives actor identity from auth.uid(); do not forward client-provided actor ids.
    const { data, error } = await this.neon.rpc("upsert_tenant_staff_member", {
      p_tenant_id: input.tenantId,
      p_staff_email: input.staffEmail,
      p_staff_name: input.staffName
    });

    if (error) {
      throw new Error(`Unable to save staff access roster member: ${error.message}`);
    }

    const rows = data as unknown as TenantMemberRow[] | TenantMemberRow | null;
    const row = Array.isArray(rows) ? rows[0] : rows;

    if (!row) {
      throw new Error("Unable to save staff access roster member: no member was returned.");
    }

    return { member: mapTenantMember(row) };
  }

  async disableTenantStaffMemberTransaction(
    input: TransactionalDisableTenantStaffMemberInput
  ): Promise<DisableTenantStaffMemberTransactionResult> {
    // The RPC derives actor identity from auth.uid(); do not forward client-provided actor ids.
    const { data, error } = await this.neon.rpc("disable_tenant_staff_member", {
      p_tenant_id: input.tenantId,
      p_membership_id: input.membershipId
    });

    if (error) {
      throw new Error(`Unable to disable staff access roster member: ${error.message}`);
    }

    const rows = data as unknown as TenantMemberRow[] | TenantMemberRow | null;
    const row = Array.isArray(rows) ? rows[0] : rows;

    if (!row) {
      throw new Error("Unable to disable staff access roster member: no member was returned.");
    }

    return { member: mapTenantMember(row) };
  }
}
