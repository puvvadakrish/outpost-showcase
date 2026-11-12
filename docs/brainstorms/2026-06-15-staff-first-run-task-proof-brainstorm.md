---
title: "Staff first-run task proof"
type: brainstorm
status: complete
date: 2026-06-15
---

# Staff First-Run Task Proof Brainstorm

## What We're Building

Make the staff workboard complete the local beta loop that starts on the owner
page. When an owner creates staff work from an answer review item, staff should
see why the task exists, what proof step it satisfies, and how to resolve or
ignore it without needing to understand backend provenance.

## Why This Approach

The backend already creates answer-derived tasks transactionally and records
provenance in task events and audit metadata. The owner beta-loop UI now points
owners to staff task proof, but the staff page still treats those tasks like any
other manual task. This slice should clarify the existing task object rather
than adding schema or write authority.

## Key Decisions

- Keep the slice read-only except for existing status, assignment, note, and
  manual-task actions.
- Derive task proof/provenance from existing task rows and creation events.
- Highlight answer-review tasks in the staff list and selected-task detail.
- Add a compact proof checklist in the detail panel: read context, assign or
  own it, resolve or ignore.
- Preserve provider, notification, billing, hosted-proof, and live-channel
  blocks.

## Alternatives Considered

- Add first-class task provenance columns. Rejected for this slice because it
  would require schema/RPC/RLS changes; useful later if provenance becomes a
  query/filter primitive.
- Add a separate staff onboarding wizard. Rejected because it would duplicate
  the workboard and hide the real task workflow.
- Auto-resolve tasks after owner approval. Rejected because local beta proof
  should verify the staff workflow explicitly.

## Success Criteria

- Staff can tell which tasks came from owner answer review.
- The selected answer-derived task shows its source, why staff needs to act, and
  the next proof action.
- Domain tests cover the new task-proof projection.
- Browser smoke covers owner-created task visibility and staff resolution.

## Open Questions

None for this slice.
