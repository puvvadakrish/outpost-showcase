---
title: Beta Access Request Queue
date: 2026-06-22
status: complete
---

# Beta Access Request Queue

## What We're Building

Add a production-safe beta access request path for gym owners who reach the
owner sign-in screen before they have an operator-provisioned account. The form
collects only a small customer-safe request record and shows it to founder
admins in the existing support console.

This is a pre-self-serve slice. It does not create Neon Auth users, grant owner
access, send invite email, enable billing, connect phone/email providers, or
write POS/member-ledger data.

## Why This Approach

Outpost already has a controlled operator path for beta owner access:
`owner_beta_access_grants` plus `npm run beta:operator:owner-access`. The
missing SaaS step is capturing demand and support context without relying on
chat memory or manual notes.

A narrow public RPC is the smallest durable step toward self-serve onboarding.
It lets a gym owner express interest from the real product surface, while
founder-admin review remains read-only and approval stays in the existing
operator command.

## Key Decisions

- Store requests in hosted Neon as `owner_beta_access_requests`.
- Accept only email, owner name, gym name, optional location hint, optional note,
  and a honeypot field.
- Make request submission idempotent by normalized email.
- Return a generic received message to avoid access-grant enumeration.
- Keep direct table access revoked; expose writes only through
  `submit_owner_beta_access_request`.
- Expose founder-admin visibility through
  `list_founder_admin_beta_access_requests`.
- Show request state alongside grant/auth/tenant linkage in `/founder-admin`.
- Do not add approval/decline buttons in the web app yet.

## Out Of Scope

- Public self-serve account creation.
- Invite delivery, notification sending, email verification delivery, or
  marketing automation.
- Founder-admin web approval mutations.
- Phone/email provider setup, Retell, Resend, Gmail, webhooks, or live routing.
- Billing, POS, access control, Club OS replacement, or member-ledger writes.

## Success Criteria

- Owner sign-in has a real request form that persists a safe request in hosted
  Neon when configured.
- The request path fails closed when Neon is not configured and rejects invalid
  input, bot honeypot submissions, and secret-shaped content.
- Founder-admin can read recent request rows, including whether an operator
  grant, app user, or tenant bootstrap already exists.
- Owner/staff/anonymous sessions cannot read the founder-admin request queue.
- Tests cover migration shape, form/action wiring, founder-admin projection, UI
  rendering, and no-live-provider boundaries.
