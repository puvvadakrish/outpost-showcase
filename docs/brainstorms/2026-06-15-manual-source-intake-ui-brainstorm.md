---
date: 2026-06-15
topic: manual-source-intake-ui
status: captured
---

# Manual Source Intake UI Brainstorm

## What We're Building

Make the existing manual source intake workflow usable from the owner workspace.
The backend slice already persists a manual source document, replacement source
facts, and an audit event through `upsert_manual_source_document`, then stages
answer proposals through `propose_answers_from_manual_source`. This slice should
surface that workflow clearly without adding another persistence boundary.

## Why This Approach

The smallest useful next step is to let the owner choose a location, create or
refresh a manual source, enter multiple proposed facts, mark conflict groups,
and stage saved manual facts as answer proposals for review. That gives the
local beta loop a source-to-answer path while preserving the current local
Supabase Docker proof model.

This should stay a UI and action-parsing improvement:

- keep the existing transactional RPCs;
- keep source facts proposed until owner review;
- keep answer approval, task creation, and live channels as separate workflows;
- avoid importing/scraping sources or connecting providers;
- make the replace-all fact behavior visible in the owner UI.

## Key Decisions

- Use the existing owner workspace rather than a new route so the beta-loop
  panel can link directly to source intake.
- Support location selection and manual source selection, but only update
  source documents that already belong to the chosen location.
- Add conflict-group input because the backend and answer proposal RPC already
  use it to stage conflict proposals.
- Show persisted manual source summaries so owners know which document can be
  staged into answer proposals.
- Do not load or edit existing individual source facts in this slice; saving a
  document replaces the proposed fact set from the submitted form.

## Explicit Non-Goals

- No source scraping, Google import, or file upload.
- No answer approval or live-answer serving.
- No task creation, assignment, notification delivery, provider setup,
  webhooks, billing, POS, payments, ClubOS, or member-ledger writes.
- No hosted Supabase/Vercel proof claim while the Supabase free-project quota
  blocker remains.

## Success Criteria

- Owner workspace has a clear source intake anchor linked from beta-loop setup.
- The form can create a new manual source or refresh an existing manual source
  for a chosen location.
- Submitted conflict groups reach the existing backend command.
- Persisted manual sources can be staged into draft/conflict answer proposals.
- Local verification and browser smoke prove the workflow without claiming
  hosted preview readiness.
