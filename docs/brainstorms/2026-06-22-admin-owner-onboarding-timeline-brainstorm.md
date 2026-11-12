---
date: 2026-06-22
topic: admin-owner-onboarding-timeline
status: captured
origin: user-request
---

# Admin Owner Onboarding Timeline Brainstorm

## What We're Building

Add a per-owner onboarding timeline to the Admin portal request row so an
operator can see the path from public beta request through fulfillment receipt,
owner sign-in, workspace bootstrap, handoff packet readiness, and rollback
classification in one customer-safe read-only view.

## Why This Approach

The original Outpost plan expects guided self-serve onboarding with concierge
assist, owner-approved setup, test flows, and emergency rollback before live
phone/email. The current product has many of those proof objects, but the Admin
portal requires operators to mentally join request, receipt, proof, and
rollback panels.

The smallest useful slice is a derived timeline over existing projections. It
does not add schema, browser mutations, invite delivery, live providers,
billing, POS, access control, or member-ledger writes.

## Key Decisions

- Keep the request row as the operator object; do not create a separate
  dashboard.
- Derive timeline state from existing request queue, fulfillment receipt,
  owner Auth link, tenant bootstrap, proof ledger, and owner readiness rollback
  row.
- Show customer-safe labels and proof state only. Do not expose secrets, command
  output, raw notes, tokens, cookies, API keys, or temporary passwords.
- Treat the handoff packet as ready only after workspace bootstrap and matching
  hosted proof records exist. Customer-observed proof remains a separate final
  gate.
- Treat rollback as ready only when the existing readiness row says the tenant
  shape is dry-run rollback ready.

## Non-Goals

- No new Neon tables or RPCs.
- No Admin portal approve/fulfill/reset buttons.
- No public self-serve account creation.
- No invite delivery, notification delivery, live phone/email provider setup,
  billing, POS, access control, or member-ledger writes.

## Open Questions

None for this slice.
