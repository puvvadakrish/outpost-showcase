---
title: Manual task creation pipeline before source intake
status: captured
date: 2026-06-13
---

# Manual Task Creation Pipeline Brainstorm

## What We're Building

Add the smallest backend-backed path for a signed-in tenant member to create a
manual staff task from the existing workboard. This lets Outpost exercise the
task creation pipeline before manual source intake exists, without pretending
that a phone, email, website, or Google source produced the work.

The task is explicitly internal and manual:

- Channel is `manual`.
- Status starts as `new`.
- The task belongs to an existing tenant and existing location.
- The write creates an initial task event, a usage event, and an audit event in
  the same database transaction.

## Why This Approach

Task creation can safely precede manual source intake when the source is a
human-entered staff work item. It gives Acme Fitness and local beta testing a
real staff queue creation loop while source extraction, provider ingress, and
notification delivery remain off.

The existing task-status slice already established the right shape:

- Server action validates sign-in and form inputs.
- Application service owns business validation.
- Repository calls one PostgreSQL RPC.
- RLS grants read access and denies direct table writes.
- RPC is the only authenticated write boundary.

## Key Decisions

- Use one `create_manual_task(...)` RPC instead of client-side multi-table
  writes.
- Insert `tasks`, `task_events`, `usage_events`, and `audit_events` inside the
  RPC transaction.
- Keep direct `insert`, `update`, and `delete` privileges revoked on task
  tables.
- Allow active tenant members to create manual tasks; do not restrict the slice
  to owners because staff members operate the workboard.
- Do not create source documents, source facts, notification attempts, provider
  payloads, staff assignments, notes, due dates, email sends, call transfers, or
  webhook flows.

## Architecture Strategist Notes

This is an extension of the existing backend persistence pattern, not a new
service boundary. The durable model decision is limited to naming the write
boundary `create_manual_task` and treating `usage_events.meter =
'task_created'` as a local metering fact, not billing computation.

Tenant safety depends on:

- `is_active_tenant_member(p_tenant_id)` inside the RPC.
- Location membership checked by `(tenant_id, location_id)`.
- Actor identity derived from `auth.uid()` through `current_app_user_id()`.
- Cross-tenant denial in the rollback-only RLS script.

## Success Criteria

- A backend-mode staff workboard shows a manual task form.
- Submitting the form creates exactly one task, one created task event, one
  `task_created` usage event, and one audit event.
- Failure after partial in-memory writes rolls back task/event/audit/usage
  state in tests.
- Cross-tenant RPC attempts fail.
- Direct task, task event, and usage event table writes remain denied.
- No live provider, phone, email, webhook, billing, Club OS, POS, payment, or
  member-ledger behavior is added.

## Open Questions

None for this slice. Manual source intake remains the next separate workflow.
