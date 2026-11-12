import { notificationDestinationStatuses, notificationDestinationTypes } from "@/domain/models";
import type {
  CreateNotificationDestinationDraftCommand,
  NotificationDestinationRepository,
  UpdateNotificationDestinationCommand
} from "./ports";

const DEFAULT_CREATE_NOTE =
  "Created as a draft through backend-backed owner notification-destination persistence.";
const DEFAULT_UPDATE_NOTE =
  "Updated through backend-backed owner notification-destination persistence.";
const LABEL_LIMIT = 120;
const DESTINATION_LIMIT = 240;
const CREATION_KEY_LIMIT = 200;

function includesValue<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

export class NotificationDestinationApplicationService {
  constructor(private readonly repository: NotificationDestinationRepository) {}

  async createNotificationDestinationDraft(command: CreateNotificationDestinationDraftCommand) {
    const tenantId = command.tenantId.trim();
    const locationId = command.locationId?.trim() || undefined;
    const creationKey = command.creationKey.trim();
    const label = command.label.trim();
    const destination = command.destination.trim();
    const note = command.note?.trim() || DEFAULT_CREATE_NOTE;

    if (!tenantId) {
      throw new Error("Tenant identifier is required.");
    }
    if (!creationKey || creationKey.length > CREATION_KEY_LIMIT) {
      throw new Error(
        `Notification destination creation key is required and must be ${CREATION_KEY_LIMIT} characters or fewer.`
      );
    }

    if (!label) {
      throw new Error("Notification destination label is required.");
    }

    if (!destination) {
      throw new Error("Notification destination value is required.");
    }

    if (!includesValue(notificationDestinationTypes, command.type)) {
      throw new Error("Notification destination type is invalid.");
    }

    if (label.length > LABEL_LIMIT) {
      throw new Error(`Notification destination label must be ${LABEL_LIMIT} characters or fewer.`);
    }

    if (destination.length > DESTINATION_LIMIT) {
      throw new Error(`Notification destination value must be ${DESTINATION_LIMIT} characters or fewer.`);
    }

    const result = await this.repository.createNotificationDestinationDraftTransaction({
      ...command,
      tenantId,
      locationId,
      creationKey,
      label,
      destination,
      note
    });

    return result.destination;
  }

  async loadOwnerNotificationDestinations(tenantId: string) {
    if (!tenantId.trim()) {
      throw new Error("Tenant identifier is required.");
    }

    return this.repository.listForOwnerTenant(tenantId.trim());
  }

  async updateNotificationDestination(command: UpdateNotificationDestinationCommand) {
    const label = command.label.trim();
    const destination = command.destination.trim();
    const note = command.note?.trim() || DEFAULT_UPDATE_NOTE;

    if (!command.tenantId.trim()) {
      throw new Error("Tenant identifier is required.");
    }

    if (!command.destinationId.trim()) {
      throw new Error("Notification destination identifier is required.");
    }

    if (!label) {
      throw new Error("Notification destination label is required.");
    }

    if (!destination) {
      throw new Error("Notification destination value is required.");
    }

    if (!includesValue(notificationDestinationTypes, command.type)) {
      throw new Error("Notification destination type is invalid.");
    }

    if (!includesValue(notificationDestinationStatuses, command.status)) {
      throw new Error("Notification destination status is invalid.");
    }

    if (label.length > LABEL_LIMIT) {
      throw new Error(`Notification destination label must be ${LABEL_LIMIT} characters or fewer.`);
    }

    if (destination.length > DESTINATION_LIMIT) {
      throw new Error(`Notification destination value must be ${DESTINATION_LIMIT} characters or fewer.`);
    }

    const result = await this.repository.updateNotificationDestinationTransaction({
      ...command,
      tenantId: command.tenantId.trim(),
      destinationId: command.destinationId.trim(),
      label,
      destination,
      note
    });

    return result.destination;
  }
}
