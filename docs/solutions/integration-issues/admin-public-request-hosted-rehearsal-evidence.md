---
title: Admin public request hosted rehearsal evidence
category: integration-issues
date: 2026-06-30
status: solved
---

# Admin Public Request Hosted Rehearsal Evidence

## Problem

The current public-request readiness lane prepared hosted rehearsal readiness,
but the real hosted rehearsal evidence command still consumed the older
approved-gym readiness artifact. That made the next operator step ambiguous.

## Solution

Add `admin_public_request_hosted_rehearsal_evidence`. It consumes
`admin_public_request_hosted_rehearsal_readiness_batch`, reruns the parent
inspector, chains the parent SHA, records explicit operator/browser observation
confirmations, and keeps all customer/go-no-go/public/live-provider gates
blocked.

## Guardrails

- No schema changes or hosted writes.
- No customer-observed completion claim.
- No invite delivery, notifications, provider activation, billing, POS, access
  control, or member-ledger writes.
- The first-gym evidence acquisition packet now points at this current-chain
  command instead of the older approved-gym command.
