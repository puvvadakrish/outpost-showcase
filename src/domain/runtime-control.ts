export const tenantProcessingStates = ["stopped", "enabled"] as const;

export type TenantProcessingState = (typeof tenantProcessingStates)[number];

export interface TenantRuntimeControl {
  tenantId: string;
  processingState: TenantProcessingState;
  pauseGeneration: number;
  updatedAt: string;
}

export interface TenantRuntimeOperationReceipt {
  operationId: string;
  tenantId: string;
  previousState: TenantProcessingState;
  resultingState: TenantProcessingState;
  previousPauseGeneration: number;
  resultingPauseGeneration: number;
  currentState: TenantProcessingState;
  currentPauseGeneration: number;
  replayed: boolean;
  createdAt: string;
}
