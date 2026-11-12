---
topic: task-terminal-lifecycle
date: 2026-07-11
status: decided
---

# Task Terminal Lifecycle

## What We're Building

Add one audited recovery path from terminal tasks, expose it as a server-derived
staff Reopen task command, then add one-click Mark done for owned active work.

## Key Decisions

- `done` and `ignored` may transition only to `new`; all other terminal exits remain invalid.
- Reopen preserves assignment and writes `reopened` task event plus `task.reopened` audit action.
- Reuse `update_task_status`; PostgreSQL row lock and transition validation stay authoritative.
- Reopen and Mark done derive target status server-side and ignore submitted target status.
- Reopen is available to active same-tenant staff under the existing status authorization contract.
- Mark done is limited ergonomically to the current assignee's `in_progress` task.

## Boundaries

No notification, outbound delivery, provider, invite, public self-serve,
billing, POS, access-control, or member-ledger behavior.

## Open Questions

None.
