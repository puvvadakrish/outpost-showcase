# Local Beta Walkthrough Polish Brainstorm

Date: 2026-06-15

## What We Are Fixing

The local beta loop is now functionally provable, but the owner and staff
screens still read as separate surfaces. A user can save manual facts, stage
answers, create staff work, and resolve tasks, yet the UI does not make that
path feel like one coherent product loop.

## Product Goal

Make the existing local proof path legible from a user perspective:

1. Manual source facts are staged.
2. Owner reviews draft/conflict answers.
3. A staff task proves uncertain work reaches the workboard.
4. Staff resolves the task while live providers remain blocked.

The proof object remains the staff-ready task. This is a walkthrough polish
slice, not a new persistence or automation slice.

## Design Diagnosis

- The owner proof panel has the right data, but its grid feels more like a
  status dashboard than a guided loop.
- Staff task proof exists in the selected-task detail, but it does not visibly
  connect back to the owner path that created the task.
- Mobile has improved screen-by-screen, but the full path still needs compact
  labels and fewer competing boxes.
- Readiness blockers should remain clear without becoming the primary visual
  object on every screen.

## Recommended Approach

Add a shared local-beta walkthrough spine:

- Reuse the existing `ownerBetaLoopSummary(...)` state and task proof
  projection.
- Present the owner loop as a compact numbered route with the current step,
  progress, and blocked live-provider gates.
- Add a staff-side proof strip above the workboard so a user can see why the
  selected task matters in the beta loop.
- Keep manual intake and detail controls intact, but visually demote utilities
  and make the next action more obvious.

## Non-Goals

- No schema, RPC, RLS, service, or seed-data changes.
- No live phone/email/provider behavior.
- No hosted Supabase proof claim.
- No onboarding/import automation, task automation, billing, POS, or
  member-ledger work.

## Acceptance Criteria

- `/owner` makes the local beta loop read as one route from source facts to
  staff proof.
- `/staff/tasks` shows the selected task's place in that same route.
- Desktop and mobile render without horizontal overflow.
- Existing forms, actions, and backend/local modes continue to work.
- Verification includes typecheck, tests, build, and Chrome screenshots.
