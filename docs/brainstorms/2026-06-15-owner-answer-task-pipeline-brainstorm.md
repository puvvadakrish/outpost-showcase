---
title: "Owner answer task creation pipeline"
type: brainstorm
date: 2026-06-15
---

# Owner Answer Task Creation Pipeline Brainstorm

## What We Are Building

Add the next local backend-backed task pipeline slice: an owner can create a
staff follow-up task from an existing answer-bank review row. The action starts
from already-persisted owner context, not from phone/email/provider ingress.

The task should land in the existing staff workboard as a normal `manual` task
with provenance in the task event and audit event.

## Why This Slice

The owner setup flow can now ingest manual source facts, stage answer proposals,
approve/retire/edit them, create manual staff tasks, assign tasks, and append
notes. The missing local loop is a direct bridge from “this answer needs staff
follow-up” to “there is a staff task to handle it.”

This is smaller and safer than provider ingress because it uses existing owner
answer rows and the existing task table/RLS workflow. It also exercises the beta
loop without claiming hosted proof or live behavior.

## Chosen Approach

Use a PostgreSQL RPC named `create_task_from_answer_bank_entry(...)`.

The RPC accepts only tenant id and answer-bank entry id. It derives location,
topic, question, answer, source label, and review note from the locked answer
row. It creates:

- one `tasks` row with channel `manual`;
- one `task_events` row with event type `created`;
- one `usage_events` row for `task_created`;
- one `audit_events` row with action `task.created_from_answer`.

All writes happen in one transaction boundary through the RPC.

## Alternatives Considered

- Reuse `create_manual_task` from a pre-filled owner form. Rejected because it
  would trust more client-provided fields and would not encode answer-row
  provenance server-side.
- Add provider/task-generation infrastructure. Rejected because live ingress,
  automation, and provider behavior remain explicitly out of scope.
- Add a new task-source link table now. Deferred because audit metadata and the
  created task event are enough for this local proof slice.

## Boundaries

- No phone or email provider ingress.
- No Retell, Resend, Gmail, webhooks, notifications, billing, POS, payments, or
  member-ledger writes.
- No hosted Supabase proof claim.
- No autonomous task generation from live traffic.
- No answer approval or answer mutation as part of this action.

## Architecture Notes

- Tenant isolation stays with `is_active_tenant_member(...)`, direct table RLS,
  and existing authenticated grants.
- The RPC should reject anonymous callers, cross-tenant callers, missing answer
  rows, answer rows without a usable location, approved live-answer rows, and
  retired rows.
- Failure-path tests should prove no partial task, task event, usage event, or
  audit event state when the RPC fails.
- The owner UI should stay operational and compact, reusing the existing answer
  review table/card action area.

## Success Criteria

- Eligible owner answer rows show a backend-backed “Create task” action.
- The action creates one staff task visible on `/staff/tasks`.
- The write is atomic and auditable.
- Cross-tenant RPC denial is proven.
- Verification remains local Supabase Docker only.

## Open Questions

None.
