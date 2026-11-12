---
title: Customer-Observed Beta Handoff Gate
date: 2026-06-22
status: complete
---

# Customer-Observed Beta Handoff Gate

## What We're Building

Add a reusable operator gate that records a beta handoff as customer-observed
only after an external gym owner has seen the protected Vercel Preview,
completed owner sign-in, reached the owner workspace, walked through manual
source facts to answer review to staff task, reviewed reset/rollback support,
and confirmed there was no unexpected data or live-provider behavior.

This is not a new self-serve signup path. It wraps the existing generic beta
owner packet and completion artifacts with a final fail-closed gate artifact
that can be checked later without relying on chat memory.

## Why This Approach

The product already has the correct operator-assisted pieces:

- `npm run beta:owner-handoff:packet` generates the customer-safe checklist.
- `npm run beta:owner-handoff:complete` records observed confirmations.
- `/owner` and `/founder-admin` show read-only readiness and proof boundaries.
- Hosted proof-run records prove the protected Preview and founder-admin access
  without claiming customer-observed completion.

The missing piece is an independent green gate that validates the packet and
completion record together, rejects internal/dry-run evidence, preserves
no-live-provider gates, and writes a sanitized result under ignored
`artifacts/`.

## Key Decisions

- Use a CLI-first gate rather than a new web mutation. This avoids adding
  support write authorization, schema, or rollback buttons while the product is
  still in operator-assisted beta.
- Require explicit customer-observed evidence. Internal smoke tests,
  disposable dry-runs, and founder-admin proofs remain prerequisites, not the
  customer handoff itself.
- Re-check boundaries from artifacts instead of trusting operator memory:
  operator-assisted beta, blocked live providers, all observed confirmations,
  stop concerns exactly `none`, and no secret-shaped content.
- Keep the artifact customer-safe. Do not store passwords, cookies, API keys,
  JWTs, bypass secrets, command output, raw notes, or hosted credentials.

## Out Of Scope

- Public self-signup.
- Invite delivery.
- Phone/email providers, Retell, Resend, Gmail, webhooks, or notifications.
- Billing, POS, access control, Club OS replacement, or member-ledger writes.
- Automated rollback execution or support mutation buttons.
- Recording Acme Fitness-specific completion before the owner actually
  observes the workflow.

## Success Criteria

- A new npm command validates packet plus completion evidence and writes a
  sanitized customer-observed gate artifact.
- The command fails closed when packet/completion artifacts are missing,
  completion is not customer-observed, stop concerns are present, live-provider
  gates are not blocked, or paths/secrets are unsafe.
- Owner and founder-admin ledger copy point operators to the final gate command
  without implying the gate is already green.
- `AGENTS.md`, `PLOT.md`, and the hosted beta runbook capture the durable state.
