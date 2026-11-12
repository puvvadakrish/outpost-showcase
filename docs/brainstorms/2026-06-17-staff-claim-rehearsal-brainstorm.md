# Staff claim rehearsal brainstorm

Date: 2026-06-17

## What we're building

Add a local-only verifier for the new staff claim path:

1. seeded owner signs in through local Supabase Auth,
2. owner adds a new staff roster row through existing staff-access RPC,
3. owner projection sees the row as active but not claimed,
4. staff signs up with the matching email and claims the roster row,
5. owner projection sees the same row as claimed.

The owner staff-access panel should also point to this command so local beta
testing has a repeatable proof path.

## Why this approach

The app already has the persistence boundaries: owner-managed staff row upsert,
owner-only staff-access projection, and authenticated staff claim. The missing
piece is executable proof that a brand-new local staff account can move from
`Needs claim` to `Claimed` without invite email or Auth admin provisioning.

## Key decisions

- Add a separate reset-backed script instead of expanding the broader local beta
  rehearsal. This keeps failures easy to diagnose.
- Use only the public local Supabase publishable/anon key. Reject service-role
  keys and non-local Supabase hosts.
- Drive the flow through existing Auth and RPC boundaries; do not write tables
  directly.
- Keep the owner UI pointer compact and attached to the staff-access panel.

## Non-goals

- Sending invite email or magic links.
- Creating Supabase Auth users from the owner UI.
- Live providers, notifications, webhooks, billing, POS, ClubOS, or
  member-ledger writes.
- Hosted Supabase proof.

