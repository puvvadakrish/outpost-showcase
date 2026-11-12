---
title: Admin Launch Promotion Panel
type: brainstorm
date: 2026-06-22
---

# Admin Launch Promotion Panel

## What We're Building

Expose the new promotion gate in `/admin` as a read-only panel next to the
launch-readiness export. The panel should show the promotion summary path, the
terminal command, required gates, and what remains blocked after a promotion
candidate passes.

## Why This Approach

Operators already use `/admin` as the proof projection. Making the promotion
gate visible there prevents chat-memory handoffs and reduces the chance that an
operator jumps straight from "artifact exported" to "launch allowed." The page
must not mutate anything; it only shows the command path and gate state.

## Key Decisions

- Derive the panel from existing proof projections and the launch export
  projection.
- Use the existing admin proof-state pills and command/code styling.
- Keep the panel compact and operational, matching the Front Desk Command
  design direction.
- Show promotion as `blocked` unless the export artifact is ready and the
  customer-observed handoff gate is ready.
- Keep the blocked live-provider/public-self-serve copy visible.

## Success Criteria

- Authorized admin users can see the promotion command and summary path.
- Unauthorized hosted users cannot see the promotion panel.
- Local or incomplete proof states render blocked guidance.
- Browser smoke confirms the panel is readable and has no mutation controls.

## Open Questions

None. Future launch-enabling work should be a separate reviewed slice.
