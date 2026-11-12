import type {
  DisableTenantStaffMemberCommand,
  StaffAccessRepository,
  UpsertTenantStaffMemberCommand
} from "./ports";

const EMAIL_LIMIT = 254;
const NAME_LIMIT = 120;

function assertMaxLength(label: string, value: string, maxLength: number) {
  if (value.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
}

export class StaffAccessApplicationService {
  constructor(private readonly repository: StaffAccessRepository) {}

  async listTenantMembers(tenantId: string) {
    const normalizedTenantId = tenantId.trim();

    if (!normalizedTenantId) {
      throw new Error("Tenant identifier is required.");
    }

    return this.repository.listTenantMembers(normalizedTenantId);
  }

  async upsertTenantStaffMember(command: UpsertTenantStaffMemberCommand) {
    const tenantId = command.tenantId.trim();
    const staffEmail = command.staffEmail.trim().toLowerCase();
    const staffName = command.staffName.trim();

    if (!tenantId) {
      throw new Error("Tenant identifier is required.");
    }

    if (!staffEmail) {
      throw new Error("Staff email is required.");
    }

    if (!staffEmail.includes("@")) {
      throw new Error("Staff email must be valid.");
    }

    if (!staffName) {
      throw new Error("Staff name is required.");
    }

    assertMaxLength("Staff email", staffEmail, EMAIL_LIMIT);
    assertMaxLength("Staff name", staffName, NAME_LIMIT);

    const result = await this.repository.upsertTenantStaffMemberTransaction({
      ...command,
      tenantId,
      staffEmail,
      staffName
    });

    return result.member;
  }

  async disableTenantStaffMember(command: DisableTenantStaffMemberCommand) {
    const tenantId = command.tenantId.trim();
    const membershipId = command.membershipId.trim();

    if (!tenantId) {
      throw new Error("Tenant identifier is required.");
    }

    if (!membershipId) {
      throw new Error("Staff membership identifier is required.");
    }

    const result = await this.repository.disableTenantStaffMemberTransaction({
      ...command,
      tenantId,
      membershipId
    });

    return result.member;
  }
}
