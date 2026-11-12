---
title: "Local beta rehearsal harness"
type: brainstorm
date: 2026-06-15
---

# Local Beta Rehearsal Harness Brainstorm

## What We're Building

Build a repeatable local-only rehearsal harness for the current Outpost beta
loop:

1. owner auth against local Supabase Docker;
2. manual source facts;
3. staged answer proposals;
4. answer-derived staff task;
5. approved answer;
6. staff resolution;
7. final read-only readiness summary with live/hosted gates still blocked.

The harness should help developers and the founder rerun the complete current
workflow after `npm run db:reset` without remembering the exact UI sequence or
raw RPC calls.

## Recommended Approach

Use a two-part slice:

- A Node verifier script that signs in as the seeded local owner, calls existing
  Supabase RPCs through the public authenticated client, reads the resulting
  tenant-scoped rows through RLS, and prints a concise rehearsal report.
- A read-only owner workspace checklist panel that explains the same rehearsal
  path and references the local command, while keeping hosted Supabase and live
  providers visibly blocked.

This keeps the proof executable and visible without adding schema, service-role
paths, background jobs, live providers, or customer-facing production behavior.

## Alternatives Considered

### UI-only checklist

This would be fast and useful for humans, but it would not give a repeatable
machine-verifiable proof after DB resets.

### Browser-only smoke script

This would exercise more of the rendered UI, but it would be brittle without a
browser automation dependency in the repo and would duplicate the manual smoke
tests already used during PR validation.

### Database SQL-only proof

The existing RLS verifier already covers table/RPC safety deeply. A SQL-only
script would miss the Supabase Auth public-client path that local beta users
actually exercise.

## Key Decisions

- Rehearsal is local-only and should default to `http://127.0.0.1:54331`.
- Use the seeded owner account rather than a service-role key.
- Require the anon/publishable Supabase key from environment so credentials stay
  out of source.
- Mutate only resettable local seed data; docs must say to run after
  `npm run db:reset`.
- Keep the owner UI panel read-only. It should not create a second workflow or
  bypass existing owner/staff screens.
- Do not claim hosted proof; the Supabase quota blocker remains explicit.

## Success Criteria

- One command verifies the local beta loop end to end against local Supabase
  Auth/RLS/RPCs.
- The command fails loudly when required local Supabase env values are missing.
- The verifier proves the expected row deltas or final row state for source
  document, source facts, answer proposal, approval, answer-derived task, task
  event, usage event, and audit event.
- `/owner` shows a concise rehearsal checklist and command without implying
  live readiness.
- Full tests, build, local DB reset/RLS verification, and browser smoke pass.

## Boundaries

- No schema or migration changes.
- No new RPCs.
- No service-role proof path.
- No hosted Supabase claim.
- No Retell, Resend/Gmail, inbound/outbound email, phone, webhooks, billing,
  POS, member-ledger, Meta/IG, or staff workflow expansion.

## Open Questions

None. The next step is a focused implementation plan.
