---
title: "Admin public request first-gym execution control"
date: 2026-07-01
category: integration-issues
tags:
  - compound-engineering
  - admin-readiness
  - proof-ledger
  - no-live-provider
---

# Admin Public Request First-Gym Execution Control

## Problem

After the first-gym execution ledger, Outpost could show which proof artifacts
were missing, but the operator still had to mentally translate that into the
next command and an overall completion gate.

The risky shortcut would be to add another readiness artifact that sounded like
proof. That would blur the line between real customer/hosted evidence and
operator planning.

## Solution

Add two derived artifacts:

- `admin_public_request_first_gym_missing_proof_packet` turns ledger `missing`
  steps into an ordered terminal command packet.
- `admin_public_request_first_gym_completion_gate` derives blocked/ready state
  from whether every ledger child artifact is inspectable.

Both artifacts replay the execution ledger inspector, pin its SHA-256, and
reassert blocked public/live-provider/revenue/member-system gates.

## Reusable Pattern

When external customer evidence is the blocker:

1. Keep the real proof command as the only proof writer.
2. Add a status/control artifact that consumes the latest ledger.
3. Re-run parent inspectors and pin SHA-256 values.
4. Make missing evidence visible without converting it into a success claim.
5. Keep browser/Admin surfaces read-only until a separate launch gate is green.

## Prevention

Tests should tamper both command ordering and launch/provider gates. This
catches two common regressions: a queue drifting away from the parent ledger,
and a control artifact accidentally becoming an approval surface.
