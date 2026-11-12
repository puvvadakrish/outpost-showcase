# Admin Public Request First-Gym Real Evidence Refresh Coordinator Brainstorm

## What We're Building

Add a control-only refresh coordinator after the real evidence execution guard.
The coordinator should make the real hosted/customer evidence session harder to
mis-run by pinning the inspected guard, naming the exact manual proof command,
pairing it with the correct post-manual verification command(s), and listing the full
post-evidence regeneration sequence.

## Why This Approach

The current chain has a good pre-run guard, but the operator still has to
remember the post-proof refresh loop from several artifacts. A coordinator that
does not execute proof writers or write proof can reduce that operational
failure mode. This is more useful than adding another narrow lane test because
it connects the real evidence command, inspection, refresh loop, and blocked
downstream gates in one SHA-pinned artifact.

## Key Decisions

- Keep the coordinator control-only. It must not run proof writers, record
  hosted evidence, record customer completion, import hosted digest proof, or
  write public/live/revenue/member-system state.
- Consume and SHA-pin
  `admin_public_request_first_gym_real_evidence_execution_guard`, then replay
  its inspector.
- Derive post-manual verification commands from the guard's next real step:
  hosted rehearsal uses hosted evidence inspect; customer/digest runs the
  hosted customer-session digest proof exactly once after the customer session
  record command has inspected.
- Exact-match the existing full regeneration sequence after proof inspection:
  proof session runbook, execution pack, progress, resume, diagnostics,
  follow-up preflight, launch checkpoint, proof-command execution envelope,
  proof evidence intake manifest, proof evidence session handoff, session
  ledger, evidence execution readiness, run coordinator, protected Preview
  preflight, attempt readiness, execution packet, execution guard, and this
  coordinator.
- Keep all public self-serve, provider, invite, notification, billing, POS,
  access-control, and member-ledger gates blocked.

## Success Criteria

- A blocked guard produces a blocked refresh coordinator with no runnable
  manual proof state.
- A ready hosted guard produces a coordinator that names the hosted manual
  proof command, hosted evidence inspector, and complete refresh sequence.
- A ready customer/digest guard produces a coordinator that names the customer
  session record command, hosted digest proof command, and complete refresh
  sequence without listing the hosted digest proof as an inspector.
- The inspector rejects stale guard lineage, tampered command rows, proof
  claims, and gate unlocks.
