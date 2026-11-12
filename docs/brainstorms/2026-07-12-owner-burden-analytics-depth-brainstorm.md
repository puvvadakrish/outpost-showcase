---
title: Owner burden analytics depth
date: 2026-07-12
status: complete
---

# Owner Burden Analytics Depth

## What We're Building

Deepen the existing local-only owner burden report with channel workload,
common request intent pressure, and staff human-intake contribution derived
from existing tenant-loaded tasks, events, and users.

## Key Decisions

- Reuse shared task-domain summaries for channel and intent semantics.
- Count total and unresolved work; do not claim calls/emails handled, delivery,
  automation, or time saved before real hosted/provider/customer evidence.
- Staff contribution uses exact manual-created events keyed by tenant/task/actor
  and shows aggregate counts only, never requester contact or note text.
- Keep every surface read-only and preserve the existing blocked-gate copy.

## Boundaries

No provider calls, hosted writes, analytics event pipeline, productivity score,
employee ranking, notifications, billing, POS, access-control, or member-ledger
behavior.
