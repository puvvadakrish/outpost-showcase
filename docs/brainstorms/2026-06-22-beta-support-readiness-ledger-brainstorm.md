---
title: Beta Support Readiness Ledger Brainstorm
date: 2026-06-22
status: captured
---

# Beta Support Readiness Ledger Brainstorm

## What We're Building

Add a generic beta support readiness ledger to the owner workspace. It should
surface the operator-assisted beta handoff path for any gym: beta preflight is
ready, the support handoff packet can be generated, observed completion remains
pending until a real session is recorded, and live/self-serve gates remain
blocked.

## Why This Approach

The repo now has reusable support artifacts for non-ACME beta handoffs, but the
owner workspace still only surfaces the Acme Fitness-specific ledger. A
generic read-only ledger brings the reusable packet/completion workflow back
into the product surface without adding support-state persistence or claiming an
artifact exists when the app cannot read it.

## Key Decisions

- Render the generic ledger in `/owner` for all beta tenants.
- Keep it read-only and static/derived for now.
- Show “packet ready to generate” rather than “packet generated” because there
  is no persisted artifact state in the app.
- Keep observed completion pending until the operator records it with
  `npm run beta:owner-handoff:complete`.
- Keep public self-serve, invite delivery, notifications, phone/email
  providers, billing, POS, access control, and member-ledger writes blocked.

## Rejected Approaches

- Add support artifact persistence now. That would be premature and would widen
  data/support-access scope.
- Read local artifact files from the app. That would not work in hosted
  environments and would blur product state with operator evidence files.
- Claim completion from packet generation. A packet is a checklist, not an
  observed customer session.

## Success Criteria

- `/owner` shows the generic beta support ledger.
- The ledger includes the packet and completion commands.
- Tests prove the ledger is read-only, generic, and preserves no-live-provider
  gates.
- Durable docs record that this is support guidance, not persisted state.

## Open Questions

None for this slice.
