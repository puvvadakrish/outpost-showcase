---
date: 2026-06-29
topic: admin-first-gym-evidence-batch
status: captured
---

# Admin First Gym Evidence Batch Brainstorm

## What We're Building

Create the next continuous SaaS readiness batch after approved-gym hosted
rehearsal readiness. The batch should close the gap between an internal
approved-gym rehearsal checklist and a first real gym operator-assisted run,
without treating readiness as public launch or live-provider proof.

The batch adds two terminal-only evidence steps:

- record non-secret approved-gym hosted rehearsal evidence after browser/operator
  checks pass;
- prepare a first-gym go/no-go bundle only after that rehearsal evidence and a
  real customer-observed session record both exist.

## Why This Approach

The existing repo already has the strict customer-observed session recorder, so
duplicating that gate would create two sources of truth. The safer pattern is
to compose around it: rehearsal evidence before the customer session, go/no-go
bundle after the customer session.

This keeps proof states separate:

- readiness prepared;
- hosted rehearsal observed;
- customer-observed completion recorded;
- first-gym go/no-go bundled;
- public self-serve and live-provider gates still blocked.

## Key Decisions

- Reuse `admin:customer-session:record` for customer-observed completion.
- Add a new hosted rehearsal evidence command that requires explicit yes
  confirmations for owner workspace, staff workboard, reset/rollback, no
  unexpected data, no invite delivery, no live-provider claims, and no
  billing/POS/member writes.
- Add a first-gym go/no-go bundle that chains hosted rehearsal evidence and the
  customer-observed session record by SHA.
- Keep the Admin portal read-only: commands and gate state only, no approval,
  provisioning, invite, provider, billing, POS, or member-ledger actions.

## Open Questions

None for implementation. The actual first-gym operator-assisted run still
requires a real owner/staff session outside automation.
