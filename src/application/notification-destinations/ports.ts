import type { NotificationDestination } from "@/domain/notifications";
import type { Id, NotificationDestinationStatus, NotificationDestinationType } from "@/domain/models";

export interface CreateNotificationDestinationDraftCommand {
  tenantId: Id;
  locationId?: Id;
  creationKey: string;
  actorUserId: Id;
  type: NotificationDestinationType;
  label: string;
  destination: string;
  note?: string;
}

export interface TransactionalCreateNotificationDestinationDraftInput
  extends CreateNotificationDestinationDraftCommand {
  note: string;
}

export interface CreateNotificationDestinationDraftTransactionResult {
  destination: NotificationDestination;
}

export interface UpdateNotificationDestinationCommand {
  tenantId: Id;
  destinationId: Id;
  actorUserId: Id;
  type: NotificationDestinationType;
  label: string;
  destination: string;
  status: NotificationDestinationStatus;
  note?: string;
}

export interface TransactionalUpdateNotificationDestinationInput
  extends UpdateNotificationDestinationCommand {
  note: string;
}

export interface UpdateNotificationDestinationTransactionResult {
  destination: NotificationDestination;
}

export interface NotificationDestinationRepository {
  listForOwnerTenant(tenantId: Id): Promise<NotificationDestination[]>;
  createNotificationDestinationDraftTransaction(
    input: TransactionalCreateNotificationDestinationDraftInput
  ): Promise<CreateNotificationDestinationDraftTransactionResult>;
  updateNotificationDestinationTransaction(
    input: TransactionalUpdateNotificationDestinationInput
  ): Promise<UpdateNotificationDestinationTransactionResult>;
}
