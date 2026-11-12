import type { AuditEvent } from "@/domain/audit";
import type {
  NotificationDestination,
  NotificationDestinationRevision
} from "@/domain/notifications";
import type {
  CreateNotificationDestinationDraftTransactionResult,
  NotificationDestinationRepository,
  TransactionalCreateNotificationDestinationDraftInput,
  TransactionalUpdateNotificationDestinationInput,
  UpdateNotificationDestinationTransactionResult
} from "./ports";

interface InMemoryNotificationDestinationState {
  auditEvents: AuditEvent[];
  destinations: NotificationDestination[];
  revisions: NotificationDestinationRevision[];
}

export class InMemoryNotificationDestinationRepository implements NotificationDestinationRepository {
  private failAfterDestinationCreate = false;
  private failAfterInitialRevisionCreate = false;
  private failAfterDestinationUpdate = false;
  private state: InMemoryNotificationDestinationState;

  constructor(seed: InMemoryNotificationDestinationState) {
    this.state = {
      auditEvents: seed.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      destinations: seed.destinations.map((destination) => ({ ...destination })),
      revisions: seed.revisions.map((revision) => ({ ...revision }))
    };
  }

  requestFailureAfterDestinationUpdate() {
    this.failAfterDestinationUpdate = true;
  }

  requestFailureAfterDestinationCreate() {
    this.failAfterDestinationCreate = true;
  }

  requestFailureAfterInitialRevisionCreate() {
    this.failAfterInitialRevisionCreate = true;
  }

  snapshot(): InMemoryNotificationDestinationState {
    return {
      auditEvents: this.state.auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      destinations: this.state.destinations.map((destination) => ({ ...destination })),
      revisions: this.state.revisions.map((revision) => ({ ...revision }))
    };
  }

  async listForOwnerTenant(tenantId: string) {
    return this.state.destinations
      .filter((destination) => destination.tenantId === tenantId)
      .map((destination) => ({ ...destination }));
  }

  async createNotificationDestinationDraftTransaction(
    input: TransactionalCreateNotificationDestinationDraftInput
  ): Promise<CreateNotificationDestinationDraftTransactionResult> {
    const existingAudit = this.state.auditEvents.find(
      (event) =>
        event.tenantId === input.tenantId &&
        event.action === "notification_destination.created" &&
        event.metadata.creation_key === input.creationKey
    );
    if (existingAudit) {
      const existingDestination = this.state.destinations.find(
        (destination) => destination.id === existingAudit.subjectId
      );
      if (!existingDestination) {
        throw new Error("Notification destination creation state is inconsistent.");
      }
      if (
        existingDestination.locationId !== input.locationId ||
        existingDestination.type !== input.type ||
        existingDestination.label !== input.label ||
        existingDestination.destination !== input.destination
      ) {
        throw new Error("Notification destination creation key conflicts with different work.");
      }
      return { destination: { ...existingDestination } };
    }
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const destinationId = `notification_destination_${this.state.destinations.length + 1}`;
    const revisionId = `notification_destination_revision_${this.state.revisions.length + 1}`;

    try {
      const destination: NotificationDestination = {
        id: destinationId,
        creationKey: input.creationKey,
        tenantId: input.tenantId,
        locationId: input.locationId,
        type: input.type,
        label: input.label,
        destination: input.destination,
        status: "draft",
        updatedAt: now
      };

      this.state.destinations.push(destination);

      if (this.failAfterDestinationCreate) {
        throw new Error("Injected failure after notification destination create.");
      }

      const revision: NotificationDestinationRevision = {
        id: revisionId,
        tenantId: input.tenantId,
        locationId: input.locationId,
        notificationDestinationId: destination.id,
        actorUserId: input.actorUserId,
        previousType: destination.type,
        nextType: destination.type,
        previousLabel: destination.label,
        nextLabel: destination.label,
        previousDestination: destination.destination,
        nextDestination: destination.destination,
        previousStatus: "draft",
        nextStatus: "draft",
        note: input.note,
        createdAt: now
      };

      this.state.revisions.push(revision);

      if (this.failAfterInitialRevisionCreate) {
        throw new Error("Injected failure after initial notification destination revision create.");
      }

      this.state.auditEvents.push({
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "notification_destination",
        subjectId: destination.id,
        action: "notification_destination.created",
        metadata: {
          destination_type: destination.type,
          label: destination.label,
          destination: destination.destination,
          status: destination.status,
          revision_id: revision.id,
          creation_key: input.creationKey
        },
        occurredAt: now
      });

      return { destination: { ...destination } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterDestinationCreate = false;
      this.failAfterInitialRevisionCreate = false;
    }
  }

  async updateNotificationDestinationTransaction(
    input: TransactionalUpdateNotificationDestinationInput
  ): Promise<UpdateNotificationDestinationTransactionResult> {
    const rollback = this.snapshot();
    const now = new Date().toISOString();
    const destinationIndex = this.state.destinations.findIndex(
      (destination) => destination.tenantId === input.tenantId && destination.id === input.destinationId
    );

    try {
      if (destinationIndex === -1) {
        throw new Error("Notification destination not found.");
      }

      const existing = this.state.destinations[destinationIndex];
      const updated: NotificationDestination = {
        ...existing,
        type: input.type,
        label: input.label,
        destination: input.destination,
        status: input.status,
        updatedAt: now
      };

      this.state.destinations[destinationIndex] = updated;

      if (this.failAfterDestinationUpdate) {
        throw new Error("Injected failure after notification destination update.");
      }

      const revision: NotificationDestinationRevision = {
        id: `notification_destination_revision_${this.state.revisions.length + 1}`,
        tenantId: input.tenantId,
        locationId: updated.locationId,
        notificationDestinationId: updated.id,
        actorUserId: input.actorUserId,
        previousType: existing.type,
        nextType: updated.type,
        previousLabel: existing.label,
        nextLabel: updated.label,
        previousDestination: existing.destination,
        nextDestination: updated.destination,
        previousStatus: existing.status,
        nextStatus: updated.status,
        note: input.note,
        createdAt: now
      };

      const auditEvent: AuditEvent = {
        id: `audit_event_${this.state.auditEvents.length + 1}`,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        subjectType: "notification_destination",
        subjectId: updated.id,
        action: "notification_destination.updated",
        metadata: {
          previous_destination_type: existing.type,
          next_destination_type: updated.type,
          previous_label: existing.label,
          next_label: updated.label,
          previous_destination: existing.destination,
          next_destination: updated.destination,
          previous_status: existing.status,
          next_status: updated.status,
          revision_id: revision.id
        },
        occurredAt: now
      };

      this.state.revisions.push(revision);
      this.state.auditEvents.push(auditEvent);

      return { destination: { ...updated } };
    } catch (error) {
      this.state = rollback;
      throw error;
    } finally {
      this.failAfterDestinationUpdate = false;
    }
  }
}
