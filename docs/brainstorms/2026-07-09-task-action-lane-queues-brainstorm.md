---
date: 2026-07-09
topic: task-action-lane-queues
---

# Task Action-Lane Queues

## What We're Building

Complete the read-only action-lane workflow by exposing bounded Admin and Owner
queues for the existing `staff_reply_ready` and `member_system_hold` lanes. Each
queue shows the requester, intent, and current suggested next step in the same
inbox order used by the staff workboard.

## Why This Approach

The action-lane summary already establishes the product boundary and precedence.
Small lane-specific projections make the aggregate counts actionable without
adding assignment, approval, outbound delivery, or member-system controls. A
single generic projection helper avoids three copies of the same sort, filter,
limit, and map behavior while preserving named public helpers for each workflow.

## Key Decisions

- Add the staff reply-ready queue first, then the member-system hold queue.
- Keep both queues read-only and capped at four rows by default.
- Reuse `taskStaffActionLaneForTask()` so member-system and owner-policy
  precedence cannot drift between counts and queue membership.
- Keep raw requester contact data out of Admin and Owner queue summaries.
- Preserve all public self-serve, provider, delivery, billing, POS,
  access-control, and member-ledger gates.

## Open Questions

None. The existing action-lane contract and owner-policy queue establish the
required behavior.

## Next Steps

Create and execute one plan per queue so each batch remains independently
reviewable and revertible.
