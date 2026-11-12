---
title: Beta Hosted Proof Package Brainstorm
date: 2026-06-22
status: complete
---

# Beta Hosted Proof Package Brainstorm

## Goal

Turn the generic beta handoff tooling from implemented into proven by running a
disposable, non-House-of-Fitness gym through the hosted proof path. The proof
should use a protected Vercel Preview backed by hosted Neon Auth/Data API,
exercise owner sign-in in the user's Chrome profile when the Vercel bypass
secret is unavailable, generate a customer-safe packet, and roll back all
throwaway data.

## Scope

- Reuse the dedicated hosted Neon proof branch
  `outpost-beta-access-scoped-20260621102658` because it already has Neon Auth,
  Data API, and rotated seed-password material.
- Deploy a fresh protected Vercel Preview with explicit Neon Auth/Data API env.
- Run `npm run vercel:preview:verify` against the fresh deployment.
- Run `npm run beta:dry-run:onboarding` with retained disposable data for a fake
  beta gym.
- Use the authenticated Chrome profile/Codex computer-use path for the
  protected Preview owner sign-in because `VERCEL_AUTOMATION_BYPASS_SECRET` is
  not present.
- Generate `npm run beta:owner-handoff:packet`.
- Run rollback-only cleanup and record non-secret evidence under ignored
  `artifacts/`.

## Boundaries

- Do not record `npm run beta:owner-handoff:complete`; no real external owner
  observed this session.
- Do not enable public self-signup, invite delivery, notifications, phone/email
  providers, billing, POS, access control, or member-ledger writes.
- Do not commit generated artifacts, passwords, Neon API keys, JWTs, cookies, or
  Vercel bypass material.

## Decision

Use the existing proof branch for the current proof package and document the
fresh-branch blocker separately. Creating a new Neon branch succeeded through
migration/Auth setup, but Neon Data API creation failed with a scoped-key
permission error, so the partial branch was deleted before continuing.
