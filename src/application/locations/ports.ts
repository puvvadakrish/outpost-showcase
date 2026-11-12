import type { Id, LocationStatus } from "@/domain/models";
import type { Location, LocationRevision } from "@/domain/tenancy";
import type { AuditEvent } from "@/domain/audit";

export interface CreateLocationDraftCommand {
  tenantId: Id;
  creationKey: string;
  actorUserId: Id;
  name: string;
  address: string;
  publicPhone?: string;
  routingPhone?: string;
  timezone: string;
  note?: string;
}

export interface TransactionalCreateLocationDraftInput extends CreateLocationDraftCommand {
  note: string;
}

export interface CreateLocationDraftTransactionResult {
  location: Location;
}

export interface UpdateLocationProfileCommand {
  tenantId: Id;
  locationId: Id;
  actorUserId: Id;
  name: string;
  address: string;
  publicPhone?: string;
  routingPhone?: string;
  timezone: string;
  status: LocationStatus;
  note?: string;
}

export interface TransactionalUpdateLocationProfileInput extends UpdateLocationProfileCommand {
  note: string;
}

export interface UpdateLocationProfileTransactionResult {
  location: Location;
}

export interface LocationRepository {
  listForOwnerTenant(tenantId: Id): Promise<Location[]>;
  createLocationDraftTransaction(
    input: TransactionalCreateLocationDraftInput
  ): Promise<CreateLocationDraftTransactionResult>;
  updateLocationProfileTransaction(
    input: TransactionalUpdateLocationProfileInput
  ): Promise<UpdateLocationProfileTransactionResult>;
}

export interface LocationPersistenceState {
  locations: Location[];
  revisions: LocationRevision[];
  auditEvents: AuditEvent[];
  includedLocationsByTenant?: Record<Id, number>;
}
