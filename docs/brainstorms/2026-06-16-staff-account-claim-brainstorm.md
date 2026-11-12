---
title: Staff account claim
type: brainstorm
status: captured
date: 2026-06-16
---

# Staff account claim

## What We're Building

Let a rostered staff member connect a Supabase Auth identity to an existing
active staff roster row, then land on the staff workboard. The owner still
creates or reactivates roster access first through `upsert_tenant_staff_member`;
the staff user only claims the matching roster row by signing in or creating a
local Supabase Auth account with the same email.

## Why This Approach

The smallest useful beta step after owner-managed roster access is staff login,
not invite delivery. A claim RPC keeps the tenant boundary in Postgres: it
derives the caller from `auth.uid()` and the JWT email claim, finds the matching
confirmed app user by email, requires an active staff membership, then writes
the `external_auth_id` and one audit event atomically.

This preserves local Docker proof and avoids live-provider scope. There is no
Retell, Resend, Gmail, inbound/outbound email, notification delivery, Auth
admin provisioning, or provider webhook behavior.

## Key Decisions

- Use a no-argument `claim_staff_roster_membership()` RPC so the client cannot
  choose tenant, membership, or user identifiers.
- Require a confirmed authenticated JWT email claim and match it to an existing
  app `users.email` row.
- Require at least one active `staff` tenant membership for that app user.
- Reject users already linked to another `auth.uid()`.
- Return the claimed staff tenant/member context for the UI.
- Add a `/staff/sign-in` page that signs in or signs up through Supabase Auth,
  then calls the claim RPC before redirecting to `/staff/tasks`.
- Do not send invite email or create Supabase Auth users from the owner roster
  screen.

## Success Criteria

- Rostered staff can sign up/sign in and reach the backend-backed staff
  workboard.
- Non-rostered users cannot claim access.
- Owner-only users cannot claim staff access unless they also have an active
  staff membership.
- Claim writes app-user link and audit event in one transaction.
- Failure-path verification proves no partial link/audit state.
- Hosted proof remains unclaimed while Supabase quota is blocked.

## Open Questions

None for this local slice.
