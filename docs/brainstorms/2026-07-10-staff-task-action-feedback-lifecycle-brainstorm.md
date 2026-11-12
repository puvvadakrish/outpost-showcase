---
topic: staff-task-action-feedback-lifecycle
date: 2026-07-10
status: decided
---

# Staff Task Action Feedback Lifecycle

## What We're Building

Expire selected-task backend status, assignment, and handoff-note result copy
after five seconds. Ship one reviewed batch per action lane over one shared
client hook.

## Why This Approach

Target scoping prevents feedback from appearing on the wrong task, but the
latest action state otherwise persists indefinitely and reappears whenever
staff returns to that task. A short lifecycle matches the existing clipboard
feedback behavior while the durable task/event activity remains available.

## Key Decisions

- Use one hook for target matching, result identity, timer cleanup, and expiry.
- Compare action-state object identity rather than message text so repeated
  identical failures are treated as new results.
- Keep feedback visible for five seconds only while its task remains selected.
- Add `role="status"` to migrated result copy for polite assistive announcement.
- Status, assignment, and note lanes migrate in separate batches.
- Persistence, reconciliation, task events, and audits remain unchanged.

## Rejected Alternatives

- Persisting dismissed result IDs adds state for non-durable UI feedback.
- Message-string keys suppress legitimate repeated identical failures.
- Permanent feedback is redundant with the durable activity trail and becomes
  stale after later work.

## Boundaries

No mutation, authorization, RPC, migration, notification, outbound delivery,
provider, invite, public self-serve, billing, POS, access-control, or
member-ledger behavior.

## Open Questions

None.
