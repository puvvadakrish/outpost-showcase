---
title: Customer Handoff Proof Records
date: 2026-06-22
status: complete
origin: docs/brainstorms/2026-06-22-customer-observed-handoff-gate-brainstorm.md
---

# Customer Handoff Proof Records

## What We're Building

Persist reviewed customer-observed beta handoff gate results in hosted Neon so
the founder-admin console can show whether a protected Preview has durable
customer-observed proof. The record is imported from the existing sanitized
`beta:owner-handoff:gate` artifact after an operator review, not entered through
a customer-facing web form.

The feature is a proof ledger, not a product unlock. It records that the gate
artifact was valid for a Preview and Neon branch, then keeps phone/email
providers, invite delivery, notifications, billing, POS, access control, and
member-ledger writes blocked.

## Why This Approach

The previous gate slice intentionally writes a customer-safe JSON artifact under
`artifacts/` and rejects internal/dry-run evidence. The missing SaaS step is
durability: a later operator or founder-admin should not have to remember which
artifact was reviewed or whether it matched the hosted Preview.

The existing `hosted_proof_runs` pattern is the right architecture. Operator
scripts append sanitized proof rows through a Neon owner connection, RLS blocks
direct table reads, and `/founder-admin` reads only a security-definer
projection gated by active app-admin plus `founder_admin` membership.

## Key Decisions

- Add an append-only Neon table for customer handoff gate records.
- Expose records through a founder-admin-only read RPC; do not add any web
  insert/update/delete action.
- Import from the final gate artifact with a new operator CLI command after the
  artifact has already passed validation.
- Use a deterministic source artifact SHA as the idempotency key so re-running
  the import does not duplicate proof.
- Store only labels, status, Preview origin, Neon branch, session/generated
  timestamps, blocked-gate summary, and source artifact hash.
- Reject local origins, production/spike Neon branches, mismatched branch or
  Preview values, and secret-shaped content before writing.
- Keep `/founder-admin` read-only: show status, recent records, and commands,
  but no support mutation buttons or rollback execution.

## Out Of Scope

- Public self-serve signup.
- Customer or owner-submitted proof writes.
- Invite delivery or email/SMS notification sending.
- Phone/email provider activation, Retell, Resend, Gmail, webhooks, or live
  routing.
- Billing, POS, access control, Club OS replacement, or member-ledger writes.
- Automatic rollback execution or support mutation buttons.
- Claiming a customer-observed handoff without a real external participant.

## Success Criteria

- A hosted Neon migration creates an RLS-locked customer handoff proof table and
  founder-admin-only projection.
- A new npm command imports a sanitized customer-observed gate artifact into
  hosted Neon and fails closed on unsafe env, artifact, branch, origin, or
  secret-shaped data.
- `/founder-admin` marks the customer-observed handoff gate ready only when a
  persisted record matches the current Preview origin.
- Founder/admin proof scripts verify the new projection is readable only by a
  founder-admin session and denied to owner, staff, and anonymous sessions.
- Tests cover migration shape, domain ledger behavior, repository/UI wiring,
  operator command boundaries, and no-live-provider gates.
