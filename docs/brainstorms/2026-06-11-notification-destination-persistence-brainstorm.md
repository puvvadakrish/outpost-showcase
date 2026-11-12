---
title: "Notification destination persistence"
date: 2026-06-11
status: captured
---

# Notification Destination Persistence Brainstorm

## What We're Building

Persist owner edits to existing notification destinations through the same
backend pattern now used for answer-bank and handoff-rule owner setup rows. The
owner can update a seeded destination's label, destination type, destination
value, and readiness status.

## Why This Approach

Notification destinations are setup policy, not delivery behavior. Persisting
them lets owner setup move one step closer to a backend-backed workspace while
still keeping email delivery, outbound replies, provider connections,
notification attempts, and staff-task creation disconnected.

The smallest useful slice is an owner-only PostgreSQL RPC:

- update the existing `notification_destinations` row;
- append one revision row with full before/after evidence;
- append one audit event;
- keep all writes inside one database transaction boundary;
- preserve read-only table RLS and avoid direct table update grants.

## Key Decisions

- Only existing seeded destinations are editable in the backend. Browser-local
  draft destination creation/removal stays local.
- Destination persistence does not send email, create notification attempts,
  enqueue jobs, or mark providers ready.
- Cross-tenant denial must be verified at the RPC layer, not only through UI
  filtering.
- Revision evidence should include before/after type, label, destination, and
  status because destination values can later affect who receives operational
  notifications.

## Out Of Scope

- Resend, Gmail, SMTP, deliverability, unsubscribe, or reply automation.
- Staff task creation, task notifications, webhook delivery, billing, usage
  metering, provider secrets, or live phone/email readiness.
- Creating new backend notification destinations from the UI.

## Success Criteria

- A signed-in Acme Fitness owner can load and update the three seeded
  notification destinations through Supabase Auth/RLS/RPC.
- Each update creates exactly one revision row and one audit event.
- A Acme Fitness owner cannot read or update Peak CrossFit notification
  destinations.
- Anon/public cannot execute the RPC.
- No live-provider readiness gate changes.
