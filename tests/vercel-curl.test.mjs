import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VERCEL_CURL_MAX_BUFFER_BYTES } from "../scripts/vercel-curl.mjs";

const consumers = [
  "scripts/prepare-hosted-owner-handoff.mjs",
  "scripts/verify-beta-dry-run-onboarding.mjs",
  "scripts/verify-acme-dry-run-onboarding.mjs",
  "scripts/verify-hosted-beta-workflow.mjs",
  "scripts/verify-hosted-founder-admin-readiness.mjs",
  "scripts/verify-hosted-request-fulfillment-proof.mjs"
].map((path) => readFileSync(path, "utf8"));
const helper = readFileSync("scripts/vercel-curl.mjs", "utf8");

describe("Vercel curl process boundary", () => {
  it("captures bounded large route responses and rejects process termination", () => {
    expect(VERCEL_CURL_MAX_BUFFER_BYTES).toBe(16 * 1024 * 1024);
    expect(helper).toContain("maxBuffer: VERCEL_CURL_MAX_BUFFER_BYTES");
    expect(helper).toContain("Vercel curl process failed");
    expect(helper).toContain("result.status === null");
  });

  it("is shared by every hosted route-smoke consumer", () => {
    for (const consumer of consumers) {
      expect(consumer).toContain('import { runVercelCurl } from "./vercel-curl.mjs"');
      expect(consumer).not.toMatch(/spawnSync\(\s*"vercel"\s*,\s*\[?\s*"curl"/u);
    }
  });
});
