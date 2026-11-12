// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OwnerSetupActionState } from "@/application/owner-setup/action-result";
import { OwnerOnboardingBootstrapForm } from "@/components/owner/OwnerOnboardingBootstrapForm";

describe("action-result accessibility", () => {
  afterEach(() => cleanup());

  it.each([
    [true, "Owner workspace created."],
    [false, "Owner workspace could not be created."],
  ])("announces one %s asynchronous result without changing its copy", async (ok, message) => {
    const action = vi.fn(
      async (): Promise<OwnerSetupActionState> => ({ ok, message }),
    );
    const { container } = render(
      <OwnerOnboardingBootstrapForm action={action} ownerEmail="owner@example.com" />,
    );

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(message));
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").className).toContain(ok ? "success" : "error");
  });
});
