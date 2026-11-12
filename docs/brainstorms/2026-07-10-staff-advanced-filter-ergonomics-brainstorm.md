---
date: 2026-07-10
topic: staff-advanced-filter-ergonomics
---

# Staff Advanced Filter Ergonomics

## What We're Building

Make the staff workboard scannable again after the queue-observability batches.
Keep search, primary selects, result count, queue-state chips, and personal work
shortcuts immediately visible. Place secondary insight grids behind an
accessible Advanced filters disclosure, then add hidden-filter count and
advanced-only clearing as separate batches.

## Why This Approach

The insight projections are useful for investigation, but showing every grid by
default pushes the actual task list far below the first viewport, especially on
mobile. Removing those projections would discard useful SaaS observability.
Collapsing them preserves capability while restoring the work-first hierarchy.

The recommended sequence is:

1. Native disclosure with all existing secondary filters preserved.
2. Active hidden-filter count in the closed summary.
3. Clear advanced filters without clearing primary or personal queue state.

A wholesale workboard redesign was rejected as unnecessary. Terminal task
actions remain deferred because terminal work still has no reopen policy.

## Key Decisions

- Use native `<details>`/`<summary>` for keyboard and screen-reader semantics.
- Keep the disclosure closed by default and uncontrolled in batch 1.
- Keep all current chip interactions and filter composition unchanged.
- Treat workflow stage, trail, attention, proof, age, last touch, confidence,
  intent, next step, contact, follow-up, member boundary, owner policy, and
  action lane as advanced state.
- Keep source, channel, location, status, assignee, queue state, and search as
  primary state even when duplicate summary grids remain available inside the
  disclosure.
- Add no persistence, URL state, task write, provider behavior, notification,
  invite, or launch gate change.

## Open Questions

None. The existing filter state and native disclosure contract define the
three batches.

## Next Steps

Ship the disclosure, active hidden-filter count, and advanced-only clear action
as three independently reviewed and browser-tested PRs.
