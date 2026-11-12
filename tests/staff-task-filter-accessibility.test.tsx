// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { StaffTaskActionState } from "@/application/tasks/action-result";
import { StaffTaskWorkspaceClient } from "@/components/staff/StaffTaskWorkspaceClient";
import { getCustomerZeroTenant } from "@/domain/app-data";
import type { Task } from "@/domain/tasks";

const unchangedAction = async (): Promise<StaffTaskActionState> => ({
  message: "",
  ok: false,
});

const toggleGroupLabels = [
  "Task queue state counts",
  "Task workflow-stage counts",
  "Task activity trail counts",
  "Task attention counts",
  "Task source counts",
  "Task proof completion counts",
  "Task age counts",
  "Task last-touch counts",
  "Task confidence counts",
  "Task intent counts",
  "Task next-step counts",
  "Task requester contact counts",
  "Task follow-up mode counts",
  "Task member-system boundary counts",
  "Task owner-policy dependency counts",
  "Task staff action-lane counts",
  "Task channel counts",
  "Task location counts",
  "Task assignee counts",
] as const;

function renderWorkspace(tasks?: Task[], initialTaskId?: string) {
  const customerZero = getCustomerZeroTenant();

  return render(
    <StaffTaskWorkspaceClient
      authenticatedStaffUserId="user_staff_acme"
      initialTaskId={initialTaskId}
      locations={customerZero.locations}
      onAddTaskNote={unchangedAction}
      onAssignTask={unchangedAction}
      onCreateManualTask={unchangedAction}
      onUpdateTaskStatus={unchangedAction}
      persistenceMode="local"
      seed={{ tasks: tasks ?? customerZero.tasks, taskEvents: customerZero.taskEvents }}
      tenant={customerZero.tenant}
      users={customerZero.users}
    />,
  );
}

function toggleGroup(container: HTMLElement, label: string) {
  const group = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  expect(group, `${label} should render`).not.toBeNull();
  return group!;
}

function buttonStartingWith(group: HTMLElement, label: string) {
  const button = [...group.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.trim().startsWith(label),
  );
  expect(button, `${label} toggle should render`).toBeTruthy();
  return button!;
}

describe("staff task filter accessibility", () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(() => cleanup());

  it("exposes pressed state on every persistent summary-filter group", () => {
    const { container } = renderWorkspace();

    for (const label of toggleGroupLabels) {
      const buttons = toggleGroup(container, label).querySelectorAll("button");
      expect(buttons.length, `${label} should contain toggles`).toBeGreaterThan(0);
      for (const button of buttons) {
        expect(["false", "true"], button.textContent ?? label).toContain(
          button.getAttribute("aria-pressed"),
        );
      }
      expect([...buttons].filter((button) => button.getAttribute("aria-pressed") === "true"))
        .toHaveLength(label === "Task queue state counts" ? 1 : 0);
    }
  });

  it("tracks basic, advanced, grouped, and composed filter state", () => {
    const customerZero = getCustomerZeroTenant();
    const extraTasks = Array.from({ length: 7 }, (_, index): Task => ({
      ...customerZero.tasks[0],
      id: `task_accessibility_${index}`,
      intent: `Accessibility intent ${index}`,
      requesterName: `Requester ${index}`,
      suggestedNextStep: `Accessibility next step ${index}`,
    }));
    const { container } = renderWorkspace(extraTasks);

    const open = buttonStartingWith(
      toggleGroup(container, "Task queue state counts"),
      "Open",
    );
    fireEvent.click(open);
    expect(open.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(open);
    expect(open.getAttribute("aria-pressed")).toBe("false");

    const workflow = buttonStartingWith(
      toggleGroup(container, "Task workflow-stage counts"),
      "Ready for staff",
    );
    fireEvent.click(workflow);
    expect(workflow.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(workflow);
    expect(workflow.getAttribute("aria-pressed")).toBe("false");

    const otherIntents = buttonStartingWith(
      toggleGroup(container, "Task intent counts"),
      "Other intents",
    );
    const otherNextSteps = buttonStartingWith(
      toggleGroup(container, "Task next-step counts"),
      "Other next steps",
    );
    expect(otherIntents.getAttribute("aria-pressed")).toBe("false");
    expect(otherNextSteps.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(otherIntents);
    expect(otherIntents.getAttribute("aria-pressed")).toBe("true");
    expect(otherNextSteps.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(otherNextSteps);
    expect(otherIntents.getAttribute("aria-pressed")).toBe("true");
    expect(otherNextSteps.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Showing 2 of 7 tasks")).toBeTruthy();

    const composedToggles: HTMLButtonElement[] = [];
    for (const groupLabel of [
      "Task channel counts",
      "Task location counts",
      "Task assignee counts",
    ] as const) {
      const toggle = [...toggleGroup(container, groupLabel).querySelectorAll("button")].find(
        (button) => !button.hasAttribute("disabled"),
      );
      expect(toggle, `${groupLabel} should have an enabled toggle`).toBeTruthy();
      fireEvent.click(toggle!);
      expect(toggle!.getAttribute("aria-pressed")).toBe("true");
      composedToggles.push(toggle!);
      expect(otherIntents.getAttribute("aria-pressed")).toBe("true");
      expect(otherNextSteps.getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByText("Showing 2 of 7 tasks")).toBeTruthy();
    }

    fireEvent.click(composedToggles[0]);
    expect(composedToggles[0].getAttribute("aria-pressed")).toBe("false");
    expect(composedToggles[1].getAttribute("aria-pressed")).toBe("true");
    expect(composedToggles[2].getAttribute("aria-pressed")).toBe("true");
    expect(otherIntents.getAttribute("aria-pressed")).toBe("true");
    expect(otherNextSteps.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(otherIntents);
    expect(otherIntents.getAttribute("aria-pressed")).toBe("false");
    expect(otherNextSteps.getAttribute("aria-pressed")).toBe("true");
    expect(composedToggles[1].getAttribute("aria-pressed")).toBe("true");
    expect(composedToggles[2].getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(otherNextSteps);
    expect(otherNextSteps.getAttribute("aria-pressed")).toBe("false");
    for (const toggle of composedToggles.slice(1)) {
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-pressed")).toBe("false");
    }
    expect(screen.getByText("Showing 7 of 7 tasks")).toBeTruthy();
  });

  it("keeps a grouped filter pressed when its selected value is rebucketed", async () => {
    const customerZero = getCustomerZeroTenant();
    const regroupedTasks = Array.from({ length: 7 }, (_, index): Task => ({
      ...customerZero.tasks[0],
      id: `task_regrouped_${index}`,
      intent: `Regrouped intent ${index}`,
      requesterName: `Requester ${index}`,
      status: index === 0 ? "in_progress" : "new",
      suggestedNextStep: `Regrouped next step ${index}`,
    }));
    const { container } = renderWorkspace(regroupedTasks, regroupedTasks[0].id);
    const selectedIntent = buttonStartingWith(
      toggleGroup(container, "Task intent counts"),
      "Regrouped intent 0",
    );
    const selectedNextStep = buttonStartingWith(
      toggleGroup(container, "Task next-step counts"),
      "Regrouped next step 0",
    );

    fireEvent.click(selectedIntent);
    fireEvent.click(selectedNextStep);
    expect(selectedIntent.getAttribute("aria-pressed")).toBe("true");
    expect(selectedNextStep.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Showing 1 of 7 tasks")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));

    const otherIntents = await waitFor(() => {
      const button = buttonStartingWith(
        toggleGroup(container, "Task intent counts"),
        "Other intents",
      );
      expect(button.getAttribute("aria-pressed")).toBe("true");
      return button;
    });
    const otherNextSteps = buttonStartingWith(
      toggleGroup(container, "Task next-step counts"),
      "Other next steps",
    );
    expect(otherNextSteps.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Showing 2 of 7 tasks")).toBeTruthy();

    fireEvent.click(otherIntents);
    expect(otherIntents.getAttribute("aria-pressed")).toBe("false");
    expect(otherNextSteps.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(otherNextSteps);
    expect(otherNextSteps.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Showing 7 of 7 tasks")).toBeTruthy();
  });

  it("keeps an active zero-result queue toggle available to clear", async () => {
    const customerZero = getCustomerZeroTenant();
    const onlyTask: Task = {
      ...customerZero.tasks.find((task) => task.id === "task_new_tour")!,
      status: "in_progress",
    };
    const { container } = renderWorkspace([onlyTask], onlyTask.id);
    const open = buttonStartingWith(
      toggleGroup(container, "Task queue state counts"),
      "Open",
    );

    fireEvent.click(open);
    expect(open.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getAllByRole("button", { name: "Mark done" })[0]);

    await waitFor(() => expect(open.textContent).toContain("0"));
    expect(open.getAttribute("aria-pressed")).toBe("true");
    expect(open.hasAttribute("disabled")).toBe(false);
    fireEvent.click(open);
    expect(open.getAttribute("aria-pressed")).toBe("false");
    expect(within(screen.getByLabelText("Task filters")).getByText("Showing 1 of 1 tasks")).toBeTruthy();
  });
});
