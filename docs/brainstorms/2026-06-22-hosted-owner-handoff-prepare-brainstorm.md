---
date: 2026-06-22
topic: hosted-owner-handoff-prepare
status: captured
origin: user-request
---

# Hosted Owner Handoff Prepare Brainstorm

## What We're Building

Add a hosted-safe preparation command that validates the protected Vercel Preview
entry point for a beta owner handoff and then generates the existing handoff
bundle artifacts from the same hosted inputs.

## Why This Approach

The previous slice made handoff preparation repeatable locally, but operators
still need a single command that proves they are pointing at a real Preview URL
before handing a packet to a beta owner. The smallest next step is a
non-mutating hosted preparation wrapper: validate the Preview origin, smoke the
owner sign-in page, and delegate to `beta:owner-handoff:bundle`.

This keeps customer-observed completion separate. A reachable Preview plus
generated artifacts means preparation is ready, not that the customer handoff
has happened.

## Key Decisions

- Add `npm run hosted:owner-handoff:prepare`.
- Require a non-local HTTPS `vercel.app` Preview origin.
- Smoke `/owner/sign-in` for owner sign-in and beta access request copy.
- Support protected Preview access through `VERCEL_AUTOMATION_BYPASS_SECRET`
  headers or `OUTPOST_USE_VERCEL_CURL=1`.
- Delegate artifact generation to `npm run beta:owner-handoff:bundle`.
- Keep output secret-scanned and avoid writing any hosted database state.

## Non-Goals

- No owner account creation, request fulfillment, tenant bootstrap,
  customer-observed completion, final gate validation, hosted proof import, live
  provider activation, invite delivery, notifications, billing, POS, access
  control, or member-ledger writes.

## Open Questions

None for this slice.
