import type { JobHandler } from "@/server/jobs/types";

export const handleNoopJob: JobHandler = async () => ({
  ok: true,
  message: "No-op job acknowledged."
});
