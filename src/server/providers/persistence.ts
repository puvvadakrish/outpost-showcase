import "server-only";

import type { NormalizedProviderEvent } from "@/server/providers/normalized";
import type { SystemDbClient } from "@/server/system-db";

export interface PersistedNormalizedProviderEvent {
  channelEventId: string;
  conversationId: string;
  insertedTasks: number;
  insertedUsageEvents: number;
  proposedTaskId?: string;
  upsertedChannelEvents: number;
  upsertedConversations: number;
  usageEventCount: number;
}

export async function persistNormalizedProviderEvent(
  client: SystemDbClient,
  event: NormalizedProviderEvent,
  lease: { jobId: string; workerId: string }
): Promise<PersistedNormalizedProviderEvent> {
  if (!lease.jobId.trim() || !lease.workerId.trim()) {
    throw new Error("Provider persistence requires an active job lease.");
  }

  const result = await client.query<{ result: PersistedNormalizedProviderEvent }>(
    "select persist_normalized_provider_event($1::jsonb, $2, $3) as result",
    [JSON.stringify(event), lease.jobId, lease.workerId]
  );
  const persisted = result.rows[0]?.result;

  if (!persisted) {
    throw new Error("persist_normalized_provider_event returned no result.");
  }

  return persisted;
}
