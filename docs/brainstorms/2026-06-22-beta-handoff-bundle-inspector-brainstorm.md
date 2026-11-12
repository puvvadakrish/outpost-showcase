---
date: 2026-06-22
topic: beta-handoff-bundle-inspector
status: captured
origin: user-request
---

# Beta Handoff Bundle Inspector Brainstorm

## What We're Building

Add a safe inspection command for generated beta owner handoff bundle manifests,
then surface that inspection step in the owner beta support ledger.

## Why This Approach

Hosted preparation writes useful artifacts, but an operator still needs a quick
way to verify the manifest says what it should before sharing the packet or
scheduling a customer-observed handoff. A read-only inspector gives a repeatable
review step without mutating hosted data or pretending the customer session has
completed.

The owner-facing UI should show that bundle inspection is part of preparation,
not a new browser action.

## Key Decisions

- Add `npm run beta:owner-handoff:inspect`.
- Read an explicit bundle manifest path from `OUTPOST_BETA_HANDOFF_BUNDLE_PATH`.
- Fail closed if the manifest is missing, secret-shaped, marked
  customer-observed, missing blocked live-provider status, or missing the
  expected checklist/packet artifacts.
- Print a short non-secret preparation summary for operators.
- Add the inspector command to the owner beta support ledger.

## Non-Goals

- No customer-observed completion recording.
- No final gate validation.
- No hosted proof import.
- No browser mutation controls, invite delivery, notifications, phone/email
  providers, billing, POS, access control, or member-ledger writes.

## Open Questions

None for this slice.
