---
title: Admin customer-observed session record
date: 2026-06-27
status: captured
---

# Admin Customer-Observed Session Record Brainstorm

## Problem

The admin launch-readiness chain now reaches a customer-safe handoff scheduling packet, but it still deliberately leaves the real customer-observed session unresolved. Operators need a repeatable way to record that a gym owner actually saw the protected Preview, owner workspace, staff handoff path, reset/rollback guidance, and no-live-provider boundaries without relying on chat memory or implying public self-serve readiness.

## Scope

Build the next two SaaS slices as one proof package:

- A terminal-only customer-observed session record generated from the existing handoff scheduling packet.
- A strict inspector that refuses the record unless all owner-visible checks and no-live-provider confirmations are explicit.

This should be generic for any operator-assisted gym, not Acme Fitness-specific.

## Chosen Approach

Use the existing artifact-chain architecture under `artifacts/admin-launch-readiness/`. The record script re-inspects the scheduling packet, hashes it, copies only non-secret customer-safe metadata, requires explicit `yes` confirmations for every observed and blocked gate, and writes a new JSON artifact. The inspector replays the scheduling-packet verification, validates the SHA chain, and refuses forged completion or live-provider claims.

This avoids a database write because the current need is operational proof, not a product workflow. It also avoids browser approval buttons, invite delivery, notifications, provider ingress, billing, POS, access control, or member-ledger writes.

## Rejected Approaches

- **Admin UI completion button:** rejected because it would look like a product action and risks implying public launch readiness.
- **Database-backed customer session table:** rejected for this slice because the existing admin proof chain is artifact-based and this record should stay terminal-only until customer handoff semantics are stable.
- **Acme Fitness-specific completion:** rejected because the product boundary is repeatable SaaS, not a custom services flow.

## Success Criteria

- Operators can run a record command only after a valid scheduling packet exists.
- Missing or non-`yes` customer-observed confirmations fail closed.
- The inspector catches stale parent hashes, unsafe live-provider flags, missing observed checks, and secret-shaped values.
- `/admin` exposes the next commands in the existing readiness surface without adding product activation controls.
- AGENTS.md and PLOT.md record that this proves a customer-observed session record path only, not live providers or self-serve launch.

## No-Live-Provider Gates

The record may claim `customer_observed_session_recorded: true` only after explicit operator confirmation. It must still keep public owner self-signup, invite delivery, source automation, automatic answer approval, automatic task generation, email ingress, outbound email, notification sending, phone/email providers, billing, POS, access control, and member-ledger writes blocked.
