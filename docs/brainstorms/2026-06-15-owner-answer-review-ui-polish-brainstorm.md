---
title: "Owner answer review UI polish"
type: brainstorm
date: 2026-06-15
status: complete
---

# Owner Answer Review UI Polish Brainstorm

## What We're Building

Polish the existing owner answer-bank review workflow so a local beta owner can
understand and complete the path from manual source facts to staged answer
proposals to approved answers without reading backend state.

This is a UI and domain-projection slice over the existing answer-bank RPCs. It
does not add schema, new RPCs, source scraping/import, provider behavior,
notifications, billing, POS/member-ledger writes, or live answering.

## Why This Slice

The backend path already exists and is locally proven:

- Manual source facts can be saved.
- Saved facts can stage draft/conflict answer-bank entries.
- Draft/conflict answers can be edited, approved, retired, or turned into staff
  tasks through existing action boundaries.

The remaining beta usability gap is that staged proposals appear inside a dense
answer-bank table. Owners need a clearer review queue with source provenance,
conflict priority, and action labels that explain what each button will do.

## Chosen Approach

Use the existing `AnswerBankReviewClient` as the workflow surface and add a
review summary plus a source-aware review queue before the full table. The
queue should lead with draft/conflict items, show the source label and runtime
boundary, expose the editable proposed answer, and label actions in owner terms:
approve answer, save edited draft, create staff task, or retire proposal.

## Alternatives Considered

- **New route or wizard:** clearer flow, but heavier than needed and risks
  duplicating answer-bank action paths.
- **Backend changes:** unnecessary because the existing transaction/RLS
  boundaries already support the workflow.
- **Only copy tweaks in the table:** too small; the source-to-answer path still
  remains hard to scan.

## Key Decisions

- Keep the same server actions and RPCs.
- Add domain helpers for sorting and summarizing the owner review queue.
- Keep approved/routed/retired entries visible in the existing full answer-bank
  table, but make draft/conflict review items the first operational object.
- Preserve the no-live-provider readiness gate and hosted-proof blocker.
- Verify with local browser automation against Supabase Docker.

## Open Questions

None for this slice.
