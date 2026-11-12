---
title: Operator intake follow-through
date: 2026-07-12
status: complete
---

# Operator Intake Follow-through

## What We're Building

Close the human-intake loop with optional atomic ownership, retrieval of work
submitted by the current staff member, and advisory duplicate awareness before
another task is created.

## Key Decisions

- Create and claim is optional, stays `new`, derives the assignee from the
  authenticated actor, and composes the existing create and assignment
  transactions inside one outer PostgreSQL transaction.
- My submitted work is a read projection over exact manual-created events and
  current actor identity. It is distinct from assignment and does not grant
  ownership.
- Duplicate awareness compares unresolved same-location tasks using normalized
  requester contact plus intent. It warns but never blocks or merges because
  concurrent hosted creation still requires a future authoritative contract.
- Local rehearsal mirrors task/event shape but makes no hosted audit or usage
  claim.

## Boundaries

No automatic assignment beyond the explicit current-user option, deduplication
write, merge, provider ingress, automatic task creation, reply, notification,
invite, public self-serve, billing, POS, access-control, or member-ledger
behavior.
