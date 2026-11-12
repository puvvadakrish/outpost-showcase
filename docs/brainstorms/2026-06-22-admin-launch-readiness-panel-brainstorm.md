---
topic: admin-launch-readiness-panel
created: 2026-06-22
---

# Admin Launch Readiness Panel Brainstorm

## What We're Building

Add a read-only `/admin` panel that explains how to generate and inspect the
launch-readiness export artifact from the current proof ledger. It should show
the artifact gates, the command sequence, and the blocked self-serve/live-provider
boundary without adding browser approval or mutation controls.

## Why This Approach

The admin portal is now the internal operator route. It should show the next
artifact-producing step directly where operators inspect beta readiness, but it
must not become a support mutation surface. A read-only panel keeps the product
usable while preserving the terminal-only proof workflow.

## Key Decisions

- Derive panel state from existing `FounderAdminProofStatusLedger`,
  owner-readiness projection, beta request projection, and self-serve matrix.
- Show commands as copyable-looking code text only; no buttons or form fields.
- Keep the public self-serve launch gate hard blocked until a later reviewed
  slice deliberately replaces it.
- Use existing admin portal panel/list styling and status pills rather than a
  new visual system.

## Open Questions

None for this slice.

