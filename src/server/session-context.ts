import "server-only";

import type { MembershipRole } from "@/domain/models";
import type { Tenant } from "@/domain/tenancy";
import type { OutpostNeonClient } from "@/server/neon/server-client";

export interface SessionAccountContext {
  email: string;
  name: string;
  role: MembershipRole;
}

export interface MembershipSessionContext {
  account: SessionAccountContext;
  memberUserId: string;
  tenant: Tenant;
  user: {
    email?: string;
    id: string;
  };
}

export type MembershipSessionResolution =
  | {
      state: "resolved";
      session: MembershipSessionContext;
    }
  | {
      state: "no_authenticated_user";
    }
  | {
      state: "no_active_membership";
      user: {
        email?: string;
        id: string;
      };
    }
  | {
      state: "ambiguous_active_membership";
      user: {
        email?: string;
        id: string;
      };
    };

interface MembershipSessionRow {
  role: MembershipRole;
  invite_status: string;
  tenants: {
    billing_mode: Tenant["billingMode"];
    created_at: string;
    id: string;
    name: string;
    plan_id: string;
    slug: string;
    status: Tenant["status"];
    support_tier: Tenant["supportTier"];
  };
  users: {
    email: string;
    external_auth_id: string | null;
    id: string;
    name: string;
  };
}

export function matchesAuthenticatedUser(
  row: MembershipSessionRow,
  user: { id: string }
) {
  return row.users.external_auth_id === user.id;
}

function mapTenant(row: MembershipSessionRow["tenants"]): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    planId: row.plan_id,
    billingMode: row.billing_mode,
    supportTier: row.support_tier,
    createdAt: row.created_at
  };
}

export function resolveActiveMembershipSessionRows(
  rows: MembershipSessionRow[],
  user: { email?: string | null; id: string }
): MembershipSessionResolution {
  const sessionUser = {
    id: user.id,
    email: user.email ?? undefined
  };
  const activeRows = rows.filter(
    (candidate) =>
      candidate.invite_status === "active" && matchesAuthenticatedUser(candidate, sessionUser)
  );

  if (activeRows.length === 0) {
    return { state: "no_active_membership", user: sessionUser };
  }

  if (activeRows.length > 1) {
    return { state: "ambiguous_active_membership", user: sessionUser };
  }

  const row = activeRows[0];
  return {
    state: "resolved",
    session: {
      account: {
        email: row.users.email,
        name: row.users.name,
        role: row.role
      },
      memberUserId: row.users.id,
      tenant: mapTenant(row.tenants),
      user: sessionUser
    }
  };
}

export async function resolveMembershipSession(
  neon: OutpostNeonClient
): Promise<MembershipSessionResolution> {
  const {
    data: { user }
  } = await neon.auth.getUser();

  if (!user) {
    return { state: "no_authenticated_user" };
  }

  const { data, error } = await neon
    .from("tenant_memberships")
    .select(
      "role, invite_status, users!inner(id, email, external_auth_id, name), tenants!inner(id, name, slug, status, plan_id, billing_mode, support_tier, created_at)"
    )
    .eq("invite_status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Unable to resolve membership session: ${error.message}`);
  }

  return resolveActiveMembershipSessionRows((data ?? []) as unknown as MembershipSessionRow[], user);
}
