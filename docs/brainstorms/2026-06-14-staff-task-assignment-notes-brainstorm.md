---
topic: staff-task-assignment-notes
status: complete
date: 2026-06-14
---

# Staff Task Assignment And Notes Brainstorm

## What We're Building

Persist the existing staff task detail controls that are still browser-local:
task assignment and staff notes. This is the next smallest backend slice after
manual task creation, task status persistence, manual source intake, answer
proposal staging, and owner answer review queue persistence.

The slice covers existing task rows only. It lets an active tenant member:

- Assign an existing tenant task to an active member of the same tenant, or
  clear the assignee.
- Add a staff note to an existing tenant task.
- See assignment and note events in the backend event trail.

## Why This Approach

Tasks are Outpost's primary proof object. A task that cannot carry ownership or
handoff notes is still hard to use during real front-desk shifts, even if status
changes persist. Assignment and notes are already modeled locally in
`src/domain/tasks.ts` and exposed in `StaffTaskWorkspaceClient`; backend mode
currently disables those controls.

The smallest durable backend extension is two explicit PostgreSQL RPCs:

- `assign_task(...)`: update the task assignee, insert one `task_events` row,
  and insert one audit event in the same transaction.
- `add_task_note(...)`: insert one `task_events` row, update the task
  `updated_at`, and insert one audit event in the same transaction.

This matches existing Outpost persistence slices: narrow application-service
methods, Supabase repository methods, security-definer RPCs, deny-by-default
table grants, rollback tests, and RLS verifier proof.

## Key Decisions

- Use active tenant membership, not owner-only authorization. Staff and owners
  both operate task workboards.
- Validate assignees inside the RPC through `tenant_memberships` with matching
  tenant and active invite status. Client-provided users are only form options,
  not trust boundaries.
- Keep notes append-only as `task_events` rows. Do not add a separate notes
  table until search, editing, retention, or moderation requirements exist.
- Keep assignment and note actions separate. Each user action maps to one
  explicit transaction boundary and one audit action.
- Do not create notification attempts, send email, route live answers, ingest
  providers, compute billing, or create tasks from provider events.
- Update the task `updated_at` on assignment and note addition so the workboard
  reflects recent collaboration.

## Alternatives Considered

1. **One generic `update_task(...)` RPC.**
   Rejected because it would blur status, assignment, note, and future provider
   workflows into one larger authorization and audit surface.

2. **Persist notes only.**
   Rejected because assignment is already an exposed staff control and uses the
   same tenant/member validation pattern.

3. **Add a `task_notes` table.**
   Deferred. The current event trail is enough for append-only staff handoff
   notes, and adding a new table would increase model surface before it is
   needed.

## Success Criteria

- Assignment persists only for own-tenant tasks and only to active same-tenant
  members, or clears to unassigned.
- Note addition persists only for own-tenant tasks with non-empty bounded text.
- Each successful assignment writes one task row update, one task event, and one
  audit event.
- Each successful note writes one task updated-at bump, one task event, and one
  audit event.
- Failure-path tests prove no partial task/event/audit state.
- RLS verifier proves anon/public execute denial, direct table write denial,
  same-tenant member success, invalid assignee denial, and cross-tenant denial.
- Backend task UI enables assignment and note controls only when backend mode is
  active.

## Open Questions

None for this slice.
