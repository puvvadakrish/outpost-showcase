import "server-only";

import type { NotificationDestination } from "@/domain/notifications";
import type {
  CreateNotificationDestinationDraftTransactionResult,
  NotificationDestinationRepository,
  TransactionalCreateNotificationDestinationDraftInput,
  TransactionalUpdateNotificationDestinationInput,
  UpdateNotificationDestinationTransactionResult
} from "@/application/notification-destinations/ports";
import type { OutpostNeonClient } from "@/server/neon/server-client";

interface NotificationDestinationRow {
  id: string;
  creation_key: string | null;
  tenant_id: string;
  location_id: string | null;
  destination_type: NotificationDestination["type"];
  label: string;
  destination: string;
  status: NotificationDestination["status"];
  updated_at: string;
}

function mapNotificationDestination(row: NotificationDestinationRow): NotificationDestination {
  return {
    id: row.id,
    creationKey: row.creation_key ?? undefined,
    tenantId: row.tenant_id,
    locationId: row.location_id ?? undefined,
    type: row.destination_type,
    label: row.label,
    destination: row.destination,
    status: row.status,
    updatedAt: row.updated_at
  };
}

export class NeonNotificationDestinationRepository implements NotificationDestinationRepository {
  constructor(private readonly neon: OutpostNeonClient) {}

  async listForOwnerTenant(tenantId: string) {
    const { data, error } = await this.neon
      .from("notification_destinations")
      .select("id, tenant_id, location_id, destination_type, label, destination, status, creation_key, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to load owner notification destinations: ${error.message}`);
    }

    return ((data ?? []) as unknown as NotificationDestinationRow[]).map(mapNotificationDestination);
  }

  async createNotificationDestinationDraftTransaction(
    input: TransactionalCreateNotificationDestinationDraftInput
  ): Promise<CreateNotificationDestinationDraftTransactionResult> {
    // The RPC generates IDs, derives actor identity, and fixes status to draft.
    const { data, error } = await this.neon.rpc("create_notification_destination_draft", {
      p_tenant_id: input.tenantId,
      p_location_id: input.locationId ?? null,
      p_creation_key: input.creationKey,
      p_destination_type: input.type,
      p_label: input.label,
      p_destination: input.destination,
      p_note: input.note
    });

    if (error) {
      throw new Error(`Unable to create notification destination draft: ${error.message}`);
    }

    if (!data) {
      throw new Error("Unable to create notification destination draft: RPC returned no destination.");
    }

    return { destination: mapNotificationDestination(data as unknown as NotificationDestinationRow) };
  }

  async updateNotificationDestinationTransaction(
    input: TransactionalUpdateNotificationDestinationInput
  ): Promise<UpdateNotificationDestinationTransactionResult> {
    const { data, error } = await this.neon.rpc("update_notification_destination", {
      p_tenant_id: input.tenantId,
      p_notification_destination_id: input.destinationId,
      p_destination_type: input.type,
      p_label: input.label,
      p_destination: input.destination,
      p_status: input.status,
      p_note: input.note
    });

    if (error) {
      throw new Error(`Unable to update notification destination: ${error.message}`);
    }

    return { destination: mapNotificationDestination(data as unknown as NotificationDestinationRow) };
  }
}
