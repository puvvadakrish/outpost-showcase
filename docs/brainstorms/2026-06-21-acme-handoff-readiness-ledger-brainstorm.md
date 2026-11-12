---
title: Acme Fitness Handoff Readiness Ledger Brainstorm
date: 2026-06-21
status: captured
---

# Acme Fitness Handoff Readiness Ledger Brainstorm

## What We're Building

Add a small owner/operator readiness ledger that makes the current Acme Fitness handoff state unambiguous: internal protected-Preview proof is complete,
but the customer-observed Acme Fitness walkthrough is still pending until the
owner or staff observer is actually available.

## Why This Approach

The immediate product risk is not missing backend capability. The risky gap is
operational ambiguity: an internal dry run can look similar to a real customer
handoff unless the UI and runbook keep those states separate. A read-only ledger
uses existing proof commands and artifacts without adding schema, RPCs, support
access, providers, notifications, billing, POS behavior, or member-ledger
writes.

## Key Decisions

- Treat the ACME owner-observed handoff as a later gate, not a blocker for this
  internal slice.
- Show the ledger inside `/owner` near existing beta-readiness surfaces so the
  operator sees it during protected Preview checks.
- Keep the ledger derived/static for now; do not add database state until there
  is more than one customer-zero style handoff to track.
- Reuse existing commands: `acme:dry-run:onboarding`,
  `acme:customer-handoff:packet`, and `acme:customer-handoff:complete`.
- Preserve no-live-provider copy directly in the ledger.

## Rejected Approaches

- Do nothing and rely on chat memory. This would repeat the same confusion in
  the next handoff session.
- Add a persisted handoff-state table now. That is premature while the next gate
  is one customer-observed walkthrough with disposable proof artifacts.
- Build customer self-serve onboarding now. The protected Preview handoff gate
  must be green before broadening to self-serve signup.

## Success Criteria

- `/owner` shows internal proof as done and customer-observed handoff as pending.
- The UI lists the exact operator commands and customer-safe packet flow.
- The UI states that live-provider productization remains blocked.
- Tests prove the ledger is read-only and does not introduce new persistence.
- `AGENTS.md`, `PLOT.md`, and the ACME runbook carry the same durable state.

## Open Questions

None for this slice.
