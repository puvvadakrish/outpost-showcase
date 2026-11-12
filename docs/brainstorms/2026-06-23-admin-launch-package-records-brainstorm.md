---
title: Admin Launch Package Records
date: 2026-06-23
---

# Admin Launch Package Records Brainstorm

## What We're Building

Add a terminal-only import step for reviewed admin launch packages. The import
records sanitized metadata from the inspected launch-readiness bundle and the
owner handoff message artifact into hosted Neon so `/admin` can show the latest
package evidence as part of the read-only proof ledger.

## Why This Approach

The existing admin portal uses append-only hosted evidence tables plus
founder-admin-gated list RPCs. This slice should follow that pattern instead of
adding browser writes or overloading generic hosted proof runs. The launch
package record is not a launch approval; it is evidence that an operator
reviewed a complete artifact package while public self-serve and live-provider
gates remain blocked.

## Key Decisions

- Store launch package imports in a distinct append-only
  `admin_launch_package_records` table.
- Require the launch bundle to pass the existing inspector shape and require a
  non-secret owner handoff message artifact.
- Record only sanitized labels, artifact hashes, paths, Preview URL, Neon
  branch, and blocked-gate summary.
- Surface records read-only in `/admin`; do not add approval buttons, provider
  controls, invite delivery, billing, POS, access-control, or member-ledger
  writes.

## Success Criteria

- A new CLI command imports reviewed launch package metadata into hosted Neon.
- Owner/staff/anonymous sessions cannot read the new records.
- `/admin` shows imported launch package records for active admin portal users.
- Tests cover migration shape, command registration, script safety boundaries,
  domain projection, repository wiring, and rendered UI text.

## Open Questions

None for this slice.
