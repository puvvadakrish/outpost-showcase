---
topic: staff-per-task-note-drafts
date: 2026-07-10
status: decided
---

# Staff Per-Task Note Drafts

## What We're Building

Retain unfinished handoff-note text separately for each task during the current
workboard session, show when the selected task has unsaved text, and provide an
explicit selected-draft clear command. Ship each capability independently.

## Why This Approach

Selection-owned single-draft state prevents cross-task submission, but it also
discards work whenever staff checks another task. An in-memory task-keyed map
preserves useful context without persisting potentially sensitive draft text.

## Key Decisions

- Drafts are keyed by opaque tenant-loaded task ID in component memory only.
- Drafts never enter localStorage, URLs, server actions before submission,
  analytics, audit events, or provider payloads.
- Selection reads only its own key, so text cannot cross tasks.
- Successful local or backend note creation clears exactly the submitted task's
  draft, even when another task is selected.
- Reset local clears every in-memory note draft.
- Follow-up batches add an unsaved indicator and explicit clear command.

## Rejected Alternatives

- localStorage persistence retains sensitive free-form text beyond the session.
- Browser unload prompts interrupt normal queue work.
- Continuing to discard on selection protects isolation but loses staff work.

## Boundaries

No note autosave, cross-session persistence, server draft, task write before
submission, notification, outbound delivery, provider, invite, public
self-serve, billing, POS, access-control, or member-ledger behavior.

## Open Questions

None.
