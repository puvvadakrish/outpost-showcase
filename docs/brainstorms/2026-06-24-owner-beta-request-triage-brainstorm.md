---
title: Owner beta request triage
type: brainstorm
status: complete
date: 2026-06-24
---

# Owner beta request triage

## Goal

Move the public owner beta request path one step closer to repeatable SaaS
onboarding without turning it into public self-serve. The next operator should
be able to inspect a hosted request, export a customer-safe triage packet, and
record that a human reviewed it before any separate owner access provisioning
work happens.

## Approach

Use two small connected slices:

1. **Request triage packet export.** Add a terminal-only command that reads the
   hosted founder-admin beta access request projection and writes a sanitized
   packet for one request under `artifacts/`.
2. **Request triage completion ledger.** Add an append-only hosted Neon table,
   founder-admin-gated projection, and Admin portal panel showing whether each
   request has a reviewed triage record.

## Key Decisions

- Keep the browser UI read-only. The Admin portal may show commands, status,
  and packets, but it must not approve, decline, fulfill, invite, or provision
  accounts.
- Require a hosted non-production Neon branch and protected Preview URL for
  packet generation and receipt recording.
- Store only customer-safe labels and hashes. Do not store notes, passwords,
  cookies, tokens, Neon keys, Vercel bypass secrets, or provider credentials in
  artifacts or receipt summaries.
- Treat triage as a prerequisite for later operator fulfillment, not a launch
  approval and not owner self-serve.

## Non-Goals

- No public owner account creation.
- No invite delivery or notification sending.
- No phone/email provider activation.
- No billing, POS, access-control, or member-ledger writes.
- No request approval buttons in the Admin portal.

## Success Criteria

- Operator can export a request triage packet from hosted request state.
- Operator can record a reviewed triage receipt into hosted Neon.
- Admin portal shows triage status per request and command copy.
- Existing tests and build pass, with coverage for fail-closed behavior.
