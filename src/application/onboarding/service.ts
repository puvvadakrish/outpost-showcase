import type { BootstrapOwnerTenantCommand, OnboardingRepository } from "./ports";

const EMAIL_LIMIT = 254;
const NAME_LIMIT = 120;
const ADDRESS_LIMIT = 240;
const PHONE_LIMIT = 80;
const TIMEZONE_LIMIT = 80;

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

export class OnboardingApplicationService {
  constructor(private readonly repository: OnboardingRepository) {}

  async bootstrapOwnerTenant(command: BootstrapOwnerTenantCommand) {
    const ownerEmail = command.ownerEmail.trim().toLowerCase();
    const ownerName = command.ownerName.trim();
    const tenantName = command.tenantName.trim();
    const locationName = command.locationName.trim();
    const locationAddress = command.locationAddress.trim();
    const timezone = command.timezone.trim();
    const publicPhone = normalizeOptional(command.publicPhone);

    if (!ownerEmail) {
      throw new Error("Owner email is required.");
    }

    if (!ownerEmail.includes("@")) {
      throw new Error("Owner email must be valid.");
    }

    if (!ownerName) {
      throw new Error("Owner name is required.");
    }

    if (!tenantName) {
      throw new Error("Gym name is required.");
    }

    if (!locationName) {
      throw new Error("Location name is required.");
    }

    if (!locationAddress) {
      throw new Error("Location address is required.");
    }

    if (!timezone) {
      throw new Error("Timezone is required.");
    }

    if (ownerEmail.length > EMAIL_LIMIT) {
      throw new Error(`Owner email must be ${EMAIL_LIMIT} characters or fewer.`);
    }

    if (ownerName.length > NAME_LIMIT) {
      throw new Error(`Owner name must be ${NAME_LIMIT} characters or fewer.`);
    }

    if (tenantName.length > NAME_LIMIT) {
      throw new Error(`Gym name must be ${NAME_LIMIT} characters or fewer.`);
    }

    if (locationName.length > NAME_LIMIT) {
      throw new Error(`Location name must be ${NAME_LIMIT} characters or fewer.`);
    }

    if (locationAddress.length > ADDRESS_LIMIT) {
      throw new Error(`Location address must be ${ADDRESS_LIMIT} characters or fewer.`);
    }

    if (timezone.length > TIMEZONE_LIMIT) {
      throw new Error(`Timezone must be ${TIMEZONE_LIMIT} characters or fewer.`);
    }

    if (publicPhone && publicPhone.length > PHONE_LIMIT) {
      throw new Error(`Public phone must be ${PHONE_LIMIT} characters or fewer.`);
    }

    const transaction = await this.repository.bootstrapOwnerTenantTransaction({
      ownerEmail,
      ownerName,
      tenantName,
      locationName,
      locationAddress,
      timezone,
      publicPhone
    });

    return transaction.result;
  }
}
