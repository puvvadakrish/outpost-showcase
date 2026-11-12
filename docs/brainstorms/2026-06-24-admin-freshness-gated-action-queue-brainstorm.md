---
title: Admin Freshness-Gated Action Queue
date: 2026-06-24
status: captured
---

# Admin Freshness-Gated Action Queue Brainstorm

## What We're Building

Add the next two SaaS support slices after Admin proof freshness:

1. Make the Admin operator next-action queue treat stale or missing proof
   freshness as the highest-priority operator action.
2. Extend the Admin next-action export/inspect artifact to include proof
   freshness state and fail closed when stale evidence is being exported as
   actionable.

## Why This Approach

The proof freshness panel now shows drift, but the queue can still point to a
later launch or handoff action first. Operators should not have to cross-check
two panels under pressure. Freshness should gate the queue, and the exported
queue artifact should carry the same safety state outside the browser.

## Key Decisions

- Reuse `founderAdminProofFreshnessSummary()` as the source of truth.
- Insert one queue action near the top: done when freshness is fresh, next when
  stale or missing, blocked when Preview/branch context is absent.
- Keep the command terminal-only: run the freshness export/inspect path, then
  rerun/import the missing proof command shown by the freshness panel.
- Add freshness metadata to `admin:next-actions:export`.
- Make `admin:next-actions:inspect` reject queue artifacts that present a next
  action while proof freshness is stale, missing, or blocked.

## Non-Goals

- No hosted writes or new tables.
- No browser approval buttons or mutation controls.
- No customer-observed completion claim.
- No public self-serve, invite delivery, notifications, phone/email providers,
  billing, POS, access control, or member-ledger writes.

## Success Criteria

- `/admin` next-action queue surfaces stale/missing proof freshness before later
  launch/handoff actions.
- Fresh queue artifacts include freshness state and counts.
- Queue inspect fails closed when freshness is not fresh.
- Existing no-live-provider boundaries remain explicit in UI, scripts, and
  tests.
