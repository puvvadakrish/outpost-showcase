---
title: "Admin public request first-gym proof session runbook"
date: 2026-07-01
status: captured
---

# Admin Public Request First-Gym Proof Session Runbook

## What We're Building

Add a customer-safe operator runbook after the public request first-gym
missing-proof packet and completion gate. The runbook packages the current
missing proof commands, prerequisites, stop conditions, and blocked gates so
the next real owner/customer session is repeatable.

## Why This Approach

The current blocker is not code capability; it is real hosted/browser proof
with the owner or customer present. Creating another "proof" artifact would
overstate readiness. A runbook is the right next artifact because it makes the
human session executable while preserving the blocked gates.

## Key Decisions

- Consume both the missing-proof packet and completion gate, and require both
  to point at the same first-gym execution ledger SHA-256.
- Re-run both parent inspectors before writing or inspecting the runbook.
- Include only customer-safe commands and stop conditions.
- Keep Admin portal guidance read-only.
- Do not record customer-observed completion, first-gym run success, limited
  beta review, public self-serve readiness, invites, providers, billing, POS,
  access-control, or member-ledger writes.

## Open Questions

None for this slice. Real completion still requires the owner/customer session
and must be recorded through the dedicated proof commands.
