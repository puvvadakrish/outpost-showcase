---
title: "Admin public request first-gym execution control batch"
date: 2026-07-01
status: captured
---

# Admin Public Request First-Gym Execution Control Batch

## What We're Building

Build a small control layer after the first-gym execution ledger so operators
can keep running the SaaS readiness batch continuously while the real
customer/hosted proof artifacts are still external blockers.

The batch should add:

- A missing-proof command packet derived from the execution ledger.
- A completion gate derived from the same ledger.
- Read-only Admin portal command guidance for both artifacts.

## Why This Approach

The execution ledger already answers which downstream proof artifacts are
`missing` or `inspectable`. The next useful product slice is not another proof
claim. It is an operator control surface that turns missing proof into the next
ordered command, and separately tells us whether all proof artifacts are
inspectable yet.

This preserves the product boundary: no public self-serve launch, invite
delivery, provider activation, billing, POS, access-control, or member-ledger
writes.

## Key Decisions

- The missing-proof packet is terminal-command-only and cannot record proof.
- The completion gate is derived from the ledger and can be blocked or ready,
  but it cannot authorize public launch.
- Both scripts re-run the execution ledger inspector and pin its SHA-256.
- Admin UI remains read-only; no browser approval or mutation controls are
  added.

## Open Questions

None for this slice. Real owner/customer proof still requires the owner to be
available and must be recorded through the existing proof commands.
