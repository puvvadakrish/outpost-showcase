import type { AuditEvent } from "@/domain/audit";
import type { ProviderConnection } from "@/domain/channels";
import type { HandoffRule } from "@/domain/handoff-rules";
import type { NotificationDestination } from "@/domain/notifications";
import type { SourceDocument } from "@/domain/sources";
import type { Location, Tenant, TenantMembership, User } from "@/domain/tenancy";
import type {
  BootstrapOwnerTenantCommand,
  BootstrapOwnerTenantTransactionResult,
  OnboardingPersistenceState,
  OnboardingRepository
} from "./ports";

const NOW = "2026-06-12T00:00:00.000Z";

function cloneAuditEvent(event: AuditEvent): AuditEvent {
  return { ...event, metadata: { ...event.metadata } };
}

function cloneState(state: OnboardingPersistenceState): OnboardingPersistenceState {
  return {
    auditEvents: state.auditEvents.map(cloneAuditEvent),
    handoffRules: state.handoffRules.map((rule) => ({ ...rule })),
    locations: state.locations.map((location) => ({ ...location })),
    memberships: state.memberships.map((membership) => ({ ...membership })),
    notificationDestinations: state.notificationDestinations.map((destination) => ({ ...destination })),
    providerConnections: state.providerConnections.map((connection) => ({ ...connection })),
    sourceDocuments: state.sourceDocuments.map((source) => ({ ...source })),
    tenants: state.tenants.map((tenant) => ({ ...tenant })),
    users: state.users.map((user) => ({ ...user }))
  };
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "gym";
}

export class InMemoryOnboardingRepository implements OnboardingRepository {
  private failAfterTenantInsert = false;
  private state: OnboardingPersistenceState;

  constructor(initialState: OnboardingPersistenceState) {
    this.state = cloneState(initialState);
  }

  requestFailureAfterTenantInsert() {
    this.failAfterTenantInsert = true;
  }

  snapshot() {
    return cloneState(this.state);
  }

  async bootstrapOwnerTenantTransaction(
    input: BootstrapOwnerTenantCommand
  ): Promise<BootstrapOwnerTenantTransactionResult> {
    const before = cloneState(this.state);
    const suffix = this.state.tenants.length + 1;
    const userId = `user_bootstrap_${suffix}`;
    const tenantId = `tenant_bootstrap_${suffix}`;
    const locationId = `loc_bootstrap_${suffix}`;
    const sourceDocumentId = `source_bootstrap_${suffix}`;

    try {
      if (
        this.state.memberships.some(
          (membership) => membership.userId === userId && membership.role === "owner" && membership.inviteStatus === "active"
        )
      ) {
        throw new Error("Owner already has an active tenant.");
      }

      const user: User = {
        id: userId,
        email: input.ownerEmail,
        name: input.ownerName,
        externalAuthId: `auth_${suffix}`,
        createdAt: NOW
      };
      this.state.users.push(user);

      const tenant: Tenant = {
        id: tenantId,
        name: input.tenantName,
        slug: `${slugify(input.tenantName)}-${suffix}`,
        status: "setup",
        planId: "plan_single_location",
        billingMode: "pilot",
        supportTier: "standard",
        createdAt: NOW
      };
      this.state.tenants.push(tenant);

      if (this.failAfterTenantInsert) {
        throw new Error("Injected failure after tenant insert.");
      }

      const membership: TenantMembership = {
        id: `member_bootstrap_${suffix}`,
        tenantId,
        userId,
        role: "owner",
        inviteStatus: "active"
      };
      this.state.memberships.push(membership);

      const location: Location = {
        id: locationId,
        tenantId,
        name: input.locationName,
        address: input.locationAddress,
        publicPhone: input.publicPhone,
        timezone: input.timezone,
        status: "draft",
        updatedAt: NOW
      };
      this.state.locations.push(location);

      const sourceDocument: SourceDocument = {
        id: sourceDocumentId,
        tenantId,
        locationId,
        type: "manual",
        label: "Owner setup notes",
        status: "missing",
        factsFound: 0,
        conflictsFound: 0,
        lastCheckedAt: NOW
      };
      this.state.sourceDocuments.push(sourceDocument);

      const starterRules: HandoffRule[] = [
        {
          id: `rule_bootstrap_cancel_${suffix}`,
          tenantId,
          locationId,
          trigger: "always_human",
          topic: "cancellation or freeze",
          action: "create_task",
          destination: "front desk queue",
          activeWindow: "always",
          priority: 10,
          status: "active"
        },
        {
          id: `rule_bootstrap_low_confidence_${suffix}`,
          tenantId,
          locationId,
          trigger: "low_confidence",
          topic: "unapproved or low-confidence fact",
          action: "create_task",
          destination: "front desk queue",
          activeWindow: "always",
          priority: 20,
          status: "active"
        }
      ];
      this.state.handoffRules.push(...starterRules);

      const destination: NotificationDestination = {
        id: `dest_bootstrap_queue_${suffix}`,
        tenantId,
        locationId,
        type: "task_queue",
        label: "Unified task inbox",
        destination: "Front-desk workboard",
        status: "ready",
        updatedAt: NOW
      };
      this.state.notificationDestinations.push(destination);

      const providers: ProviderConnection[] = [
        {
          id: `provider_bootstrap_phone_${suffix}`,
          tenantId,
          locationId,
          channel: "phone",
          providerKey: "retell",
          status: "not_configured",
          credentialReferenceConfigured: false,
          disabledReason: "not configured",
          createdAt: NOW
        },
        {
          id: `provider_bootstrap_email_${suffix}`,
          tenantId,
          locationId,
          channel: "email",
          providerKey: "gmail",
          status: "not_configured",
          credentialReferenceConfigured: false,
          disabledReason: "not configured",
          createdAt: NOW
        }
      ];
      this.state.providerConnections.push(...providers);

      this.state.auditEvents.push({
        id: `audit_bootstrap_${suffix}`,
        tenantId,
        actorUserId: userId,
        subjectType: "tenant",
        subjectId: tenantId,
        action: "tenant.bootstrapped",
        metadata: {
          location_id: locationId,
          source_document_id: sourceDocumentId,
          plan_id: "plan_single_location",
          live_providers_enabled: false
        },
        occurredAt: NOW
      });

      return {
        result: {
          tenantId,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          locationId,
          locationName: location.name
        }
      };
    } catch (error) {
      this.state = before;
      this.failAfterTenantInsert = false;
      throw error;
    }
  }
}
