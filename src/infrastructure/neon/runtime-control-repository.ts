import "server-only";

import type {
  RuntimeControlRepository,
  SetTenantRuntimeStateCommand,
} from "@/application/runtime-control/ports";
import type {
  TenantRuntimeControl,
  TenantRuntimeOperationReceipt,
} from "@/domain/runtime-control";
import type { OutpostNeonClient } from "@/server/neon/server-client";

interface RuntimeControlRow {
  tenant_id: string;
  processing_state: TenantRuntimeControl["processingState"];
  pause_generation: number;
  updated_at: string;
}

function mapControl(row: RuntimeControlRow): TenantRuntimeControl {
  return {
    tenantId: row.tenant_id,
    processingState: row.processing_state,
    pauseGeneration: Number(row.pause_generation),
    updatedAt: row.updated_at,
  };
}

export class NeonRuntimeControlRepository implements RuntimeControlRepository {
  constructor(private readonly neon: OutpostNeonClient) {}

  async loadForTenant(tenantId: string) {
    const { data, error } = await this.neon
      .from("tenant_runtime_controls")
      .select("tenant_id, processing_state, pause_generation, updated_at")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to load tenant runtime control: ${error.message}`,
      );
    }

    return data ? mapControl(data as unknown as RuntimeControlRow) : undefined;
  }

  async setProcessingState(command: SetTenantRuntimeStateCommand) {
    const { data, error } = await this.neon.rpc(
      "set_tenant_runtime_processing_state",
      {
        p_tenant_id: command.tenantId,
        p_operation_key: command.operationKey,
        p_requested_state: command.requestedState,
        p_expected_pause_generation: command.expectedPauseGeneration ?? null,
        p_reason: command.reason,
      },
    );

    if (error) {
      throw new Error(
        `Unable to change tenant runtime processing: ${error.message}`,
      );
    }

    return data as unknown as TenantRuntimeOperationReceipt;
  }
}
