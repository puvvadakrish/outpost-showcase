---
title: "Owner first-run beta loop"
type: brainstorm
status: complete
date: 2026-06-15
---

# Owner First-Run Beta Loop Brainstorm

## What We're Building

Make the existing owner workspace feel like one continuous local beta path for a
new owner: create the workspace, add manual source facts, stage proposals,
approve safe answers, and create staff-task proof. The slice should connect
existing backend-backed workflows rather than adding new persistence.

## Why This Approach

The core backend pieces already exist and have local Supabase Docker proof:
seedless bootstrap, manual source intake, answer proposal staging, owner answer
review, and answer-derived staff task creation. The gap is path clarity. A new
owner should not need to know which backend slice owns each step or scroll past
answer review before adding facts.

## Key Decisions

- Keep this as a UI/domain-projection slice over existing persisted state.
- Preserve the no-live-provider boundary and continue to label hosted Supabase
  proof as blocked by project quota.
- Make the current beta action visible at the top of `/owner` with a direct
  link to the relevant section.
- Put manual source intake before answer review in the owner workflow so the
  source-to-answer path matches the first-run sequence.
- Add a bootstrap rail that previews what setup creates and what the owner does
  next after tenant creation.

## Alternatives Considered

- Add a wizard with hidden steps. Rejected for now because it would create a
  second flow over the same forms and add state before the beta loop is stable.
- Add new persistence for onboarding progress. Rejected because progress can be
  derived from source facts, answer approvals, tasks, destinations, and provider
  stubs.
- Add scraping/import. Rejected because manual source intake remains the local
  proof path while hosted/provider work is blocked.

## Success Criteria

- A newly bootstrapped owner can see the next local proof action immediately.
- `/owner` flows from source facts to answer review to staff-task proof without
  requiring backend-state vocabulary.
- Domain tests prove the progress/current-action projection.
- Browser snapshots cover the bootstrap screen and owner beta loop on desktop
  and mobile.

## Open Questions

None for this slice.
