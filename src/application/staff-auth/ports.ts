import type { StaffRosterClaim } from "@/domain/tenancy";

export interface StaffAuthRepository {
  claimStaffRosterMembershipTransaction(): Promise<StaffRosterClaim>;
}
