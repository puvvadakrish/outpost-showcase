---
date: 2026-06-21
topic: beta-operator-access-ops
---

# Beta Operator Access Ops

## What We're Building

Build the smallest repeatable operator workflow for granting a real beta owner
access to a hosted Neon proof branch. The workflow should provision or verify a
Neon Auth email/password user, upsert the existing `owner_beta_access_grants`
row for that owner email, prove the signed-in owner can see only their own
grant through `has_active_owner_beta_access`, and verify live providers remain
blocked.

This is an operations bridge between the hosted Neon/Vercel proof and a House
of Fitness handoff. It is not public self-serve signup, invite email delivery,
Auth admin productization, production promotion, or live phone/email provider
setup.

## Why This Approach

The hosted preview and owner beta access gates are green, but customer handoff
still depends on ad hoc Neon Auth and grant setup. A CLI/runbook slice keeps the
handoff repeatable and auditable enough for a first beta while preserving the
existing product boundary. It also avoids prematurely adding invite delivery or
a founder-admin write UI before the single-customer hosted path is proven.

## Key Decisions

- Use the existing `owner_beta_access_grants` table instead of adding schema.
  It already represents the gate that `bootstrap_owner_tenant` checks.
- Keep this as a script plus runbook under `scripts/` and `docs/setup/`, not a
  customer-facing screen.
- Require hosted Neon Auth/Data API env and refuse `production` plus
  `outpost-neon-spike`, matching existing proof-branch discipline.
- Use a caller-supplied temporary password for the beta owner. The script may
  create a Neon Auth user through the public hosted Auth endpoint, then mark
  that proof user verified through branch-scoped Neon SQL.
- Prove access through the Data API as the signed-in owner, including a negative
  cross-email grant probe, so the operator does not rely only on direct SQL.
- Keep no-live-provider gates explicit by verifying no provider connection is
  configured outside disabled/not-configured proof states.

## Out Of Scope

- Public owner self-signup.
- Invite email delivery, password reset delivery, or notification delivery.
- Auth admin product APIs or a founder-admin write interface.
- Retell, Resend, Gmail, provider ingress, live calls, live email ingestion,
  automated outbound replies, billing, POS, or member-ledger writes.
- Production Vercel promotion.

## Architecture Check

The slice stays outside product runtime boundaries. It uses the existing hosted
proof helpers for Neon project and endpoint validation, uses direct branch SQL
only as an operator action, and validates the resulting customer-visible gate
through Neon Auth plus the Data API. That keeps the tenant/data path unchanged:
the app still admits an owner only after a signed-in email matches an active
grant and the owner bootstrap RPC creates tenant state transactionally.

## Next Steps

Proceed to `ce-plan` for the command, tests, hosted proof, review, and durable
status updates.
