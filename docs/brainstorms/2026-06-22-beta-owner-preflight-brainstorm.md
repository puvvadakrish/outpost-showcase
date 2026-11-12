---
title: Beta Owner Preflight Brainstorm
date: 2026-06-22
status: captured
---

# Beta Owner Preflight Brainstorm

## What We're Building

Add a customer-facing beta owner preflight surface that makes the current
Outpost onboarding state obvious before and during first-run owner setup. It
should tell an operator-assisted beta owner what is ready, what they can do in
the protected Preview, and which self-serve or live-provider capabilities remain
blocked.

## Why This Approach

The Acme Fitness internal dry run is complete, but the real customer-observed
handoff is intentionally pending. The next useful SaaS step is not phone/email
productization; it is making the current beta access path explain itself to the
next gym without relying on the operator to narrate every boundary. A read-only
preflight helper keeps the slice low-risk and reusable.

## Key Decisions

- Put preflight copy on `/owner/sign-in` so a beta owner sees the current model
  before authenticating.
- Reuse the same preflight inside the seedless owner bootstrap screen so a new
  owner sees what happens next before creating their workspace.
- Represent the state as derived/static product guidance for now. Do not add
  schema, RPCs, support records, invites, notifications, providers, billing, or
  POS/member-ledger behavior.
- Keep the Acme Fitness customer-observed gate as the prerequisite before
  claiming real-customer readiness or public self-serve onboarding.
- Make the blocked gates explicit: invite delivery, phone/email automation,
  notifications, billing, POS, access control, and member-ledger writes.

## Rejected Approaches

- Build public self-signup now. The real Acme Fitness observed handoff is not
  complete, so public onboarding would outrun proof.
- Add a persisted onboarding-state model. The current problem is clarity around
  a known beta path, not missing durable state.
- Start phone/email provider productization. That remains gated on the
  customer-observed Acme Fitness handoff.

## Success Criteria

- `/owner/sign-in` shows a concise beta access preflight before login.
- First-run owner bootstrap also shows the same preflight boundaries.
- Tests prove the preflight is read-only and keeps self-serve/live-provider
  gates blocked.
- `AGENTS.md` and `PLOT.md` record the durable state and next gate.

## Open Questions

None for this slice.
