---
title: "brainstorm: Admin pre-self-serve readiness matrix"
date: 2026-06-22
status: accepted
---

# Problem

Outpost now has repeatable hosted proof and operator-assisted beta handoff
artifacts, but the admin portal should say whether the product is ready for
public owner onboarding without relying on chat memory.

# Scope

- Add a read-only pre-self-serve readiness matrix to `/admin`.
- Derive gates from existing hosted proof records, customer handoff records,
  request fulfillment receipts, owner readiness rows, rollback readiness, and
  no-live-provider gates.
- Keep public self-serve intentionally blocked until customer-observed proof and
  a later productization decision.

# Decision

Use a domain projection over existing reports. The matrix should make the next
operator action obvious while preserving the current no-live-provider boundary.
