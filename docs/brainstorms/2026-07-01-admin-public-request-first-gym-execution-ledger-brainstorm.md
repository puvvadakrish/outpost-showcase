---
title: "Admin public request first-gym execution ledger"
date: 2026-07-01
status: captured
---

# Admin Public Request First-Gym Execution Ledger

## What We're Building

Add a status-only ledger after the public request first-gym proof runway. The
ledger should show whether the real proof artifacts listed by the runway are
still missing or already inspectable, and it should re-run child inspectors for
any artifact that exists.

## Why This Approach

The proof runway is intentionally terminal-only. The next batch needs a durable
operator surface that can track real progress without converting a checklist
into a proof claim. A ledger keeps the batch continuous: missing artifacts
remain visible today, and the same command becomes proof-aware when hosted and
customer-observed artifacts are recorded.

## Key Decisions

- Treat the ledger as status-only; it never records customer completion,
  first-gym success, limited beta approval, public launch approval, or live
  provider readiness.
- Re-run the proof runway inspector before trusting the parent artifact.
- Re-run each child inspector if that child artifact exists.
- Mark absent child artifacts as `missing`, not failure, so the ledger can be
  run before the owner/customer session is available.
- Keep public self-serve, invites, notifications, providers, billing, POS,
  access control, and member-ledger writes blocked.

## Success Criteria

- Operators get one command pair for current-chain proof execution status.
- Present artifacts are tamper-evident through their own inspectors and SHA
  pins.
- Missing proof stays explicit and does not block creating the status ledger.
- `/admin` shows read-only command guidance only.
