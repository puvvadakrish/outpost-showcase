# Staff claim handoff polish brainstorm

Date: 2026-06-16

## What we're building

Make the owner-managed staff roster easier to hand off during local beta. Owners
should be able to see whether each staff roster row is already linked to a
Supabase Auth account, copy the local staff sign-in path, and understand the
manual claim steps without assuming invite email exists.

## Why this approach

The backend staff-access and staff-claim slices already landed the durable
boundary: owners create active staff roster rows, and staff members claim only
their matching row through `claim_staff_roster_membership()`. The current UI
still leaves the handoff implicit. A small read-only polish slice makes beta
testing smoother without adding invite delivery, Auth admin provisioning, live
providers, or new persistence.

## Key decisions

- Reuse the existing staff access panel and roster-row pattern.
- Surface claim state from `users.external_auth_id` through an owner-only
  staff-access roster projection so the shared task-assignment member list and
  direct `users` table RLS remain narrow.
- Add a copyable staff sign-in URL/path from the owner roster panel using the
  current browser origin when available.
- Keep copy explicit: this is local roster access, not invite email, Auth admin
  provisioning, notification delivery, or provider setup.
- Keep mobile stacked and no-horizontal-scroll.

## Non-goals

- New write workflow RPCs or mutations.
- Sending invite emails.
- Creating Supabase Auth users from the owner UI.
- Magic-link delivery, notifications, Retell/Resend/Gmail/live email, webhooks,
  billing, POS, ClubOS, or member-ledger writes.
- Hosted Supabase proof.
