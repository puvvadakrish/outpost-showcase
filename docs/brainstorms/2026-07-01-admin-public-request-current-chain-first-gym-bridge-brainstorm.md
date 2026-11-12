---
title: Admin Public Request Current-Chain First-Gym Bridge
date: 2026-07-01
status: captured
---

# Admin Public Request Current-Chain First-Gym Bridge

## What We're Building

Add the missing executable bridge between the public-request customer proof
runway and the first-gym operator-assisted run. The current Admin runway already
has public-request hosted rehearsal evidence, customer-session proof acquisition,
first-gym go/no-go readiness, and first-gym evidence acquisition packets. The
gap is that the actual first-gym go/no-go bundle still points through the older
approved-gym artifact lane.

## Why This Approach

The public-request chain should be self-contained before a real gym demo. The
operator needs one consistent path:

- public-request hosted rehearsal evidence
- customer-observed session record
- hosted customer-session proof confirmation
- public-request first-gym go/no-go bundle
- public-request first-gym operator-run record

This keeps the operator workflow repeatable without claiming public signup,
invite delivery, live providers, billing, POS, access control, or member-ledger
writes.

## Key Decisions

- Keep the old approved-gym commands intact for historical artifacts.
- Add explicit public-request commands instead of overloading the old
  `admin:first-gym:*` commands.
- Require Preview URL, hosted Neon branch, and hosted customer-session proof
  confirmation before creating the public-request go/no-go bundle.
- Keep the first-gym run operator-assisted only; do not use it as public
  self-serve or live-provider launch approval.
- Surface the new commands in the Admin portal runway so an operator does not
  have to remember the artifact names from chat.

## Boundaries

- No public owner self-signup.
- No browser approval buttons or automatic approval.
- No invite delivery or notification sending.
- No Auth admin product API or automatic owner/staff grants.
- No phone/email provider activation.
- No provider ingress/egress.
- No billing, POS, access control, or member-ledger writes.

## Success Criteria

- Public-request go/no-go bundle validates current-chain hosted rehearsal
  evidence and customer session proof inputs.
- Public-request first-gym run record validates that bundle and explicit
  operator confirmations.
- Scripts fail closed on stale/tampered SHA links and live-provider gate drift.
- Admin portal shows the new executable bridge.
- Full tests, typecheck, build, browser smoke, and Claude Opus review pass.
