---
date: 2026-07-07
topic: provider-normalized-persistence
---

# Provider Normalized Persistence

## What We're Building

Persist the normalized Retell and Resend outputs from the fixture-only
normalization layer into Outpost's existing SaaS domain tables:
`conversations`, `channel_events`, `tasks`, and `usage_events`.

This is still an offline/internal substrate. It should let the internal jobs
drain store normalized rows idempotently for later owner/staff review, without
adding webhook ingress, provider SDK calls, outbound replies, notifications,
billing, POS, access-control, or member-ledger writes.

## Why This Approach

The previous batch intentionally stopped at normalized in-memory shapes. The
smallest useful next step is to persist those exact shapes through one
database-owned boundary, rather than creating provider-specific tables or
letting the route/handler scatter inserts across multiple tables.

The chosen approach is an atomic Neon RPC that accepts sanitized normalized
payloads, validates tenant/location/provider consistency, upserts
conversation/event/task rows by deterministic IDs, and inserts usage rows
idempotently by stable usage IDs.

## Key Decisions

- Reuse existing domain tables: avoids parallel provider-specific persistence
  and keeps the staff inbox model as the product center.
- Database function owns consistency: tenant, location, and provider
  connection checks should happen in SQL so all callers share the same guard.
- Idempotent replay is required: jobs are at-least-once, so repeated drains
  must not duplicate tasks or metering rows.
- Store normalized metadata only: raw provider payloads remain outside this
  persistence path; channel events keep payload digest/ref only.
- Preserve blocked gates: this does not enable live providers, delivery,
  billing, POS, access control, or ledger writes.

## Open Questions

- None for this slice. Future slices can decide whether normalized events
  should become visible in owner/staff UI immediately or behind a review gate.

## Next Steps

-> `ce-plan` for migration, repository/helper, job-handler, and test details.
