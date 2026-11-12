---
title: Admin public request hosted rehearsal readiness
date: 2026-06-30
status: captured
---

# Admin Public Request Hosted Rehearsal Readiness

## What We're Building

Add the current-chain hosted rehearsal bridge after
`admin_public_request_owner_staff_handoff_readiness_batch`.

## Key Decisions

- Chain from the public-request owner/staff handoff artifact, not the older
  approved-gym hosted rehearsal parent path.
- Prepare hosted browser rehearsal prerequisites only.
- Keep customer-observed proof, first-gym go/no-go, public launch, invite
  delivery, Auth creation, providers, billing, POS, access control, and
  member-ledger writes blocked.

## Success Criteria

- Prepare/inspect scripts preserve parent SHA and fail closed on tampering.
- Admin portal shows the current-chain hosted rehearsal bridge.
- Tests cover happy path, parent tamper, hosted proof tamper, and UI/package
  wiring.
