---
title: Admin public request first-gym evidence acquisition
category: integration-issues
date: 2026-06-30
status: solved
---

# Admin Public Request First-Gym Evidence Acquisition

## Problem

The current public-request readiness chain reached first-gym go/no-go
readiness, but the next real evidence commands lived in older lanes. Operators
needed a current-chain packet that made the evidence path explicit without
claiming hosted rehearsal, customer-observed, hosted import, go/no-go, or
first-gym run proof.

## Solution

Add `admin_public_request_first_gym_evidence_acquisition_batch`. It consumes
`admin_public_request_first_gym_go_no_go_readiness_batch`, verifies the parent
with its inspector, chains the parent SHA, and emits the existing real command
sequence:

- `npm run admin:public-request-hosted-rehearsal:evidence`
- `npm run admin:customer-session:record`
- `npm run admin:customer-session:record-hosted`
- `npm run hosted:customer-session-record:proof`
- `npm run admin:first-gym:go-no-go`
- `npm run admin:first-gym:run`

The inspector fails if any real proof flag is already claimed by the packet.

## Guardrails

- No schema changes or hosted writes.
- No public self-serve, browser approval buttons, invite delivery,
  notifications, provider activation, billing, POS, access control, or
  member-ledger writes.
- Real proof remains owned by the existing strict evidence commands.

## Prevention

When adding readiness lanes, prefer small bridge artifacts that point to the
real proof writers instead of duplicating proof recording semantics.
