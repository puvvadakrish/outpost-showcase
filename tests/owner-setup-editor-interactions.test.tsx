// @vitest-environment jsdom

import { act } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationProfileEditor } from "@/components/owner/LocationProfileEditor";
import { HandoffRulesEditor } from "@/components/owner/HandoffRulesEditor";
import type { OwnerSetupActionState } from "@/application/owner-setup/action-result";
import type { Location } from "@/domain/tenancy";

const location: Location = {
  id: "location_primary",
  tenantId: "tenant_test",
  name: "Primary gym",
  address: "100 Main Street",
  timezone: "America/Chicago",
  status: "draft"
};

function successfulNoopAction(
  _previousState: OwnerSetupActionState,
  _formData: FormData
) {
  return Promise.resolve({ ok: true, message: "saved", targetId: location.id });
}

describe("owner setup editor interactions", () => {
  let uuidSequence: number;

  beforeEach(() => {
    uuidSequence = 0;
    vi.stubGlobal("crypto", {
      randomUUID: () => `00000000-0000-4000-8000-${String(++uuidSequence).padStart(12, "0")}`
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("locks a pending create and preserves its key and fields after failure", async () => {
    let settleCreate: ((state: OwnerSetupActionState) => void) | undefined;
    const onCreate = vi.fn(
      () =>
        new Promise<OwnerSetupActionState>((resolve) => {
          settleCreate = resolve;
        })
    );

    const { container } = render(
      <LocationProfileEditor
        includedLocations={2}
        locations={[location]}
        onCreateLocationDraft={onCreate}
        onUpdateLocationProfile={successfulNoopAction}
        persistenceMode="backend"
        tenantId="tenant_test"
      />
    );

    const createForm = container.querySelector<HTMLFormElement>("form.location-create-form")!;
    const name = within(createForm).getByLabelText("Name");
    const address = within(createForm).getByLabelText("Address");
    const creationKey = createForm.querySelector<HTMLInputElement>('input[name="creationKey"]')!;

    await waitFor(() => expect(creationKey.value).toContain("location_"));
    const submittedKey = creationKey.value;
    fireEvent.change(name, { target: { value: "North gym" } });
    fireEvent.change(address, { target: { value: "200 North Street" } });
    fireEvent.submit(createForm);

    await waitFor(() =>
      expect(createForm.querySelector("fieldset")?.hasAttribute("disabled")).toBe(true)
    );

    await act(async () => {
      settleCreate?.({ ok: false, message: "Location allowance reached." });
    });

    await waitFor(() => expect(screen.getByText("Location allowance reached.")).toBeTruthy());
    expect((name as HTMLInputElement).value).toBe("North gym");
    expect((address as HTMLInputElement).value).toBe("200 North Street");
    expect(creationKey.value).toBe(submittedKey);
  });

  it("clears a successful create and rotates its idempotency key", async () => {
    const onCreate = vi.fn().mockResolvedValue({ ok: true, message: "created" });
    const { container } = render(
      <LocationProfileEditor
        includedLocations={2}
        locations={[location]}
        onCreateLocationDraft={onCreate}
        onUpdateLocationProfile={successfulNoopAction}
        persistenceMode="backend"
        tenantId="tenant_test"
      />
    );
    const createForm = container.querySelector<HTMLFormElement>("form.location-create-form")!;
    const name = within(createForm).getByLabelText("Name") as HTMLInputElement;
    const address = within(createForm).getByLabelText("Address") as HTMLInputElement;
    const creationKey = createForm.querySelector<HTMLInputElement>('input[name="creationKey"]')!;

    await waitFor(() => expect(creationKey.value).toContain("location_"));
    const submittedKey = creationKey.value;
    fireEvent.change(name, { target: { value: "North gym" } });
    fireEvent.change(address, { target: { value: "200 North Street" } });
    fireEvent.submit(createForm);

    await waitFor(() => expect(name.value).toBe(""));
    expect(address.value).toBe("");
    expect(creationKey.value).not.toBe(submittedKey);
  });

  it("renders existing-row save feedback beside its target", async () => {
    const onUpdate = vi.fn().mockResolvedValue({
      ok: false,
      message: "Location update was rejected.",
      targetId: location.id
    });
    render(
      <LocationProfileEditor
        includedLocations={2}
        locations={[location]}
        onCreateLocationDraft={vi.fn()}
        onUpdateLocationProfile={onUpdate}
        persistenceMode="backend"
        tenantId="tenant_test"
      />
    );

    const row = screen.getByText("Primary gym").closest("article")!;
    fireEvent.click(within(row).getByRole("button", { name: "Save location" }));

    await waitFor(() =>
      expect(within(row).getByText("Location update was rejected.")).toBeTruthy()
    );
  });

  it("does not offer browser-only removal for a persisted draft", () => {
    render(
      <HandoffRulesEditor
        locations={[location]}
        onAddDraftRule={vi.fn()}
        onCreateHandoffRuleDraft={successfulNoopAction}
        onRemoveDraftRule={vi.fn()}
        onRulesChange={vi.fn()}
        onUpdateHandoffRule={successfulNoopAction}
        persistenceMode="backend"
        rules={[
          {
            id: "server_rule",
            tenantId: "tenant_test",
            trigger: "topic",
            topic: "Persisted draft",
            action: "create_task",
            destination: "front desk queue",
            activeWindow: "always",
            priority: 50,
            status: "draft"
          }
        ]}
        tenantId="tenant_test"
      />
    );

    expect(screen.queryByRole("button", { name: "Remove draft" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save rule" })).toBeTruthy();
  });
});
