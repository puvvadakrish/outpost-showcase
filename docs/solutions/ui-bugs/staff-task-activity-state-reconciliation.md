---
title: "Staff task activity state reconciliation"
category: ui-bugs
status: documented
date: 2026-06-15
components:
  - staff task workboard
  - task events
  - server actions
related_files:
  - src/components/staff/StaffTaskWorkspaceClient.tsx
  - src/domain/tasks.ts
  - tests/tasks.test.ts
---

# Staff Task Activity State Reconciliation

## Problem

The staff task detail panel was backed by persisted `task_events`, but the UI
rendered raw event cards and mostly relied on route revalidation after backend
actions. That made notes, status changes, assignment changes, and manual task
creation feel less immediate than the staff workboard should feel.

## Root Cause

The persistence model was already good enough: status, assignment, note, manual
task, and answer-derived task writes all create task rows/events through
transactional RPCs. The missing piece was a reusable domain projection and a
client reconciliation pattern for returned server-action payloads.

## Solution

Keep `task_events` as the single activity source of truth and project it into
display-ready activity items:

- `created` -> creation activity
- `assigned` -> assignment activity
- `status_changed` -> status activity with from/to labels
- `note_added` -> staff note activity
- other event types -> system activity

In the client, reconcile returned server-action payloads into the current
workboard state:

- Returned `task` payloads replace or prepend the matching task.
- Returned `taskEvent` payloads prepend only if that event id is not already in
  state.
- Note events update the selected task recency locally.
- Route revalidation still remains the source-of-truth refresh for the full
  event timeline. Status and assignment actions update the task row immediately,
  while their event rows arrive with the backend refresh unless those actions
  later return task events too.

This gives staff immediate feedback without trusting client state for tenant
authorization or persistence.

## Verification Pattern

For similar staff-workboard UI slices:

1. Unit test domain projections for tenant filtering, ordering, and
   classification.
2. Run the full local proof suite: `db:reset`, `db:verify:rls`, typecheck,
   tests, and build.
3. Browser-smoke the affected staff action against local Supabase Auth/RPC.
4. Reset the local database back to seed state after smoke testing.

## Boundaries

This pattern does not add new write authority. Server actions and Supabase RPCs
remain the mutation boundary, and RLS remains the tenant boundary. Do not use
client reconciliation as proof that persistence or authorization succeeded.
