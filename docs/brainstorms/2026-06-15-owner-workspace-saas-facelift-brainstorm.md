---
title: "brainstorm: Owner workspace SaaS facelift"
date: 2026-06-15
status: complete
---

# Owner Workspace SaaS Facelift Brainstorm

## Context

The local beta workflow is now credible at the backend boundary: manual source
facts can stage answer proposals, owners can approve or route answers, answer
review can create staff work, and the local rehearsal verifier proves the loop
against Supabase Docker. The next risk is not persistence. It is whether the
owner workspace looks and feels like a professional SaaS surface instead of a
stack of implementation panels.

Current visual problems:

- The first viewport repeats topbar metrics with three large metric cards.
- The owner page stacks too many boxed panels with similar visual weight.
- Manual source facts read as a long form wall.
- Rehearsal and command proof content sits too high for normal owner use.
- Mono uppercase labels are overused, making form-heavy areas feel technical.
- The path from facts to staged proposals to approval is present but not obvious
  enough at a glance.

## Visual Thesis

The owner workspace should feel like a calm command review desk:

- Status and blockers are visible, but compact.
- The primary object is the review workflow, not a developer proof panel.
- Source facts should look like rows of operating evidence, not a questionnaire.
- Forms should appear where an edit happens, not dominate every scroll position.
- Technical proof remains available but moves into secondary disclosure.

## Options

### Option A: CSS-only polish

Reduce shadows, spacing, and typography intensity without changing component
structure.

Pros: low risk and fast.

Cons: the page would still read as a stack of equal-weight panels and the manual
source workflow would still feel like a field wall.

### Option B: Owner workspace IA facelift

Change only the owner workspace component hierarchy and CSS presentation:
compact the readiness/proof area, remove duplicate overview cards, make manual
facts row-based, collapse local rehearsal proof, and reduce mono label use.

Pros: fixes the actual user perception problem while preserving backend and
workflow behavior.

Cons: requires browser review because spacing and responsive behavior change.

### Option C: Full app shell redesign

Rework app shell, navigation, staff workboard, owner setup, and design tokens
in one broad visual pass.

Pros: could create a more complete visual reset.

Cons: too large for the current slice and likely to hide regressions.

## Recommendation

Use Option B. Keep the app architecture and backend untouched, but make the
owner workspace feel like the product surface an owner would actually use.

## Decisions

- Do not add schema, RPCs, repositories, providers, notifications, billing,
  hosted proof, or live phone/email behavior.
- Remove the duplicate owner overview card row on desktop; topbar metrics and
  the beta-loop strip carry the summary.
- Convert the local rehearsal panel into a collapsed proof disclosure.
- Treat manual source facts as compact rows with topic, confidence, conflict,
  and answer text columns.
- Keep handoff rules, notification destinations, and channel stubs below the
  review workflow as setup details.
- Reduce mono/uppercase label treatment in owner setup forms; reserve mono for
  numbers, commands, confidence, counts, and technical values.
- Update `DESIGN.md` only for durable new design guidance introduced by this
  slice.

## Acceptance Signals

- The `/owner` first viewport reads as a focused owner review workspace.
- The page no longer starts with three large duplicate metric cards.
- Manual facts can be scanned row-by-row without feeling like four stacked
  mini forms.
- Local rehearsal proof remains available but no longer dominates the page.
- Typography looks calmer and more professional, especially in labels.
- Browser screenshots show no obvious text collisions, clipped controls, or
  horizontal overflow at desktop and mobile widths.
