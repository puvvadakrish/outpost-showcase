import type { StaffAuthRepository } from "./ports";

export class StaffAuthApplicationService {
  constructor(private readonly repository: StaffAuthRepository) {}

  async claimStaffRosterMembership() {
    return this.repository.claimStaffRosterMembershipTransaction();
  }
}
