import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync("scripts/enqueue-provider-normalization-fixtures.mjs", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

describe("provider fixture enqueue command", () => {
  it("is wired as an operator-only package script", () => {
    expect(packageJson.scripts["admin:provider-fixtures:enqueue"]).toBe(
      "node scripts/enqueue-provider-normalization-fixtures.mjs"
    );
    expect(script).toContain("OUTPOST_DATABASE_URL required");
    expect(script).toContain("OUTPOST_DATABASE_URL must use postgres:// or postgresql://");
    expect(script).toContain("enqueue_job($1, $2::jsonb, $3, $4, $5)");
  });

  it("enqueues only known fixture normalization jobs", () => {
    expect(script).toContain("provider.retell.call_ended.normalize");
    expect(script).toContain("provider.resend.email_received.normalize");
    expect(script).toContain("tests/fixtures/retell/call-ended-gym-follow-up.json");
    expect(script).toContain("tests/fixtures/resend/inbound-gym-freeze-request.json");
    expect(script).toContain("OUTPOST_PROVIDER_FIXTURE_KIND must be retell, resend, or all");
  });

  it("does not call providers, drain jobs, or delivery/revenue systems", () => {
    expect(script).not.toMatch(/fetch\(|@retell|@resend|retell-sdk|resend-sdk|webhook|send\s+email|invite|billing|invoice|access-control|member\s+ledger/iu);
    expect(script).not.toMatch(/\bpos\b/iu);
    expect(script).not.toMatch(/fetch\([^)]*\/api\/internal\/jobs\/drain/iu);
    expect(script).toContain("Drain separately");
  });

  it("keeps secret-shaped values out of fixture enqueue payloads", () => {
    expect(script).toContain("assertNoSecretShapedValue(raw, path)");
    expect(script).toContain("provider_payload: payload");
    expect(script).not.toContain("OUTPOST_INTERNAL_JOB_DRAIN_TOKEN");
  });
});
