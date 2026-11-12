import { beforeEach, describe, expect, it, vi } from "vitest";

const pool = vi.hoisted(() => ({
  end: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@neondatabase/serverless", () => ({
  Pool: class {
    end = pool.end;
    query = pool.query;
  },
}));

import { verifyRuntimeDatabaseAuthority } from "../scripts/verify-runtime-database-authority.mjs";
import {
  RUNTIME_DATABASE_AUTHORITY_SQL,
  RUNTIME_FUNCTION_ALLOWLIST,
  RUNTIME_ROLE,
} from "@/server/runtime-database-authority.mjs";

function authorityRow(overrides: Record<string, unknown> = {}) {
  return {
    has_direct_table_authority: false,
    has_elevated_attributes: false,
    has_exact_role_memberships: true,
    has_exact_security_definer_functions: true,
    has_runtime_role: true,
    has_schema_creation: false,
    owns_runtime_function: false,
    session_user: "outpost_runtime_test_login",
    ...overrides,
  };
}

describe("runtime database operator authority verifier", () => {
  beforeEach(() => {
    pool.end.mockReset().mockResolvedValue(undefined);
    pool.query.mockReset();
  });

  it("executes the same runtime-specific query and allowlist as the application", async () => {
    pool.query.mockResolvedValue({ rows: [authorityRow()] });

    await expect(
      verifyRuntimeDatabaseAuthority({ connectionString: "postgres://runtime-test" }),
    ).resolves.toEqual({
      currentUser: "outpost_runtime_test_login",
      verifiedFunctionCount: RUNTIME_FUNCTION_ALLOWLIST.length,
    });
    expect(pool.query).toHaveBeenCalledExactlyOnceWith(
      RUNTIME_DATABASE_AUTHORITY_SQL,
      [RUNTIME_ROLE, RUNTIME_FUNCTION_ALLOWLIST],
    );
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it("rejects direct table or column authority reported by the production query", async () => {
    pool.query.mockResolvedValue({
      rows: [authorityRow({ has_direct_table_authority: true })],
    });

    await expect(
      verifyRuntimeDatabaseAuthority({ connectionString: "postgres://runtime-test" }),
    ).rejects.toThrow(
      "Runtime database login has direct application-table authority.",
    );
    expect(pool.end).toHaveBeenCalledOnce();
  });
});
