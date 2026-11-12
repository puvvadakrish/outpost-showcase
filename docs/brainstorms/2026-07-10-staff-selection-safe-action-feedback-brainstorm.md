---
topic: staff-selection-safe-action-feedback
date: 2026-07-10
status: decided
---

# Staff Selection-Safe Action Feedback

## What We're Building

Make backend status, assignment, and handoff-note results remain associated
with the task that was submitted even if staff changes the selected task while
the server action is pending. Ship one independently reviewed batch per action
lane.

## Why This Approach

The backend already commits against the task ID captured in each submitted
form, and authoritative task/event reconciliation should still update that
task. The gap is presentation ownership: action messages currently render in
whichever task detail happens to be selected, and note completion can force
selection back. Returning the submitted opaque task ID gives the client enough
context to scope feedback without adding request registries, cancellation, or
new persistence.

## Key Decisions

- Add optional `taskId` context to the existing action-state contract.
- Each task-specific action returns its submitted task ID on success and on
  failures after submission; the ID remains opaque and tenant authorization is
  unchanged.
- Reconcile authoritative tasks and events regardless of current selection.
- Render action feedback only when its target matches the selected task.
- Status, assignment, and note lanes migrate in separate batches.
- Note completion must not change selection. Note text is selection-scoped and
  cleared when selection changes so it cannot be reused on another task.
- Keep manual task creation behavior unchanged because successful creation is
  intentionally selected.

## Rejected Alternatives

- Client request registries or abort controllers add coordination without
  canceling the server mutation.
- Global toast feedback still loses task context.
- Disabling queue navigation during saves would block useful work and would not
  fix stale feedback after failures.

## Boundaries

No authorization change, mutation semantics change, new RPC, migration,
notification, outbound delivery, provider behavior, invite, public self-serve,
billing, POS, access-control, or member-ledger behavior.

## Resolved Questions

- Authoritative reconciliation remains global; only feedback and draft
  presentation are selection-scoped.
- An absent task ID never matches a selection, preserving the empty initial
  action state.

## Open Questions

None.
