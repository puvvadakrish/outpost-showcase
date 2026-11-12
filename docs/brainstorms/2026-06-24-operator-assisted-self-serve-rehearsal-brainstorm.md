---
title: Operator-assisted self-serve rehearsal
date: 2026-06-24
status: captured
---

# Operator-assisted self-serve rehearsal

## What We're Building

Add the next two pre-self-serve SaaS slices after admin launch follow-through:

1. A terminal-only command that turns a reviewed follow-through artifact into a
   customer-safe operator-assisted self-serve rehearsal packet.
2. A hosted Neon completion ledger, plus Admin portal read-only projection, for
   recording that the rehearsal was completed without enabling public launch.

## Why This Approach

The previous follow-through artifact is permission to rehearse the next launch
slice, not permission to expose public signup. The rehearsal should therefore
stay terminal-driven, artifact-backed, and explicit about what the operator
must observe. Completion should be durable in hosted Neon so the Admin portal
can show progress without relying on chat memory.

## Key Decisions

- Reuse the reviewed `admin_launch_followthrough_prepared` artifact as the
  only acceptable input.
- Require operator-observed evidence labels, but keep temporary passwords,
  tokens, cookies, bypass secrets, and provider credentials out of artifacts.
- Record completion as a hosted Neon admin-only proof row, scoped to Preview
  URL, Neon branch, and follow-through artifact digest.
- Keep the Admin portal read-only: no browser approval buttons and no mutation
  controls.

## Boundaries

- No public owner self-signup.
- No invite delivery or notification sending.
- No phone/email provider activation.
- No billing, POS, access-control, or member-ledger writes.
- No claim that customer self-serve is live.

## Success Criteria

- Rehearsal packet generation fails closed on missing/unsafe follow-through
  artifacts and writes only non-secret JSON.
- Completion import fails closed on production/spike Neon branches, mismatched
  Preview/branch, missing blocked gates, or secret-shaped content.
- Admin portal shows rehearsal records and next command copy without enabling
  live behavior.
