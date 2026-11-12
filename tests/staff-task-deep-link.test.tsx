import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StaffTaskWorkspaceClient } from "@/components/staff/StaffTaskWorkspaceClient";
import { getCustomerZeroTenant } from "@/domain/app-data";
import type { StaffTaskActionState } from "@/application/tasks/action-result";

const unchangedAction = async (): Promise<StaffTaskActionState> => ({
  message: "",
  ok: false
});

function renderWorkspace(initialTaskId?: string) {
  const { locations, tasks, taskEvents, tenant, users } = getCustomerZeroTenant();

  return renderToStaticMarkup(
    <StaffTaskWorkspaceClient
      authenticatedStaffUserId="user_staff_acme"
      initialTaskId={initialTaskId}
      locations={locations}
      onAddTaskNote={unchangedAction}
      onAssignTask={unchangedAction}
      onCreateManualTask={unchangedAction}
      onUpdateTaskStatus={unchangedAction}
      persistenceMode="local"
      seed={{ tasks, taskEvents }}
      tenant={tenant}
      users={users}
    />
  );
}

describe("staff task deep-link selection", () => {
  it("renders the requested tenant task as selected", () => {
    const rendered = renderWorkspace("task_done_hours");

    expect(rendered).toContain('<aside class="panel task-detail-panel"');
    expect(rendered).toContain("<h2>Morgan Chen</h2>");
    expect(rendered).toContain("Copy task link");
    expect(rendered).toContain("Copy contact");
  });

  it("exposes manual intake as a browser-local rehearsal", () => {
    const rendered = renderWorkspace();

    expect(rendered).toContain("Browser local");
    expect(rendered).toContain("Create staff task");
    expect(rendered).toContain("Create task");
    expect(rendered).toContain("0/160");
    expect(rendered).toContain("0/1200");
    expect(rendered).toContain('class="mini-button quiet" disabled="" type="button">Clear draft</button>');
  });

  it("renders shared clipboard feedback for selected task values", () => {
    const rendered = renderWorkspace("task_new_tour");

    expect(rendered).toContain("task-detail-requester-contact");
    expect(rendered).toContain("Copy contact");
    expect(rendered).toContain('aria-live="polite"');
    expect(rendered).toContain("task-copy-feedback");
    expect(rendered).toContain("Copy next step");
    expect(rendered).toContain("Copy task brief");
  });

  it("renders the normal inbox default for unknown task ids", () => {
    const rendered = renderWorkspace("task_other_tenant");

    expect(rendered).toContain("<h2>Jordan Lee</h2>");
    expect(rendered).not.toContain("task_other_tenant");
  });

  it("offers Claim task only for the selected unassigned task", () => {
    expect(renderWorkspace()).toContain("Claim task");
    expect(renderWorkspace("task_new_tour")).not.toContain("Claim task");
  });

  it("offers Release task only for work assigned to the current staff member", () => {
    expect(renderWorkspace("task_new_tour")).toContain("Release task");
    expect(renderWorkspace()).not.toContain("Release task");
    expect(renderWorkspace("task_in_progress_callback")).not.toContain("Release task");
  });

  it("offers Start work only for eligible work assigned to the current staff member", () => {
    expect(renderWorkspace("task_new_tour")).toContain("Start work");
    expect(renderWorkspace()).not.toContain("Start work");
    expect(renderWorkspace("task_in_progress_callback")).not.toContain("Start work");
  });

  it("offers Mark needs human only for active work assigned to current staff", () => {
    const { locations, tasks, taskEvents, tenant, users } = getCustomerZeroTenant();
    const activeStaffTasks = tasks.map((task) =>
      task.id === "task_new_tour" ? { ...task, status: "in_progress" as const } : task
    );
    const rendered = renderToStaticMarkup(
      <StaffTaskWorkspaceClient
        authenticatedStaffUserId="user_staff_acme"
        initialTaskId="task_new_tour"
        locations={locations}
        onAddTaskNote={unchangedAction}
        onAssignTask={unchangedAction}
        onCreateManualTask={unchangedAction}
        onUpdateTaskStatus={unchangedAction}
        persistenceMode="local"
        seed={{ tasks: activeStaffTasks, taskEvents }}
        tenant={tenant}
        users={users}
      />
    );

    expect(rendered).toContain("Mark needs human");
    expect(renderWorkspace("task_new_tour")).not.toContain("Mark needs human");
    expect(renderWorkspace("task_in_progress_callback")).not.toContain("Mark needs human");
  });

  it("offers Reopen task only for selected terminal work", () => {
    expect(renderWorkspace("task_done_hours")).toContain("Reopen task");
    expect(renderWorkspace("task_ignored_duplicate")).toContain("Reopen task");
    expect(renderWorkspace("task_new_tour")).not.toContain("Reopen task");
  });

  it("offers Mark done only for active work assigned to current staff", () => {
    const { locations, tasks, taskEvents, tenant, users } = getCustomerZeroTenant();
    const currentStaffActive = tasks.map((task) =>
      task.id === "task_new_tour" ? { ...task, status: "in_progress" as const } : task
    );
    const rendered = renderToStaticMarkup(
      <StaffTaskWorkspaceClient authenticatedStaffUserId="user_staff_acme" initialTaskId="task_new_tour"
        locations={locations} onAddTaskNote={unchangedAction} onAssignTask={unchangedAction}
        onCreateManualTask={unchangedAction} onUpdateTaskStatus={unchangedAction}
        persistenceMode="local" seed={{ tasks: currentStaffActive, taskEvents }} tenant={tenant} users={users} />
    );
    expect(rendered).toContain("Mark done");
    expect(renderWorkspace("task_in_progress_callback")).not.toContain("Mark done");
  });

  it("renders the current staff member's open-work shortcut", () => {
    const rendered = renderWorkspace();

    expect(rendered).toContain("My open work");
    expect(rendered).toContain("1 total");
    expect(rendered).toContain('aria-pressed="false"');
  });

  it("shows the selected task position in the visible queue", () => {
    const rendered = renderWorkspace();

    expect(rendered).toContain("1 of 5 in view");
    expect(rendered).toContain("task-detail-queue-position");
  });

  it("renders bounded visible-queue navigation", () => {
    const firstTask = renderWorkspace();
    const middleTask = renderWorkspace("task_in_progress_callback");

    expect(firstTask).toContain('aria-label="Visible task navigation"');
    expect(firstTask).toContain("Previous task");
    expect(firstTask).toContain("Next task");
    expect(firstTask).toContain(
      '<button class="mini-button quiet" disabled="" type="button">Previous task</button>'
    );
    expect(middleTask).not.toContain(
      '<button class="mini-button quiet" disabled="" type="button">Previous task</button>'
    );
    expect(middleTask).not.toContain(
      '<button class="mini-button quiet" disabled="" type="button">Next task</button>'
    );
  });

  it("links task detail back to the single selected workboard row", () => {
    const rendered = renderWorkspace("task_in_progress_callback");

    expect(rendered).toContain('href="#selected-workboard-task"');
    expect(rendered).toContain("Back to selected row");
    expect(rendered.match(/id="selected-workboard-task"/gu)).toHaveLength(1);
  });

  it("renders the current staff member's active-work shortcut", () => {
    const rendered = renderWorkspace();

    expect(rendered).toContain("My active work");
    expect(rendered).toContain("1 open");
    expect(rendered).toContain("task-my-active-work");
  });

  it("renders the current staff member's ready-work shortcut", () => {
    const rendered = renderWorkspace();

    expect(rendered).toContain("My ready work");
    expect(rendered).toContain("task-my-ready-work");
    expect(rendered).toContain(
      'class="task-queue-state-summary-item task-my-ready-work" type="button"><span>My ready work</span><span class="task-queue-state-summary-count"><strong>1</strong>'
    );
  });

  it("renders the current staff member's completed-work shortcut", () => {
    const rendered = renderWorkspace();

    expect(rendered).toContain("My completed work");
    expect(rendered).toContain("task-my-completed-work");
    expect(rendered).toContain(
      'class="task-queue-state-summary-item task-my-completed-work" disabled="" type="button"><span>My completed work</span><span class="task-queue-state-summary-count"><strong>0</strong>'
    );
  });

  it("renders the current staff member's ignored-work shortcut", () => {
    const rendered = renderWorkspace();

    expect(rendered).toContain("My ignored work");
    expect(rendered).toContain("task-my-ignored-work");
    expect(rendered).toContain(
      'class="task-queue-state-summary-item task-my-ignored-work" disabled="" type="button"><span>My ignored work</span><span class="task-queue-state-summary-count"><strong>0</strong>'
    );
  });

  it("renders the current staff member's submitted-work shortcut", () => {
    const rendered = renderWorkspace();

    expect(rendered).toContain("My submitted work");
    expect(rendered).toContain("task-my-submitted-work");
    expect(rendered).toContain(
      'class="task-queue-state-summary-item task-my-submitted-work" disabled="" type="button"><span>My submitted work</span>'
    );
  });

  it("keeps secondary queue insights in a closed native disclosure", () => {
    const rendered = renderWorkspace();

    expect(rendered).toContain('<details class="task-advanced-filter-disclosure">');
    expect(rendered).toContain(
      '<summary class="task-advanced-filter-summary"><span class="task-advanced-filter-summary-copy"><span>Advanced filters</span><small>0 active</small>'
    );
    expect(rendered).not.toContain(
      '<details class="task-advanced-filter-disclosure" open=""'
    );
    expect(rendered.indexOf("Advanced filters")).toBeLessThan(
      rendered.indexOf('aria-label="Task workflow-stage counts"')
    );
    expect(rendered.indexOf('aria-label="Task assignee counts"')).toBeLessThan(
      rendered.indexOf("</details>")
    );
    expect(rendered).toContain(
      '<button class="mini-button quiet" disabled="" type="button">Clear advanced</button>'
    );
    expect(rendered.indexOf("</summary>")).toBeLessThan(
      rendered.indexOf("Clear advanced")
    );
  });

  it("renders the current staff member's needs-human shortcut", () => {
    const { locations, tasks, taskEvents, tenant, users } = getCustomerZeroTenant();
    const needsHumanStaffTasks = tasks.map((task) =>
      task.id === "task_new_tour" ? { ...task, status: "needs_human" as const } : task
    );
    const rendered = renderToStaticMarkup(
      <StaffTaskWorkspaceClient
        authenticatedStaffUserId="user_staff_acme"
        locations={locations}
        onAddTaskNote={unchangedAction}
        onAssignTask={unchangedAction}
        onCreateManualTask={unchangedAction}
        onUpdateTaskStatus={unchangedAction}
        persistenceMode="local"
        seed={{ tasks: needsHumanStaffTasks, taskEvents }}
        tenant={tenant}
        users={users}
      />
    );

    expect(rendered).toContain("My needs help");
    expect(rendered).toContain("task-my-needs-human");
    expect(rendered).toContain(
      'class="task-queue-state-summary-item task-my-needs-human" type="button"><span>My needs help</span><span class="task-queue-state-summary-count"><strong>1</strong>'
    );
  });

  it("uses the authenticated internal member identity in backend mode", () => {
    const { locations, tasks, taskEvents, tenant, users } = getCustomerZeroTenant();
    const backendTasks = tasks.map((task, index) =>
      index === 0 ? { ...task, assigneeUserId: "user_owner_acme" } : task
    );

    const rendered = renderToStaticMarkup(
      <StaffTaskWorkspaceClient
        authenticatedStaffUserId="user_owner_acme"
        locations={locations}
        onAddTaskNote={unchangedAction}
        onAssignTask={unchangedAction}
        onCreateManualTask={unchangedAction}
        onUpdateTaskStatus={unchangedAction}
        persistenceMode="backend"
        seed={{ tasks: backendTasks, taskEvents }}
        tenant={tenant}
        users={users}
      />
    );

    expect(rendered).toContain("My open work");
    expect(rendered).toContain("2 total");
  });
});
