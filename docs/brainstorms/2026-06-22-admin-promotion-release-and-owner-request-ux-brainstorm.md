---
title: Admin promotion release artifact and owner request UX
status: complete
date: 2026-06-22
---

# Admin promotion release artifact and owner request UX

## What We're Building

Two adjacent SaaS launch-readiness slices:

1. A launch promotion release-note artifact generated from the checked
   promotion summary, plus clearer admin command UX for missing Preview/Neon
   evidence.
2. A more customer-safe owner beta request surface on `/owner/sign-in` that
   explains operator-assisted access without implying self-serve signup,
   invite delivery, or live-provider readiness.

## Why This Approach

The admin portal already derives launch-readiness and promotion-gate state, and
the backend already captures public beta access requests through a constrained
RPC. The next useful work is not new persistence. It is making the existing
operator path repeatable and understandable:

- admins need an attachable artifact for PR/release handoff after promotion
  check passes;
- operators need blocked placeholders to read as intentional missing evidence,
  not broken UI;
- prospective beta owners need to understand that a request queues operator
  review and does not create an account.

## Key Decisions

- Keep both slices read-only or existing-RPC-only. No new schema, provider
  ingress, invite delivery, billing, POS, access control, or member-ledger
  writes.
- Generate release notes only from a promotion candidate that already passed
  the fail-closed promotion verifier.
- Keep release artifacts under ignored `artifacts/` and scan for secret-shaped
  keys/values.
- Improve command presentation without adding browser approval buttons.
- Keep `/owner/sign-in` as the entry point, but make the beta request copy and
  layout customer-facing enough for a protected Preview.

## Success Criteria

- Promotion release-note command fails closed for missing, unsafe, unpromoted,
  public-launch-allowed, or secret-shaped inputs.
- Admin panel shows the release-note command and clearer missing-evidence copy.
- Owner sign-in page separates "already have access" from "request beta
  access" and clearly says accounts are operator-provisioned.
- Browser smoke confirms `/admin` and `/owner/sign-in` remain readable and
  mobile-safe enough for the current Preview.
