---
topic: admin-public-request-first-gym-evidence-run-coordinator
date: 2026-07-03
---

# Admin Public Request First-Gym Evidence Run Coordinator Brainstorm

## Context

The current public-request first-gym chain has a refreshable session ledger and
an evidence execution readiness artifact. The real blockers are still external:
protected Preview hosted rehearsal evidence, customer-observed session evidence,
hosted customer-session digest proof, first-gym go/no-go, first-gym operator
run, and limited beta operator review. The next SaaS readiness batch should not
invent any of those outcomes, but it should make the continuous operator run
less dependent on chat memory.

## Scope Decision

Add an evidence run coordinator after evidence execution readiness. It consumes
and SHA-pins the readiness artifact, replays its inspector, exact-matches the
real command lanes, and records stop conditions plus required regeneration
after every evidence change. It stays coordinator-only: no proof writes, no
hosted digest claim, no go/no-go approval, no first-gym run success, no limited
beta approval, and no public/live/revenue enablement.

Also harden the existing evidence execution readiness inspector so every
operator step command is exact-matched, not just the customer-session command.
The coordinator should not trust a parent artifact with mutated command text.

## Alternatives Considered

- Run the real evidence commands locally now. Rejected because the required
  protected Preview/customer-observed inputs are not present in this terminal
  session, and fabricating proof would weaken the launch gate.
- Add only a hosted rehearsal helper. Rejected because the operator needs the
  whole next path: hosted rehearsal, customer session, hosted digest proof,
  go/no-go, operator run, beta review, and blocked launch/live/revenue gates.
- Start public self-serve or live-provider preflight. Rejected because those
  remain separate proof tracks after first-gym and limited beta evidence.

## Acceptance

- New `admin:public-request-first-gym:evidence-run-coordinator` and inspect
  scripts replay the evidence execution readiness inspector and pin SHA-256.
- The coordinator exposes hosted rehearsal, customer session/hosted digest,
  ledger/readiness regeneration, go/no-go, operator-run, limited-beta-review,
  and blocked public/live/revenue lanes.
- Inspectors fail closed on stale parent SHA, mutated commands, proof claims, or
  blocked gate drift.
- `/admin` surfaces the coordinator as a read-only operator card.
- AGENTS.md and PLOT.md record the durable product and implementation learning.
