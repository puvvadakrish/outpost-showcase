---
title: Beta Owner Completion Record Brainstorm
date: 2026-06-22
status: captured
---

# Beta Owner Completion Record Brainstorm

## What We're Building

Add a generic observed-session completion recorder for any operator-assisted
beta owner handoff. It should consume the generic beta owner handoff packet,
require explicit operator confirmations, and write non-secret JSON evidence
under ignored artifacts.

## Why This Approach

The generic packet makes a handoff repeatable, but it intentionally does not
prove that a customer observed the session. The next gap is a consistent record
that says a specific operator-assisted walkthrough happened without stop
concerns, while still preserving the boundaries around self-serve, invite
delivery, live providers, billing, POS, access control, and member-ledger
writes.

## Key Decisions

- Add `beta:owner-handoff:complete` as a generic counterpart to the Acme Fitness customer-observed completion command.
- Consume the generated beta owner packet rather than re-reading hosted Neon or
  Vercel state.
- Require explicit confirmations for Preview URL, owner sign-in, owner
  workspace, first workflow, reset/rotate review, live gates blocked, and no
  unexpected data.
- Require stop concerns to be exactly `none` for a green record.
- Write JSON evidence only under ignored `artifacts/` when repo-local.
- Keep the record as support evidence, not product state.

## Rejected Approaches

- Add database support records. That is premature while customer-observed proof
  is still an operator evidence artifact.
- Reuse the ACME completion command. It correctly validates ACME dry-run packet
  fields and should stay customer-zero-specific.
- Treat packet generation as completion. A packet is only the plan; completion
  requires observed-session confirmations.

## Success Criteria

- A generic command writes non-secret JSON from a valid beta owner handoff
  packet and explicit confirmations.
- The command fails closed when any observed gate is missing, stop concerns are
  not `none`, packet live-provider state is not blocked, or output path is
  unsafe.
- Tests prove success and failure modes.
- Durable docs keep self-serve and live-provider gates blocked.

## Open Questions

None for this slice.
