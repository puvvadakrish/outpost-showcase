import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const rehearsalScript = readFileSync("scripts/verify-local-staff-claim-rehearsal.mjs", "utf8");

describe("staff claim rehearsal", () => {
  it("registers a local-only staff claim rehearsal command", () => {
    expect(packageJson).toContain('"staff:claim:rehearsal:local"');
    expect(packageJson).toContain("verify-local-staff-claim-rehearsal.mjs");
  });

  it("uses only local Neon Auth/RLS/RPC boundaries", () => {
    expect(rehearsalScript).toContain("verify-neon-spike-readiness.mjs");
    expect(rehearsalScript).toContain("Neon verifier owns Auth/Data API setup and RLS proof");
    expect(rehearsalScript).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(rehearsalScript).not.toContain("service_role");
  });

  it("keeps hosted proof and live-provider boundaries explicit", () => {
    expect(rehearsalScript).toContain("does not claim hosted beta workflow proof");
    expect(rehearsalScript).toContain("Invite email and live providers remain blocked");
  });
});
