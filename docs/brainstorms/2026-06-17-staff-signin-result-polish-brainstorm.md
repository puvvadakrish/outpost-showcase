# Staff sign-in result polish brainstorm

Date: 2026-06-17

## What we're building

Polish `/staff/sign-in` so local beta staff can understand what happened after
they try to sign in or create an account:

1. wrong credentials stay a credential problem,
2. not-rostered email tells the staff member to ask the owner to add access,
3. already-claimed roster rows explain that the owner must resolve the roster
   link,
4. unconfirmed email tells the staff member to confirm the account email, and
5. successful local sign-up without an immediate session tells the staff member
   to confirm and return.

## Why this approach

The backend claim RPC already owns the security boundary and denial reasons. The
screen needs to translate those existing outcomes into operational next steps
without adding invite email, Auth admin provisioning, hosted proof, or live
providers.

## Key decisions

- Keep one page with two forms, but add a shared result panel that names the
  current state and next step.
- Extend server-action return state with a stable UI kind instead of parsing
  messages in the client.
- Keep the proof strip and forms compact on desktop, then stack everything on
  mobile with no horizontal overflow.
- Document this as an auth result-state pattern in `DESIGN.md`.

## Non-goals

- New schema, migrations, or RPCs.
- Owner-triggered invite delivery or Supabase Auth admin provisioning.
- Hosted Supabase proof.
- Retell, Resend, Gmail, notifications, billing, POS, ClubOS, member-ledger
  writes, or live phone/email behavior.
