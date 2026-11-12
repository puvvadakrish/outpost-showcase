---
date: 2026-06-11
topic: handoff-rule-persistence
---

# Handoff Rule Persistence Brainstorm

## What We're Building

Persist owner edits to existing handoff rules as the next backend-backed owner
setup slice. The owner can change a seeded rule's topic, trigger, action,
destination, active window, priority, and status; Outpost writes the current
rule row, a revision row, and an audit event in one PostgreSQL transaction.

This is not live routing. The slice only stores owner policy that future phone
and email runtime work can consult after hosted persistence proof is complete.

## Why This Approach

Owner-approved answers are now editable and approvable through Supabase RPCs.
The next useful backend step is to persist the complementary "do not answer
this; hand it to a human" policy. Handoff rules sit directly between answer
bank safety and future provider behavior, so they need the same tenant isolation,
history, audit, and no-partial-write proof before live channels exist.

## Key Decisions

- Extend the existing RPC pattern instead of granting direct table writes.
- Add a narrow `handoff_rule_revisions` table because current schema has
  `handoff_rules` but no durable evidence trail for owner policy changes.
- Keep update scope to existing rules. Creating/removing rules stays
  browser-local until a later slice defines owner workflow and validation.
- Allow `transfer_when_live` as stored policy, but preserve provider/readiness
  gates so no transfer or live phone behavior is enabled.
- Derive the actor from Supabase Auth inside the RPC, not from client input.
- Prove tenant isolation through RLS SQL and repository tests, including
  cross-tenant denial.

## Explicit Non-Goals

- No Retell, phone transfer, call handling, recordings, transcripts, webhooks,
  Resend/Gmail, inbound/outbound email, billing, ClubOS/POS/payment/member
  ledger writes, Meta/IG, or staff task creation.
- No runtime rule evaluation.
- No hosted proof claim while Supabase project quota remains blocked.

## Success Criteria

- Updating an existing own-tenant rule writes exactly one rule update, one
  handoff-rule revision, and one audit event.
- Mid-transaction failure tests prove no partial rule/revision/audit state.
- Cross-tenant owner attempts fail through the RPC.
- Existing no-live-provider readiness copy and gates remain blocked.
- The implementation follows the answer-bank service/repository/RPC pattern.

## Open Questions

None for this narrow slice.
