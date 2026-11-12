import { locationStatuses } from "@/domain/models";
import type {
  CreateLocationDraftCommand,
  LocationRepository,
  UpdateLocationProfileCommand
} from "./ports";

const DEFAULT_CREATE_NOTE = "Created as a draft through backend-backed owner location persistence.";
const DEFAULT_UPDATE_NOTE = "Updated through backend-backed owner location persistence.";
const NAME_LIMIT = 120;
const ADDRESS_LIMIT = 240;
const PHONE_LIMIT = 80;
const TIMEZONE_LIMIT = 80;
const CREATION_KEY_LIMIT = 200;

function includesValue<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

export class LocationApplicationService {
  constructor(private readonly repository: LocationRepository) {}

  async loadOwnerLocations(tenantId: string) {
    if (!tenantId.trim()) {
      throw new Error("Tenant identifier is required.");
    }

    return this.repository.listForOwnerTenant(tenantId.trim());
  }

  async updateLocationProfile(command: UpdateLocationProfileCommand) {
    const name = command.name.trim();
    const address = command.address.trim();
    const publicPhone = normalizeOptional(command.publicPhone);
    const routingPhone = normalizeOptional(command.routingPhone);
    const timezone = command.timezone.trim();
    const note = command.note?.trim() || DEFAULT_UPDATE_NOTE;

    if (!command.tenantId.trim()) {
      throw new Error("Tenant identifier is required.");
    }

    if (!command.locationId.trim()) {
      throw new Error("Location identifier is required.");
    }

    if (!name) {
      throw new Error("Location name is required.");
    }

    if (!address) {
      throw new Error("Location address is required.");
    }

    if (!timezone) {
      throw new Error("Location timezone is required.");
    }

    if (!includesValue(locationStatuses, command.status)) {
      throw new Error("Location status is invalid.");
    }

    if (name.length > NAME_LIMIT) {
      throw new Error(`Location name must be ${NAME_LIMIT} characters or fewer.`);
    }

    if (address.length > ADDRESS_LIMIT) {
      throw new Error(`Location address must be ${ADDRESS_LIMIT} characters or fewer.`);
    }

    if (publicPhone && publicPhone.length > PHONE_LIMIT) {
      throw new Error(`Location public phone must be ${PHONE_LIMIT} characters or fewer.`);
    }

    if (routingPhone && routingPhone.length > PHONE_LIMIT) {
      throw new Error(`Location routing phone must be ${PHONE_LIMIT} characters or fewer.`);
    }

    if (timezone.length > TIMEZONE_LIMIT) {
      throw new Error(`Location timezone must be ${TIMEZONE_LIMIT} characters or fewer.`);
    }

    const result = await this.repository.updateLocationProfileTransaction({
      ...command,
      tenantId: command.tenantId.trim(),
      locationId: command.locationId.trim(),
      name,
      address,
      publicPhone,
      routingPhone,
      timezone,
      note
    });

    return result.location;
  }

  async createLocationDraft(command: CreateLocationDraftCommand) {
    const tenantId = command.tenantId.trim();
    const creationKey = command.creationKey.trim();
    const name = command.name.trim();
    const address = command.address.trim();
    const publicPhone = normalizeOptional(command.publicPhone);
    const routingPhone = normalizeOptional(command.routingPhone);
    const timezone = command.timezone.trim();
    const note = command.note?.trim() || DEFAULT_CREATE_NOTE;

    if (!tenantId) throw new Error("Tenant identifier is required.");
    if (!creationKey || creationKey.length > CREATION_KEY_LIMIT) {
      throw new Error(
        `Location creation key is required and must be ${CREATION_KEY_LIMIT} characters or fewer.`
      );
    }
    if (!name) throw new Error("Location name is required.");
    if (!address) throw new Error("Location address is required.");
    if (!timezone) throw new Error("Location timezone is required.");
    if (name.length > NAME_LIMIT) {
      throw new Error(`Location name must be ${NAME_LIMIT} characters or fewer.`);
    }
    if (address.length > ADDRESS_LIMIT) {
      throw new Error(`Location address must be ${ADDRESS_LIMIT} characters or fewer.`);
    }
    if (publicPhone && publicPhone.length > PHONE_LIMIT) {
      throw new Error(`Location public phone must be ${PHONE_LIMIT} characters or fewer.`);
    }
    if (routingPhone && routingPhone.length > PHONE_LIMIT) {
      throw new Error(`Location routing phone must be ${PHONE_LIMIT} characters or fewer.`);
    }
    if (timezone.length > TIMEZONE_LIMIT) {
      throw new Error(`Location timezone must be ${TIMEZONE_LIMIT} characters or fewer.`);
    }

    const result = await this.repository.createLocationDraftTransaction({
      ...command,
      tenantId,
      creationKey,
      name,
      address,
      publicPhone,
      routingPhone,
      timezone,
      note
    });
    return result.location;
  }
}
