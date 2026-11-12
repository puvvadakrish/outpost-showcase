import "server-only";

import type { StaffAuthRepository } from "@/application/staff-auth/ports";
import type { StaffRosterClaim } from "@/domain/tenancy";
import type { OutpostNeonClient } from "@/server/neon/server-client";

interface StaffRosterClaimRow {
  tenant_id: string;
  tenant_name: string;
  membership_id: string;
  user_id: string;
  email: string;
  name: string;
  role: StaffRosterClaim["role"];
  invite_status: StaffRosterClaim["inviteStatus"];
}

function mapStaffRosterClaim(row: StaffRosterClaimRow): StaffRosterClaim {
  return {
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    membershipId: row.membership_id,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    inviteStatus: row.invite_status
  };
}

export class NeonStaffAuthRepository implements StaffAuthRepository {
  constructor(private readonly neon: OutpostNeonClient) {}

  async claimStaffRosterMembershipTransaction() {
    const { data, error } = await this.neon.rpc("claim_staff_roster_membership");

    if (error) {
      throw new Error(`Unable to claim staff roster membership: ${error.message}`);
    }

    const rows = data as unknown as StaffRosterClaimRow[] | StaffRosterClaimRow | null;
    const row = Array.isArray(rows) ? rows[0] : rows;

    if (!row) {
      throw new Error("Unable to claim staff roster membership: no membership was returned.");
    }

    return mapStaffRosterClaim(row);
  }
}
