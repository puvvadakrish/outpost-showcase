---
title: "brainstorm: Beta request fulfillment"
date: 2026-06-22
status: accepted
---

# Beta Request Fulfillment

## Scope

Turn the hosted owner beta access request queue into a repeatable
operator-assisted fulfillment path. A founder admin can see requests in
`/founder-admin`, but the actual approval remains a local operator command that
uses hosted Neon proof credentials and the existing owner-access provisioner.

## Product Boundary

- Do not add a web approve or decline button.
- Do not send invite email or password reset email.
- Do not enable phone/email providers, notifications, billing, POS, access
  control, or member-ledger writes.
- Do not claim public self-serve onboarding.

## Architecture Choice

Use a privileged operator CLI for mutation and keep the web console read-only.
The CLI reads a single queued request by owner email, marks it `reviewing`,
delegates account/grant creation to `beta:operator:owner-access`, then records a
secret-free fulfilled timestamp and grant linkage on success. If provisioning
fails, the request remains `reviewing` instead of becoming green.

This preserves the current customer-safe control plane:

- public owner sign-in can only submit requests through the existing RPC;
- founder-admin sessions can only read sanitized queue state;
- hosted mutation still requires Neon CLI/API credentials outside the app;
- proof linkage is visible without exposing passwords, tokens, or provider
  configuration.

## Risks

- A partial failure after marking `reviewing` could require a manual retry.
  That is acceptable because `reviewing` is not a green state.
- The CLI must avoid printing temporary passwords or secrets.
- The fulfilled state should not make customer handoff or self-serve gates green
  by itself.

