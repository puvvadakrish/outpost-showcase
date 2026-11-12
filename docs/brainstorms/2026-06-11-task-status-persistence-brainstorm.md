---
date: 2026-06-11
topic: task-status-persistence
---

# Task Status Persistence Brainstorm

## What We're Building

Persist staff task status changes for existing task rows. This is the next
smallest backend slice after owner setup persistence because the task inbox is
Outpost's proof object, but the slice can still avoid provider ingress,
notification delivery, and full staff workflow expansion.

The workflow is: an authenticated active tenant member changes one existing
task from an allowed non-terminal status to another allowed status, and the
database records the task update, a task event, and an audit event in one
transaction.

## Why This Approach

The previous owner setup slices established the durable pattern: keep domain
validation in TypeScript, keep tenant authorization in a PostgreSQL RPC, use
RLS as the read boundary, and make multi-row evidence writes atomic. Task
status changes should reuse that pattern instead of introducing a separate API
shape.

The slice deliberately chooses status only. Assignment persistence and staff
notes are valuable, but adding them now would expand the workflow surface and
force more UI and audit decisions than the current backend spine needs.

## Key Decisions

- Use Supabase/Postgres/Auth/RLS, matching the current backend spine.
- Authorize through active tenant membership, not owner-only membership,
  because staff and owners both operate the task workboard.
- Persist only existing seeded tasks. Do not create tasks from calls, emails,
  imports, provider events, webhooks, or automations.
- Enforce task transition guardrails in both TypeScript and the RPC.
- Persist one task row update, one `task_events` row, and one `audit_events`
  row through `update_task_status(...)`.
- Keep `done` and `ignored` terminal until a future audited reopen slice is
  explicitly planned.
- Keep assignment and note persistence out of scope. In backend mode the status
  control is the durable operation.
- Preserve no-live-provider readiness gates and do not claim hosted Supabase
  proof.

## Rejected Alternatives

- **Persist assignment and notes together.** This is a useful staff workflow,
  but it widens scope into collaboration semantics and more event types before
  status persistence is proven.
- **Create tasks from routed answers or provider events.** This is the larger
  phone/email productization path and must wait for hosted proof plus provider
  ingress planning.
- **Use multiple Supabase table writes from the server action.** This would
  lose the explicit transaction boundary already required by the backend spine.
- **Owner-only authorization.** Owners can use the workboard, but staff task
  operation should be tenant-member scoped once staff sessions are available.

## Success Criteria

- Backend-backed task reads work through Supabase Auth + RLS when a session is
  present.
- A status update persists atomically as current task state, task event, and
  audit event.
- Failure-path tests prove no partial task/event/audit state.
- RLS verification proves own-tenant visibility and cross-tenant RPC denial.
- Local Supabase Docker API proof covers update and denial paths.
- Live phone, email, notification, provider, billing, POS, ClubOS, and hosted
  proof remain explicitly blocked or out of scope.

## Open Questions

None for this slice. The user authorized continuing through the Compound loop
while away, and the scope is intentionally constrained to the existing backend
pattern.
