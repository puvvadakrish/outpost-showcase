# Admin Public Request First-Gym Proof Evidence Session Ledger

## Problem

The session handoff gives operators a run sheet for real proof collection, but
there was no post-handoff surface that could be rerun after each evidence
command to show which artifacts were actually inspectable.

## Solution

Add a status-only ledger:

```sh
npm run admin:public-request-first-gym:proof-evidence-session-ledger
npm run admin:public-request-first-gym:proof-evidence-session-ledger:inspect
```

The ledger consumes the proof evidence session handoff, replays its inspector,
pins the handoff SHA-256, and then checks every handoff evidence row. Missing
artifacts remain visible as `missing`. Present artifacts only become
`inspectable` after their dedicated inspector passes and the artifact SHA-256 is
pinned.

## Guardrails

- The ledger records no proof.
- Customer-observed completion, first-gym go/no-go, first-gym run, limited beta
  review, and public launch remain dedicated proof tracks.
- Public self-serve, public request submission, browser approval buttons,
  invite delivery, notifications, phone/email providers, Auth admin APIs, Auth
  user creation, magic links, automatic grants, billing, POS, access-control,
  provider ingress/egress, and member-ledger writes stay blocked.

## Pattern

After an operator handoff artifact, add a refreshable status ledger rather than
another proof writer. Let the ledger observe proof artifacts that already exist,
but require each artifact's own inspector before marking it inspectable.
