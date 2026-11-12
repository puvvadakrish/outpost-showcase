import type {
  TenantProcessingState,
  TenantRuntimeControl,
  TenantRuntimeOperationReceipt,
} from "@/domain/runtime-control";

export interface SetTenantRuntimeStateCommand {
  tenantId: string;
  operationKey: string;
  requestedState: TenantProcessingState;
  expectedPauseGeneration?: number;
  reason: string;
}

export interface RuntimeControlRepository {
  loadForTenant(tenantId: string): Promise<TenantRuntimeControl | undefined>;
  setProcessingState(
    command: SetTenantRuntimeStateCommand,
  ): Promise<TenantRuntimeOperationReceipt>;
}
