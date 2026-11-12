import type { Id, NotificationDestinationStatus, NotificationDestinationType } from "./models";

export interface NotificationDestination {
  id: Id;
  creationKey?: string;
  tenantId: Id;
  locationId?: Id;
  type: NotificationDestinationType;
  label: string;
  destination: string;
  status: NotificationDestinationStatus;
  updatedAt?: string;
}

export interface NotificationDestinationRevision {
  id: Id;
  tenantId: Id;
  locationId?: Id;
  notificationDestinationId: Id;
  actorUserId?: Id;
  previousType: NotificationDestinationType;
  nextType: NotificationDestinationType;
  previousLabel: string;
  nextLabel: string;
  previousDestination: string;
  nextDestination: string;
  previousStatus: NotificationDestinationStatus;
  nextStatus: NotificationDestinationStatus;
  note: string;
  createdAt: string;
}
