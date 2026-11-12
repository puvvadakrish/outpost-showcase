---
title: "First-gym proof session runbook before customer evidence"
date: 2026-07-01
category: integration-issues
status: documented
tags:
  - admin-readiness
  - proof-chain
  - no-live-provider-gates
---

# First-Gym Proof Session Runbook Before Customer Evidence

## Problem

The SaaS readiness chain can reach a point where the next blocker is not code:
the operator needs a protected Preview, hosted Neon branch, and owner/customer
present to record real proof. Continuing to build downstream "proof" artifacts
at that point risks creating false readiness.

## Working Pattern

Create a runbook artifact from the latest control artifacts instead of claiming
proof. For Outpost, the proof-session runbook consumes the missing-proof packet
and completion gate, pins both SHA-256 values, verifies both point to the same
execution ledger, and replays both parent inspectors.

The runbook is allowed to contain:

- Current missing proof commands.
- Prerequisites.
- Stop conditions.
- Blocked gate inventory.

It is not allowed to contain:

- Customer-observed completion.
- First-gym operator run success.
- Limited beta review completion.
- Public launch readiness.
- Invite/provider/billing/POS/access-control/member-ledger enablement.

## Prevention

When a readiness batch depends on real customer observation, prefer a
customer-safe runbook artifact over a synthetic proof artifact. Inspectors
should pin parent SHA-256 values and fail closed if any no-live-provider flag
becomes true.
