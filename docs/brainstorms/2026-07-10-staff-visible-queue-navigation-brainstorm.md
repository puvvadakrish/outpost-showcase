---
date: 2026-07-10
topic: staff-visible-queue-navigation
---

# Staff Visible Queue Navigation

## What We're Building

Help staff process a filtered task queue without repeatedly searching the list.
Ship three adjacent batches: selected-task position within the current visible
queue, bounded Previous/Next navigation, and a return link from task detail to
the selected workboard row.

## Why This Approach

Outpost now exposes strong queue filtering and personal work shortcuts, but the
selected detail does not explain its place in the filtered result and offers no
direct way to move through or return to that result. These additions complete a
reversible read-only queue-review loop using state already loaded for the
tenant. They do not add another observability grid or workflow artifact.

Automatic advancement after a task mutation was rejected because status and
assignment changes can remove a task from the current filters; silently moving
the selection would make action reconciliation harder to understand. Keyboard
shortcuts were rejected for now because arrow keys either conflict with native
page scrolling and form controls or require a larger roving-focus contract.

## Key Decisions

- Position and adjacency operate on `visibleTasks`, after every active filter
  and the existing inbox sort.
- Invalid or empty selection reports zero position and exposes no navigation.
- Previous and Next stop at queue boundaries instead of wrapping.
- Navigation changes local selection only and does not mutate task state or
  rewrite filters.
- The return link targets the selected task row, not just the top of the page,
  so the mobile detail-to-queue loop preserves context.
- Add no persistence, URL filter state, task write, provider behavior,
  notification, invite delivery, public self-serve, billing, POS,
  access-control, or member-ledger behavior.

## Open Questions

None. The current sorted visible queue and selected-task state define the
behavior.

## Next Steps

Ship position context, Previous/Next navigation, and selected-row return as
three independently reviewed and browser-tested PRs.
