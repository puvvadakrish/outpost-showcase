---
title: Admin Proof Freshness
date: 2026-06-24
status: captured
---

# Admin Proof Freshness Brainstorm

## What We're Building

Add the next two pre-self-serve SaaS slices after the Admin operator
next-action queue:

1. A read-only Admin portal proof freshness summary that tells operators whether
   the latest hosted evidence is current for the Preview URL and Neon proof
   branch being viewed.
2. Terminal-only `admin:proof-freshness:export` and
   `admin:proof-freshness:inspect` commands that write and validate a sanitized
   freshness artifact for handoff outside chat memory.

## Why This Approach

The Admin portal now has many proof ledgers and a next-action queue, but the
operator still has to mentally check whether records belong to the current
protected Preview and hosted Neon branch. That creates drift risk before a
customer-observed handoff or launch-review packet. A freshness projection makes
the current path explicit without adding browser mutation controls.

## Key Decisions

- Derive freshness from the existing `FounderAdminProofStatusLedger`; do not
  create new hosted tables or mutate hosted data.
- Treat a record as fresh only when its Preview origin and Neon branch match
  the current ledger context.
- Keep the portal read-only and compact: show current, stale, missing, or
  blocked states with exact next command guidance.
- Export only non-secret labels, states, Preview URL, branch, and command
  guidance under ignored `artifacts/`.
- Preserve blocked public self-serve, invite delivery, notifications,
  phone/email providers, billing, POS, access control, and member-ledger writes.

## Non-Goals

- No public owner self-signup.
- No browser approval or launch buttons.
- No invite delivery or notification sending.
- No phone/email provider activation.
- No billing, POS, access control, or member-ledger writes.
- No customer-observed completion claim.

## Success Criteria

- `/admin` shows a compact proof freshness panel derived from existing proof
  state.
- Freshness marks stale evidence when records target a different Preview URL or
  Neon branch.
- Export writes a secret-scanned JSON artifact with blocked live-provider gates.
- Inspect fails closed on stale/unsafe artifacts, browser approval affordances,
  public self-serve launch allowance, or live-provider allowance.
- Tests, typecheck, build, browser smoke, and Claude Code Opus review pass.
