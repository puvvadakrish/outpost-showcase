---
date: 2026-07-09
topic: staff-task-active-workflow
---

# Staff Task Active Workflow

## What We're Building

Complete the next reversible steps in the staff ownership workflow: let the
current assignee release a selected task, then let the current assignee start
selected `new` or `needs_human` work. Ship each command as a separate batch.

## Why This Approach

Claim and My open work make ownership usable, but correcting a claim still
requires the generic assignee control and beginning work still requires the
generic status control. Release and Start work are narrow ergonomic commands
over transactions Outpost already authorizes, locks, audits, and reconciles.
They keep assignment and status as separate operations.

One-click Mark done was rejected for this sequence because `done` and `ignored`
are terminal and the current lifecycle has no reopen transition. Increasing
the convenience of an irreversible write before adding deliberate confirmation
or reopen policy would be unsafe. A read-only alternative was also rejected
because the existing queue already exposes ownership and workflow-stage state;
the remaining friction is the staff command path.

## Key Decisions

- Release appears only when the selected task is assigned to the current staff
  member and uses a server-derived assignment intent with no submitted assignee.
- Release preserves status and retains existing last-write-wins assignment
  concurrency semantics.
- Start work appears only for selected work assigned to the current staff
  member with status `new` or `needs_human`.
- Start work derives `in_progress` on the server and preserves assignment.
- Both commands reuse existing transactions, events, audit records, action
  reconciliation, and local draft behavior; no migration or RPC is added.
- UI eligibility is an ergonomic constraint, not a new authorization claim.
  Existing active-member tenant/RPC authorization remains authoritative.

## Open Questions

None. Existing assignment and status transactions define the behavior.

## Next Steps

Ship Release task first, then Start work. Keep terminal quick actions deferred.
