---
title: Admin public request first-gym proof session progress batch
category: integration-issues
date: 2026-07-02
status: solved
---

# Admin Public Request First-Gym Proof Session Progress Batch

## Problem

After the proof-session execution pack, the operator needed a repeatable way to
know what changed after each real proof command. Without a progress artifact,
the workflow either relied on chat memory or risked adding a new command that
looked like it was recording proof.

## Solution

Add a status-only progress batch after the execution pack. It structurally
validates the pinned execution pack as the session source of truth, reads its
expected evidence manifest, treats missing artifacts as `missing`, and runs
each dedicated child inspector before marking present artifacts `inspectable`.
The artifact writes a progress ledger, next-step packet, and completion check
while keeping all public launch and live-provider gates blocked.

## Reusable Pattern

When real-world customer evidence is the blocker, add a refreshable status
control artifact between an operator worksheet and proof writers. The control
artifact may re-inspect and SHA-pin evidence, but it must not create or imply
the evidence itself.

## Prevention

Tests should cover the fully missing state, stale parent SHA rejection, and
blocked gate tamper rejection. Admin UI wiring should expose the command as an
operator packet, not as a browser approval or launch action.
