---
title: "Admin public request first-gym execution ledger"
category: integration-issues
tags:
  - outpost
  - admin-readiness
  - proof-chain
  - no-live-provider
status: solved
date: 2026-07-01
---

# Admin Public Request First-Gym Execution Ledger

## Problem

After adding a proof runway, the next operator step could drift back into chat
memory: real hosted/customer proof, go/no-go, first-gym run, limited beta
review, and launch-control commands existed, but there was no single current
artifact showing which downstream proof files were actually present and
inspectable.

## Solution

Add a status-only execution ledger after the proof runway:

- Re-run the parent proof-runway inspector before trusting it.
- Pin the proof-runway SHA-256 into the ledger.
- For each downstream proof artifact, mark it `missing` if absent.
- If a downstream artifact exists, run that artifact's own inspector and pin
  its SHA-256.
- Keep all public launch, invite, provider, revenue, POS, access-control, and
  member-ledger gates false.

This creates a useful command before real customer proof exists, while making
real proof tamper-evident once it is recorded.

## Commands

```bash
npm run admin:public-request-first-gym:execution-ledger
npm run admin:public-request-first-gym:execution-ledger:inspect
```

## Pattern

Use this when a batch is blocked on external/customer evidence but the operator
needs a repeatable readiness surface. The artifact should describe status and
re-inspect existing proof; it should not convert missing evidence into a pass.

## Prevention

- Do not add browser approval buttons or public launch controls to status
  ledgers.
- Tests should flip a launch/live-provider gate and assert inspection fails.
- Tests should mark a missing child artifact as `inspectable` and assert
  inspection fails.
- Keep the Admin portal surface read-only and terminal-command based.
