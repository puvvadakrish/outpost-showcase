import { LocationApplicationService } from "@/application/locations/service";
import { TaskApplicationService } from "@/application/tasks/service";
import { signOutStaffAction } from "@/app/auth/actions";
import { WrongAccountState } from "@/components/auth/WrongAccountState";
import { StaffTaskWorkspaceClient } from "@/components/staff/StaffTaskWorkspaceClient";
import { getCustomerZeroTenant } from "@/domain/app-data";
import {
  maxStaffTaskIdSearchParamLength,
  staffTaskIdSearchParam
} from "@/domain/tasks";
import { NeonLocationRepository } from "@/infrastructure/neon/location-repository";
import { NeonTaskRepository } from "@/infrastructure/neon/task-repository";
import { isNeonConfigured } from "@/server/neon/env";
import { createOutpostServerNeonClient } from "@/server/neon/server-client";
import { resolveMembershipSession } from "@/server/session-context";
import { redirect } from "next/navigation";
import type { SessionAccountContext } from "@/server/session-context";
import { reportServerFailure } from "@/server/observability";
import {
  addTaskNoteAction,
  assignTaskAction,
  createManualTaskAction,
  updateTaskStatusAction
} from "./actions";

export const dynamic = "force-dynamic";

interface StaffTasksPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StaffTasksPage({ searchParams }: StaffTasksPageProps) {
  const taskIdSearchParam = (await searchParams)[staffTaskIdSearchParam];
  const initialTaskId =
    typeof taskIdSearchParam === "string" &&
    taskIdSearchParam.length <= maxStaffTaskIdSearchParamLength
      ? taskIdSearchParam
      : undefined;
  const seed = getCustomerZeroTenant();
  let { locations, tenant, tasks, taskEvents, users } = seed;
  let backendTasks = tasks;
  let backendTaskEvents = taskEvents;
  let backendLocations = locations;
  let backendUsers = users;
  let account: SessionAccountContext | null = null;
  let authenticatedStaffUserId: string | undefined;
  let staffAccessDenied = false;
  let staffBackendUnavailable = false;
  let signedInEmail: string | undefined;
  let persistenceMode:
    | "local"
    | "backend"
    | "backend_unavailable"
    | "setup_required"
    | "sign_in_required" = "local";

  const neonConfigured = isNeonConfigured();

  if (!neonConfigured && process.env.NODE_ENV === "production") {
    return (
      <WrongAccountState
        activeNav="tasks"
        expectedRole="staff"
        milestoneLabel="Neon beta proof"
        signOutAction={signOutStaffAction}
        signOutLabel="Clear session"
        subtitle="Staff task inbox"
        tenantName="Outpost"
        variant="unavailable"
      />
    );
  }

  if (neonConfigured) {
    const neon = await createOutpostServerNeonClient();
    const {
      data: { user }
    } = await neon.auth.getUser();

    if (user) {
      signedInEmail = user.email ?? undefined;
      const repository = new NeonTaskRepository(neon);
      try {
        const sessionResolution = await resolveMembershipSession(neon);

        if (sessionResolution.state === "no_active_membership") {
          return (
            <WrongAccountState
              activeNav="tasks"
              expectedRole="staff"
              signedInEmail={signedInEmail}
              signOutAction={signOutStaffAction}
              signOutLabel="Sign out"
              subtitle="Staff task inbox"
              tenantName="Outpost"
            />
          );
        } else if (sessionResolution.state !== "resolved") {
          staffAccessDenied = true;
        } else {
          tenant = sessionResolution.session.tenant;
          account = sessionResolution.session.account;
          if (account?.role === "staff") {
            authenticatedStaffUserId = sessionResolution.session.memberUserId;
            const locationService = new LocationApplicationService(new NeonLocationRepository(neon));
            const taskService = new TaskApplicationService(repository);
            backendLocations = await locationService.loadOwnerLocations(tenant.id);

            [backendTasks, backendTaskEvents, backendUsers] = await Promise.all([
              taskService.loadTenantTasks(tenant.id),
              taskService.loadTenantTaskEvents(tenant.id),
              taskService.loadTenantAssignableUsers(tenant.id)
            ]);
            persistenceMode = "backend";
          } else {
            staffAccessDenied = true;
          }
        }
      } catch (error) {
        reportServerFailure("staff.tasks.load", error);
        staffBackendUnavailable = true;
        persistenceMode = "backend_unavailable";
      }
    } else {
      redirect("/staff/sign-in");
    }
  }

  if (staffBackendUnavailable) {
    return (
      <WrongAccountState
        account={account ?? undefined}
        activeNav="tasks"
        expectedRole="staff"
        signedInEmail={signedInEmail}
        signOutAction={signOutStaffAction}
        signOutLabel="Sign out"
        subtitle="Staff task inbox"
        tenantName={tenant.name}
        variant="unavailable"
      />
    );
  }

  if (staffAccessDenied) {
    return (
      <WrongAccountState
        account={account ?? undefined}
        activeNav="tasks"
        alternateHref={account?.role === "owner" ? "/owner" : undefined}
        alternateLabel={account?.role === "owner" ? "Go to owner workspace" : undefined}
        expectedRole="staff"
        signedInEmail={signedInEmail}
        signOutAction={signOutStaffAction}
        signOutLabel="Sign out for staff access"
        subtitle="Staff task inbox"
        tenantName={tenant.name}
      />
    );
  }

  return (
    <StaffTaskWorkspaceClient
      authenticatedStaffUserId={authenticatedStaffUserId}
      initialTaskId={initialTaskId}
      locations={backendLocations}
      onAddTaskNote={addTaskNoteAction}
      onAssignTask={assignTaskAction}
      onCreateManualTask={createManualTaskAction}
      onUpdateTaskStatus={updateTaskStatusAction}
      account={account ? { ...account, signOutAction: signOutStaffAction } : undefined}
      persistenceMode={persistenceMode}
      seed={{ tasks: backendTasks, taskEvents: backendTaskEvents }}
      tenant={tenant}
      users={backendUsers}
    />
  );
}
