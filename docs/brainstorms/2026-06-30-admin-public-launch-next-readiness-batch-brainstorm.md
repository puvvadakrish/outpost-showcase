---
title: Admin public launch next readiness batch
date: 2026-06-30
status: captured
---

# Admin Public Launch Next Readiness Batch

## What We're Building

Package the next public-launch readiness set after
`admin_public_launch_controls_batch` into one current-chain artifact. The batch
should make the next work explicit without enabling any public self-serve
behavior: request-only intake, invite/Auth no-send/no-create proof records,
live-provider/revenue/member-system proof tracks, and a required limited beta
operator-assisted onboarding review.

## Key Decisions

- Consume `admin_public_launch_controls_batch` as the parent instead of older
  approved-gym/request-intake artifacts, so the chain follows the latest public
  launch preflight path.
- Keep the batch as proof packaging and Admin command guidance only. No public
  form submission, browser approval, invite sending, product Auth admin API,
  Auth user creation, live providers, billing, POS, access control, or
  member-ledger writes.
- Record four current workstreams in one artifact because the next few slices
  are co-dependent and easier to reason about together.

## Alternatives Considered

- Reuse the older `admin_request_intake_invite_auth_readiness_batch` directly.
  Rejected because it chains to earlier approved beta expansion artifacts, not
  the newly merged public launch controls parent.
- Build actual public intake UI now. Rejected because the current gate still
  requires request-only/human-reviewed packaging before any public submission
  surface.

## Success Criteria

- Prepare script writes a sanitized artifact under `artifacts/`.
- Inspector verifies parent SHA, nested blocked gates, top-level blocked gates,
  and the four next batch IDs.
- Admin portal exposes read-only command guidance.
- Tests cover happy path and fail-closed tamper cases.
