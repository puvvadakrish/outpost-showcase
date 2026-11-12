---
date: 2026-07-10
topic: staff-my-ready-work
---

# Staff My Ready Work

## What We're Building

Add a personal workboard shortcut that returns the signed-in staff member to
tasks assigned to them with `new` status. The shortcut composes the existing
assignee and status filters and remains read-only.

## Why This Approach

Claim task assigns work without changing status. An unassigned `new` task
therefore becomes staff-owned ready work, but the current My open work shortcut
can include active and needs-help tasks too. My active work and My needs help
already provide focused retrieval for the later lifecycle states. My ready work
completes the same retrieval pattern for work waiting to be started.

The preferred approach is a fourth personal-work projection over existing
state. A combined Claim and Start command was rejected because ownership and
status are deliberately separate transactions. A terminal Done command remains
deferred because terminal tasks have no reopen policy.

## Key Decisions

- Label the shortcut "My ready work" and map it exactly to current-assignee
  `new` tasks.
- Count only rows assigned to the authenticated internal member.
- Compose the existing assignee and status filters while preserving every
  unrelated filter.
- Extend the shared pure transition contract so direct switching among ready,
  active, needs-help, and open shortcuts clears only shortcut-owned state.
- Keep the batch client/domain only with no migration, RPC, task write, event,
  audit event, notification, provider call, invite, or launch gate change.

## Open Questions

None. Claim behavior and the existing `new` status define the ready-work state.

## Next Steps

Implement the summary count, pure filter transition, responsive shortcut,
focused/full tests, CE review, and desktop/mobile Chrome verification.
