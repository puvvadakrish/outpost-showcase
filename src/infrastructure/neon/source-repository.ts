import "server-only";

import type {
  SourceRepository,
  TransactionalUpsertManualSourceDocumentInput,
  UpsertManualSourceDocumentTransactionResult
} from "@/application/sources/ports";
import type { SourceDocument } from "@/domain/sources";
import type { OutpostNeonClient } from "@/server/neon/server-client";

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

export class NeonSourceRepository implements SourceRepository {
  constructor(private readonly neon: OutpostNeonClient) {}

  async upsertManualSourceDocumentTransaction(
    input: TransactionalUpsertManualSourceDocumentInput
  ): Promise<UpsertManualSourceDocumentTransactionResult> {
    // The RPC derives actor identity from auth.uid(); do not forward client-provided actor ids.
    const { data, error } = await this.neon.rpc("upsert_manual_source_document", {
      p_tenant_id: input.tenantId,
      p_location_id: input.locationId,
      p_source_document_id: input.sourceDocumentId ?? null,
      p_label: input.label,
      p_facts: input.facts
    });

    if (error) {
      throw new Error(`Unable to save manual source intake: ${error.message}`);
    }

    return { sourceDocument: mapSourceDocument(data as unknown as SourceDocumentRow) };
  }
}
