---
title: Owner operational pressure
date: 2026-07-12
status: complete
---

# Owner Operational Pressure

## What We're Building

Extend the local owner burden report with location workload, workflow-stage
pressure, and task-age pressure derived from the tenant-loaded task set.

## Why This Approach

The preceding report slices explain channel, request theme, and human intake.
Owners still need to see where unresolved demand sits, whether it is waiting
for ownership or actively handled, and how long it has waited. Existing task
domain projections already define those semantics, so the report should reuse
them instead of creating an analytics model or parallel classification rules.

## Key Decisions

- Reuse `taskLocationSummaries()`, `taskWorkflowStageSummaries()`, and
  `taskAgeSummaries()` without changing their queue semantics.
- Show unresolved and total counts; do not imply response time, SLA compliance,
  automation, or work completed by a provider.
- Keep all configured locations and all workflow/age buckets visible at zero.
- Make task-age reference time injectable for deterministic tests.
- Keep the report read-only and tenant-loaded; add no persistence or telemetry.

## Boundaries

No task writes, hosted writes, provider calls, notifications, employee ranking,
SLA enforcement, billing, POS, access-control, or member-ledger behavior.

