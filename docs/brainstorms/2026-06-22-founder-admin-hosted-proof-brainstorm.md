---
title: Founder admin hosted proof brainstorm
date: 2026-06-22
status: complete
---

# Founder Admin Hosted Proof Brainstorm

## What We're Building

Add a repeatable hosted proof for the newly landed founder/admin readiness
console. The proof should run against hosted Neon Auth/Data API and, when a
Vercel Preview URL is provided, smoke `/founder-admin` through the protected
Preview just like an operator would.

This is proof tooling, not new product behavior. The goal is to verify that a
real hosted founder-admin session can read the sanitized readiness projection
while owner/staff/non-founder sessions cannot.

## Key Decisions

- Reuse the hosted readiness verifier first so the branch, Neon Auth URL, Data
  API URL, seed password, and no-spike/no-local guardrails remain the source of
  truth.
- Create or verify a disposable founder-admin Neon Auth user in the proof
  branch and link it to normal app rows with an active `app_admins` record plus
  active `founder_admin` tenant membership.
- Prove the RPC directly through Neon Data API:
  - founder-admin session returns `authorized: true` and readiness rows;
  - seeded owner/staff sessions return `authorized: false` and no rows;
  - anonymous calls fail closed.
- Smoke `/founder-admin` when an app origin is available. Use the existing
  Vercel `curl` path for protected Preview automation and normal fetch for
  local app proof.
- Default proof identities are disposable and can remain on the proof branch.
  Operators can set `OUTPOST_FOUNDER_ADMIN_PROOF_EMAIL` to reuse one
  idempotent founder-admin proof identity on repeated runs, then reset or
  rotate the proof branch for cleanup.
- Keep the proof read-only except for setting up the disposable founder-admin
  identity. Do not add support mutations, reset/rollback buttons, invite
  delivery, providers, notifications, billing, POS, access control, or
  member-ledger writes.

## Approach Options

1. **Recommended: new hosted founder-admin verifier command**
   - Pros: small, repeatable, can be run after hosted readiness and from the
     Vercel Preview verifier.
   - Cons: duplicates a few Auth/Data API helper utilities already used by the
     hosted beta workflow script.

2. **Fold checks into hosted beta workflow**
   - Pros: one command.
   - Cons: mixes owner/staff workflow mutation proof with support/admin proof,
     making failures harder to triage.

3. **Browser-only manual proof**
   - Pros: closest to user behavior.
   - Cons: not repeatable, cannot prove owner/staff Data API denial, and risks
     leaving the proof only in chat memory.

## Scope Boundaries

- No support mutation APIs.
- No rollback or reset execution from the app.
- No raw grant notes, display names, provider secrets, JWTs, cookies, or seed
  passwords in committed output.
- No live phone/email providers, invite delivery, notifications, billing, POS,
  access control, or member-ledger writes.
- No production promotion claim.

## Success Criteria

- `npm run hosted:founder-admin-readiness` runs hosted readiness first.
- The proof links a hosted founder-admin Auth user to app-admin/founder rows
  without using app service-role credentials.
- Founder-admin RPC access succeeds with sanitized rows.
- Owner/staff/anonymous RPC access is denied or unauthorized.
- Vercel Preview verification includes founder-admin route proof after the
  existing owner/staff hosted workflow.
