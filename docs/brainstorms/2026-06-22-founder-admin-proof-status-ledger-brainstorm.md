# Founder Admin Proof Status Ledger Brainstorm

Date: 2026-06-22

## Problem

The founder-admin console now exposes read-only beta owner readiness, and the
hosted founder-admin verifier proves the protected path when the correct Neon
and Vercel env is available. Operators still have to keep the current proof
state in chat, PR comments, or shell output. That is fragile before self-serve
onboarding because the next support handoff needs one place to see which proof
gates are currently actionable and which gates are still intentionally blocked.

## Product Boundary

Build a support-facing proof status ledger inside the existing `/founder-admin`
surface. It should summarize the current hosted proof prerequisites, Preview
URL, Neon branch, founder-admin session status, customer-handoff gate, and
blocked live-provider gates.

Do not add product support mutations, proof result persistence, reset or
rollback buttons, invite delivery, public self-serve onboarding, phone/email
providers, notifications, billing, POS, access control, or member-ledger
writes.

## Architecture Options

1. Persist proof runs in hosted Neon.
   - Pros: true "last successful proof" state.
   - Cons: adds schema, write boundaries, retention semantics, and support-data
     audit scope before the current hosted proof gate is fully green.

2. Read proof artifacts from the filesystem or CI.
   - Pros: can reflect exact verifier output.
   - Cons: not available inside Vercel runtime, risks coupling product UI to
     local ignored artifacts or GitHub-specific implementation details.

3. Derive a read-only ledger from current founder-admin readiness, deployment
   env metadata, and explicit no-live-provider gates.
   - Pros: no writes, no secrets, works in local preview and protected Vercel,
     keeps proof claims honest by saying command evidence must still be rerun.
   - Cons: cannot honestly claim "last successful hosted proof" until proof
     result persistence exists.

## Decision

Use option 3 for this slice. The ledger will show whether the current runtime is
configured for hosted proof, whether a founder-admin session can read the
sanitized readiness projection, which Preview origin and Neon branch are in
scope, which verification commands remain the source of proof, and which
customer/live-provider gates remain blocked.

The ledger should make the absence of persisted command evidence explicit. It
can say "run required" or "session ready"; it must not say the hosted beta
workflow passed unless a future slice records that proof result in a durable
store.

## Review Notes

This touches founder/admin support visibility, so treat it as sensitive. Review
for tenant-data leakage, secret leakage, overclaiming hosted proof, and accidental
live-provider enablement.
