---
title: Staff access management
type: brainstorm
status: captured
date: 2026-06-15
---

# Staff access management

## What We're Building

Add the next smallest local beta slice for owner-managed staff access. Owners
need a way to maintain the tenant staff roster that powers assignment and
front-desk workboard ownership, without depending on seed users.

This slice creates or updates an existing tenant staff membership from the
owner workspace. It is a roster and access-preparation step only: no invite
email is sent, no Supabase Auth admin account is created, and no live provider
or notification behavior is enabled.

## Why This Approach

The schema already has `users`, `tenant_memberships`, `membership_role`, and
`invite_status`. The staff workboard already reads assignable users through the
tenant-scoped `list_active_tenant_members` RPC. The safest incremental move is
to extend that same model with one owner-only transactional RPC that upserts a
staff user row, creates or reactivates the tenant membership, and writes an
audit event.

This keeps the current Supabase Auth/RLS direction intact while avoiding a
premature invitation system. Real email invitations and Auth admin provisioning
can come later when hosted Supabase proof and live email readiness are unblocked.

## Key Decisions

- Build an owner-only `upsert_tenant_staff_member` RPC.
- Persist the staff roster mutation as one explicit PostgreSQL transaction:
  `users` row plus `tenant_memberships` row plus one `audit_events` row.
- Use the existing `invite_status = 'active'` membership state so staff can
  immediately appear in assignment options, while UI copy states that login
  still requires matching Auth setup.
- Reject owner/founder-admin role creation through this RPC; it can only manage
  staff roster rows.
- Preserve deny-by-default table writes. Do not add broad insert/update RLS
  policies on `users` or `tenant_memberships`.
- Add cross-tenant denial and rollback/no-partial-state verification.
- Keep the UI as an operational roster panel, not a decorative card wall.

## Scope Boundaries

In scope:

- Owner-managed staff roster row creation or reactivation.
- Backend service/repository support.
- Owner workspace UI for staff access state and one staff form.
- Audit event proof and RLS verification.

Out of scope:

- Supabase Auth admin user creation.
- Magic links or invite emails.
- Retell, Resend, Gmail, live phone/email, webhooks, notifications, billing,
  ClubOS/POS/member-ledger writes, social APIs, or provider ingress.
- Owner role transfer, founder-admin creation, support/admin access, or member
  deletion.

## Design Notes

Staff access should look like an operations roster. Rows need identity, role,
access status, and boundary copy. The panel should avoid nested cards and avoid
large generic input boxes. On mobile, rows become stacked identity blocks with
the form below the roster.

## Open Questions

None for this slice. Real invite delivery remains deferred until hosted
Supabase proof and live email readiness are available.
