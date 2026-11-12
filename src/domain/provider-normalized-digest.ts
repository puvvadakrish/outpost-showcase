export interface ProviderNormalizedDigestRow {
  channel: string;
  channel_event_id: string;
  conversation_id: string;
  event_type: string;
  location_id: string | null;
  location_name: string | null;
  payload_digest: string | null;
  payload_ref: string | null;
  processing_status: string;
  provider_connection_id: string | null;
  provider_event_id: string | null;
  provider_key: string | null;
  received_at: string;
  source_linked_task_event_id: string | null;
  task_id: string | null;
  task_status: string | null;
  tenant_id: string;
  tenant_name: string;
  usage_meters: string[];
}

export interface ProviderNormalizedDigestReport {
  authorized: boolean;
  generated_at: string | null;
  rows: ProviderNormalizedDigestRow[];
}

export const emptyProviderNormalizedDigestReport: ProviderNormalizedDigestReport = {
  authorized: false,
  generated_at: null,
  rows: [],
};

export function providerNormalizedDigestSummary(
  report: ProviderNormalizedDigestReport,
) {
  const providerKeys = new Set(
    report.rows
      .map((row) => row.provider_key)
      .filter((value): value is string => Boolean(value)),
  );
  const taskCount = report.rows.filter((row) =>
    row.usage_meters.includes("task_created"),
  ).length;
  const sourceLinkedTaskCount = report.rows.filter((row) =>
    Boolean(row.source_linked_task_event_id && row.task_id),
  ).length;
  const meterCount = report.rows.reduce(
    (total, row) => total + row.usage_meters.length,
    0,
  );

  return {
    eventCount: report.rows.length,
    meterCount,
    providerCount: providerKeys.size,
    sourceLinkedTaskCount,
    taskCount,
  };
}
