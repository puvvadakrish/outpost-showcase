import { spawnSync } from "node:child_process";

export const VERCEL_CURL_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

export function runVercelCurl(args) {
  const result = spawnSync("vercel", ["curl", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: VERCEL_CURL_MAX_BUFFER_BYTES
  });

  if (result.error) {
    throw new Error(`Vercel curl process failed: ${result.error.message}`);
  }
  if (result.status === null) {
    throw new Error(`Vercel curl process terminated${result.signal ? ` by ${result.signal}` : ""}.`);
  }

  return result;
}
