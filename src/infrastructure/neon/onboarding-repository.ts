import "server-only";

import type {
  BootstrapOwnerTenantCommand,
  BootstrappedOwnerTenant,
  BootstrapOwnerTenantTransactionResult,
  OnboardingRepository
} from "@/application/onboarding/ports";
import type { OutpostNeonClient } from "@/server/neon/server-client";

interface BootstrapOwnerTenantRow {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  location_id: string;
  location_name: string;
}

function mapBootstrappedTenant(row: BootstrapOwnerTenantRow): BootstrappedOwnerTenant {
  return {
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    tenantSlug: row.tenant_slug,
    locationId: row.location_id,
    locationName: row.location_name
  };
}

export class NeonOnboardingRepository implements OnboardingRepository {
  constructor(private readonly neon: OutpostNeonClient) {}

  async bootstrapOwnerTenantTransaction(
    input: BootstrapOwnerTenantCommand
  ): Promise<BootstrapOwnerTenantTransactionResult> {
    const { data, error } = await this.neon.rpc("bootstrap_owner_tenant", {
      p_owner_email: input.ownerEmail,
      p_owner_name: input.ownerName,
      p_tenant_name: input.tenantName,
      p_location_name: input.locationName,
      p_location_address: input.locationAddress,
      p_timezone: input.timezone,
      p_public_phone: input.publicPhone ?? null
    });

    if (error) {
      throw new Error(`Unable to bootstrap owner tenant: ${error.message}`);
    }

    const rows = data as unknown as BootstrapOwnerTenantRow[] | BootstrapOwnerTenantRow | null;
    const row = Array.isArray(rows) ? rows[0] : rows;

    if (!row) {
      throw new Error("Unable to bootstrap owner tenant: no tenant was returned.");
    }

    return { result: mapBootstrappedTenant(row) };
  }
}
