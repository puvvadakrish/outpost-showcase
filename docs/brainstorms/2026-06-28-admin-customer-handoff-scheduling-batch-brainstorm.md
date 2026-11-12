---
title: "Admin customer handoff scheduling batch"
date: 2026-06-28
status: captured
---

# Admin customer handoff scheduling batch

## Problem

The protected Preview walkthrough batch records internal operator evidence, but
the next customer-facing step still needs a customer-safe scheduling packet
that can be prepared before the gym owner is available. Existing scheduling
scripts are tied to an older launch-evidence lane, so the current protected
Preview chain needs its own bridge artifact without claiming customer-observed
completion.

The batch should also keep the next readiness set visible: customer-observed
handoff, limited operator-assisted beta onboarding, public self-serve preflight,
and live-provider/revenue gates remain separate decisions.

## Chosen Approach

Add a terminal-only customer handoff scheduling batch artifact. It consumes
`admin_protected_preview_walkthrough`, validates the parent SHA and blocked
gates, requires sanitized operator scheduling inputs, and writes a customer-safe
agenda/support checklist. It marks the customer session ready to schedule, not
completed.

## Alternatives Rejected

- **Reuse older launch-evidence scheduling packet:** rejected because it would
  bridge across a different artifact chain and blur current proof lineage.
- **Record customer-observed completion now:** rejected because the real owner
  is not present.
- **Add browser approval or invite delivery:** rejected because customer
  scheduling remains operator-led and terminal-only.

## Success Criteria

- One command writes a sanitized scheduling batch from protected Preview
  walkthrough proof.
- One inspect command verifies the parent SHA, safe Preview/Neon context,
  customer-safe agenda, blocked gates, and next readiness set.
- `/admin` exposes the packet and keeps no-live-provider gates blocked.
- Tests cover happy path, parent tampering, missing inputs, unsafe branches,
  existing output, and secret-shaped values.

## Next Gate

Use the scheduling batch when the real gym owner is available. Record
customer-observed completion only after the owner observes the protected
Preview workspace, staff path, reset/rollback checklist, and blocked live
provider/revenue claims.
