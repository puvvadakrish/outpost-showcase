import type { AuditEvent } from "@/domain/audit";
import type { Location, LocationRevision } from "@/domain/tenancy";
import type {
  LocationPersistenceState,
  LocationRepository,
  TransactionalCreateLocationDraftInput,
  TransactionalUpdateLocationProfileInput,
  CreateLocationDraftTransactionResult,
  UpdateLocationProfileTransactionResult
} from "./ports";

function cloneAuditEvent(event: AuditEvent): AuditEvent {
  return { ...event, metadata: { ...event.metadata } };
}

function cloneState(state: LocationPersistenceState): LocationPersistenceState {
  return {
    locations: state.locations.map((location) => ({ ...location })),
    revisions: state.revisions.map((revision) => ({ ...revision })),
    auditEvents: state.auditEvents.map(cloneAuditEvent),
    includedLocationsByTenant: state.includedLocationsByTenant
      ? { ...state.includedLocationsByTenant }
      : undefined
  };
}

export class InMemoryLocationRepository implements LocationRepository {
  private state: LocationPersistenceState;
  private failAfterLocationUpdate = false;
  private failAfterLocationCreate = false;

  constructor(initialState: LocationPersistenceState) {
    this.state = cloneState(initialState);
  }

  snapshot() {
    return cloneState(this.state);
  }

  requestFailureAfterLocationUpdate() {
    this.failAfterLocationUpdate = true;
  }

  requestFailureAfterLocationCreate() {
    this.failAfterLocationCreate = true;
  }

  async listForOwnerTenant(tenantId: string) {
    return this.state.locations
      .filter((location) => location.tenantId === tenantId)
      .map((location) => ({ ...location }));
  }

  async createLocationDraftTransaction(
    input: TransactionalCreateLocationDraftInput
  ): Promise<CreateLocationDraftTransactionResult> {
    const existingAudit = this.state.auditEvents.find(
      (event) =>
        event.tenantId === input.tenantId &&
        event.action === "location.created" &&
        event.metadata.creation_key === input.creationKey
    );
    if (existingAudit) {
      const existing = this.state.locations.find((location) => location.id === existingAudit.subjectId);
      if (!existing) throw new Error("Location creation state is inconsistent.");
      if (
        existing.name !== input.name ||
        existing.address !== input.address ||
        existing.publicPhone !== input.publicPhone ||
        existing.routingPhone !== input.routingPhone ||
        existing.timezone !== input.timezone
      ) {
        throw new Error("Location creation key conflicts with different work.");
      }
      return { location: { ...existing } };
    }

    const allowance = this.state.includedLocationsByTenant?.[input.tenantId] ?? Number.POSITIVE_INFINITY;
    const currentCount = this.state.locations.filter(
      (location) => location.tenantId === input.tenantId
    ).length;
    if (currentCount >= allowance) {
      throw new Error("Location allowance reached for the current plan.");
    }

    const before = cloneState(this.state);
    const now = "2026-07-13T00:00:00.000Z";
    const location: Location = {
      id: `location_${this.state.locations.length + 1}`,
      tenantId: input.tenantId,
      name: input.name,
      address: input.address,
      publicPhone: input.publicPhone,
      routingPhone: input.routingPhone,
      timezone: input.timezone,
      status: "draft",
      updatedAt: now
    };

    try {
      this.state.locations.push(location);
      if (this.failAfterLocationCreate) {
        throw new Error("Injected failure after location creation.");
      }
      const revision: LocationRevision = {
        id: `location_revision_${this.state.revisions.length + 1}`,
        tenantId: input.tenantId,
        locationId: location.id,
        actorUserId: input.actorUserId,
        previousName: location.name,
        nextName: location.name,
        previousAddress: location.address,
        nextAddress: location.address,
        previousPublicPhone: location.publicPhone,
        nextPublicPhone: location.publicPhone,
        previousRoutingPhone: location.routingPhone,
        nextRoutingPhone: location.routingPhone,
        previousTimezone: location.timezone,
        nextTimezone: location.timezone,
        previousStatus: "draft",
        nextStatus: "draft",
        note: input.note,
        createdAt: now
      };
      this.state.revisions.push(revision);
      this.state.auditEvents.push({
        id: `location_audit_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "location",
        subjectId: location.id,
        action: "location.created",
        metadata: {
          creation_key: input.creationKey,
          status: "draft",
          revision_id: revision.id,
          provider_stubs: 2
        },
        occurredAt: now
      });
      return { location: { ...location } };
    } catch (error) {
      this.state = before;
      throw error;
    } finally {
      this.failAfterLocationCreate = false;
    }
  }

  async updateLocationProfileTransaction(
    input: TransactionalUpdateLocationProfileInput
  ): Promise<UpdateLocationProfileTransactionResult> {
    const before = cloneState(this.state);
    const locationIndex = this.state.locations.findIndex(
      (location) => location.tenantId === input.tenantId && location.id === input.locationId
    );

    if (locationIndex === -1) {
      throw new Error("Location not found.");
    }

    const existing = this.state.locations[locationIndex];
    const updated: Location = {
      ...existing,
      name: input.name,
      address: input.address,
      publicPhone: input.publicPhone,
      routingPhone: input.routingPhone,
      timezone: input.timezone,
      status: input.status,
      updatedAt: "2026-06-11T00:00:00.000Z"
    };

    try {
      this.state.locations[locationIndex] = updated;

      if (this.failAfterLocationUpdate) {
        throw new Error("Injected failure after location update.");
      }

      const revision: LocationRevision = {
        id: `location_revision_${this.state.revisions.length + 1}`,
        tenantId: input.tenantId,
        locationId: updated.id,
        actorUserId: input.actorUserId,
        previousName: existing.name,
        nextName: updated.name,
        previousAddress: existing.address,
        nextAddress: updated.address,
        previousPublicPhone: existing.publicPhone,
        nextPublicPhone: updated.publicPhone,
        previousRoutingPhone: existing.routingPhone,
        nextRoutingPhone: updated.routingPhone,
        previousTimezone: existing.timezone,
        nextTimezone: updated.timezone,
        previousStatus: existing.status,
        nextStatus: updated.status,
        note: input.note,
        createdAt: "2026-06-11T00:00:00.000Z"
      };
      this.state.revisions.push(revision);

      this.state.auditEvents.push({
        id: `location_audit_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "location",
        subjectId: updated.id,
        action: "location.updated",
        metadata: {
          previous_name: existing.name,
          next_name: updated.name,
          previous_address: existing.address,
          next_address: updated.address,
          previous_public_phone: existing.publicPhone ?? null,
          next_public_phone: updated.publicPhone ?? null,
          previous_routing_phone: existing.routingPhone ?? null,
          next_routing_phone: updated.routingPhone ?? null,
          previous_timezone: existing.timezone,
          next_timezone: updated.timezone,
          previous_status: existing.status,
          next_status: updated.status,
          revision_id: revision.id
        },
        occurredAt: "2026-06-11T00:00:00.000Z"
      });
    } catch (error) {
      this.state = before;
      this.failAfterLocationUpdate = false;
      throw error;
    }

    this.failAfterLocationUpdate = false;

    return { location: { ...updated } };
  }
}
