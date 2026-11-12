---
title: "Answer Task Idempotency"
type: brainstorm
status: complete
date: 2026-06-15
---

# Answer Task Idempotency

## What We're Building

Prevent duplicate unresolved staff tasks when an owner repeatedly clicks
`Create task` on the same answer-bank review item. The owner review row should
also show when an unresolved task already exists for that answer, so the owner
understands that staff work has already been created.

## Why This Approach

The previous slice already writes durable provenance in `audit_events` with
`action = 'task.created_from_answer'` and `metadata.answer_bank_entry_id`. Use
that provenance as the idempotency key instead of adding a new task-source table
or broad task workflow model.

The transactional RPC remains the write boundary. It locks the answer row,
checks for an existing unresolved answer-derived task for the same tenant and
answer, and returns that task without writing a second task/event/usage/audit
set. If the previous task is terminal (`done` or `ignored`), the owner can
create a new follow-up task later.

## Key Decisions

- Keep `create_task_from_answer_bank_entry(...)` as the owner action boundary.
- Treat `new`, `needs_human`, and `in_progress` tasks as open/unresolved.
- Return the existing unresolved task from the RPC instead of raising an error.
- Show existing task state in owner answer rows/cards and disable the create
  button while that unresolved task exists.
- Keep task content, location, and provenance server-derived.
- Do not add providers, notifications, assignment automation, billing, POS,
  member-ledger writes, hosted proof, or live phone/email behavior.

## Rejected Alternatives

- Add a new `answer_task_links` table now. Rejected as too much model for the
  current slice because the audit provenance already exists and remains
  tenant-scoped.
- Add a unique expression index on audit metadata. Rejected because idempotency
  only applies to unresolved tasks; terminal tasks should not block future
  staff follow-up.
- Make the client pass task ids or task state. Rejected because the server
  should derive all provenance and enforce tenant boundaries.

## Success Criteria

- Repeated owner clicks against the same answer return the same unresolved task.
- The second click creates no additional task, task event, usage event, or audit
  event.
- Cross-tenant denial and approved-answer denial still leave no partial state.
- Owner review UI displays the existing unresolved task and disables duplicate
  task creation.
- Local Supabase Docker proof remains the verification path; hosted proof is
  not claimed.

## Open Questions

None.
