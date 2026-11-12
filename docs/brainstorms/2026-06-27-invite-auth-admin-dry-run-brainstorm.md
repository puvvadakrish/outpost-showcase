---
title: Invite delivery preflight and Auth admin provisioning dry-run
date: 2026-06-27
status: captured
---

# Invite Delivery Preflight and Auth Admin Provisioning Dry-Run

## Context

The current Admin portal chain can package a limited beta self-serve preflight,
an approved non-House-of-Fitness gym follow-through packet, and a public request
intake dry-run. The next two SaaS slices should make the next operator steps
repeatable without enabling any live capability.

## Decision

Build two artifact-only slices:

1. `admin_invite_delivery_preflight` consumes the public request intake dry-run
   and prepares reviewed invite content/recipient metadata while proving no
   email, notification, provider, or browser-send path is enabled.
2. `admin_auth_admin_provisioning_dry_run` consumes the invite preflight and
   prepares an operator-reviewed account-provisioning shape while proving no
   product Auth admin API, automatic grant, invite send, provider, billing, POS,
   access-control, or member-ledger write is enabled.

## Rejected Approaches

- Do not add browser approval/send buttons yet. That would make the operator UI
  imply live behavior before customer handoff proof is ready.
- Do not create Neon Auth users from product code. Account creation stays an
  operator-run path until this dry-run is reviewed.
- Do not persist public request rows. This remains an artifact chain only.

## Success Criteria

- Operators can generate and inspect both artifacts from npm scripts.
- The Admin portal shows both slices and the next two blocked steps.
- Tests prove no-send/no-provision gates fail closed when parent artifacts try
  to enable live behavior.
- AGENTS.md and PLOT.md capture the durable proof boundary.
