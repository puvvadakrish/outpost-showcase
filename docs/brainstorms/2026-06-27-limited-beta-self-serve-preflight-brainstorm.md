---
title: Limited beta onboarding and self-serve preflight
date: 2026-06-27
status: captured
---

# Limited Beta Onboarding And Self-Serve Preflight Brainstorm

## Problem

Outpost has protected Preview proof, operator handoff packets, customer demo
gate packets, and admin proof ledgers. The next SaaS step is not to open public
self-serve. It is to make the next operator-assisted gym onboarding repeatable
from the current proof chain, then prepare a public self-serve preflight that
still blocks launch until real customer evidence exists.

## Scope

Build two linked terminal/admin slices:

1. A limited operator-assisted beta onboarding packet that starts from the
   customer demo gate packet and produces a customer-safe checklist for the
   next approved gym request.
2. A public self-serve preflight packet that starts from limited onboarding
   evidence and documents the remaining go/no-go gates without enabling public
   owner signup, invite delivery, provider ingress, notifications, billing,
   POS, access control, or member-ledger writes.

## Approach

Use the existing artifact pattern rather than schema or runtime changes:

- JSON packet writer under `scripts/`.
- JSON inspector that fails closed on missing parent evidence, unsafe booleans,
  secret-shaped values, local/prod-like Preview URLs, and missing blocked gates.
- Read-only `/admin` panels using the existing proof-state, gate, artifact, and
  command-row UI patterns.
- Focused tests that generate the parent artifact chain in temp ignored
  artifacts and prove positive and negative paths.

## Decisions

- The limited beta packet can be prepared from a customer demo gate packet, but
  it must not claim customer-observed completion or public launch readiness.
- The self-serve preflight can be prepared only from limited onboarding packet
  evidence and must remain launch-blocked.
- Owner access remains operator-managed. No browser approval buttons, public
  signup approval, invite delivery, Auth admin product API, or provider setup is
  added.
- The admin UI should be operational and scannable, matching the existing
  Outpost admin portal style.

## Rejected

- Adding a new database table for preflight packets: artifact inspection is
  enough for this slice and avoids implying hosted proof that has not happened.
- Adding public request fulfillment automation: that crosses into self-serve
  launch behavior and needs a later customer-proven gate.
- Adding provider setup toggles: phone/email providers remain explicitly out of
  scope until the customer handoff and later launch gates are green.

## Success Criteria

- Operators can generate and inspect both packets locally without secrets.
- Both packets preserve explicit no-live-provider and no-self-serve boundaries.
- `/admin` shows the two new readiness surfaces and the next two SaaS slices.
- Tests cover the happy path and fail-closed behavior for unsafe parent gates.

