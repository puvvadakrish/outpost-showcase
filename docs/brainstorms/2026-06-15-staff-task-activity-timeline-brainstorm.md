---
title: "Staff task activity timeline"
status: complete
date: 2026-06-15
---

# Staff Task Activity Timeline Brainstorm

## What We're Building

Improve the existing staff task detail workflow so staff can read task history as
an activity timeline, with human notes clearly separated from system/status and
assignment events. The work uses the existing `task_events` model and existing
backend RPCs for status, assignment, and notes.

This is a staff execution polish slice. It does not add live phone/email
providers, notification delivery, task automation, billing, POS, member-ledger
writes, webhooks, or hosted Supabase proof.

## Why This Slice

The previous slices made tasks durable and made owner-created answer tasks
idempotent. The next useful step is making staff execution easier to inspect:
what happened, who touched it, what changed, and which entries are actual handoff
notes. This keeps the primary proof object a staff-ready task and makes local
beta testing more realistic without expanding provider scope.

## Approach Chosen

Use `task_events` as the activity source of truth and add a domain projection
that classifies events into:

- staff notes
- status changes
- assignments
- creation/provenance
- other system activity

The staff UI will render that projection in a compact operational timeline and
will reconcile returned server-action task/event results into local component
state so the selected task updates immediately after backend actions.

## Alternatives Considered

### New `task_comments` table

Rejected for this slice. It would add another tenant-scoped model and migration
when `task_events` already stores note events and actor/time metadata. A separate
comments table may be useful later for richer mentions, edits, attachments, or
internal/external visibility.

### Backend-only refetch after every action

Rejected as the only behavior. Route revalidation is still useful, but relying on
it alone makes the selected task detail feel stale after notes, status changes,
assignment changes, and manual task creation. Local reconciliation keeps the
workboard responsive while preserving backend persistence as source of truth.

## Key Decisions

- No new database table for this slice.
- Keep all mutation authority in existing backend RPCs and server actions.
- Do not trust client state for persistence or tenant access.
- Keep the timeline compact, operational, and mobile-safe according to
  `DESIGN.md`.
- Document any durable learning with `ce-compound` after the slice is verified.

## Open Questions

None for this slice.
