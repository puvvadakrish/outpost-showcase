---
topic: task-terminal-outcome-followthrough
date: 2026-07-12
status: decided
---

# Task Terminal Outcome Follow-Through

## What We're Building

Add explicit Mark ignored for owned active work, then add My completed work and
My ignored work personal queues so terminal outcomes remain retrievable and
reopenable.

## Key Decisions

- Mark ignored uses current-assignee `in_progress` UI eligibility.
- The server derives `ignored` and ignores submitted target status.
- Existing status RPC/event/audit/reopen authority remains unchanged.
- Completed and ignored shortcuts compose existing assignee/status filters.
- Shortcuts remain transient client state and preserve unrelated filters.

## Boundaries

No outcome analytics, notification, provider, invite, public self-serve,
billing, POS, access-control, or member-ledger behavior.

## Open Questions

None.
