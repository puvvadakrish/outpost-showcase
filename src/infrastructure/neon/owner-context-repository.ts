import "server-only";

import type { ProviderConnection } from "@/domain/channels";
import type { SourceDocument } from "@/domain/sources";
import type { Plan } from "@/domain/tenancy";
import type { UsageEvent } from "@/domain/usage";
import type { OutpostNeonClient } from "@/server/neon/server-client";

interface PlanRow {
  id: string;
  name: string;
  is_public: boolean;
  included_locations: number;
  included_voice_minutes: number;
  included_emails: number;
  included_users: number;
  overage_voice_minute_cents: number;
}

interface SourceDocumentRow {
  id: string;
  tenant_id: string;
  location_id: string | null;
  source_type: SourceDocument["type"];
  label: string;
  url: string | null;
  status: SourceDocument["status"];
  facts_found: number;
  conflicts_found: number;
  last_checked_at: string;
}

interface ProviderConnectionRow {
  id: string;
  tenant_id: string;
  location_id: string | null;
  channel: ProviderConnection["channel"];
  provider_key: ProviderConnection["providerKey"];
  status: ProviderConnection["status"];
  external_account_label: string | null;
  credential_reference_configured: boolean;
  disabled_reason: string;
  created_at: string;
}

interface UsageEventRow {
  id: string;
  tenant_id: string;
  location_id: string | null;
  meter: UsageEvent["meter"];
  quantity: number;
  source_type: string;
  source_id: string;
  period_key: string;
  occurred_at: string;
}

function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    public: row.is_public,
    includedLocations: row.included_locations,
    includedVoiceMinutes: row.included_voice_minutes,
    includedEmails: row.included_emails,
    includedUsers: row.included_users,
    overageVoiceMinuteCents: row.overage_voice_minute_cents
  };
}

function mapSourceDocument(row: SourceDocumentRow): SourceDocument {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    locationId: row.location_id ?? undefined,
    type: row.source_type,
    label: row.label,
    url: row.url ?? undefined,
    status: row.status,
    factsFound: row.facts_found,
    conflictsFound: row.conflicts_found,
    lastCheckedAt: row.last_checked_at
  };
}

function mapProviderConnection(row: ProviderConnectionRow): ProviderConnection {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    locationId: row.location_id ?? undefined,
    channel: row.channel,
    providerKey: row.provider_key,
    status: row.status,
    externalAccountLabel: row.external_account_label ?? undefined,
    credentialReferenceConfigured: row.credential_reference_configured,
    disabledReason: row.disabled_reason,
    createdAt: row.created_at
  };
}

function mapUsageEvent(row: UsageEventRow): UsageEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    locationId: row.location_id ?? undefined,
    meter: row.meter,
    quantity: Number(row.quantity),
    sourceType: row.source_type,
    sourceId: row.source_id,
    periodKey: row.period_key,
    occurredAt: row.occurred_at
  };
}

export class NeonOwnerContextRepository {
  constructor(private readonly neon: OutpostNeonClient) {}

  async loadPlan(planId: string) {
    const { data, error } = await this.neon
      .from("plans")
      .select("id, name, is_public, included_locations, included_voice_minutes, included_emails, included_users, overage_voice_minute_cents")
      .eq("id", planId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load owner plan context: ${error.message}`);
    }

    return data ? mapPlan(data as unknown as PlanRow) : undefined;
  }

  async loadSourceDocuments(tenantId: string) {
    const { data, error } = await this.neon
      .from("source_documents")
      .select("id, tenant_id, location_id, source_type, label, url, status, facts_found, conflicts_found, last_checked_at")
      .eq("tenant_id", tenantId)
      .order("last_checked_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to load owner source documents: ${error.message}`);
    }

    return ((data ?? []) as unknown as SourceDocumentRow[]).map(mapSourceDocument);
  }

  async loadProviderConnections(tenantId: string) {
    const { data, error } = await this.neon
      .from("provider_connections")
      .select("id, tenant_id, location_id, channel, provider_key, status, external_account_label, credential_reference_configured, disabled_reason, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Unable to load owner provider stubs: ${error.message}`);
    }

    return ((data ?? []) as unknown as ProviderConnectionRow[]).map(mapProviderConnection);
  }

  async loadUsageEvents(tenantId: string) {
    const { data, error } = await this.neon
      .from("usage_events")
      .select("id, tenant_id, location_id, meter, quantity, source_type, source_id, period_key, occurred_at")
      .eq("tenant_id", tenantId)
      .order("occurred_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to load owner usage placeholders: ${error.message}`);
    }

    return ((data ?? []) as unknown as UsageEventRow[]).map(mapUsageEvent);
  }
}
