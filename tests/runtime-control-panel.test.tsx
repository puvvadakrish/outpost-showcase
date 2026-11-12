// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeControlPanel } from "@/components/owner/RuntimeControlPanel";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("owner runtime control panel", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.stubGlobal("crypto", {
      randomUUID: () => "00000000-0000-4000-8000-000000000301",
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("submits a stopped control as a generation-checked enable", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, message: "enabled" });
    const { container } = render(
      <RuntimeControlPanel
        control={{
          tenantId: "tenant_test",
          processingState: "stopped",
          pauseGeneration: 4,
          updatedAt: "2026-07-13T00:00:00.000Z",
        }}
        onSetRuntimeProcessingState={action}
        persistenceMode="backend"
        tenantId="tenant_test"
      />,
    );

    const button = await screen.findByRole("button", {
      name: "Enable protected processing",
    });
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(button);

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0]?.[1] as FormData;
    expect(formData.get("requestedState")).toBe("enabled");
    expect(formData.get("expectedPauseGeneration")).toBe("4");
    expect(String(formData.get("operationKey"))).toContain("runtime_");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(container.textContent).toContain("enabled");
  });

  it("offers an unconditional stop while enabled", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ ok: false, message: "stop rejected" });
    render(
      <RuntimeControlPanel
        control={{
          tenantId: "tenant_test",
          processingState: "enabled",
          pauseGeneration: 7,
          updatedAt: "2026-07-13T00:00:00.000Z",
        }}
        onSetRuntimeProcessingState={action}
        persistenceMode="backend"
        tenantId="tenant_test"
      />,
    );

    const button = await screen.findByRole("button", {
      name: "Stop background processing",
    });
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(button);

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0]?.[1] as FormData;
    expect(formData.get("requestedState")).toBe("stopped");
    expect(formData.get("expectedPauseGeneration")).toBe("");
    expect((await screen.findByRole("status")).textContent).toContain(
      "stop rejected",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps mutation controls disabled without backend authority", async () => {
    render(
      <RuntimeControlPanel
        control={{
          tenantId: "tenant_test",
          processingState: "stopped",
          pauseGeneration: 0,
          updatedAt: "2026-07-13T00:00:00.000Z",
        }}
        onSetRuntimeProcessingState={vi.fn()}
        persistenceMode="setup_required"
        tenantId="tenant_test"
      />,
    );

    const button = await screen.findByRole("button", {
      name: "Enable protected processing",
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("Backend authority is required to change processing."),
    ).toBeTruthy();
  });

  it("refreshes authoritative state after a stale-generation rejection", async () => {
    const action = vi.fn().mockResolvedValue({
      ok: false,
      message:
        "Processing state changed. Refreshing authoritative state before enabling.",
    });
    render(
      <RuntimeControlPanel
        control={{
          tenantId: "tenant_test",
          processingState: "stopped",
          pauseGeneration: 4,
          updatedAt: "2026-07-13T00:00:00.000Z",
        }}
        onSetRuntimeProcessingState={action}
        persistenceMode="backend"
        tenantId="tenant_test"
      />,
    );

    const button = await screen.findByRole("button", {
      name: "Enable protected processing",
    });
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(button);

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("resets the audit reason when authoritative state changes", async () => {
    const { rerender } = render(
      <RuntimeControlPanel
        control={{
          tenantId: "tenant_test",
          processingState: "stopped",
          pauseGeneration: 4,
          updatedAt: "2026-07-13T00:00:00.000Z",
        }}
        onSetRuntimeProcessingState={vi.fn()}
        persistenceMode="backend"
        tenantId="tenant_test"
      />,
    );
    const reason = screen.getByRole("textbox", { name: "Audit reason" });
    fireEvent.change(reason, { target: { value: "Custom enable reason" } });

    rerender(
      <RuntimeControlPanel
        control={{
          tenantId: "tenant_test",
          processingState: "enabled",
          pauseGeneration: 4,
          updatedAt: "2026-07-13T00:01:00.000Z",
        }}
        onSetRuntimeProcessingState={vi.fn()}
        persistenceMode="backend"
        tenantId="tenant_test"
      />,
    );

    await waitFor(() =>
      expect((reason as HTMLInputElement).value).toBe("Owner emergency stop"),
    );
  });
});
