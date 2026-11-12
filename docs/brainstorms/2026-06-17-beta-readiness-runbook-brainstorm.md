---
title: "Beta readiness runbook"
type: brainstorm
date: 2026-06-17
---

# Beta Readiness Runbook Brainstorm

## What We're Building

Package the current local owner/staff beta rehearsal into an operator-readable
runbook and a clearer in-app readiness checklist on `/owner`.

The workflow is:

1. reset local Supabase Docker;
2. run the owner source-to-answer-to-staff rehearsal;
3. run the staff roster claim rehearsal;
4. inspect owner and staff screens locally;
5. stop before hosted Supabase, live phone/email providers, billing, POS, or
   member-ledger behavior.

## Recommended Approach

Use a documentation-plus-derived-UI slice:

- Add a markdown operator runbook under `docs/setup/`.
- Extend the existing beta-loop projection with local operator readiness copy,
  commands, checks, and no-go gates.
- Render that projection in the existing owner beta rehearsal panel without
  adding new mutations, schema, RPCs, or provider behavior.
- Keep commands local-Docker labeled and keep hosted/live gates explicit.

This fits the current architecture because the rehearsal commands already prove
the backend workflows through local Auth/RLS/RPC. The new slice should package
and clarify that proof path, not create a second proof mechanism.

## Alternatives Considered

### New beta route

A standalone `/owner/beta-readiness` route would make the runbook prominent,
but it adds navigation and surface area for a workflow that should stay attached
to the owner proof path.

### Browser automation harness

Browser automation would exercise more UI, but it would add a new dependency and
is not necessary for this packaging slice. Manual browser screenshots plus the
existing local verifier scripts are enough.

### Hosted readiness copy

Hosted readiness copy would be misleading while Supabase project creation is
blocked by quota. The in-app checklist should say local rehearsal is packaged,
not that hosted preview is ready.

## Key Decisions

- Keep local Supabase Docker as the proof path.
- Include both `npm run beta:rehearsal:local` and
  `npm run staff:claim:rehearsal:local`.
- Add runbook file references and operator steps to `/owner`, but no new write workflow.
- Keep hosted Supabase proof unclaimed and keep live providers blocked.
- Do not introduce schema, migrations, RPCs, provider setup, notifications,
  billing, POS, payment, member-ledger writes, or live phone/email behavior.

## Success Criteria

- A founder/operator can follow one runbook to rehearse owner and staff beta
  locally after `npm run db:reset`.
- `/owner` shows an in-app readiness checklist that separates local proof from
  no-go gates.
- Existing no-live-provider and hosted-quota blockers remain visible.
- Tests, local Supabase proof, browser screenshots, and review pass before PR
  merge.

## Open Questions

None. The requirements are clear enough to proceed to implementation planning.
