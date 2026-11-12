---
topic: admin-public-request-first-gym-proof-evidence-session-ledger
date: 2026-07-03
status: decided
---

# Admin Public Request First-Gym Proof Evidence Session Ledger Brainstorm

## What We're Building

Add a status-only ledger after the proof evidence session handoff. The ledger
re-inspects every evidence artifact named by the handoff and marks each row
`missing` or `inspectable`.

## Why This Approach

The next real work is a protected Preview/customer-observed session, but this
runtime cannot honestly record that proof. A ledger gives operators a durable
current-state surface after the handoff: once a dedicated proof command creates
an artifact, rerunning the ledger will verify it through its own inspector.

## Key Decisions

- Consume and SHA-pin `admin_public_request_first_gym_proof_evidence_session_handoff`.
- Replay the handoff inspector before checking any evidence row.
- Treat absent evidence artifacts as visible `missing` rows, not failures.
- Treat present evidence artifacts as `inspectable` only after their dedicated
  inspector passes and their SHA-256 is pinned.
- Keep the ledger status-only: no proof recording, no customer-observed claim,
  no first-gym run completion, and no public/live-provider/revenue gates.

## Rejected Alternatives

- Recording hosted rehearsal or customer-observed evidence here: rejected
  because no real external proof is available in this runtime.
- Allowing the ledger to approve first-gym go/no-go: rejected because go/no-go
  remains a dedicated proof command.
- Adding browser approval buttons: rejected because launch and approval remain
  terminal, inspectable proof tracks.

## Success Criteria

- New prepare and inspect commands generate and verify the session ledger.
- Missing evidence remains visible without failing the ledger.
- Present evidence must pass its dedicated inspector before being marked
  inspectable.
- Inspector rejects stale parent SHA, fabricated inspectable rows, proof-recording
  drift, and live-provider/public-launch gate drift.
- Admin portal shows the ledger without adding approval controls.
