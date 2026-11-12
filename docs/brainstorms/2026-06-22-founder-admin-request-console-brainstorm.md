---
title: Founder Admin Request Console Brainstorm
date: 2026-06-22
status: complete
---

# Founder Admin Request Console Brainstorm

## What We're Building

Make `/founder-admin` easier to use as the internal operator surface for beta
owner access requests. The current request queue is visible, but it reads like a
wide audit grid. The next step should make it an action-oriented console:
which requests need review, which are already fulfilled, what proof exists, and
which safe command/checklist an operator should run next.

## Key Decisions

- Keep fulfillment execution in the existing CLI for this slice. The UI should
  not collect or transmit temporary passwords, Neon API keys, cookies, or bypass
  secrets.
- Use the existing founder-admin projection and request records. No schema/RPC
  expansion is required unless the console needs to mutate request state.
- Prioritize operational readability over decorative dashboard density. The
  request object should become a scannable row with a status rail, not another
  card grid.
- Keep no-live-provider copy adjacent to the queue so operators cannot mistake
  a fulfilled beta access grant for invite delivery, notifications, or provider
  enablement.

## Approach

Recommended approach: reshape the existing `FounderAdminReadinessConsole`
request section into an operator queue with request summary, readiness chips,
safe fulfillment command templates, and post-fulfillment checks. This is the
smallest useful slice because it improves the real handoff workflow without
adding a secret-handling web action.

Rejected for now:

- Full web approval/reject buttons: useful later, but it requires a new audited
  RPC and a careful temporary-password design.
- Separate admin route: unnecessary until the founder-admin console has more
  than one active operator workflow.

## Success Criteria

- Founder-admin request rows make pending versus fulfilled requests obvious.
- Each request exposes a customer-safe/operator-safe handoff packet: email,
  gym, owner, request count, current grant/account/tenant state, and a CLI
  command template with password placeholders only.
- The console remains usable on mobile with no horizontal scrolling.
- Copy preserves the no-live-provider gates.
- Browser verification confirms `/founder-admin` still renders cleanly.

## Open Questions

None for this slice. Web-based approval/rejection should be planned separately
after this operator console is usable.
