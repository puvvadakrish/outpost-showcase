---
title: "brainstorm: Admin operator sequence handoff"
date: 2026-06-22
status: accepted
---

# Problem

The admin portal already shows beta requests, preflight state, fulfillment
receipts, owner onboarding timeline, and hosted proof. The operator still has
to infer the exact safe command order from several panels.

# Scope

- Add a read-only, customer-safe operator command sequence to each beta request
  row.
- Sequence the existing dry-run preflight, CLI fulfillment, disposable hosted
  proof, and owner handoff preparation commands.
- Keep passwords and notes as placeholders only.
- Do not add browser approval buttons, browser mutations, invite delivery,
  notifications, live providers, billing, POS, access control, or
  member-ledger writes.

# Decision

Keep the sequence derived in the domain layer so tests can assert that no
secret-shaped values or write controls enter the rendered admin portal. Render
it as a compact operational checklist inside the existing request row rather
than a new top-level page.
