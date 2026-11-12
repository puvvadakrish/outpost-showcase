---
title: Admin public request owner/staff handoff readiness
date: 2026-06-30
status: captured
---

# Admin Public Request Owner/Staff Handoff Readiness

## What We're Building

Add a current-chain bridge after `admin_public_request_followup_readiness_batch`
that prepares owner/staff handoff readiness without using the older approved
beta expansion parent path.

## Key Decisions

- Chain from `admin_public_request_followup_readiness_batch`.
- Keep owner access operator-managed evidence only: no provisioning, Auth admin
  API, Auth user, magic link, or automatic grant.
- Keep staff handoff no-send/no-create.
- Keep hosted rehearsal, customer-observed proof, and first-gym go/no-go as
  downstream gates.

## Success Criteria

- Prepare/inspect scripts preserve parent SHA and fail closed.
- Admin portal surfaces the bridge and next batch set.
- Tests cover happy path, parent tamper, owner/Auth tamper, staff send tamper,
  hosted rehearsal tamper, and UI wiring.
