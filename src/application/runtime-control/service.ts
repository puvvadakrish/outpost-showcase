import { tenantProcessingStates } from "@/domain/runtime-control";
import type { TenantRuntimeOperationReceipt } from "@/domain/runtime-control";
import type {
  RuntimeControlRepository,
  SetTenantRuntimeStateCommand,
} from "./ports";

const OPERATION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;

export function runtimeControlActionMessage(receipt: TenantRuntimeOperationReceipt) {
  const currentMessage = receipt.currentState === "stopped"
    ? "Background processing is stopped. Already committed work is unchanged."
    : "Protected background processing is enabled at the current pause generation.";

  return receipt.replayed ? `Request reconciled. ${currentMessage}` : currentMessage;
}

export class RuntimeControlApplicationService {
  constructor(private readonly repository: RuntimeControlRepository) {}

  async loadOwnerRuntimeControl(tenantId: string) {
    const normalizedTenantId = tenantId.trim();
    if (!normalizedTenantId) {
      throw new Error("Tenant identifier is required.");
    }

    return this.repository.loadForTenant(normalizedTenantId);
  }

  async setProcessingState(command: SetTenantRuntimeStateCommand) {
    const tenantId = command.tenantId.trim();
    const operationKey = command.operationKey.trim();
    const reason = command.reason.trim();

    if (!tenantId) throw new Error("Tenant identifier is required.");
    if (!OPERATION_KEY_PATTERN.test(operationKey)) {
      throw new Error("Runtime operation key is invalid.");
    }
    if (!tenantProcessingStates.includes(command.requestedState)) {
      throw new Error("Runtime processing state is invalid.");
    }
    if (reason.length < 3 || reason.length > 500) {
      throw new Error(
        "Runtime change reason must be between 3 and 500 characters.",
      );
    }
    if (
      command.requestedState === "enabled" &&
      (!Number.isSafeInteger(command.expectedPauseGeneration) ||
        (command.expectedPauseGeneration ?? -1) < 0)
    ) {
      throw new Error(
        "Current pause generation is required before enabling processing.",
      );
    }

    return this.repository.setProcessingState({
      ...command,
      tenantId,
      operationKey,
      reason,
      expectedPauseGeneration:
        command.requestedState === "enabled"
          ? command.expectedPauseGeneration
          : undefined,
    });
  }
}
