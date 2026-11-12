---
title: Admin first gym runway batch
status: complete
date: 2026-06-30
---

# Admin First Gym Runway Batch Brainstorm

## What We're Building

Extend the current admin readiness chain after the first-gym go/no-go bundle.
The batch should let an operator record the first gym operator-assisted E2E run,
prepare a limited beta review/onboarding packet from that run, and prepare a
public self-serve launch preflight that stays blocked until separate evidence
exists.

## Why This Approach

The prior batch made the go/no-go bundle ready, but it stops before the actual
first gym run and the follow-on beta decision. The smallest useful next batch is
an append-only artifact chain that records the run outcome and turns it into the
next readiness packets without enabling product behavior.

## Key Decisions

- Keep this as an operator/admin artifact workflow, not a customer-facing
  product feature.
- Chain every artifact by parent path plus SHA-256 so tampering fails closed.
- Require explicit `yes` confirmations for observed owner, staff, rollback,
  support, no unexpected data, and no live-provider/revenue/member-system
  claims.
- Public self-serve remains a preflight artifact only. It must not create
  browser approval buttons, invites, provider activation, billing, POS, access
  control, or member-ledger writes.
- Surface the new batch in `/admin` as read-only commands, matching the existing
  admin portal design pattern.

## Batch Scope

1. First gym operator-assisted run record.
2. Limited beta review/onboarding packet after that run is reviewed.
3. Public self-serve launch preflight with blocked gates and required future
   proof.

## Out Of Scope

- Hosted Neon mutations.
- Vercel deployment changes.
- Public signup.
- Invite delivery or notification sending.
- Phone/email provider activation.
- Product Auth admin APIs or Auth user creation.
- Billing, POS, access control, or member-ledger writes.

## Success Criteria

- Commands are repeatable, non-secret, and fail closed on missing/tampered
  parent artifacts.
- `/admin` shows the next batch without action buttons.
- Tests prove happy path and guardrail failures.
- Claude Code Opus 4.8 review finds no blocking issues before merge.
