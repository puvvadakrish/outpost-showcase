---
title: Admin First Gym Evidence Batch
category: integration-issues
date: 2026-06-29
status: active
---

# Admin First Gym Evidence Batch

## Problem

The approved-gym hosted rehearsal readiness batch prepared the next command
path, but did not record browser/operator evidence or package the first-gym
go/no-go state. Without another artifact layer, the team would either rely on
chat memory or be tempted to overclaim that readiness equals customer-observed
completion.

## Solution

Add two terminal-only artifact commands:

- `admin:approved-gym-hosted-rehearsal:evidence` records non-secret hosted
  rehearsal observations after explicit operator confirmations.
- `admin:first-gym:go-no-go` bundles hosted rehearsal evidence with the existing
  real customer-observed session record.

Both inspectors re-verify parent SHA chains and keep public self-serve, invite
delivery, providers, notifications, billing/POS/access control, and member
ledger writes blocked.

## Prevention

Keep rehearsal evidence, customer-observed session proof, and first-gym go/no-go
as separate states. Do not add a second customer-observed recorder, and do not
let first-gym go/no-go imply public self-serve or live-provider launch.
