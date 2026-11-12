export const membershipRoles = ["owner", "staff", "founder_admin"] as const;
export type MembershipRole = (typeof membershipRoles)[number];

export const tenantStatuses = ["setup", "active", "paused", "disabled"] as const;
export type TenantStatus = (typeof tenantStatuses)[number];

export const locationStatuses = ["draft", "active", "paused"] as const;
export type LocationStatus = (typeof locationStatuses)[number];

export const taskStatuses = [
  "new",
  "needs_human",
  "in_progress",
  "done",
  "ignored"
] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const unresolvedTaskStatuses = ["new", "needs_human", "in_progress"] as const;

export const channels = ["phone", "email", "manual", "social"] as const;
export type Channel = (typeof channels)[number];

export const taskChannels = ["phone", "email", "manual"] as const satisfies readonly Channel[];
export type TaskChannel = (typeof taskChannels)[number];

export const answerApprovalStatuses = ["draft", "approved", "conflict", "routed", "retired"] as const;
export type AnswerApprovalStatus = (typeof answerApprovalStatuses)[number];

export const sourceDocumentTypes = ["website", "google_profile", "manual"] as const;
export type SourceDocumentType = (typeof sourceDocumentTypes)[number];

export const sourceDocumentStatuses = ["ready", "needs_review", "conflict", "missing"] as const;
export type SourceDocumentStatus = (typeof sourceDocumentStatuses)[number];

export const sourceFactStatuses = ["proposed", "needs_review", "approved", "conflict", "rejected"] as const;
export type SourceFactStatus = (typeof sourceFactStatuses)[number];

export const notificationDestinationTypes = ["task_queue", "staff_email", "owner_email"] as const;
export type NotificationDestinationType = (typeof notificationDestinationTypes)[number];

export const notificationDestinationStatuses = ["ready", "draft", "disabled"] as const;
export type NotificationDestinationStatus = (typeof notificationDestinationStatuses)[number];

export const handoffTriggers = [
  "topic",
  "low_confidence",
  "always_human",
  "explicit_human_request",
  "missing_fact",
  "conflict"
] as const;
export type HandoffTrigger = (typeof handoffTriggers)[number];

export const handoffActions = ["create_task", "notify_staff", "transfer_when_live", "block_automation"] as const;
export type HandoffAction = (typeof handoffActions)[number];

export const handoffRuleStatuses = ["active", "draft", "disabled"] as const;
export type HandoffRuleStatus = (typeof handoffRuleStatuses)[number];

export type Id = string;

export function taskStatusLabel(status: TaskStatus): string {
  return status.replaceAll("_", " ");
}
