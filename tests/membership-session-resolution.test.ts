import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveActiveMembershipSessionRows } from "@/server/session-context";

type MembershipSessionRow = Parameters<typeof resolveActiveMembershipSessionRows>[0][number];

function membershipRow(overrides: Record<string, unknown> = {}) {
  return {
    role: "owner",
    invite_status: "active",
    tenants: {
      id: "tenant_acme_fitness",
      name: "Acme Fitness",
      slug: "acme-fitness",
      status: "active",
      plan_id: "plan_beta",
      billing_mode: "pilot",
      support_tier: "concierge",
      created_at: "2026-06-08T00:00:00.000Z"
    },
    users: {
      email: "owner@example.com",
      external_auth_id: "auth_owner",
      id: "user_owner_acme",
      name: "Owner"
    },
    ...overrides
  } as MembershipSessionRow;
}

describe("membership session resolution", () => {
  it("resolves exactly one active external-auth-linked membership", () => {
    const resolution = resolveActiveMembershipSessionRows(
      [membershipRow()],
      { id: "auth_owner", email: "owner@example.com" }
    );

    expect(resolution.state).toBe("resolved");
    if (resolution.state !== "resolved") {
      return;
    }
    expect(resolution.session.tenant.id).toBe("tenant_acme_fitness");
    expect(resolution.session.memberUserId).toBe("user_owner_acme");
    expect(resolution.session.user.id).toBe("auth_owner");
    expect(resolution.session.account).toMatchObject({
      email: "owner@example.com",
      name: "Owner",
      role: "owner"
    });
  });

  it("does not use email equality as an auth fallback", () => {
    const resolution = resolveActiveMembershipSessionRows(
      [membershipRow({ users: { email: "owner@example.com", external_auth_id: null, id: "user_owner_acme", name: "Owner" } })],
      { id: "auth_owner", email: "owner@example.com" }
    );

    expect(resolution.state).toBe("no_active_membership");
  });

  it("ignores inactive memberships", () => {
    const resolution = resolveActiveMembershipSessionRows(
      [membershipRow({ invite_status: "disabled" })],
      { id: "auth_owner", email: "owner@example.com" }
    );

    expect(resolution.state).toBe("no_active_membership");
  });

  it("fails closed when one authenticated user has multiple active memberships", () => {
    const resolution = resolveActiveMembershipSessionRows(
      [
        membershipRow(),
        membershipRow({
          role: "staff",
          tenants: {
            id: "tenant_partner_gym",
            name: "Partner Gym",
            slug: "partner-gym",
            status: "active",
            plan_id: "plan_beta",
            billing_mode: "pilot",
            support_tier: "concierge",
            created_at: "2026-06-09T00:00:00.000Z"
          }
        })
      ],
      { id: "auth_owner", email: "owner@example.com" }
    );

    expect(resolution.state).toBe("ambiguous_active_membership");
  });
});
