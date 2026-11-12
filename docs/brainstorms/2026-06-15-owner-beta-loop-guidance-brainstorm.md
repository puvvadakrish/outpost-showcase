---
topic: owner-beta-loop-guidance
status: complete
date: 2026-06-15
---

# Owner Beta Loop Guidance Brainstorm

## What We're Building

Make the existing local Supabase beta loop easier to understand from the owner
workspace. The owner should land on `/owner` and immediately see what is ready
to test locally, what the next safe action is, and what remains blocked before
real customer beta or live providers.

This is a product-guidance and frontend slice over existing persisted state. It
does not introduce new provider behavior, hosted proof, billing, or task
creation workflows.

## Why This Approach

The backend now persists the local beta ingredients: owner bootstrap, manual
source intake, answer proposal/review, manual task creation, task status,
assignment, notes, handoff rules, locations, and notification destination setup.
The product gap is that the owner page still reads like a setup workbench, not
like a clear local test loop.

The smallest useful slice is a guided "local beta loop" panel that summarizes:

- Source facts staged for review.
- Answer-bank review state.
- Staff task proof state.
- Readiness gates that remain blocked.
- The next owner/staff action to take.

## Key Decisions

- Use existing Supabase reads and local seed data. Do not add schema or RPCs.
- Load task rows into the owner page through the existing task application
  service so owner setup can show task proof without duplicating staff logic.
- Keep copy operational and direct, following `DESIGN.md`: the proof object is
  a task, not a generic AI status.
- Keep live calls, email automation, provider config, hosted preview, billing,
  POS, and member-ledger systems explicitly blocked.
- Do not replace the existing setup rail. Add a top-level panel that orients the
  beta loop before the owner dives into answer review and setup editors.

## Alternatives Considered

1. **Build a new owner dashboard.**
   Deferred. A dashboard would imply analytics and burden reduction metrics that
   are not fully persisted yet.

2. **Add a backend task-generation pipeline.**
   Deferred. The current manual task creation RPC already provides the staff
   proof object; this slice should first make the local test loop obvious.

3. **Polish only empty states.**
   Rejected as too fragmented. A single beta-loop panel gives the owner one
   coherent path through existing persisted features.

## Success Criteria

- `/owner` shows a concise local beta loop panel in backend and local modes.
- The panel uses real current state: source facts, answer review counts, task
  counts, and blocked readiness gates.
- The panel links to the relevant owner setup sections and staff workboard.
- Staff task proof stays read-only on the owner page; task mutation remains in
  `/staff/tasks`.
- The no-live-provider and hosted-proof blockers remain explicit.

## Open Questions

None for this slice.
