---
title: Admin public request first-gym proof-session launch checkpoint
category: integration-issues
date: 2026-07-03
tags:
  - admin-readiness
  - artifact-chain
  - proof-session
  - no-live-provider
---

# Admin public request first-gym proof-session launch checkpoint

## Problem

The proof-session chain could tell an operator the next missing proof command,
but it did not provide one final current-chain checkpoint with the exact inputs
needed before running the real first-gym go/no-go, operator-run, and limited
beta review commands.

## Solution

Add a launch-checkpoint artifact after follow-up preflight:

```bash
npm run admin:public-request-first-gym:proof-session-launch-checkpoint
npm run admin:public-request-first-gym:proof-session-launch-checkpoint:inspect
```

The writer replays the follow-up preflight inspector, SHA-pins the preflight,
copies the evidence summary, lists required operator env inputs, and writes the
current command sequence. The inspector replays the parent again, exact-matches
input requirements and command rows, and keeps all public/live/provider/revenue
gates blocked.

## Reusable Pattern

Use a launch checkpoint when an artifact chain is about to move from
readiness/preflight into real proof writers:

- replay and SHA-pin the immediate parent;
- list required operator inputs without storing secrets;
- exact-match command rows in the inspector;
- keep the checkpoint unable to record proof itself;
- keep public launch and live-provider/revenue gates separate.
