---
title: Owner beta request follow-through
type: brainstorm
status: complete
date: 2026-06-24
---

# Owner beta request follow-through

## Goal

Make the reviewed owner beta request path repeatable after triage, before any
operator provisions owner access. The operator should be able to turn the
latest customer-safe triage receipt into a small follow-through packet that
lists the next terminal-only commands and still-blocked product gates.

## Approach

Use two connected slices:

1. **Request follow-through packet.** Add a terminal-only command that reads the
   hosted Neon request plus latest triage receipt and writes an ignored,
   secret-scanned artifact for the next operator step.
2. **Admin follow-through visibility.** Show the derived follow-through state in
   the existing Admin portal beta request row, without adding browser action
   buttons or mutating request status.

## Key Decisions

- Require a hosted, non-production Neon proof branch and protected Vercel
  Preview URL.
- Require the latest triage decision to be `ready_for_operator_fulfillment`
  before the follow-through packet can be written.
- Keep request fulfillment as the existing separate CLI path. This slice may
  point to it but must not run it or create accounts.
- Store only artifact paths, hashes, request labels, checklist items, and
  blocked-gate metadata. Do not store notes, passwords, cookies, tokens, Neon
  keys, Vercel bypass secrets, provider credentials, or invite content.

## Non-Goals

- No public owner self-signup.
- No invite delivery or notification sending.
- No browser approval, decline, or fulfillment buttons.
- No Auth user provisioning in the browser.
- No phone/email provider activation.
- No billing, POS, access-control, or member-ledger writes.

## Success Criteria

- Operator can generate a follow-through packet only after reviewed triage is
  ready for fulfillment.
- Follow-through packet fails closed for unsafe Preview/branch/gate state or
  follow-up/not-fit triage decisions.
- Admin portal request row shows follow-through command/state compactly.
- Typecheck, tests, build, and browser smoke pass.
