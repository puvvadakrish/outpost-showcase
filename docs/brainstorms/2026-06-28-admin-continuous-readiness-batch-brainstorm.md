---
title: "Admin continuous readiness batch"
date: 2026-06-28
status: captured
---

# Admin continuous readiness batch

## Problem

The Admin portal now has many proof packets, but the operator still has to know
which proof lane is current. After the handoff proof bundle, the next useful
SaaS readiness step is not another isolated packet; it is a local-only batch
manifest that ties the newest owner/staff/operator proof bundle to the existing
handoff-readiness packet lane.

## Chosen Approach

Add a terminal-only continuous readiness batch artifact. It consumes:

- `admin_handoff_proof_bundle`
- `admin_handoff_readiness_packet`

The script validates both parents, chains their SHA-256 values, writes one
manifest, and keeps customer completion, public self-serve, invites,
notifications, providers, product Auth admin APIs, automatic grants, billing,
POS, access control, and member-ledger writes blocked.

## Alternatives Rejected

- **Browser approval button:** rejected because Admin proof artifacts should
  stay terminal-only until public self-serve is intentionally designed.
- **Hosted mutation in this slice:** rejected because this batch is a local
  orchestration proof, not new hosted proof.
- **Customer completion claim:** rejected because a real owner must be present
  before customer-observed completion can be recorded.

## Success Criteria

- One command writes a sanitized batch manifest from both parent lanes.
- One inspect command verifies parent hashes and all blocked gates.
- `/admin` exposes the batch commands without adding runtime actions.
- Tests cover happy path, parent tampering, unsafe branch, and live-gate flips.

## Next Gate

Use the batch manifest as the checklist for a protected Preview browser
walkthrough, then run the customer-observed gym handoff only when the owner is
available.
