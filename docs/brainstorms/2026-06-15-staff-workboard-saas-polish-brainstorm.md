# Staff Workboard SaaS Polish Brainstorm

Date: 2026-06-15

## Question

How should the staff task surface be polished so it feels like a professional SaaS workboard rather than a form-heavy prototype, while preserving the current local Supabase-backed task workflow?

## Constraints

- Keep the current Next.js/TypeScript implementation and existing backend behavior.
- Do not add providers, phone/email ingestion, notifications, billing, POS/member-ledger writes, or live automation.
- Preserve the staff-ready task as the primary proof object.
- Keep the screen operational, dense enough for repeated staff use, and responsive without horizontal scrolling.
- Use `DESIGN.md` Front Desk Command direction: quiet operations UI, clear status, subdued surfaces, no decorative marketing composition.

## Current Friction

- Manual task creation visually dominates the page before the task queue, even though the queue is the core staff work surface.
- The staff task detail panel has useful proof and action controls, but the repeated boxed fields and mono uppercase labels make the page read like a database editor.
- The suggested next step is present, but it can carry more visual command weight because it is the staff action target.
- Mobile already stacks, but the hierarchy should make the selected task and next action easier to scan.

## Options Considered

### 1. Full staff dashboard redesign

This could rebuild the task queue, add filters, introduce a split-pane toolbar, and add richer staff analytics.

Reject for this slice. It would be a larger product change and risks inventing workflow before the local beta rehearsal exposes real staff needs.

### 2. Detail-only typography cleanup

This would change labels and spacing but leave the large manual task form in the main flow.

Partial value, but it does not solve the first-impression problem: the page still reads as a task creation form instead of a workboard.

### 3. Queue-first polish with secondary manual intake

Make manual intake a compact disclosure, tighten task row hierarchy, give the next step stronger operational treatment, and make editable labels more readable without changing persistence.

Recommended. It is the smallest visual/product slice that fixes the staff surface's current hierarchy.

## Decision

Proceed with queue-first staff workboard polish:

- Keep `TaskTable` as the first-class work surface.
- Convert manual task creation into a compact disclosure that is available but not visually dominant.
- Make row and detail labels use sentence-case operational typography instead of mono uppercase where the user is editing or reading field values.
- Strengthen the suggested next step as the command object in each task row.
- Keep backend/service/RPC behavior unchanged.

## Non-Goals

- No new task filters, assignment persistence, note backend changes, provider ingestion, notifications, or live routing.
- No schema or RLS changes.
- No hosted Supabase proof claim.
