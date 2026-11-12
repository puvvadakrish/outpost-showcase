import { OwnerSetupWorkspaceClient } from "@/components/owner/OwnerSetupWorkspaceClient";
import { AnswerBankApplicationService } from "@/application/answer-bank/service";
import { HandoffRuleApplicationService } from "@/application/handoff-rules/service";
import { LocationApplicationService } from "@/application/locations/service";
import { NotificationDestinationApplicationService } from "@/application/notification-destinations/service";
import { StaffAccessApplicationService } from "@/application/staff-access/service";
import { TaskApplicationService } from "@/application/tasks/service";
import { RuntimeControlApplicationService } from "@/application/runtime-control/service";
import { RuntimePolicyApplicationService } from "@/application/runtime-policy/service";
import type { PersistenceMode } from "@/application/owner-setup/action-result";
import { OwnerOnboardingBootstrap } from "@/components/owner/OwnerOnboardingBootstrap";
import { signOutOwnerAction } from "@/app/auth/actions";
import { WrongAccountState } from "@/components/auth/WrongAccountState";
import { getCustomerZeroTenant } from "@/domain/app-data";
import { NeonAnswerBankRepository } from "@/infrastructure/neon/answer-bank-repository";
import { NeonHandoffRuleRepository } from "@/infrastructure/neon/handoff-rule-repository";
import { NeonLocationRepository } from "@/infrastructure/neon/location-repository";
import { NeonNotificationDestinationRepository } from "@/infrastructure/neon/notification-destination-repository";
import { NeonOwnerContextRepository } from "@/infrastructure/neon/owner-context-repository";
import { NeonStaffAccessRepository } from "@/infrastructure/neon/staff-access-repository";
import { NeonTaskRepository } from "@/infrastructure/neon/task-repository";
import { NeonRuntimeControlRepository } from "@/infrastructure/neon/runtime-control-repository";
import { NeonRuntimePolicyRepository } from "@/infrastructure/neon/runtime-policy-repository";
import {
  createHandoffRuleDraftAction,
  createNotificationDestinationDraftAction,
  setTenantRuntimeProcessingStateAction,
  approveAnswerAction,
  bootstrapOwnerTenantAction,
  createTaskFromAnswerAction,
  disableTenantStaffMemberAction,
  editDraftAnswerAction,
  proposeAnswersFromManualSourceAction,
  recordRuntimePolicyCandidateAction,
  reviewRuntimePolicyCandidateAction,
  retireAnswerAction,
  upsertManualSourceDocumentAction,
  updateHandoffRuleAction,
  updateLocationProfileAction,
  updateNotificationDestinationAction,
  upsertTenantStaffMemberAction
} from "./actions";
import { isNeonConfigured } from "@/server/neon/env";
import { createOutpostServerNeonClient } from "@/server/neon/server-client";
import { resolveMembershipSession } from "@/server/session-context";
import { redirect } from "next/navigation";
import type { SessionAccountContext } from "@/server/session-context";
import type { TenantMember } from "@/domain/tenancy";
import { reportServerFailure } from "@/server/observability";
import type { TenantRuntimeControl } from "@/domain/runtime-control";
import type {
  RuntimePolicyCandidateLineageView,
  RuntimePolicyCandidateReviewManifestView,
  RuntimePolicyReviewCurrentnessRecord,
  RuntimePolicyReviewHistoryView,
  RuntimePolicySnapshotRecord,
} from "@/domain/runtime-policy-records";
import {
  assertPolicyDbAuthorityWithTimeout,
  getPolicyDbClient,
  isPolicyDbConfigured
} from "@/server/policy-db";

export const dynamic = "force-dynamic";

export default async function OwnerPage() {
  const seed = getCustomerZeroTenant();
  let {
    tenant,
    plan,
    locations,
    answerBankEntries,
    handoffRules,
    notificationDestinations,
    sourceDocuments,
    providerConnections,
    users,
    memberships,
    tasks,
    taskEvents,
    usageEvents
  } = seed;
  let backendLocations = locations;
  let backendAnswerBankEntries = answerBankEntries;
  let backendHandoffRules = handoffRules;
  let backendNotificationDestinations = notificationDestinations;
  let backendStaffMembers: TenantMember[] = memberships
    .map((membership) => {
      const memberUser = users.find((candidate) => candidate.id === membership.userId);

      return memberUser
        ? {
            membershipId: membership.id,
            userId: memberUser.id,
            email: memberUser.email,
            name: memberUser.name,
            role: membership.role,
            inviteStatus: membership.inviteStatus,
            createdAt: membership.createdAt ?? memberUser.createdAt,
            updatedAt: membership.updatedAt
          }
        : null;
    })
    .filter((member): member is NonNullable<typeof member> => member !== null);
  let backendTasks = tasks;
  let backendTaskEvents = taskEvents;
  let backendRuntimeControl: TenantRuntimeControl = {
    tenantId: tenant.id,
    processingState: "stopped",
    pauseGeneration: 0,
    updatedAt: tenant.createdAt
  };
  let backendRuntimePolicySnapshots: RuntimePolicySnapshotRecord[] = [];
  let backendRuntimePolicyCandidateLineage: RuntimePolicyCandidateLineageView[] = [];
  let backendRuntimePolicyCandidateReviewManifests: RuntimePolicyCandidateReviewManifestView[] = [];
  let backendRuntimePolicyReviewCurrentness: RuntimePolicyReviewCurrentnessRecord[] = [];
  let backendRuntimePolicyReviewHistory: RuntimePolicyReviewHistoryView[] = [];
  let runtimePolicyBackendUnavailable = false;
  let policyDbAuthorityVerified = false;
  let account: SessionAccountContext | null = null;
  let ownerAccessDenied = false;
  let ownerBackendUnavailable = false;
  let signedInEmail: string | undefined;
  let persistenceMode: PersistenceMode = "setup_required";
  let persistenceMessage =
    "Neon env values are not configured, so backend location, answer, handoff-rule, and notification-destination edits are disabled.";

  const neonConfigured = isNeonConfigured();

  if (!neonConfigured && process.env.NODE_ENV === "production") {
    return (
      <WrongAccountState
        activeNav="owner"
        expectedRole="owner"
        milestoneLabel="Neon beta proof"
        signOutAction={signOutOwnerAction}
        signOutLabel="Clear session"
        subtitle="Owner workspace"
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

    if (!user) {
      redirect("/owner/sign-in");
    } else {
      signedInEmail = user.email ?? undefined;
      try {
        const ownerContextRepository = new NeonOwnerContextRepository(neon);
        const sessionResolution = await resolveMembershipSession(neon);

        if (sessionResolution.state === "no_active_membership") {
          return (
            <OwnerOnboardingBootstrap
              action={bootstrapOwnerTenantAction}
              ownerEmail={user.email ?? "signed-in owner"}
            />
          );
        }

        if (sessionResolution.state !== "resolved") {
          ownerAccessDenied = true;
        } else {
          tenant = sessionResolution.session.tenant;
          account = sessionResolution.session.account;
        }

        if (account?.role === "owner") {
          const locationService = new LocationApplicationService(new NeonLocationRepository(neon));
          const answerService = new AnswerBankApplicationService(new NeonAnswerBankRepository(neon));
          const handoffRuleService = new HandoffRuleApplicationService(new NeonHandoffRuleRepository(neon));
          const notificationDestinationService = new NotificationDestinationApplicationService(
            new NeonNotificationDestinationRepository(neon)
          );
          const staffAccessService = new StaffAccessApplicationService(new NeonStaffAccessRepository(neon));
          const taskService = new TaskApplicationService(new NeonTaskRepository(neon));
          const runtimeControlService = new RuntimeControlApplicationService(
            new NeonRuntimeControlRepository(neon)
          );
          const runtimePolicyRepository = new NeonRuntimePolicyRepository(neon);
          const runtimePolicyService = new RuntimePolicyApplicationService(
            runtimePolicyRepository
          );

          [
            plan,
            backendLocations,
            backendAnswerBankEntries,
            backendHandoffRules,
            backendNotificationDestinations,
            sourceDocuments,
            providerConnections,
            usageEvents,
            backendStaffMembers,
            backendTasks,
            backendTaskEvents,
            backendRuntimeControl
          ] = await Promise.all([
            ownerContextRepository.loadPlan(tenant.planId),
            locationService.loadOwnerLocations(tenant.id),
            answerService.loadOwnerAnswerBank(tenant.id),
            handoffRuleService.loadOwnerHandoffRules(tenant.id),
            notificationDestinationService.loadOwnerNotificationDestinations(tenant.id),
            ownerContextRepository.loadSourceDocuments(tenant.id),
            ownerContextRepository.loadProviderConnections(tenant.id),
            ownerContextRepository.loadUsageEvents(tenant.id),
            staffAccessService.listTenantMembers(tenant.id),
            taskService.loadTenantTasks(tenant.id),
            taskService.loadTenantTaskEvents(tenant.id),
            runtimeControlService.loadOwnerRuntimeControl(tenant.id).then((control) =>
              control ?? {
                tenantId: tenant.id,
                processingState: "stopped" as const,
                pauseGeneration: 0,
                updatedAt: tenant.createdAt
              }
            )
          ]);
          try {
            backendRuntimePolicySnapshots = await runtimePolicyService.listOwnerCandidateSummaries(
              tenant.id
            );
            [
              backendRuntimePolicyCandidateReviewManifests,
              backendRuntimePolicyCandidateLineage,
              backendRuntimePolicyReviewCurrentness,
              backendRuntimePolicyReviewHistory
            ] = await Promise.all([
              Promise.all(
                backendRuntimePolicySnapshots.map(async (candidate) => {
                  try {
                    const manifest = await runtimePolicyService.loadOwnerCandidateReviewManifest(
                      { candidate, tenantId: tenant.id },
                      runtimePolicyRepository
                    );
                    return { ...manifest, status: "available" as const };
                  } catch (error) {
                    reportServerFailure(
                      "owner.runtime-policy-candidate-review-manifest.load",
                      error
                    );
                    return {
                      candidateId: candidate.id,
                      status: "unavailable" as const
                    };
                  }
                })
              ),
              Promise.all(
                backendRuntimePolicySnapshots.map(async (candidate) => {
                  try {
                    const lineage = await runtimePolicyService.loadOwnerCandidateLineage(
                      { candidate, tenantId: tenant.id },
                      runtimePolicyRepository
                    );
                    return { ...lineage, status: "available" as const };
                  } catch (error) {
                    reportServerFailure(
                      "owner.runtime-policy-candidate-lineage.load",
                      error
                    );
                    return {
                      anchorCandidateId: candidate.id,
                      status: "unavailable" as const
                    };
                  }
                })
              ),
              Promise.all(
                backendRuntimePolicySnapshots.map(async (candidate) => {
                  try {
                    return await runtimePolicyService.checkReviewCurrentness(
                      {
                        answerBankEntries: backendAnswerBankEntries,
                        candidate,
                        handoffRules: backendHandoffRules,
                        locations: backendLocations,
                        tenantId: tenant.id
                      },
                      runtimePolicyRepository
                    );
                  } catch (error) {
                    reportServerFailure("owner.runtime-policy-currentness.check", error);
                    return {
                      candidateId: candidate.id,
                      checkedAt: new Date().toISOString(),
                      locationId: candidate.locationId,
                      outcome: "check_unavailable" as const,
                      reason: "verification_unavailable" as const
                    };
                  }
                })
              ),
              Promise.all(
                backendRuntimePolicySnapshots.map(async (candidate) => {
                  try {
                    const history = await runtimePolicyService.loadOwnerReviewHistory(
                      { candidate, tenantId: tenant.id },
                      runtimePolicyRepository
                    );
                    return { ...history, status: "available" as const };
                  } catch (error) {
                    reportServerFailure(
                      "owner.runtime-policy-review-history.load",
                      error
                    );
                    return {
                      candidateId: candidate.id,
                      status: "unavailable" as const
                    };
                  }
                })
              )
            ]);
          } catch (error) {
            reportServerFailure("owner.runtime-policy-candidates.load", error);
            runtimePolicyBackendUnavailable = true;
          }
          if (isPolicyDbConfigured()) {
            try {
              await assertPolicyDbAuthorityWithTimeout(getPolicyDbClient());
              policyDbAuthorityVerified = true;
            } catch (error) {
              reportServerFailure("owner.runtime-policy-authority.verify", error);
            }
          }
          if (
            backendLocations.length === 0 &&
            backendAnswerBankEntries.length === 0 &&
            backendHandoffRules.length === 0 &&
            backendNotificationDestinations.length === 0
          ) {
            persistenceMode = "tenant_access_required";
            persistenceMessage = "This signed-in user does not have access to the customer-zero tenant rows.";
          } else {
            persistenceMode = "backend";
            persistenceMessage =
              "Backend location, answer-bank, handoff-rule, and notification-destination rows loaded through Neon Auth and RLS.";
          }
        } else {
          ownerAccessDenied = true;
        }
      } catch (error) {
        reportServerFailure("owner.workspace.load", error);
        ownerBackendUnavailable = true;
        persistenceMode = "backend_unavailable";
        persistenceMessage = "Neon is configured, but owner setup rows could not be loaded.";
      }
    }
  }

  if (ownerBackendUnavailable) {
    return (
      <WrongAccountState
        account={account ?? undefined}
        activeNav="owner"
        expectedRole="owner"
        signedInEmail={signedInEmail}
        signOutAction={signOutOwnerAction}
        signOutLabel="Sign out"
        subtitle="Owner workspace"
        tenantName={tenant.name}
        variant="unavailable"
      />
    );
  }

  if (ownerAccessDenied) {
    return (
      <WrongAccountState
        account={account ?? undefined}
        activeNav="owner"
        alternateHref={account?.role === "staff" ? "/staff/tasks" : undefined}
        alternateLabel={account?.role === "staff" ? "Go to staff workboard" : undefined}
        expectedRole="owner"
        signedInEmail={signedInEmail}
        signOutAction={signOutOwnerAction}
        signOutLabel="Sign out for owner access"
        subtitle="Owner workspace"
        tenantName={tenant.name}
      />
    );
  }

  return (
    <OwnerSetupWorkspaceClient
      answerBankEntries={backendAnswerBankEntries}
      onCreateHandoffRuleDraft={createHandoffRuleDraftAction}
      onCreateNotificationDestinationDraft={createNotificationDestinationDraftAction}
      onSetRuntimeProcessingState={setTenantRuntimeProcessingStateAction}
      onRecordRuntimePolicyCandidate={recordRuntimePolicyCandidateAction}
      onReviewRuntimePolicyCandidate={reviewRuntimePolicyCandidateAction}
      handoffRules={backendHandoffRules}
      locations={backendLocations}
      notificationDestinations={backendNotificationDestinations}
      onApproveAnswer={approveAnswerAction}
      onCreateTaskFromAnswer={createTaskFromAnswerAction}
      onDisableTenantStaffMember={disableTenantStaffMemberAction}
      onEditDraftAnswer={editDraftAnswerAction}
      onProposeAnswersFromManualSource={proposeAnswersFromManualSourceAction}
      onRetireAnswer={retireAnswerAction}
      onUpdateHandoffRule={updateHandoffRuleAction}
      onUpdateLocationProfile={updateLocationProfileAction}
      onUpdateNotificationDestination={updateNotificationDestinationAction}
      onUpsertManualSourceDocument={upsertManualSourceDocumentAction}
      onUpsertTenantStaffMember={upsertTenantStaffMemberAction}
      account={account ? { ...account, signOutAction: signOutOwnerAction } : undefined}
      persistenceMessage={persistenceMessage}
      persistenceMode={persistenceMode}
      runtimePolicyPersistenceMode={
        persistenceMode === "backend" &&
        !runtimePolicyBackendUnavailable
          ? "backend"
          : persistenceMode === "backend"
            ? "backend_unavailable"
            : persistenceMode
      }
      runtimePolicyCandidateLineage={backendRuntimePolicyCandidateLineage}
      runtimePolicyCandidateReviewManifests={backendRuntimePolicyCandidateReviewManifests}
      runtimePolicyReviewCurrentness={backendRuntimePolicyReviewCurrentness}
      runtimePolicyReviewHistory={backendRuntimePolicyReviewHistory}
      plan={plan}
      providerConnections={providerConnections}
      runtimeControl={backendRuntimeControl}
      runtimePolicySnapshots={backendRuntimePolicySnapshots}
      runtimePolicyWriterAvailable={policyDbAuthorityVerified}
      sourceDocuments={sourceDocuments}
      staffMembers={backendStaffMembers}
      tasks={backendTasks}
      taskEvents={backendTaskEvents}
      tenant={tenant}
      usageEvents={usageEvents}
    />
  );
}
