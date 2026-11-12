# Acme Fitness customer handoff packet brainstorm

Date: 2026-06-21

## What We're Building

Add a small operator packet generator for the real Acme Fitness handoff
session. It should consume the existing non-secret dry-run, browser-smoke, and
rollback evidence artifacts, validate that they all refer to the same disposable
Acme Fitness dry-run, and write a customer-safe Markdown packet with the proof
summary, call agenda, support checklist, rollback status, and no-live-provider
boundaries.

## Why This Approach

The protected Preview dry-run and user-Chrome proof are now green, but a real
customer-observed handoff needs a repeatable artifact that an operator can read
from before and during the session. A generated packet prevents stale terminal
notes from becoming the handoff source of truth and keeps proof metadata
separate from product data.

## Key Decisions

- Build a local verifier/generator around existing `artifacts/` evidence rather
  than adding database-backed support records.
- Require retained dry-run evidence, browser evidence, and rollback evidence so
  the packet cannot be produced from an unfinished dry run.
- Fail closed if evidence contains secret-shaped keys or if live-provider status
  is anything other than blocked.
- Keep the output in gitignored `artifacts/` by default; the runbook and
  durable docs describe status, not the generated customer artifact contents.
- Preserve the no-live-provider boundary: no invite delivery, phone/email
  providers, notifications, billing, POS, access control, or member-ledger
  writes.

## Alternatives Considered

- Build an in-app owner handoff page. Rejected for this slice because it would
  add customer-facing UI before the real handoff has been observed.
- Store handoff packets in Postgres. Rejected because this is operator proof
  metadata, not tenant product state, and would widen the tenant/support review
  surface.
- Use a manual checklist only. Rejected because it is easy to skip rollback
  evidence or accidentally paste secret-bearing terminal output.

## Done Signal

The slice is ready when the packet generator fails closed on incomplete or
secret-looking evidence, produces a customer-safe Markdown handoff packet from
valid evidence, the runbook explains how to use it for the Acme Fitness
session, local checks pass, and review finds no tenant-safety or live-provider
regressions.

## Open Questions

None for this slice.
