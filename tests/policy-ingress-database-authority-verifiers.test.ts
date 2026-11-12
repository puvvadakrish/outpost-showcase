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

import { verifyIngressDatabaseAuthority } from "../scripts/verify-ingress-database-authority.mjs";
import { verifyPolicyDatabaseAuthority } from "../scripts/verify-policy-database-authority.mjs";
import {
  INGRESS_DATABASE_AUTHORITY_SQL,
  INGRESS_FUNCTION_ALLOWLIST,
  INGRESS_ROLE,
} from "@/server/ingress-database-authority.mjs";
import {
  POLICY_COMPILER_ROLE,
  POLICY_DATABASE_AUTHORITY_SQL,
  POLICY_FUNCTION_ALLOWLIST,
} from "@/server/policy-database-authority.mjs";

function ingressAuthorityRow(overrides: Record<string, unknown> = {}) {
  return {
    has_direct_table_authority: false,
    has_elevated_attributes: false,
    has_exact_role_memberships: true,
    has_exact_security_definer_functions: true,
    has_ingress_role: true,
    has_schema_creation: false,
    owns_ingress_function: false,
    session_user: "outpost_ingress_test_login",
    ...overrides,
  };
}

function policyAuthorityRow(overrides: Record<string, unknown> = {}) {
  return {
    database_owner_name: "neondb_owner",
    has_direct_table_authority: false,
    has_elevated_attributes: false,
    has_exact_policy_function_acl: true,
    has_exact_policy_role_attributes: true,
    has_exact_role_memberships: true,
    has_exact_runtime_role_members: true,
    has_exact_security_definer_functions: true,
    has_policy_role: true,
    has_schema_creation: false,
    owns_policy_function: false,
    policy_role_members: [
      {
        adminOption: false,
        grantorName: "neondb_owner",
        inheritOption: true,
        memberName: "outpost_policy_test_login",
        setOption: true,
      },
    ],
    session_user: "outpost_policy_test_login",
    ...overrides,
  };
}

describe("policy and ingress database operator authority verifiers", () => {
  beforeEach(() => {
    pool.end.mockReset().mockResolvedValue(undefined);
    pool.query.mockReset();
  });

  it("executes the policy-specific production query and allowlist", async () => {
    pool.query.mockResolvedValue({ rows: [policyAuthorityRow()] });

    await expect(
      verifyPolicyDatabaseAuthority({ connectionString: "postgres://policy-test" }),
    ).resolves.toEqual({
      currentUser: "outpost_policy_test_login",
      verifiedFunctionCount: POLICY_FUNCTION_ALLOWLIST.length,
    });
    expect(pool.query).toHaveBeenCalledExactlyOnceWith(
      POLICY_DATABASE_AUTHORITY_SQL,
      [POLICY_COMPILER_ROLE, POLICY_FUNCTION_ALLOWLIST],
    );
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it("rejects direct relation authority in the policy operator path", async () => {
    pool.query.mockResolvedValue({
      rows: [policyAuthorityRow({ has_direct_table_authority: true })],
    });

    await expect(
      verifyPolicyDatabaseAuthority({ connectionString: "postgres://policy-test" }),
    ).rejects.toThrow(
      "Policy database login has direct application-table authority.",
    );
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it("executes the ingress-specific production query and allowlist", async () => {
    pool.query.mockResolvedValue({ rows: [ingressAuthorityRow()] });

    await expect(
      verifyIngressDatabaseAuthority({ connectionString: "postgres://ingress-test" }),
    ).resolves.toEqual({
      currentUser: "outpost_ingress_test_login",
      verifiedFunctionCount: INGRESS_FUNCTION_ALLOWLIST.length,
    });
    expect(pool.query).toHaveBeenCalledExactlyOnceWith(
      INGRESS_DATABASE_AUTHORITY_SQL,
      [INGRESS_ROLE, INGRESS_FUNCTION_ALLOWLIST],
    );
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it("rejects direct relation authority in the ingress operator path", async () => {
    pool.query.mockResolvedValue({
      rows: [ingressAuthorityRow({ has_direct_table_authority: true })],
    });

    await expect(
      verifyIngressDatabaseAuthority({ connectionString: "postgres://ingress-test" }),
    ).rejects.toThrow(
      "Provider ingress database connection lacks exact authority.",
    );
    expect(pool.end).toHaveBeenCalledOnce();
  });
});
