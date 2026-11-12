import { handleNoopJob } from "@/server/jobs/handlers/noop";
import {
  handleResendEmailReceivedNormalizationJob,
  handleRetellCallEndedNormalizationJob,
  RESEND_EMAIL_RECEIVED_NORMALIZATION_JOB,
  RETELL_CALL_ENDED_NORMALIZATION_JOB
} from "@/server/jobs/handlers/provider-normalization";
import type { JobHandler, JobHandlerContext, JobHandlerResult, JobRow } from "@/server/jobs/types";

const jobHandlers = {
  noop: handleNoopJob,
  [RETELL_CALL_ENDED_NORMALIZATION_JOB]: handleRetellCallEndedNormalizationJob,
  [RESEND_EMAIL_RECEIVED_NORMALIZATION_JOB]: handleResendEmailReceivedNormalizationJob
} satisfies Record<string, JobHandler>;

export type RegisteredJobKind = keyof typeof jobHandlers;

export function getJobHandler(kind: string): JobHandler | undefined {
  return jobHandlers[kind as RegisteredJobKind];
}

export async function dispatchJob(
  job: JobRow,
  context?: JobHandlerContext
): Promise<JobHandlerResult> {
  const handler = getJobHandler(job.kind);

  if (!handler) {
    throw new Error(`No handler registered for job kind: ${job.kind}`);
  }

  return handler(job, context);
}

export function listRegisteredJobKinds() {
  return Object.keys(jobHandlers);
}
