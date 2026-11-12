---
title: "Admin public request first-gym proof session execution pack"
date: 2026-07-02
status: captured
---

# Admin Public Request First-Gym Proof Session Execution Pack

## What We're Building

Add the next continuous readiness batch after the first-gym proof session
runbook: a single customer-safe execution pack that contains three coordinated
slices for the real proof session:

- Operator preflight observations.
- Customer-safe worksheet rows for the ordered missing commands.
- Expected evidence manifest for the artifacts that should become inspectable
  only after their dedicated proof commands run.

## Why This Approach

The runbook tells an operator what to run next, but a real owner/customer
session also needs a session packet that prevents overclaiming while the
operator is moving through the browser. This execution pack keeps the next
work continuous without manufacturing customer proof.

## Key Decisions

- Consume and SHA-pin the proof-session runbook.
- Re-run the runbook inspector before writing or inspecting the execution pack.
- Keep the pack operator-session-only: it may list observations, worksheet
  rows, and expected evidence, but it cannot record completion.
- Keep public self-serve, invites, notifications, providers, Auth admin user
  creation, billing, POS, access-control, and member-ledger writes blocked.

## Open Questions

None for this slice. Real customer-observed completion and first-gym proof still
require the owner/customer session and must be recorded through dedicated proof
commands.
