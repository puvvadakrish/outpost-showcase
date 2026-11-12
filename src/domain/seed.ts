import type { AuditEvent, DomainEvent } from "./audit";
import type { AnswerBankEntry, AnswerBankRevision } from "./answer-bank";
import type { ChannelEvent, Conversation, ProviderConnection } from "./channels";
import type { HandoffRule } from "./handoff-rules";
import type { NotificationDestination } from "./notifications";
import type { SourceDocument, SourceFact } from "./sources";
import type { Task, TaskEvent } from "./tasks";
import type {
  FounderAdmin,
  Location,
  Plan,
  PlanEntitlement,
  SupportAccessGrant,
  Tenant,
  TenantMembership,
  User
} from "./tenancy";
import type { UsageEvent } from "./usage";

export const plans: Plan[] = [
  {
    id: "plan_single_location",
    name: "Single Location",
    public: true,
    includedLocations: 1,
    includedVoiceMinutes: 900,
    includedEmails: 1000,
    includedUsers: 8,
    overageVoiceMinuteCents: 18
  },
  {
    id: "plan_growth",
    name: "Growth",
    public: true,
    includedLocations: 3,
    includedVoiceMinutes: 2000,
    includedEmails: 3000,
    includedUsers: 20,
    overageVoiceMinuteCents: 16
  }
];

export const planEntitlements: PlanEntitlement[] = [
  {
    id: "ent_single_phone",
    planId: "plan_single_location",
    key: "phone_channel",
    value: false
  },
  {
    id: "ent_single_email",
    planId: "plan_single_location",
    key: "email_channel",
    value: false
  },
  {
    id: "ent_single_task_inbox",
    planId: "plan_single_location",
    key: "task_inbox",
    value: true
  }
];

export const tenants: Tenant[] = [
  {
    id: "tenant_acme_fitness",
    name: "Acme Fitness",
    slug: "acme-fitness",
    status: "setup",
    planId: "plan_single_location",
    billingMode: "pilot",
    supportTier: "concierge",
    createdAt: "2026-06-08T00:00:00.000Z"
  }
];

export const users: User[] = [
  {
    id: "user_owner_acme",
    email: "owner@example.com",
    name: "Owner Operator",
    createdAt: "2026-06-08T00:00:00.000Z"
  },
  {
    id: "user_staff_acme",
    email: "frontdesk@example.com",
    name: "Front Desk",
    createdAt: "2026-06-08T00:00:00.000Z"
  },
  {
    id: "user_founder_admin",
    email: "founder@example.com",
    name: "Outpost Admin",
    createdAt: "2026-06-08T00:00:00.000Z"
  }
];

export const founderAdmins: FounderAdmin[] = [
  {
    id: "founder_admin_krish",
    userId: "user_founder_admin",
    status: "active",
    createdAt: "2026-06-08T00:00:00.000Z"
  }
];

export const memberships: TenantMembership[] = [
  {
    id: "member_owner_acme",
    tenantId: "tenant_acme_fitness",
    userId: "user_owner_acme",
    role: "owner",
    inviteStatus: "active"
  },
  {
    id: "member_staff_acme",
    tenantId: "tenant_acme_fitness",
    userId: "user_staff_acme",
    role: "staff",
    inviteStatus: "active"
  },
  {
    id: "member_founder_admin_acme",
    tenantId: "tenant_acme_fitness",
    userId: "user_founder_admin",
    role: "founder_admin",
    inviteStatus: "active"
  }
];

export const locations: Location[] = [
  {
    id: "loc_acme_main",
    tenantId: "tenant_acme_fitness",
    name: "Acme Fitness Main",
    address: "Customer-zero location",
    publicPhone: "(555) 010-1000",
    routingPhone: "(555) 010-2000",
    timezone: "America/Chicago",
    status: "draft"
  }
];

export const answerBankEntries: AnswerBankEntry[] = [
  {
    id: "answer_hours",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    topic: "hours",
    question: "What are your staffed hours?",
    answer: "Staffed hours are pending owner approval before live use.",
    approvalStatus: "draft",
    sourceDocumentId: "source_acme_website",
    sourceLabel: "website import",
    ownerAction: "edit",
    runtimeBehavior: "needs_owner_review",
    reviewNote: "Confirm weekday and weekend staffed windows before this can answer live.",
    updatedAt: "2026-06-08T13:00:00.000Z"
  },
  {
    id: "answer_amenities",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    topic: "amenities",
    question: "Do you have free weights and personal training?",
    answer: "Yes. The gym has strength equipment, free weights, and personal training options.",
    approvalStatus: "approved",
    sourceDocumentId: "source_acme_owner_notes",
    sourceLabel: "owner approved",
    approvedByUserId: "user_owner_acme",
    approvedAt: "2026-06-08T13:20:00.000Z",
    ownerAction: "approve",
    runtimeBehavior: "answer_live",
    reviewNote: "Approved for routine phone and email answers.",
    updatedAt: "2026-06-08T13:20:00.000Z"
  },
  {
    id: "answer_pricing",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    topic: "pricing",
    question: "How much does a membership cost?",
    answer: "Pricing needs owner review because public sources disagree.",
    approvalStatus: "conflict",
    sourceDocumentId: "source_acme_google",
    sourceLabel: "website + Google profile",
    ownerAction: "edit",
    runtimeBehavior: "blocked_until_resolved",
    reviewNote: "Public profile mentions a starter rate while the site points prospects to staff.",
    updatedAt: "2026-06-08T13:35:00.000Z"
  },
  {
    id: "answer_tours",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    topic: "tours",
    question: "Can I tour the gym?",
    answer: "Tour requests should create a staff follow-up task until approved live language is set.",
    approvalStatus: "routed",
    sourceDocumentId: "source_acme_owner_notes",
    sourceLabel: "manual seed",
    ownerAction: "keep_routed",
    runtimeBehavior: "create_staff_task",
    reviewNote: "Keep routed until tour windows and booking expectations are confirmed.",
    updatedAt: "2026-06-08T13:40:00.000Z"
  },
  {
    id: "answer_freeze",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    topic: "cancellation or freeze",
    question: "Can I cancel or freeze my membership?",
    answer: "Staff should follow up with the approved policy path. Outpost does not change member accounts.",
    approvalStatus: "routed",
    sourceDocumentId: "source_acme_owner_notes",
    sourceLabel: "owner boundary",
    ownerAction: "keep_routed",
    runtimeBehavior: "create_staff_task",
    reviewNote: "Always human because account changes are outside v1.",
    updatedAt: "2026-06-08T13:45:00.000Z"
  }
];

export const answerBankRevisions: AnswerBankRevision[] = [
  {
    id: "answer_revision_amenities_approved",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    answerBankEntryId: "answer_amenities",
    actorUserId: "user_owner_acme",
    revisionIntent: "approval",
    previousStatus: "draft",
    nextStatus: "approved",
    sourceDocumentId: "source_acme_owner_notes",
    sourceLabel: "owner approved",
    note: "Owner approved amenities language for future routine answers.",
    createdAt: "2026-06-08T13:20:00.000Z"
  },
  {
    id: "answer_revision_freeze_routed",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    answerBankEntryId: "answer_freeze",
    actorUserId: "user_owner_acme",
    revisionIntent: "route",
    nextStatus: "routed",
    sourceDocumentId: "source_acme_owner_notes",
    sourceLabel: "owner boundary",
    note: "Account-change topics must create staff work instead of live answers.",
    createdAt: "2026-06-08T13:45:00.000Z"
  }
];

export const handoffRules: HandoffRule[] = [
  {
    id: "rule_cancellation_always_human",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    trigger: "always_human",
    topic: "cancellation or freeze",
    action: "create_task",
    destination: "front desk queue",
    activeWindow: "always",
    priority: 10,
    status: "active"
  },
  {
    id: "rule_low_confidence",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    trigger: "low_confidence",
    topic: "unapproved or low-confidence fact",
    action: "create_task",
    destination: "front desk queue",
    activeWindow: "always",
    priority: 20,
    status: "active"
  },
  {
    id: "rule_person_request",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    trigger: "topic",
    topic: "caller asks for a person",
    action: "transfer_when_live",
    destination: "configured staff number",
    activeWindow: "staffed hours",
    priority: 30,
    status: "draft"
  }
];

export const sourceDocuments: SourceDocument[] = [
  {
    id: "source_acme_website",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    type: "website",
    label: "Gym website",
    url: "https://example-gym.local",
    status: "needs_review",
    factsFound: 9,
    conflictsFound: 1,
    lastCheckedAt: "2026-06-08T13:10:00.000Z"
  },
  {
    id: "source_acme_google",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    type: "google_profile",
    label: "Google business profile",
    status: "conflict",
    factsFound: 5,
    conflictsFound: 1,
    lastCheckedAt: "2026-06-08T13:12:00.000Z"
  },
  {
    id: "source_acme_owner_notes",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    type: "manual",
    label: "Owner setup notes",
    status: "ready",
    factsFound: 4,
    conflictsFound: 0,
    lastCheckedAt: "2026-06-08T13:25:00.000Z"
  }
];

export const sourceFacts: SourceFact[] = [
  {
    id: "fact_acme_hours",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    sourceDocumentId: "source_acme_website",
    topic: "hours",
    value: "Staffed hours require owner confirmation before live use.",
    confidence: 0.68,
    proposedAnswerEntryId: "answer_hours",
    reviewStatus: "needs_review",
    createdAt: "2026-06-08T13:11:00.000Z"
  },
  {
    id: "fact_acme_pricing_conflict",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    sourceDocumentId: "source_acme_google",
    topic: "pricing",
    value: "Public pricing signals conflict with website language.",
    confidence: 0.51,
    conflictGroup: "pricing-public-copy",
    proposedAnswerEntryId: "answer_pricing",
    reviewStatus: "conflict",
    createdAt: "2026-06-08T13:14:00.000Z"
  }
];

export const notificationDestinations: NotificationDestination[] = [
  {
    id: "dest_acme_queue",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    type: "task_queue",
    label: "Unified task inbox",
    destination: "Front-desk workboard",
    status: "ready"
  },
  {
    id: "dest_acme_staff_email",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    type: "staff_email",
    label: "Staff notification email",
    destination: "frontdesk@example.com",
    status: "draft"
  },
  {
    id: "dest_acme_owner_email",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    type: "owner_email",
    label: "Owner review digest",
    destination: "owner@example.com",
    status: "draft"
  }
];

export const tasks: Task[] = [
  {
    id: "task_new_tour",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    channel: "email",
    requesterName: "Taylor Morgan",
    requesterContact: "taylor@example.com",
    intent: "tour",
    summary: "Prospect wants a tour after work and asked about staffed hours.",
    confidence: 0.82,
    suggestedNextStep: "Confirm preferred tour window and staffed-hour policy.",
    assigneeUserId: "user_staff_acme",
    status: "new",
    createdAt: "2026-06-08T14:05:00.000Z",
    updatedAt: "2026-06-08T14:05:00.000Z"
  },
  {
    id: "task_needs_human_freeze",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    channel: "phone",
    requesterName: "Jordan Lee",
    requesterContact: "(555) 010-3333",
    intent: "membership freeze",
    summary: "Member asked about freezing for travel. Account changes are out of scope.",
    confidence: 0.63,
    suggestedNextStep: "Have staff explain the approved freeze process.",
    status: "needs_human",
    createdAt: "2026-06-08T15:20:00.000Z",
    updatedAt: "2026-06-08T15:20:00.000Z"
  },
  {
    id: "task_in_progress_callback",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    channel: "phone",
    requesterName: "Casey Patel",
    requesterContact: "(555) 010-4444",
    intent: "callback",
    summary: "Asked for a manager callback about personal training availability.",
    confidence: 0.74,
    suggestedNextStep: "Manager callback with training availability.",
    assigneeUserId: "user_owner_acme",
    status: "in_progress",
    createdAt: "2026-06-08T16:10:00.000Z",
    updatedAt: "2026-06-08T16:30:00.000Z"
  },
  {
    id: "task_done_hours",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    channel: "email",
    requesterName: "Morgan Chen",
    requesterContact: "morgan@example.com",
    intent: "hours",
    summary: "Asked for weekend hours.",
    confidence: 0.9,
    suggestedNextStep: "No follow-up needed after staff response.",
    status: "done",
    createdAt: "2026-06-08T12:00:00.000Z",
    updatedAt: "2026-06-08T12:15:00.000Z"
  },
  {
    id: "task_ignored_duplicate",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    channel: "email",
    requesterName: "Duplicate Sender",
    requesterContact: "duplicate@example.com",
    intent: "duplicate",
    summary: "Duplicate of an already handled task.",
    confidence: 0.99,
    suggestedNextStep: "Ignore duplicate.",
    status: "ignored",
    createdAt: "2026-06-08T11:00:00.000Z",
    updatedAt: "2026-06-08T11:05:00.000Z"
  }
];

export const taskEvents: TaskEvent[] = [
  {
    id: "task_event_new_tour_created",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    taskId: "task_new_tour",
    eventType: "created",
    toStatus: "new",
    note: "Static local seed event; no email ingestion is connected.",
    createdAt: "2026-06-08T14:05:00.000Z"
  }
];

export const providerConnections: ProviderConnection[] = [
  {
    id: "provider_phone_stub",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    channel: "phone",
    providerKey: "retell",
    status: "not_configured",
    credentialReferenceConfigured: false,
    disabledReason: "Architecture stub only; no live calls or transfers.",
    createdAt: "2026-06-09T00:00:00.000Z"
  },
  {
    id: "provider_email_stub",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    channel: "email",
    providerKey: "resend",
    status: "not_configured",
    credentialReferenceConfigured: false,
    disabledReason: "Architecture stub only; no email ingestion or outbound replies.",
    createdAt: "2026-06-09T00:00:00.000Z"
  },
  {
    id: "provider_social_stub",
    tenantId: "tenant_acme_fitness",
    channel: "social",
    providerKey: "meta",
    status: "disabled",
    credentialReferenceConfigured: false,
    disabledReason: "Meta/IG is fast follow, not a v1 blocker.",
    createdAt: "2026-06-09T00:00:00.000Z"
  }
];

export const conversations: Conversation[] = [
  {
    id: "conversation_static_tour",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    channel: "email",
    requesterLabel: "Taylor Morgan",
    status: "needs_human",
    startedAt: "2026-06-08T14:05:00.000Z",
    lastEventAt: "2026-06-08T14:05:00.000Z"
  }
];

export const channelEvents: ChannelEvent[] = [
  {
    id: "channel_event_static_tour",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    conversationId: "conversation_static_tour",
    channel: "email",
    eventType: "static_seed",
    processingStatus: "ignored",
    receivedAt: "2026-06-08T14:05:00.000Z"
  }
];

export const domainEvents: DomainEvent[] = [
  {
    id: "domain_event_answer_approved",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    actorUserId: "user_owner_acme",
    subjectType: "answer_bank_entry",
    subjectId: "answer_amenities",
    action: "approved",
    metadata: { liveBehavior: "answer_live" },
    occurredAt: "2026-06-08T13:20:00.000Z"
  }
];

export const auditEvents: AuditEvent[] = [
  {
    id: "audit_event_support_grant_created",
    tenantId: "tenant_acme_fitness",
    founderAdminId: "founder_admin_krish",
    supportAccessGrantId: "support_grant_acme_setup",
    subjectType: "support_access_grant",
    subjectId: "support_grant_acme_setup",
    action: "created",
    metadata: { scope: "setup_visibility_only" },
    occurredAt: "2026-06-09T00:00:00.000Z"
  }
];

export const supportAccessGrants: SupportAccessGrant[] = [
  {
    id: "support_grant_acme_setup",
    tenantId: "tenant_acme_fitness",
    founderAdminId: "founder_admin_krish",
    reason: "Customer-zero setup support visibility only.",
    status: "active",
    startsAt: "2026-06-09T00:00:00.000Z",
    expiresAt: "2026-06-16T00:00:00.000Z",
    approvedByUserId: "user_owner_acme",
    auditEventId: "audit_event_support_grant_created"
  }
];

export const usageEvents: UsageEvent[] = [
  {
    id: "usage_event_static_task_created",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    meter: "task_created",
    quantity: 1,
    sourceType: "task",
    sourceId: "task_new_tour",
    periodKey: "2026-06",
    occurredAt: "2026-06-08T14:05:00.000Z"
  }
];
