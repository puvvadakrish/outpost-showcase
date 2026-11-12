---
status: active
created: 2026-06-13
product: Outpost
---

# Owner Answer Review Queue Brainstorm

## What We Are Building

Build the next smallest owner answer-bank slice after manual source facts can
stage draft/conflict answer proposals. The owner needs a backend-backed review
queue that can resolve staged items without creating live-provider behavior:
edit draft answers, approve draft/conflict answers through existing approval
persistence, retire unwanted draft/conflict answers, and prevent repeated manual
source intake from piling up duplicate draft proposal rows for the same
source/topic.

## Why This Slice

The current local Docker proof can create manual facts and stage answer
proposals, but the owner review surface is still incomplete. Owners can edit
drafts and approve draft/conflict entries, but there is no backend retire path
for "do not use this proposed answer," and re-intaking the same manual notes can
create duplicate draft proposals. That makes the beta setup loop confusing even
before live providers exist.

## Key Decisions

- Keep the review queue tenant-owner scoped. Staff may read tenant answer-bank
  entries through existing RLS but must not retire or refresh owner answer
  proposals.
- Add a transactional `retire_answer_bank_entry` RPC for existing answer-bank
  entries. The RPC updates the answer row, writes an `answer_bank_revisions`
  row with `revision_intent = 'retirement'`, and writes one audit event.
- Extend `propose_answers_from_manual_source` so eligible manual facts refresh
  an existing non-retired draft/conflict proposal for the same tenant, source
  document, and normalized topic instead of creating a duplicate row.
- Do not silently rewrite approved live answers during dedupe. If an approved
  answer exists for the same topic/source, the proposal path may still create
  owner review work; live answer behavior remains explicit owner approval only.
- Treat conflict-tagged facts as blocked conflict proposals. Conflict
  resolution is owner edit plus approval or retirement; no separate conflict UI
  state machine is needed yet.

## Scope Boundaries

- No task creation from answer review.
- No provider setup, phone, email, Retell, Resend/Gmail, webhooks, billing,
  POS, payments, or member-ledger writes.
- No hosted Supabase proof is claimed while the free-project quota blocker
  remains.
- No staff workflow expansion beyond denial proof for owner-only RPCs.

## Success Criteria

- Owner can retire draft/conflict answer-bank entries from the review queue.
- Retire writes answer row + revision + audit event atomically.
- Failure-path tests prove no partial answer/revision/audit state.
- Local RLS verifier proves same-tenant staff denial, cross-tenant denial, and
  direct write denial for the new RPC.
- Re-intaking and re-staging the same manual source facts refreshes existing
  draft/conflict proposals instead of adding duplicate proposal rows.
- Existing edit/approve behavior and no-live-provider gates remain intact.
