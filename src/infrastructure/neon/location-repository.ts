import "server-only";

import type {
  CreateLocationDraftTransactionResult,
  LocationRepository,
  TransactionalCreateLocationDraftInput,
  TransactionalUpdateLocationProfileInput,
  UpdateLocationProfileTransactionResult
} from "@/application/locations/ports";
import type { Location } from "@/domain/tenancy";
import type { OutpostNeonClient } from "@/server/neon/server-client";

interface LocationRow {
  id: string;
  tenant_id: string;
  name: string;
  address: string;
  public_phone: string | null;
  routing_phone: string | null;
  timezone: string;
  status: Location["status"];
  updated_at: string;
}

function mapLocation(row: LocationRow): Location {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    address: row.address,
    publicPhone: row.public_phone ?? undefined,
    routingPhone: row.routing_phone ?? undefined,
    timezone: row.timezone,
    status: row.status,
    updatedAt: row.updated_at
  };
}

export class NeonLocationRepository implements LocationRepository {
  constructor(private readonly neon: OutpostNeonClient) {}

  async listForOwnerTenant(tenantId: string) {
    const { data, error } = await this.neon
      .from("locations")
      .select("id, tenant_id, name, address, public_phone, routing_phone, timezone, status, updated_at")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Unable to load owner locations: ${error.message}`);
    }

    return ((data ?? []) as unknown as LocationRow[]).map(mapLocation);
  }

  async updateLocationProfileTransaction(
    input: TransactionalUpdateLocationProfileInput
  ): Promise<UpdateLocationProfileTransactionResult> {
    // The RPC derives actor identity from auth.uid(); do not forward client-provided actor ids.
    const { data, error } = await this.neon.rpc("update_location_profile", {
      p_tenant_id: input.tenantId,
      p_location_id: input.locationId,
      p_name: input.name,
      p_address: input.address,
      p_public_phone: input.publicPhone ?? null,
      p_routing_phone: input.routingPhone ?? null,
      p_timezone: input.timezone,
      p_status: input.status,
      p_note: input.note
    });

    if (error) {
      throw new Error(`Unable to update location profile: ${error.message}`);
    }

    return { location: mapLocation(data as unknown as LocationRow) };
  }

  async createLocationDraftTransaction(
    input: TransactionalCreateLocationDraftInput
  ): Promise<CreateLocationDraftTransactionResult> {
    const { data, error } = await this.neon.rpc("create_additional_location_draft", {
      p_tenant_id: input.tenantId,
      p_creation_key: input.creationKey,
      p_name: input.name,
      p_address: input.address,
      p_public_phone: input.publicPhone ?? null,
      p_routing_phone: input.routingPhone ?? null,
      p_timezone: input.timezone,
      p_note: input.note
    });

    if (error) {
      throw new Error(`Unable to create location draft: ${error.message}`);
    }
    return { location: mapLocation(data as unknown as LocationRow) };
  }
}
