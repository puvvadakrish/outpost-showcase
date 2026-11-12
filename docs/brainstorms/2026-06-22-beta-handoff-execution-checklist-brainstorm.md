---
date: 2026-06-22
topic: beta-handoff-execution-checklist
status: captured
origin: user-request
---

# Beta Handoff Execution Checklist Brainstorm

## What We're Building

Add a generic operator run sheet generator for beta owner handoffs. The run
sheet should make the existing packet, completion, gate, and hosted record
commands executable in the right order without relying on chat memory.

## Why This Approach

The current product already has the hard safety pieces: packet generation,
customer-observed completion recording, final gate validation, hosted proof
record import, and Admin portal visibility. The remaining risk is operator
coordination. A customer handoff can be mishandled if the operator misses an
environment variable, confuses packet readiness with customer-observed
completion, or forgets the final record import.

The smallest useful slice is a non-mutating CLI artifact that writes a
customer-safe Markdown checklist under ignored `artifacts/`. It is easier to
review, repeat, and share internally than another long runbook section.

## Key Decisions

- Create a new `npm run beta:owner-handoff:checklist` command.
- Generate Markdown only; do not create accounts, fulfill requests, record
  completion, import hosted proof, or mutate hosted data.
- Require explicit gym, owner, Preview URL, Neon branch, operator, and artifact
  path inputs.
- Include placeholder commands for packet, completion, final gate, and hosted
  record import.
- Keep the completion section visibly customer-observed and manual.
- Keep all outputs secret-scanned and confined to ignored `artifacts/` when
  repo-local.
- Surface the checklist command in the existing owner beta support ledger as
  the first operator command.

## Non-Goals

- No public self-serve onboarding.
- No browser mutation controls.
- No invite delivery, notification sending, phone/email providers, billing,
  POS, access control, or member-ledger writes.
- No claim that a packet, checklist, internal smoke, or hosted proof means a
  customer-observed handoff has completed.

## Open Questions

None for this slice.
