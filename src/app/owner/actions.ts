"use server";

import { revalidatePath } from "next/cache";
import { AnswerBankApplicationService } from "@/application/answer-bank/service";
import { HandoffRuleApplicationService } from "@/application/handoff-rules/service";
import { LocationApplicationService } from "@/application/locations/service";
import { NotificationDestinationApplicationService } from "@/application/notification-destinations/service";
import { OnboardingApplicationService } from "@/application/onboarding/service";
import { SourceApplicationService } from "@/application/sources/service";
import { StaffAccessApplicationService } from "@/application/staff-access/service";
import {
  RuntimeControlApplicationService,
  runtimeControlActionMessage
} from "@/application/runtime-control/service";
import { TaskApplicationService } from "@/application/tasks/service";
import { RuntimePolicyApplicationService } from "@/application/runtime-policy/service";
import type {
  EditDraftAnswerActionState,
  OwnerSetupActionState,
} from "@/application/owner-setup/action-result";
import type { HandoffRule } from "@/domain/handoff-rules";
import type { NotificationDestination } from "@/domain/notifications";
import type { RuntimePolicyReviewDecision } from "@/domain/runtime-policy-records";
import type { Location } from "@/domain/tenancy";
import { NeonAnswerBankRepository } from "@/infrastructure/neon/answer-bank-repository";
import { NeonHandoffRuleRepository } from "@/infrastructure/neon/handoff-rule-repository";
import { NeonLocationRepository } from "@/infrastructure/neon/location-repository";
import { NeonNotificationDestinationRepository } from "@/infrastructure/neon/notification-destination-repository";
import { NeonOnboardingRepository } from "@/infrastructure/neon/onboarding-repository";
import { NeonSourceRepository } from "@/infrastructure/neon/source-repository";
import { NeonStaffAccessRepository } from "@/infrastructure/neon/staff-access-repository";
import { NeonRuntimeControlRepository } from "@/infrastructure/neon/runtime-control-repository";
import { NeonTaskRepository } from "@/infrastructure/neon/task-repository";
import { NeonRuntimePolicyRepository } from "@/infrastructure/neon/runtime-policy-repository";
import { RuntimePolicySystemWriter } from "@/infrastructure/neon/runtime-policy-system-writer";
import { isNeonConfigured } from "@/server/neon/env";
import { createOutpostServerNeonClient, type OutpostNeonClient } from "@/server/neon/server-client";
import { resolveMembershipSession } from "@/server/session-context";
import {
  assertPolicyDatabaseMatchesDataApi,
  getPolicyDbClient,
  isPolicyDbConfigured,
} from "@/server/policy-db";

interface OwnerActionContext {
  neon: OutpostNeonClient;
  tenantId: string;
  userId: string;
}

type OwnerActionContextResult =
  | {
      ok: true;
      context: OwnerActionContext;
    }
  | {
      ok: false;
      message: string;
    };

function manualSourceFactsFromFormData(formData: FormData) {
  const topics = formData.getAll("factTopic").map((value) => String(value));
  const values = formData.getAll("factValue").map((value) => String(value));
  const confidences = formData
    .getAll("factConfidence")
    .map((value) => String(value))
    .map((value) => (value.trim() ? Number(value) : Number.NaN));
  const conflictGroups = formData.getAll("factConflictGroup").map((value) => String(value));

  return topics
    .map((topic, index) => ({
      topic,
      value: values[index] ?? "",
      confidence: confidences[index] ?? Number.NaN,
      conflictGroup: conflictGroups[index] ?? ""
    }))
    .filter((fact) => fact.topic.trim() || fact.value.trim());
}

async function requireOwnerActionContext(actionLabel: string): Promise<OwnerActionContextResult> {
  const neon = await createOutpostServerNeonClient();
  const sessionResolution = await resolveMembershipSession(neon);

  if (sessionResolution.state === "no_authenticated_user") {
    return { ok: false, message: `Sign in is required before ${actionLabel}.` };
  }

  if (
    sessionResolution.state !== "resolved" ||
    sessionResolution.session.account.role !== "owner"
  ) {
    return { ok: false, message: `Owner access is required before ${actionLabel}.` };
  }

  return {
    ok: true,
    context: {
      neon,
      tenantId: sessionResolution.session.tenant.id,
      userId: sessionResolution.session.user.id
    }
  };
}

function submittedTenantMatchesSession(formData: FormData, tenantId: string) {
  const submittedTenantId = String(formData.get("tenantId") ?? "");
  return !submittedTenantId || submittedTenantId === tenantId;
}

export async function setTenantRuntimeProcessingStateAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured, so tenant processing authority is unavailable."
    };
  }

  const actionContext = await requireOwnerActionContext("changing tenant processing authority");
  if (!actionContext.ok) return actionContext;
  const { neon, tenantId } = actionContext.context;

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace." };
  }

  const expectedValue = String(formData.get("expectedPauseGeneration") ?? "").trim();

  try {
    const service = new RuntimeControlApplicationService(new NeonRuntimeControlRepository(neon));
    const receipt = await service.setProcessingState({
      tenantId,
      operationKey: String(formData.get("operationKey") ?? ""),
      requestedState: String(formData.get("requestedState") ?? "") as "stopped" | "enabled",
      expectedPauseGeneration: expectedValue ? Number(expectedValue) : undefined,
      reason: String(formData.get("reason") ?? "")
    });

    revalidatePath("/owner");
    return {
      ok: true,
      message: runtimeControlActionMessage(receipt)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("generation is stale")) {
      return { ok: false, message: "Processing state changed. Refreshing authoritative state before enabling." };
    }
    if (message.includes("lifecycle does not permit")) {
      return { ok: false, message: "Tenant lifecycle is paused or disabled, so processing stays stopped." };
    }
    if (message.startsWith("Runtime ") || message.startsWith("Current pause")) {
      return { ok: false, message };
    }
    return { ok: false, message: "Unable to change tenant processing through backend authority." };
  }
}

export async function bootstrapOwnerTenantAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so tenant onboarding is disabled."
    };
  }

  const neon = await createOutpostServerNeonClient();
  const {
    data: { user },
    error
  } = await neon.auth.getUser();

  if (error || !user?.email) {
    return { ok: false, message: "Sign in is required before creating an Outpost tenant." };
  }

  const ownerName = String(formData.get("ownerName") ?? "");
  const tenantName = String(formData.get("tenantName") ?? "");
  const locationName = String(formData.get("locationName") ?? "");
  const locationAddress = String(formData.get("locationAddress") ?? "");
  const timezone = String(formData.get("timezone") ?? "");
  const publicPhone = String(formData.get("publicPhone") ?? "");

  try {
    const service = new OnboardingApplicationService(new NeonOnboardingRepository(neon));

    await service.bootstrapOwnerTenant({
      ownerEmail: user.email,
      ownerName,
      tenantName,
      locationName,
      locationAddress,
      timezone,
      publicPhone
    });

    revalidatePath("/owner");
    revalidatePath("/owner/locations");

    return { ok: true, message: "Tenant setup created. Owner workspace is ready for review." };
  } catch (bootstrapError) {
    if (
      bootstrapError instanceof Error &&
      (bootstrapError.message.startsWith("Owner ") ||
        bootstrapError.message.startsWith("Gym ") ||
        bootstrapError.message.startsWith("Location ") ||
        bootstrapError.message.startsWith("Timezone") ||
        bootstrapError.message.includes("already has an active tenant"))
    ) {
      return { ok: false, message: bootstrapError.message };
    }

    return {
      ok: false,
      message: "Unable to create tenant setup through backend persistence."
    };
  }
}

export async function upsertTenantStaffMemberAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so staff access changes are disabled."
    };
  }

  const actionContext = await requireOwnerActionContext("managing staff access");
  if (!actionContext.ok) {
    return actionContext;
  }
  const { neon, tenantId, userId } = actionContext.context;
  const staffName = String(formData.get("staffName") ?? "");
  const staffEmail = String(formData.get("staffEmail") ?? "");

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace." };
  }

  try {
    const service = new StaffAccessApplicationService(new NeonStaffAccessRepository(neon));

    await service.upsertTenantStaffMember({
      tenantId,
      actorUserId: userId,
      staffEmail,
      staffName
    });

    revalidatePath("/owner");
    revalidatePath("/staff/tasks");

    return { ok: true, message: "Staff roster saved with tenant membership and audit event." };
  } catch (staffAccessError) {
    if (staffAccessError instanceof Error) {
      const message = staffAccessError.message.replace(
        /^Unable to save staff access roster member:\s*/u,
        ""
      );

      if (
        message.startsWith("Staff ") ||
        message.startsWith("Tenant ") ||
        message.toLowerCase().includes("owner membership") ||
        message.toLowerCase().includes("staff memberships")
      ) {
        return { ok: false, message };
      }
    }

    return {
      ok: false,
      message: "Unable to save staff access through backend persistence."
    };
  }
}

export async function disableTenantStaffMemberAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so staff access changes are disabled."
    };
  }

  const actionContext = await requireOwnerActionContext("managing staff access");
  if (!actionContext.ok) {
    return actionContext;
  }
  const { neon, tenantId, userId } = actionContext.context;
  const membershipId = String(formData.get("membershipId") ?? "");

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace." };
  }

  if (!membershipId) {
    return { ok: false, message: "Staff membership identifier is required." };
  }

  try {
    const service = new StaffAccessApplicationService(new NeonStaffAccessRepository(neon));

    await service.disableTenantStaffMember({
      tenantId,
      actorUserId: userId,
      membershipId
    });

    revalidatePath("/owner");
    revalidatePath("/staff/tasks");

    return { ok: true, message: "Staff access disabled with tenant membership audit proof." };
  } catch (staffAccessError) {
    if (staffAccessError instanceof Error) {
      const message = staffAccessError.message.replace(
        /^Unable to disable staff access roster member:\s*/u,
        ""
      );

      if (
        message.startsWith("Staff ") ||
        message.startsWith("Tenant ") ||
        message.toLowerCase().includes("owner membership") ||
        message.toLowerCase().includes("staff membership")
      ) {
        return { ok: false, message };
      }
    }

    return {
      ok: false,
      message: "Unable to disable staff access through backend persistence."
    };
  }
}

export async function editDraftAnswerAction(
  _previousState: EditDraftAnswerActionState,
  formData: FormData
): Promise<EditDraftAnswerActionState> {
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so backend answer edits are disabled."
    };
  }

  const actionContext = await requireOwnerActionContext("editing backend answer-bank records");
  if (!actionContext.ok) {
    return actionContext;
  }
  const { neon, tenantId, userId } = actionContext.context;
  const entryId = String(formData.get("entryId") ?? "");
  const topic = String(formData.get("topic") ?? "");
  const question = String(formData.get("question") ?? "");
  const answer = String(formData.get("answer") ?? "");

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace." };
  }

  if (!entryId) {
    return { ok: false, message: "Answer identifier is required." };
  }

  try {
    const service = new AnswerBankApplicationService(new NeonAnswerBankRepository(neon));

    await service.editDraftAnswer({
      tenantId,
      entryId,
      actorUserId: userId,
      topic,
      question,
      answer
    });

    revalidatePath("/owner");

    return { ok: true, message: "Draft answer saved with a revision and audit event." };
  } catch (saveError) {
    if (
      saveError instanceof Error &&
      (saveError.message.startsWith("Answer ") || saveError.message.startsWith("Only draft"))
    ) {
      return { ok: false, message: saveError.message };
    }

    return {
      ok: false,
      message: "Unable to save draft answer through backend persistence."
    };
  }
}

export async function approveAnswerAction(
  _previousState: EditDraftAnswerActionState,
  formData: FormData
): Promise<EditDraftAnswerActionState> {
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so backend answer approvals are disabled."
    };
  }

  const actionContext = await requireOwnerActionContext("approving backend answer-bank records");
  if (!actionContext.ok) {
    return actionContext;
  }
  const { neon, tenantId, userId } = actionContext.context;
  const entryId = String(formData.get("entryId") ?? "");

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace." };
  }

  if (!entryId) {
    return { ok: false, message: "Answer identifier is required." };
  }

  try {
    const service = new AnswerBankApplicationService(new NeonAnswerBankRepository(neon));

    await service.approveAnswer({
      tenantId,
      entryId,
      actorUserId: userId
    });

    revalidatePath("/owner");

    return { ok: true, message: "Answer approved with a revision and audit event." };
  } catch (approvalError) {
    if (
      approvalError instanceof Error &&
      (approvalError.message.startsWith("Answer ") ||
        approvalError.message.startsWith("Tenant ") ||
        approvalError.message.startsWith("Only draft"))
    ) {
      return { ok: false, message: approvalError.message };
    }

    return {
      ok: false,
      message: "Unable to approve answer through backend persistence."
    };
  }
}

export async function retireAnswerAction(
  _previousState: EditDraftAnswerActionState,
  formData: FormData
): Promise<EditDraftAnswerActionState> {
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so backend answer retirement is disabled."
    };
  }

  const actionContext = await requireOwnerActionContext("retiring backend answer-bank records");
  if (!actionContext.ok) {
    return actionContext;
  }
  const { neon, tenantId, userId } = actionContext.context;
  const entryId = String(formData.get("entryId") ?? "");

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace." };
  }

  if (!entryId) {
    return { ok: false, message: "Answer identifier is required." };
  }

  try {
    const service = new AnswerBankApplicationService(new NeonAnswerBankRepository(neon));

    await service.retireAnswer({
      tenantId,
      entryId,
      actorUserId: userId
    });

    revalidatePath("/owner");

    return { ok: true, message: "Answer retired with a revision and audit event." };
  } catch (retireError) {
    if (retireError instanceof Error) {
      const message = retireError.message.replace(/^Unable to retire answer:\s*/u, "");

      if (
        message.startsWith("Answer ") ||
        message.startsWith("Tenant ") ||
        message.startsWith("Only draft") ||
        message.toLowerCase().startsWith("only draft") ||
        message.includes("membership required")
      ) {
        return { ok: false, message };
      }
    }

    return {
      ok: false,
      message: "Unable to retire answer through backend persistence."
    };
  }
}

export async function createTaskFromAnswerAction(
  _previousState: EditDraftAnswerActionState,
  formData: FormData
): Promise<EditDraftAnswerActionState> {
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so answer task creation is disabled."
    };
  }

  const actionContext = await requireOwnerActionContext("creating backend tasks from answer reviews");
  if (!actionContext.ok) {
    return actionContext;
  }
  const { neon, tenantId, userId } = actionContext.context;
  const answerBankEntryId = String(formData.get("entryId") ?? "");

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace." };
  }

  if (!answerBankEntryId) {
    return { ok: false, message: "Answer identifier is required." };
  }

  try {
    const service = new TaskApplicationService(new NeonTaskRepository(neon));

    await service.createTaskFromAnswer({
      tenantId,
      answerBankEntryId,
      actorUserId: userId
    });

    revalidatePath("/owner");
    revalidatePath("/staff/tasks");

    return { ok: true, message: "Staff task is ready from answer review." };
  } catch (taskError) {
    if (taskError instanceof Error) {
      const message = taskError.message.replace(/^Unable to create task from answer:\s*/u, "");

      if (
        message.startsWith("Answer ") ||
        message.startsWith("Tenant ") ||
        message.startsWith("Only ") ||
        message.toLowerCase().startsWith("answer ") ||
        message.toLowerCase().startsWith("tenant ") ||
        message.toLowerCase().startsWith("only ") ||
        message.includes("membership required") ||
        message.includes("live-answer")
      ) {
        return { ok: false, message };
      }
    }

    return {
      ok: false,
      message: "Unable to create staff task from answer review through backend persistence."
    };
  }
}

export async function proposeAnswersFromManualSourceAction(
  _previousState: EditDraftAnswerActionState,
  formData: FormData
): Promise<EditDraftAnswerActionState> {
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so answer proposal staging is disabled."
    };
  }

  const actionContext = await requireOwnerActionContext("staging backend answer proposals");
  if (!actionContext.ok) {
    return actionContext;
  }
  const { neon, tenantId, userId } = actionContext.context;
  const sourceDocumentId = String(formData.get("sourceDocumentId") ?? "");

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace." };
  }

  if (!sourceDocumentId) {
    return { ok: false, message: "Source document identifier is required." };
  }

  try {
    const service = new AnswerBankApplicationService(new NeonAnswerBankRepository(neon));
    const result = await service.proposeAnswersFromManualSource({
      tenantId,
      sourceDocumentId,
      actorUserId: userId
    });

    revalidatePath("/owner");

    const conflictDetail =
      result.conflictCount > 0 ? ` ${result.conflictCount} conflict ${result.conflictCount === 1 ? "item" : "items"} remain blocked.` : "";

    return {
      ok: true,
      message: `${result.proposedCount} answer ${result.proposedCount === 1 ? "proposal" : "proposals"} staged for owner review.${conflictDetail}`
    };
  } catch (proposalError) {
    if (proposalError instanceof Error) {
      const message = proposalError.message.replace(
        /^Unable to stage answer proposals:\s*/u,
        ""
      );

      if (
        message.startsWith("Source ") ||
        message.startsWith("Manual ") ||
        message.toLowerCase().startsWith("no proposed") ||
        message.startsWith("Tenant ") ||
        message.includes("membership required")
      ) {
        return { ok: false, message };
      }
    }

    return {
      ok: false,
      message: "Unable to stage answer proposals through backend persistence."
    };
  }
}

export async function updateHandoffRuleAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  const ruleId = String(formData.get("ruleId") ?? "");
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so backend handoff-rule edits are disabled.",
      targetId: ruleId
    };
  }

  const actionContext = await requireOwnerActionContext("editing backend handoff-rule records");
  if (!actionContext.ok) {
    return { ...actionContext, targetId: ruleId };
  }
  const { neon, tenantId, userId } = actionContext.context;
  const trigger = String(formData.get("trigger") ?? "") as HandoffRule["trigger"];
  const topic = String(formData.get("topic") ?? "");
  const action = String(formData.get("action") ?? "") as HandoffRule["action"];
  const destination = String(formData.get("destination") ?? "");
  const activeWindow = String(formData.get("activeWindow") ?? "");
  const priority = Number(formData.get("priority") ?? Number.NaN);
  const status = String(formData.get("status") ?? "") as HandoffRule["status"];

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace.", targetId: ruleId };
  }

  if (!ruleId) {
    return { ok: false, message: "Handoff rule identifier is required.", targetId: ruleId };
  }

  try {
    const service = new HandoffRuleApplicationService(new NeonHandoffRuleRepository(neon));

    await service.updateHandoffRule({
      tenantId,
      ruleId,
      actorUserId: userId,
      trigger,
      topic,
      action,
      destination,
      activeWindow,
      priority,
      status
    });

    revalidatePath("/owner");

    return { ok: true, message: "Handoff rule saved with a revision and audit event.", targetId: ruleId };
  } catch (saveError) {
    if (saveError instanceof Error) {
      const message = saveError.message.replace(/^Unable to update handoff rule:\s*/u, "");
      const normalizedMessage = message.toLowerCase();
      if (
        normalizedMessage.startsWith("handoff rule") ||
        normalizedMessage.startsWith("tenant ") ||
        normalizedMessage.includes("membership required")
      ) {
        return { ok: false, message, targetId: ruleId };
      }
    }

    return {
      ok: false,
      message: "Unable to save handoff rule through backend persistence.",
      targetId: ruleId
    };
  }
}

export async function createHandoffRuleDraftAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  const creationKey = String(formData.get("creationKey") ?? "");

  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so backend handoff-rule creation is disabled.",
      targetId: creationKey
    };
  }

  const actionContext = await requireOwnerActionContext("creating backend handoff-rule drafts");
  if (!actionContext.ok) {
    return { ...actionContext, targetId: creationKey };
  }
  const { neon, tenantId, userId } = actionContext.context;
  const locationId = String(formData.get("locationId") ?? "");
  const trigger = String(formData.get("trigger") ?? "") as HandoffRule["trigger"];
  const topic = String(formData.get("topic") ?? "");
  const action = String(formData.get("action") ?? "") as HandoffRule["action"];
  const destination = String(formData.get("destination") ?? "");
  const activeWindow = String(formData.get("activeWindow") ?? "");
  const priority = Number(formData.get("priority") ?? Number.NaN);

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return {
      ok: false,
      message: "Submitted tenant does not match the signed-in owner workspace.",
      targetId: creationKey
    };
  }

  try {
    const service = new HandoffRuleApplicationService(new NeonHandoffRuleRepository(neon));
    await service.createHandoffRuleDraft({
      tenantId,
      locationId: locationId || undefined,
      creationKey,
      actorUserId: userId,
      trigger,
      topic,
      action,
      destination,
      activeWindow,
      priority
    });

    revalidatePath("/owner");
    return {
      ok: true,
      message: "Draft handoff rule created with revision and audit evidence.",
      targetId: creationKey
    };
  } catch (createError) {
    if (createError instanceof Error) {
      const message = createError.message.replace(
        /^Unable to create handoff rule draft:\s*/u,
        ""
      );
      const normalizedMessage = message.toLowerCase();
      if (
        normalizedMessage.startsWith("handoff rule") ||
        normalizedMessage.startsWith("tenant ") ||
        normalizedMessage.startsWith("location ") ||
        normalizedMessage.includes("membership required")
      ) {
        return { ok: false, message, targetId: creationKey };
      }
    }
    return {
      ok: false,
      message: "Unable to create handoff rule through backend persistence.",
      targetId: creationKey
    };
  }
}

export async function updateNotificationDestinationAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  const destinationId = String(formData.get("destinationId") ?? "");
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message:
        "Neon is not configured for this environment, so backend notification-destination edits are disabled.",
      targetId: destinationId
    };
  }

  const actionContext = await requireOwnerActionContext("editing backend notification destinations");
  if (!actionContext.ok) {
    return { ...actionContext, targetId: destinationId };
  }
  const { neon, tenantId, userId } = actionContext.context;
  const type = String(formData.get("type") ?? "") as NotificationDestination["type"];
  const label = String(formData.get("label") ?? "");
  const destination = String(formData.get("destination") ?? "");
  const status = String(formData.get("status") ?? "") as NotificationDestination["status"];

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace.", targetId: destinationId };
  }

  if (!destinationId) {
    return { ok: false, message: "Notification destination identifier is required.", targetId: destinationId };
  }

  try {
    const service = new NotificationDestinationApplicationService(
      new NeonNotificationDestinationRepository(neon)
    );

    await service.updateNotificationDestination({
      tenantId,
      destinationId,
      actorUserId: userId,
      type,
      label,
      destination,
      status
    });

    revalidatePath("/owner");

    return { ok: true, message: "Notification destination saved with a revision and audit event.", targetId: destinationId };
  } catch (saveError) {
    if (saveError instanceof Error) {
      const message = saveError.message.replace(
        /^Unable to update notification destination:\s*/u,
        ""
      );
      const normalizedMessage = message.toLowerCase();
      if (
        normalizedMessage.startsWith("notification destination") ||
        normalizedMessage.startsWith("tenant ") ||
        normalizedMessage.includes("membership required")
      ) {
        return { ok: false, message, targetId: destinationId };
      }
    }

    return {
      ok: false,
      message: "Unable to save notification destination through backend persistence.",
      targetId: destinationId
    };
  }
}

export async function createNotificationDestinationDraftAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  const creationKey = String(formData.get("creationKey") ?? "");

  if (!isNeonConfigured()) {
    return {
      ok: false,
      message:
        "Neon is not configured for this environment, so backend notification-destination creation is disabled.",
      targetId: creationKey
    };
  }

  const actionContext = await requireOwnerActionContext("creating backend notification destinations");
  if (!actionContext.ok) {
    return { ...actionContext, targetId: creationKey };
  }
  const { neon, tenantId, userId } = actionContext.context;
  const locationId = String(formData.get("locationId") ?? "");
  const type = String(formData.get("type") ?? "") as NotificationDestination["type"];
  const label = String(formData.get("label") ?? "");
  const destination = String(formData.get("destination") ?? "");

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return {
      ok: false,
      message: "Submitted tenant does not match the signed-in owner workspace.",
      targetId: creationKey
    };
  }

  try {
    const service = new NotificationDestinationApplicationService(
      new NeonNotificationDestinationRepository(neon)
    );
    await service.createNotificationDestinationDraft({
      tenantId,
      locationId: locationId || undefined,
      creationKey,
      actorUserId: userId,
      type,
      label,
      destination
    });

    revalidatePath("/owner");
    return {
      ok: true,
      message: "Draft notification destination created with revision and audit evidence.",
      targetId: creationKey
    };
  } catch (createError) {
    if (createError instanceof Error) {
      const message = createError.message.replace(
        /^Unable to create notification destination draft:\s*/u,
        ""
      );
      const normalizedMessage = message.toLowerCase();
      if (
        normalizedMessage.startsWith("notification destination") ||
        normalizedMessage.startsWith("tenant ") ||
        normalizedMessage.startsWith("location ") ||
        normalizedMessage.includes("membership required")
      ) {
        return { ok: false, message, targetId: creationKey };
      }
    }
    return {
      ok: false,
      message: "Unable to create notification destination through backend persistence.",
      targetId: creationKey
    };
  }
}

export async function updateLocationProfileAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  const locationId = String(formData.get("locationId") ?? "");
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so backend location edits are disabled.",
      targetId: locationId
    };
  }

  const actionContext = await requireOwnerActionContext("editing backend location records");
  if (!actionContext.ok) {
    return { ...actionContext, targetId: locationId };
  }
  const { neon, tenantId, userId } = actionContext.context;
  const name = String(formData.get("name") ?? "");
  const address = String(formData.get("address") ?? "");
  const publicPhone = String(formData.get("publicPhone") ?? "");
  const routingPhone = String(formData.get("routingPhone") ?? "");
  const timezone = String(formData.get("timezone") ?? "");
  const status = String(formData.get("status") ?? "") as Location["status"];

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace.", targetId: locationId };
  }

  if (!locationId) {
    return { ok: false, message: "Location identifier is required.", targetId: locationId };
  }

  try {
    const service = new LocationApplicationService(new NeonLocationRepository(neon));

    await service.updateLocationProfile({
      tenantId,
      locationId,
      actorUserId: userId,
      name,
      address,
      publicPhone,
      routingPhone,
      timezone,
      status
    });

    revalidatePath("/owner");
    revalidatePath("/owner/locations");

    return { ok: true, message: "Location profile saved with a revision and audit event.", targetId: locationId };
  } catch (saveError) {
    if (saveError instanceof Error) {
      const message = saveError.message.replace(/^Unable to update location profile:\s*/u, "");
      const normalizedMessage = message.toLowerCase();
      if (
        normalizedMessage.startsWith("location ") ||
        normalizedMessage.startsWith("tenant ") ||
        normalizedMessage.includes("membership required")
      ) {
        return { ok: false, message, targetId: locationId };
      }
    }

    return {
      ok: false,
      message: "Unable to save location profile through backend persistence.",
      targetId: locationId
    };
  }
}

export async function createLocationDraftAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  const creationKey = String(formData.get("creationKey") ?? "");
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so location creation is disabled."
    };
  }
  const actionContext = await requireOwnerActionContext("creating backend location drafts");
  if (!actionContext.ok) return actionContext;
  const { neon, tenantId, userId } = actionContext.context;

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace." };
  }

  try {
    const service = new LocationApplicationService(new NeonLocationRepository(neon));
    await service.createLocationDraft({
      tenantId,
      creationKey,
      actorUserId: userId,
      name: String(formData.get("name") ?? ""),
      address: String(formData.get("address") ?? ""),
      publicPhone: String(formData.get("publicPhone") ?? ""),
      routingPhone: String(formData.get("routingPhone") ?? ""),
      timezone: String(formData.get("timezone") ?? "")
    });
    revalidatePath("/owner");
    revalidatePath("/owner/locations");
    return {
      ok: true,
      message: "Draft location created with two blocked provider stubs and audit evidence."
    };
  } catch (createError) {
    if (createError instanceof Error) {
      const message = createError.message.replace(/^Unable to create location draft:\s*/u, "");
      const normalizedMessage = message.toLowerCase();
      if (
        normalizedMessage.startsWith("location ") ||
        normalizedMessage.startsWith("tenant ") ||
        normalizedMessage.includes("membership required")
      ) {
        return { ok: false, message };
      }
    }
    return { ok: false, message: "Unable to create location through backend persistence." };
  }
}

export async function upsertManualSourceDocumentAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Neon is not configured for this environment, so backend manual source intake is disabled."
    };
  }

  const actionContext = await requireOwnerActionContext("saving backend manual source intake");
  if (!actionContext.ok) {
    return actionContext;
  }
  const { neon, tenantId, userId } = actionContext.context;
  const locationId = String(formData.get("locationId") ?? "");
  const sourceDocumentId = String(formData.get("sourceDocumentId") ?? "");
  const label = String(formData.get("label") ?? "");
  const facts = manualSourceFactsFromFormData(formData);

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace." };
  }

  if (!locationId) {
    return { ok: false, message: "Location identifier is required." };
  }

  if (facts.length === 0) {
    return { ok: false, message: "Add at least one proposed fact before saving manual source intake." };
  }

  try {
    const service = new SourceApplicationService(new NeonSourceRepository(neon));

    await service.upsertManualSourceDocument({
      tenantId,
      locationId,
      actorUserId: userId,
      sourceDocumentId,
      label,
      facts
    });

    revalidatePath("/owner");

    return { ok: true, message: "Manual source saved with proposed facts and an audit event." };
  } catch (saveError) {
    if (
      saveError instanceof Error &&
      (saveError.message.startsWith("Source ") ||
        saveError.message.startsWith("Manual ") ||
        saveError.message.startsWith("Tenant ") ||
        saveError.message.startsWith("Location "))
    ) {
      return { ok: false, message: saveError.message };
    }

    return {
      ok: false,
      message: "Unable to save manual source intake through backend persistence."
    };
  }
}

export async function recordRuntimePolicyCandidateAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  if (!isNeonConfigured() || !isPolicyDbConfigured()) {
    return {
      ok: false,
      message: "Protected policy persistence is not configured, so candidate recording is unavailable."
    };
  }

  const actionContext = await requireOwnerActionContext("recording a runtime policy candidate");
  if (!actionContext.ok) return actionContext;
  const { neon, tenantId } = actionContext.context;
  const locationId = String(formData.get("locationId") ?? "").trim();

  if (!submittedTenantMatchesSession(formData, tenantId)) {
    return { ok: false, message: "Submitted tenant does not match the signed-in owner workspace." };
  }
  if (!locationId) return { ok: false, message: "Location identifier is required." };

  try {
    assertPolicyDatabaseMatchesDataApi();
    const locationService = new LocationApplicationService(new NeonLocationRepository(neon));
    const answerService = new AnswerBankApplicationService(new NeonAnswerBankRepository(neon));
    const handoffService = new HandoffRuleApplicationService(new NeonHandoffRuleRepository(neon));
    const [locations, answerBankEntries, handoffRules] = await Promise.all([
      locationService.loadOwnerLocations(tenantId),
      answerService.loadOwnerAnswerBank(tenantId),
      handoffService.loadOwnerHandoffRules(tenantId)
    ]);
    const location = locations.find(
      (candidate) => candidate.id === locationId && candidate.tenantId === tenantId
    );
    if (!location) {
      return { ok: false, message: "Location is unavailable to this owner workspace." };
    }

    const repository = new NeonRuntimePolicyRepository(neon);
    const service = new RuntimePolicyApplicationService(repository);
    const writer = new RuntimePolicySystemWriter(getPolicyDbClient());
    const result = await service.recordCandidate({
      answerBankEntries,
      handoffRules,
      locationId,
      locations,
      tenantId
    }, repository, writer);

    if (!result.ok) {
      const labels = result.diagnostics
        .slice(0, 3)
        .map((diagnostic) => diagnostic.code.replaceAll("_", " "));
      const remaining = result.diagnostics.length - labels.length;
      return {
        ok: false,
        targetId: locationId,
        message: `Candidate was not recorded. Resolve ${labels.join(", ")}${remaining > 0 ? ` and ${remaining} more issue${remaining === 1 ? "" : "s"}` : ""}.`
      };
    }

    revalidatePath("/owner");
    return {
      ok: true,
      targetId: locationId,
      message: `Candidate v${result.record.snapshotVersion} recorded for review. It is not active or executable.`
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Runtime policy ")) {
      return { ok: false, targetId: locationId, message: error.message };
    }
    return {
      ok: false,
      targetId: locationId,
      message: "Unable to record the runtime policy candidate through backend persistence."
    };
  }
}

export async function reviewRuntimePolicyCandidateAction(
  _previousState: OwnerSetupActionState,
  formData: FormData
): Promise<OwnerSetupActionState> {
  if (!isNeonConfigured()) {
    return {
      ok: false,
      message: "Backend owner persistence is not configured, so policy review is unavailable."
    };
  }

  const actionContext = await requireOwnerActionContext("reviewing a runtime policy candidate");
  if (!actionContext.ok) return actionContext;
  const { neon, tenantId } = actionContext.context;
  const candidateId = String(formData.get("candidateId") ?? "").trim();
  const creationKey = String(formData.get("creationKey") ?? "").trim();
  const submittedDecision = String(formData.get("decision") ?? "").trim();
  if (!candidateId) return { ok: false, message: "Runtime policy candidate is required." };
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(creationKey)) {
    return { ok: false, targetId: candidateId, message: "Policy review retry key is invalid." };
  }
  if (submittedDecision !== "accepted" && submittedDecision !== "rejected") {
    return { ok: false, targetId: candidateId, message: "Policy review decision is invalid." };
  }
  const decision: RuntimePolicyReviewDecision = submittedDecision;

  try {
    const repository = new NeonRuntimePolicyRepository(neon);
    const service = new RuntimePolicyApplicationService(repository);
    let answerBankEntries: Awaited<ReturnType<AnswerBankApplicationService["loadOwnerAnswerBank"]>> | undefined;
    let handoffRules: Awaited<ReturnType<HandoffRuleApplicationService["loadOwnerHandoffRules"]>> | undefined;
    let locations: Awaited<ReturnType<LocationApplicationService["loadOwnerLocations"]>> | undefined;

    if (decision === "accepted") {
      const locationService = new LocationApplicationService(new NeonLocationRepository(neon));
      const answerService = new AnswerBankApplicationService(new NeonAnswerBankRepository(neon));
      const handoffService = new HandoffRuleApplicationService(new NeonHandoffRuleRepository(neon));
      [locations, answerBankEntries, handoffRules] = await Promise.all([
        locationService.loadOwnerLocations(tenantId),
        answerService.loadOwnerAnswerBank(tenantId),
        handoffService.loadOwnerHandoffRules(tenantId)
      ]);
    }

    const result = await service.recordReviewDecision({
      answerBankEntries,
      candidateId,
      creationKey,
      decision,
      handoffRules,
      locations,
      tenantId
    }, repository, repository, repository);

    if (!result.ok) {
      const labels = result.diagnostics
        .slice(0, 3)
        .map((diagnostic) => diagnostic.code.replaceAll("_", " "));
      const remaining = result.diagnostics.length - labels.length;
      return {
        ok: false,
        targetId: candidateId,
        message: `Review was not accepted. Resolve ${labels.join(", ")}${remaining > 0 ? ` and ${remaining} more issue${remaining === 1 ? "" : "s"}` : ""}.`
      };
    }

    revalidatePath("/owner");
    return {
      ok: true,
      targetId: candidateId,
      message: `Candidate v${result.record.snapshotVersion} review ${result.record.decision}. This records evidence only and does not activate or execute policy. Review guidance refreshed above.`
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Runtime policy ")) {
      return { ok: false, targetId: candidateId, message: error.message };
    }
    return {
      ok: false,
      targetId: candidateId,
      message: "Unable to record the runtime policy review decision."
    };
  }
}
