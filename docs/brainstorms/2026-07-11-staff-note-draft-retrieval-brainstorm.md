---
topic: staff-note-draft-retrieval
date: 2026-07-11
status: decided
---

# Staff Note Draft Retrieval

## What We're Building

Help staff find unfinished in-memory handoff notes after switching tasks: first
a queue-level count, then task-card presence markers, then a Drafts-only queue
filter. Expose presence only, never note text or length outside the editor.

## Key Decisions

- Derive eligible draft task IDs by intersecting non-empty draft keys with the
  current tenant-loaded task array.
- Unknown/stale keys never appear in counts, cards, or filters.
- Preserve task array order and compose Drafts-only with existing filters.
- Draft visibility remains staff-session client state with no persistence.
- Do not expose draft text, length, author, timestamp, or audit claims.

## Rejected Alternatives

- Persisted drafts or server queries exceed the privacy boundary.
- Draft text previews on cards spread sensitive free-form content.
- A parallel draft inbox duplicates the task queue model.

## Boundaries

No autosave, persistence, task write, notification, outbound delivery,
provider, invite, public self-serve, billing, POS, access-control, or
member-ledger behavior.

## Open Questions

None.
