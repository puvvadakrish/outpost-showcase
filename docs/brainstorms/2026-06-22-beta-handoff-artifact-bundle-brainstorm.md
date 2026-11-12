---
date: 2026-06-22
topic: beta-handoff-artifact-bundle
status: captured
origin: user-request
---

# Beta Handoff Artifact Bundle Brainstorm

## What We're Building

Add one generic operator command that prepares the beta owner handoff checklist
and customer-safe packet together, then writes a small non-secret manifest that
records where the preparation artifacts landed.

## Why This Approach

The current handoff path has the right proof boundaries, but the operator still
has to remember to run checklist and packet generation separately with matching
environment values. A bundle command reduces drift between artifacts while
keeping completion, gate validation, and hosted proof import as separate manual
steps.

This is a better next slice than adding browser controls because the existing
no-live-provider gate should remain visible and conservative until a real
external owner observes the workflow.

## Key Decisions

- Add `npm run beta:owner-handoff:bundle`.
- Reuse the existing checklist and packet generators rather than duplicating
  rendered content.
- Require explicit gym, owner email, Preview URL, Neon branch, and bundle
  manifest path inputs.
- Default checklist, packet, completion, and gate artifact paths from the gym
  slug when the operator does not provide explicit paths.
- Write a secret-scanned JSON manifest under ignored `artifacts/` when
  repo-local.
- Keep completion recording, final gate validation, hosted proof import, owner
  account creation, invite delivery, provider setup, billing, POS, access
  control, and member-ledger writes out of scope.

## Open Questions

None for this slice.
