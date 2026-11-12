import { describe, expect, it, vi } from "vitest";
import type {
  RuntimeControlRepository,
  SetTenantRuntimeStateCommand,
} from "@/application/runtime-control/ports";
import { RuntimeControlApplicationService } from "@/application/runtime-control/service";
import { runtimeControlActionMessage } from "@/application/runtime-control/service";

function repository(): RuntimeControlRepository {
  return {
    loadForTenant: vi.fn().mockResolvedValue({
      tenantId: "tenant_test",
      processingState: "stopped",
      pauseGeneration: 3,
      updatedAt: "2026-07-13T00:00:00.000Z",
    }),
    setProcessingState: vi.fn(
      async (command: SetTenantRuntimeStateCommand) => ({
        operationId: "runtime_operation_1",
        tenantId: command.tenantId,
      previousState: "stopped" as const,
        resultingState: command.requestedState,
        previousPauseGeneration: 3,
        resultingPauseGeneration: 3,
        currentState: command.requestedState,
        currentPauseGeneration: 3,
        replayed: false,
        createdAt: "2026-07-13T00:00:00.000Z",
      }),
    ),
  };
}

describe("runtime control application service", () => {
  it("reports current authority when an older operation is replayed", () => {
    expect(runtimeControlActionMessage({
      operationId: "runtime_operation_1",
      tenantId: "tenant_test",
      previousState: "stopped",
      resultingState: "enabled",
      previousPauseGeneration: 3,
      resultingPauseGeneration: 3,
      currentState: "stopped",
      currentPauseGeneration: 4,
      replayed: true,
      createdAt: "2026-07-13T00:00:00.000Z",
    })).toBe(
      "Request reconciled. Background processing is stopped. Already committed work is unchanged.",
    );
  });

  it("normalizes and forwards a generation-checked enable", async () => {
    const port = repository();
    const service = new RuntimeControlApplicationService(port);

    await expect(
      service.setProcessingState({
        tenantId: " tenant_test ",
        operationKey: " runtime-enable-001 ",
        requestedState: "enabled",
        expectedPauseGeneration: 3,
        reason: " Protected rehearsal ",
      }),
    ).resolves.toMatchObject({
      resultingState: "enabled",
      currentPauseGeneration: 3,
    });
    expect(port.setProcessingState).toHaveBeenCalledWith({
      tenantId: "tenant_test",
      operationKey: "runtime-enable-001",
      requestedState: "enabled",
      expectedPauseGeneration: 3,
      reason: "Protected rehearsal",
    });
  });

  it("requires a current generation only for enable", async () => {
    const service = new RuntimeControlApplicationService(repository());

    await expect(
      service.setProcessingState({
        tenantId: "tenant_test",
        operationKey: "runtime-enable-001",
        requestedState: "enabled",
        reason: "Protected rehearsal",
      }),
    ).rejects.toThrow("Current pause generation");

    await expect(
      service.setProcessingState({
        tenantId: "tenant_test",
        operationKey: "runtime-stop-001",
        requestedState: "stopped",
        expectedPauseGeneration: 99,
        reason: "Emergency stop",
      }),
    ).resolves.toMatchObject({ resultingState: "stopped" });
  });

  it("rejects malformed commands before persistence", async () => {
    const service = new RuntimeControlApplicationService(repository());

    await expect(
      service.setProcessingState({
        tenantId: "tenant_test",
        operationKey: "short",
        requestedState: "stopped",
        reason: "Emergency stop",
      }),
    ).rejects.toThrow("operation key is invalid");
    await expect(
      service.setProcessingState({
        tenantId: "tenant_test",
        operationKey: "runtime-stop-001",
        requestedState: "invalid" as never,
        reason: "Emergency stop",
      }),
    ).rejects.toThrow("state is invalid");
  });
});
