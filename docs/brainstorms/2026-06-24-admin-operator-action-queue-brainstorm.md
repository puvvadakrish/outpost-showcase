---
title: Admin Operator Action Queue
date: 2026-06-24
status: captured
---

# Admin Operator Action Queue

## Feature Idea

The Admin portal has accumulated the right proof gates, command snippets, and no-go copy, but the operator still has to scan many sections to understand the next action. Add a compact read-only queue that derives the next terminal action from existing Admin proof state, then add a terminal-only export/inspect artifact so the next-action state is repeatable outside chat memory.

## Scope

Slice 1: Admin portal next-action queue.

- Derive actions from existing `FounderAdminProofStatusLedger`, launch readiness, launch promotion, launch package, launch decision, launch follow-through, operator rehearsal, and beta request projections.
- Show the queue near the top of `/admin` with action state, reason, command, and blocked live-provider boundary.
- Keep the UI read-only. No buttons that approve, launch, send invites, enable providers, or mutate hosted data.

Slice 2: Admin next-action queue export.

- Add terminal-only `npm run admin:next-actions:export` and `npm run admin:next-actions:inspect`.
- Write a sanitized JSON artifact under ignored `artifacts/admin-launch-readiness/`.
- Inspect the artifact for command presence, no-secret shape, blocked public self-serve/live-provider gates, and no browser approval affordances.

## Chosen Approach

Use the existing domain projection layer as the source of truth. The queue should not introduce new status concepts that drift from the current gates. It should rank existing commands into a short operator list, with the top item being the next thing to run and lower items showing subsequent blocked/pending context.

Alternatives rejected:

- Browser action buttons: rejected because Admin portal is still proof/readiness only, and browser approval controls are explicitly blocked.
- New hosted database records: rejected for this slice because the goal is operator clarity and artifact repeatability, not another append-only ledger.
- Separate route: rejected because the problem is scanability inside the existing Admin portal.

## Acceptance Criteria

- `/admin` shows a compact next-action queue derived from existing proof/readiness projections.
- Queue copy keeps public self-serve, invite delivery, notifications, phone/email providers, billing, POS, access control, and member-ledger writes blocked.
- Export script writes only sanitized non-secret JSON under `artifacts/`.
- Inspect script fails closed if live-provider/public-self-serve gates are not blocked or if browser approval affordances appear.
- Typecheck, tests, build, browser smoke, and Claude Code Opus review pass.
