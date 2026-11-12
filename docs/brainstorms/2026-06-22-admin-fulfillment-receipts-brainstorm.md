---
title: Admin fulfillment receipts brainstorm
date: 2026-06-22
status: complete
---

# Admin Fulfillment Receipts Brainstorm

## What We're Building

Add a customer-safe, operator-visible receipt for beta owner request
fulfillment. The receipt should prove that the CLI fulfillment path ran, linked
an owner access grant, and preserved the no-live-provider boundary without
showing secrets or moving fulfillment into the browser.

## Why This Approach

The current request row shows `fulfilled_at` and grant linkage, but the Admin
portal has no durable receipt for the operator command that performed the work.
A small append-only receipt table keeps the evidence repeatable and auditable
without turning the Admin portal into a mutating support console.

## Key Decisions

- Keep fulfillment mutation in `npm run beta:operator:request-fulfillment`.
- Insert a sanitized receipt only after the existing request fulfillment and
  owner grant linkage succeed.
- Expose the latest receipt through the existing
  `list_founder_admin_beta_access_requests()` projection, gated by the same
  active app-admin plus `founder_admin` compatibility membership boundary.
- Show the receipt inside the existing Admin portal request row, attached to
  the request object rather than as a separate dashboard.
- Store only non-secret metadata: request id, owner email, grant id, command
  name, Neon branch, completed time, status, and a small summary JSON.

## Scope Boundaries

- No browser approval, decline, or fulfill buttons.
- No invite delivery, notifications, phone/email providers, billing, POS,
  access control, or member-ledger writes.
- No raw command output, temporary passwords, cookies, API keys, JWTs, notes, or
  provider secrets in the receipt.
- No database role or RPC rename in this slice.

## Success Criteria

- The fulfillment CLI appends one sanitized receipt after successful owner
  request fulfillment.
- The Admin portal shows whether a fulfilled request has a receipt, when it was
  recorded, and which safe command/branch recorded it.
- Owner, staff, anonymous, and public access cannot read the receipt table
  directly.
- Hosted request fulfillment proof verifies receipt projection without retaining
  disposable proof data by default.
