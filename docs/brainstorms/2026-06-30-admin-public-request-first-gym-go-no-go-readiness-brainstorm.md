---
title: Admin public request first-gym go/no-go readiness
date: 2026-06-30
status: captured
---

# Admin Public Request First-Gym Go/No-Go Readiness

## What We're Building

Add the current-chain readiness bridge after public request hosted rehearsal
readiness.

## Key Decisions

- Chain from `admin_public_request_hosted_rehearsal_readiness_batch`.
- Do not produce the actual first-gym go/no-go bundle.
- Keep hosted rehearsal evidence and real customer-observed session required.
- Keep public launch, invite delivery, Auth creation, providers, billing, POS,
  access control, and member-ledger writes blocked.

## Success Criteria

- Prepare/inspect scripts preserve parent SHA and fail closed on tampering.
- Admin portal shows the bridge and the evidence still required.
- Tests cover happy path, parent tamper, go/no-go tamper, and UI/package wiring.
