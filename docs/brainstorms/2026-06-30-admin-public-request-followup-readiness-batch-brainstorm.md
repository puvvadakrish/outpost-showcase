---
title: Admin public request follow-up readiness batch
date: 2026-06-30
status: captured
---

# Admin Public Request Follow-Up Readiness Batch

## What We're Building

Package the next current-chain readiness set after
`admin_public_request_intake_artifact`: invite/Auth no-send/no-create records,
blocked live-provider/revenue/member-system runbooks, and a real limited beta
operator review gate.

## Key Decisions

- Chain from `admin_public_request_intake_artifact`, not older approved-gym
  request dry-run artifacts.
- Treat invite/Auth output as metadata-only records. No email, magic link,
  product Auth admin API, Auth user, or automatic grant is allowed.
- Treat live-provider/revenue/member-system work as blocked runbooks only.
- Keep the real limited beta review unrecorded until a real gym review occurs.

## Success Criteria

- Prepare/inspect scripts preserve the parent SHA and fail closed.
- Admin portal shows the follow-up batch and the next readiness set.
- Tests cover happy path, parent tamper, invite/Auth tamper, provider/runbook
  tamper, and Admin wiring.
