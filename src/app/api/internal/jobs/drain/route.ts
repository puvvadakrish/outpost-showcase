import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { dispatchJob, listRegisteredJobKinds } from "@/server/jobs/registry";
import type { JobRow } from "@/server/jobs/types";
import {
  assertSystemDbRuntimeAuthority,
  getSystemDbClient,
  type SystemDbClient
} from "@/server/system-db";
import { reportServerFailure } from "@/server/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export interface DrainResult {
  claimed: number;
  deferred: number;
  failed: number;
  leaseLost: number;
  registeredKinds: string[];
  settlementFailed: number;
  succeeded: number;
  workerId: string;
}

export function isTenantRuntimeStoppedError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === "OP001";
}

export function isJobLeaseLostError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === "OP002";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

export function constantTimeEquals(actual: string, expected: string) {
  return timingSafeEqual(sha256(actual), sha256(expected));
}

function bearerToken(value: string | null) {
  if (!value) {
    return "";
  }

  const [scheme, token] = value.split(/\s+/u);
  return scheme?.toLowerCase() === "bearer" ? token ?? "" : "";
}

export function isAuthorizedDrainRequest(
  headers: Pick<Headers, "get">,
  env: Record<string, string | undefined> = process.env
) {
  const expectedToken = env.OUTPOST_INTERNAL_JOB_DRAIN_TOKEN ?? "";
  const submittedToken =
    headers.get("x-outpost-job-drain-token") ?? bearerToken(headers.get("authorization"));

  return Boolean(expectedToken && submittedToken && constantTimeEquals(submittedToken, expectedToken));
}

function parseBatchSize(request: NextRequest) {
  const rawBatch = Number(new URL(request.url).searchParams.get("batch") ?? "5");
  return Math.min(Math.max(Number.isFinite(rawBatch) ? Math.trunc(rawBatch) : 5, 1), 10);
}

export async function drainJobs(
  client: SystemDbClient,
  options: {
    batchSize: number;
    workerId: string;
  }
): Promise<DrainResult> {
  const claimed = await client.query<JobRow>("select * from claim_jobs($1, $2)", [
    options.batchSize,
    options.workerId
  ]);
  let succeeded = 0;
  let failed = 0;
  let deferred = 0;
  let leaseLost = 0;
  let settlementFailed = 0;

  for (const job of claimed.rows) {
    const leaseWorkerId = job.locked_by ?? options.workerId;

    try {
      await dispatchJob(job, { db: client, workerId: leaseWorkerId });
    } catch (error) {
      if (isJobLeaseLostError(error)) {
        leaseLost += 1;
        continue;
      }

      if (isTenantRuntimeStoppedError(error)) {
        try {
          await client.query("select * from defer_job_for_tenant_stop($1, $2)", [
            job.id,
            leaseWorkerId
          ]);
          deferred += 1;
        } catch {
          settlementFailed += 1;
        }
        continue;
      }

      const message = error instanceof Error ? error.message : "Unknown job handler failure";
      try {
        await client.query("select * from mark_job_failed($1, $2, $3)", [
          job.id,
          leaseWorkerId,
          message
        ]);
      } catch {
        settlementFailed += 1;
      }
      failed += 1;
      continue;
    }

    try {
      await client.query("select * from mark_job_succeeded($1, $2)", [job.id, leaseWorkerId]);
      succeeded += 1;
    } catch {
      settlementFailed += 1;
    }
  }

  return {
    claimed: claimed.rows.length,
    deferred,
    failed,
    leaseLost,
    registeredKinds: listRegisteredJobKinds(),
    settlementFailed,
    succeeded,
    workerId: options.workerId
  };
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedDrainRequest(request.headers)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const client = getSystemDbClient();
    await assertSystemDbRuntimeAuthority(client);
    const result = await drainJobs(client, {
      batchSize: parseBatchSize(request),
      workerId: `drain_${randomUUID()}`
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    reportServerFailure("jobs.drain", error);
    return NextResponse.json({ ok: false, error: "job_drain_unavailable" }, { status: 503 });
  }
}
