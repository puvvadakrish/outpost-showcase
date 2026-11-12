---
date: 2026-06-21
topic: beta-access-hardening
---

# Beta Access Hardening

## What We're Building

Outpost's hosted Neon and protected Vercel Preview proof is green, but real
customer beta readiness still needs an explicit access gate. The next slice
should make owner beta access invite-only at the application/database boundary
while preserving the existing owner-managed staff roster claim path.

This is not invite email delivery. It is a controlled beta-access guard:
operators can seed or insert owner beta grants for approved owner emails, those
emails can create/bootstrap an owner workspace, and unapproved owner emails are
blocked before tenant creation. Staff access remains roster-first: an owner
adds a staff row, then the staff user claims it through Neon Auth.

## Why This Approach

Recommended approach: database-backed owner beta grants enforced by the owner
bootstrap RPC. Public owner sign-up stays operator-managed for this preview
because hosted Neon Data API grant checks require bearer credentials, and an
unauthenticated preflight would fail closed for every new owner. This keeps the
hard gate close to tenant creation, so a UI bypass or direct server-action call
cannot create an unapproved tenant.

Rejected alternatives:

- Env-only allowlist: easier to ship, but weak for hosted branch reset/rotate
  proof and not auditable through branch data.
- Invite email delivery: closer to the eventual customer workflow, but it opens
  notification/provider scope before the deployment and beta-access gates are
  fully proven.
- Staff invite lifecycle: staff already has owner-managed roster claims; the
  immediate risk is owner self-signup creating unintended tenants.

## Architecture Notes

- Add a small `owner_beta_access_grants` persistence surface, scoped by email
  and status, without direct anonymous or authenticated table grants.
- Gate `bootstrap_owner_tenant` on an active grant for `p_owner_email`.
- Keep owner account creation operator-managed until there is a safe
  server-authorized grant lookup path; treat the database gate as
  authoritative.
- Seed grants for the existing proof owner accounts so local/hosted rehearsals
  keep passing.
- Extend hosted proof to show approved owner bootstrap remains possible and an
  unapproved owner cannot bootstrap a tenant.

## Key Decisions

- Owner beta access is the next gate before real customer beta handoff.
- The hard gate lives in Postgres/Neon, not only in UI or environment config.
- Staff remains roster-claim based; no invite email, Auth admin provisioning,
  provider ingress, notification delivery, billing, POS, or member-ledger work
  enters this slice.
- The hosted reset/rotate story remains branch-based: a fresh proof branch
  contains seeded beta grants and can be verified through the existing Vercel
  Preview proof harness.

## Open Questions

- None for this slice. The first version should grant seeded/test owner emails
  through seed data and leave a manual SQL/operator runbook for customer-zero
  grant insertion.

## Next Steps

-> `ce-plan` for the implementation details and verification sequence.
