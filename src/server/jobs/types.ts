import type { SystemDbClient } from "@/server/system-db";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "dead";

export interface JobRow {
  id: string;
  tenant_id: string | null;
  kind: string;
  payload_version: number;
  payload: Record<string, unknown>;
  status: JobStatus;
  dedupe_key: string;
  run_after: string;
  attempts: number;
  max_attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobHandlerResult {
  details?: Record<string, unknown>;
  message?: string;
  ok: true;
}

export interface JobHandlerContext {
  db?: SystemDbClient;
  workerId?: string;
}

export type JobHandler = (job: JobRow, context?: JobHandlerContext) => Promise<JobHandlerResult>;
