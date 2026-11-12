---
date: 2026-07-09
topic: staff-task-ownership-workflow
---

# Staff Task Ownership Workflow

## What We're Building

Make the authenticated staff member's open work directly reachable, then let
that staff member claim an unassigned selected task through the existing
assignment workflow. Ship the personal queue shortcut and claim command as two
separate batches.

## Why This Approach

Deep links and copy-link handoff make a task addressable, but they do not make
ownership efficient. The existing membership session already resolves the
authenticated internal user row, and the existing assignment RPC already
authorizes, locks, audits, and persists assignment changes. Exposing the
internal member ID at the server session boundary closes the identity gap
without adding authority; a personal queue shortcut and claim command then
reuse existing filters and writes.

An unassigned shortcut was rejected because the assignee and workflow-stage
filters already provide it. A quick start-work command was deferred because it
invites a composite claim-plus-status mutation. A templated handoff note was
also deferred because notes and copy-link handoff already cover that workflow.

## Key Decisions

- Keep auth-provider IDs and internal Outpost user IDs explicitly separate.
- Resolve the internal ID from the authenticated membership row, never from
  email matching or client input.
- Implement My open work by setting the existing Open and Assignee filters.
- Reuse the existing assignment action, RPC, task event, audit event, and local
  draft path for Claim; do not add a migration or claim-specific RPC.
- Keep claim and status transition separate. Existing assignment remains
  last-write-wins under concurrent staff use until real collision evidence
  justifies an expected-assignee contract.

## Open Questions

None. The existing session, tenant, assignment, and filter boundaries define
the behavior.

## Next Steps

Implement My open work first, then add one-click Claim as a separate PR.
