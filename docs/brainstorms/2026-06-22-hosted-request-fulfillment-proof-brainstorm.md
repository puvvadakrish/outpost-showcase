---
title: Hosted Request Fulfillment Proof
date: 2026-06-22
status: captured
---

# Hosted Request Fulfillment Proof

## What We're Building

Add a repeatable hosted proof command for the newly landed beta access request
fulfillment path. The command should create a disposable owner beta request
through the public hosted Neon RPC, fulfill it through the existing
operator-managed request fulfillment command, verify the result through Neon
Auth/Data API and the protected Vercel Preview, then clean up disposable proof
data by default.

## Why This Approach

The current request queue and fulfillment pieces are implemented, but their
end-to-end hosted proof requires operators to remember a sequence from chat:
submit request, run fulfillment, check founder-admin state, sign in as owner,
confirm no live-provider drift, and reset the proof data. A single verifier
turns that into a durable operator step without adding self-serve signup,
invite delivery, support mutation buttons, live providers, billing, POS, or
member-ledger behavior.

## Key Decisions

- Reuse `submit_owner_beta_access_request` for the public request path.
- Reuse `npm run beta:operator:request-fulfillment` for the grant/Auth path.
- Verify the fulfilled row through `list_founder_admin_beta_access_requests`
  using an app-admin plus `founder_admin` session, not direct table reads alone.
- Verify owner sign-in and caller-scoped beta access through hosted Neon Auth
  and Data API.
- Smoke the protected Preview owner workspace path; the expected state for a
  disposable owner is the seedless setup screen, not a bootstrapped tenant.
- Default to cleanup of disposable request, grant, founder-admin proof user,
  and disposable owner Auth rows. Retention must be explicit.

## Scope Boundary

This slice does not create a web approval button, send invite email, expose a
temporary password, bootstrap the owner tenant, connect live providers, send
notifications, enable billing, touch POS/access-control/member-ledger systems,
or record real customer-observed handoff completion.

## Success Criteria

- A new npm command documents and runs the hosted request fulfillment proof.
- The command refuses production, the Neon migration spike branch, local app
  origins, missing hosted env, weak owner proof passwords, and reused local seed
  credentials.
- The command fails closed if fulfillment does not produce an active grant, if
  the founder-admin projection does not show fulfilled state, if owner sign-in
  cannot prove caller-scoped access, or if provider rows drift live.
- Disposable proof data is removed by default, with an explicit retain switch
  for debugging.
