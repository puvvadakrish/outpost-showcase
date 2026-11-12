---
date: 2026-06-30
topic: admin-public-request-hosted-rehearsal-evidence
status: captured
---

# Admin Public Request Hosted Rehearsal Evidence Brainstorm

## What We're Building

Add the current-chain hosted rehearsal evidence recorder after public request
hosted rehearsal readiness. It should record only operator-observed browser
rehearsal evidence for the reviewed public-request gym and should not claim a
customer-observed session, go/no-go bundle, first-gym run, public launch, or
live-provider readiness.

## Why This Approach

The older approved-gym recorder is tied to the older readiness lane. The current
public-request chain needs its own evidence artifact so operators can keep the
new lineage intact instead of hopping to a legacy parent.

## Key Decisions

- Consume `admin_public_request_hosted_rehearsal_readiness_batch` by SHA.
- Re-run the parent inspector before writing and during inspection.
- Require explicit yes confirmations for owner workspace, staff workboard,
  reset/rollback, no unexpected data, no live-provider claims, no invite
  delivery, and no billing/POS/member writes.
- Keep customer-observed proof, hosted customer-session proof, go/no-go,
  first-gym run, public self-serve, invite delivery, providers, billing, POS,
  access control, and member-ledger writes blocked.

## Open Questions

None for implementation. The real customer-observed session still needs the gym
owner to attend.
