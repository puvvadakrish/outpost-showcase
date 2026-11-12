---
date: 2026-07-09
topic: staff-task-focus-and-review
---

# Staff Task Focus And Review

## What We're Building

Help staff return directly to work already in progress, then let the current
assignee mark active work as needing human review. Ship the personal active
queue shortcut and reversible status command as separate batches.

## Why This Approach

Claim, Release, and Start work now cover ownership and entry into active work.
The next shift-level friction is finding that active work again and pausing it
honestly when another human decision is required. Existing assignee/status
filters and the existing status transaction already model both needs.

A terminal quick action remains deferred because `done` and `ignored` cannot
reopen. A new notification or owner-alert workflow was rejected because no
delivery contract exists. The command must say only that task status changed.

## Key Decisions

- My active work composes the existing current-assignee and `in_progress`
  filters; every other filter remains active.
- Personal active counts are derived from tenant-loaded task rows and the
  authenticated internal member ID.
- Mark needs human appears only for the current assignee's `in_progress` task.
- The server derives `needs_human` and ignores submitted target status.
- Mark needs human preserves assignment and does not send or imply a
  notification, escalation, or owner alert.
- Both batches reuse existing domain, authorization, transaction, event, audit,
  and action-reconciliation patterns with no migration or RPC.

## Open Questions

None. Existing filters and status transitions define the behavior.

## Next Steps

Ship My active work first, then Mark needs human.
