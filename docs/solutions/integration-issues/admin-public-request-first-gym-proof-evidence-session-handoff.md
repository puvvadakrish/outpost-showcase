# Admin Public Request First-Gym Proof Evidence Session Handoff

## Problem

The first-gym public request proof chain had reached an evidence intake manifest,
but the next real step still depended on a protected Preview/customer-observed
session. Operators needed a durable handoff packet for that session without
creating a false proof claim.

## Solution

Add a session-handoff-only artifact after the evidence intake manifest:

```sh
npm run admin:public-request-first-gym:proof-evidence-session-handoff
npm run admin:public-request-first-gym:proof-evidence-session-handoff:inspect
```

The prepare command replays the intake-manifest inspector, SHA-pins the parent,
derives session handoff rows from evidence intake rows, and writes the next
operator run sheet. The inspect command recomputes the parent SHA, replays the
parent inspector, and exact-matches handoff rows, operator input requirements,
command templates, command sequencing, guard state, and blocked gates.

## Guardrails

- No evidence is recorded by this artifact.
- Hosted proof, customer-observed completion, first-gym go/no-go, first-gym run,
  and limited beta review remain dedicated proof commands.
- Public self-serve, public request submission, browser approval buttons,
  invite delivery, notifications, phone/email providers, Auth admin APIs, Auth
  user creation, magic links, automatic grants, billing, POS, access-control,
  provider ingress/egress, and member-ledger writes stay blocked.

## Pattern

When a readiness chain is blocked on real-world/customer evidence, add an
operator handoff artifact that consumes the latest manifest/control surface
instead of adding another proof writer. The handoff should explain the next real
session and regeneration sequence, but proof must only be recorded by the
dedicated commands after real evidence exists.
