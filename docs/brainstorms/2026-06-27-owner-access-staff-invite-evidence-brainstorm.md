---
title: Owner access fulfillment evidence and staff invite no-send preflight
date: 2026-06-27
status: complete
---

# Owner Access Fulfillment Evidence and Staff Invite No-Send Preflight

## Context

The prior invite/Auth dry-run slice created a no-send invite preflight and an
operator-review-only Auth admin provisioning dry-run. The next SaaS readiness
gap is not account creation inside the product. It is proving a repeatable
operator evidence chain from reviewed owner invite metadata to an
operator-created owner access handoff, then preparing staff invite metadata
without sending anything.

## Decision

Build two terminal-only admin artifacts:

1. Owner access fulfillment evidence, chained after the Auth admin provisioning
   dry-run.
2. Staff invite no-send preflight, chained after owner access fulfillment
   evidence.

Both artifacts remain proof packaging only. They do not call Neon Auth admin
APIs, create users, create automatic grants, expose browser approval buttons,
send email, activate providers, or touch billing/POS/member-ledger surfaces.

## Rejected Alternatives

- Product Auth admin API: rejected because operator-created owner access has
  not been customer-proven enough to expose in product.
- Browser approval buttons: rejected because approval should remain terminal
  and review-only until the admin launch gate is green.
- Real invite delivery: rejected because no-send staff/owner metadata must be
  inspectable before any provider or notification path is enabled.

## Success Criteria

- New package scripts prepare and inspect both artifacts.
- Inspect commands fail closed on tampered live gates, path traversal,
  overwrites, malformed parents, and secret-shaped keys/values.
- `/admin` shows both slices as read-only command panels with live/provider
  gates blocked.
- Durable docs name the next two slices after this one.
