import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  atlasApplyArgs,
  migrationStatusHasLedger,
  migrationVersionExists
} from "../scripts/apply-neon-migrations.mjs";

const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const proofBranchScript = readFileSync("scripts/prepare-hosted-neon-proof-branch.mjs", "utf8");
const migrationApplyScript = readFileSync("scripts/apply-neon-migrations.mjs", "utf8");

describe("Neon migration ledger", () => {
  it("applies pending checksummed migrations without an established-database baseline", () => {
    expect(atlasApplyArgs("postgres://localhost/outpost")).toEqual([
      "migrate",
      "apply",
      "--env",
      "outpost",
      "--revisions-schema",
      "public",
      "--lock-timeout",
      "30s"
    ]);
  });

  it("requires explicit schema verification before baselining a known migration", () => {
    expect(migrationVersionExists("20260708040000")).toBe(true);
    expect(() => atlasApplyArgs("postgres://localhost/outpost", "20260708040000")).toThrow(
      "OUTPOST_NEON_BASELINE_CONFIRMATION=schema-verified"
    );
    expect(atlasApplyArgs("postgres://localhost/outpost", "20260708040000", "schema-verified")).toContain(
      "20260708040000"
    );
    expect(() =>
      atlasApplyArgs("postgres://localhost/outpost", "20260708999999", "schema-verified")
    ).toThrow("must name an existing 14-digit migration version");
  });

  it("allows dirty-mode migration only for an explicitly proven Neon greenfield target", () => {
    expect(
      atlasApplyArgs(
        "postgres://localhost/outpost",
        undefined,
        undefined,
        "neon-auth-only-public-empty"
      )
    ).toContain("--allow-dirty");
    expect(() =>
      atlasApplyArgs("postgres://localhost/outpost", undefined, undefined, "public-schema-empty")
    ).toThrow("OUTPOST_NEON_GREENFIELD_CONFIRMATION");
    expect(() =>
      atlasApplyArgs(
        "postgres://localhost/outpost",
        "20260708010000",
        "schema-verified",
        "neon-auth-only-public-empty"
      )
    ).toThrow("cannot be combined");
  });

  it("distinguishes a real revision ledger from a ledger-less pending history", () => {
    expect(
      migrationStatusHasLedger({ Available: [{ Version: "1" }], Pending: [{ Version: "1" }] })
    ).toBe(false);
    expect(
      migrationStatusHasLedger({
        Applied: [{ Version: "1" }],
        Available: [{ Version: "1" }, { Version: "2" }],
        Pending: [{ Version: "2" }]
      })
    ).toBe(true);
    expect(
      migrationStatusHasLedger({ Available: [{ Version: "1" }], Applied: [{ Version: "1" }] })
    ).toBe(true);
    expect(migrationStatusHasLedger({ Available: [{ Version: "1" }] })).toBe(false);
    expect(migrationStatusHasLedger({ Available: [], Pending: [] })).toBe(false);
  });

  it("keeps migration integrity and full-history execution in CI", () => {
    expect(packageJson).toContain('"db:migrations:validate"');
    expect(packageJson).toContain('"db:migrations:apply"');
    expect(ciWorkflow).toContain("atlas migrate validate");
    expect(ciWorkflow).toContain("OUTPOST_NEON_GREENFIELD_CONFIRMATION");
    expect(ciWorkflow).toContain("npm run db:migrations:apply");
    expect(proofBranchScript).toContain("applyNeonMigrations");
    expect(proofBranchScript).toContain("assertMigrationTargetReady");
    expect(proofBranchScript.indexOf("assertMigrationTargetReady")).toBeLessThan(
      proofBranchScript.indexOf('["branches", "create"')
    );
    expect(proofBranchScript).not.toContain("applyMigrationBundle");
    expect(migrationApplyScript).toContain('stdio: ["ignore", "inherit", "pipe"]');
    expect(migrationApplyScript).toContain("Atlas migration process failed");
  });
});
