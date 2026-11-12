---
date: 2026-07-10
topic: staff-my-needs-human
---

# Staff My Needs Help

## What We're Building

Add a personal workboard shortcut that returns the signed-in staff member to
tasks assigned to them with `needs_human` status. The shortcut composes the
existing assignee and status filters and remains read-only.

## Why This Approach

Staff can now claim work, start it, and mark active work as needing human
attention. That last command removes the task from My active work, while My
open work can still be broader than the immediate follow-up need. A dedicated
personal shortcut closes that retrieval loop using state the product already
owns.

The preferred approach is a third personal-work projection beside My open work
and My active work. A terminal Done command remains deferred because terminal
tasks still have no reopen policy. An owner alert or notification remains
deferred because no delivery contract exists and `needs_human` currently means
status only.

## Key Decisions

- Label the shortcut "My needs help" to fit the compact workboard while making
  the personal follow-up need clear without implying an alert was delivered.
- Count only `needs_human` tasks assigned to the authenticated internal member.
- Compose the existing assignee and status filters; preserve every unrelated
  filter.
- Switching directly among personal shortcuts clears only queue/status state
  owned by the previous shortcut.
- Keep the batch client/domain only with no migration, RPC, task write, event,
  audit event, notification, provider call, invite, or launch gate change.

## Open Questions

None. The existing personal-work filter contract and `needs_human` status define
the behavior.

## Next Steps

Implement the summary count, pure filter transition, workboard shortcut,
focused tests, full checks, CE review, and desktop/mobile browser verification.
