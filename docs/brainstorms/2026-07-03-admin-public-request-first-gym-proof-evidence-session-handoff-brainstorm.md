---
topic: admin-public-request-first-gym-proof-evidence-session-handoff
date: 2026-07-03
status: decided
---

# Admin Public Request First-Gym Proof Evidence Session Handoff Brainstorm

## What We're Building

Add a readiness-chain handoff packet after the proof evidence intake manifest.
The packet gives an operator a customer-safe run sheet for the protected
Preview/customer-observed evidence session and the proof-chain regeneration
sequence.

## Why This Approach

The current blocker is real hosted/customer evidence, not another synthetic
proof claim. A handoff-only artifact helps the operator run the session without
relying on chat memory, while still requiring the dedicated proof commands to
record hosted rehearsal, customer-observed completion, go/no-go, first-gym run,
and limited beta review evidence.

## Key Decisions

- Consume and SHA-pin `admin_public_request_first_gym_proof_evidence_intake_manifest`.
- Replay the intake-manifest inspector before deriving any handoff rows.
- Derive session handoff rows from manifest evidence intake rows and exact-match
  them in the inspector.
- Keep every no-live-provider, public launch, invite, Auth-admin, billing, POS,
  access-control, provider, and member-ledger gate false.
- Surface the packet in the Admin portal immediately after the evidence intake
  manifest.

## Rejected Alternatives

- Recording evidence in this batch: rejected because no protected
  Preview/customer-observed session is available in this runtime.
- Jumping directly to first-gym go/no-go: rejected because hosted rehearsal and
  customer-observed evidence remain missing.
- Adding browser approval buttons: rejected because approval remains terminal
  proof-command based and human-reviewed.

## Success Criteria

- New prepare and inspect commands generate and verify the handoff artifact.
- Inspector fails closed on stale parent SHA, row tampering, command tampering,
  and blocked gate drift.
- Admin portal shows the packet without adding approval or live-provider UI.
- Existing readiness-chain tests continue to pass.
