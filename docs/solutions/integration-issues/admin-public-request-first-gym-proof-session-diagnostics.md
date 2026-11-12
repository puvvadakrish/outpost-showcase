---
title: Admin public request first-gym proof session diagnostics
category: integration-issues
date: 2026-07-02
status: solved
---

# Admin Public Request First-Gym Proof Session Diagnostics

## Problem

The proof-session chain had separate runbook, execution pack, progress, and
resume artifacts. Operators needed one current diagnostic artifact that checked
the whole chain and showed the next action without creating fake proof.

## Solution

Add a diagnostics artifact after resume. The prepare and inspect scripts replay
the runbook, execution pack, progress, and resume inspectors, pin each SHA-256,
derive missing evidence and operator next actions from the verified resume
packet, and keep all launch/live-provider/revenue gates blocked.

The slice also hardens resume inspection by exact-matching the completion
handoff action and rejecting extra keys in operator-facing command rows.

## Reusable Pattern

For long readiness chains, add diagnostics after resume/recovery. Diagnostics
may inspect and summarize parent artifacts, but it must not record the proof
those parents are waiting on.

## Prevention

Tests should cover stale lineage, blocked gate tampering, command tampering,
and Admin UI wiring. Browser smoke should confirm diagnostics renders as
read-only operator guidance, not as a launch or approval action.
