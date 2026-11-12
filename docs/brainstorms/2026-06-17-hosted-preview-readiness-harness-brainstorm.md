---
date: 2026-06-17
topic: hosted-preview-readiness-harness
---

# Hosted Preview Readiness Harness Brainstorm

## What We're Building

Add an executable hosted-preview readiness gate for Outpost that can be run
after a dedicated hosted Supabase preview project exists. The gate should prove
the baseline hosted Auth/RLS shape through the public Supabase API before an
operator continues into the fuller SQL/RPC hosted verification runbook.

The current account still lists only four existing non-Outpost Supabase
projects. The harness must
refuse those refs and must not claim hosted proof while a dedicated Outpost
preview project is missing.

## Why This Approach

The blocker is infrastructure quota, not application code. Reusing an existing
Supabase project would weaken the tenant-isolation proof and conflict with the
durable Outpost instructions. A small fail-closed verifier moves the project
forward without pretending the hosted environment exists.

The verifier should use only the hosted project's public anon/publishable key
and rotated seeded owner password. It should reject local URLs, secret keys, and
the public local seed password. Once credentials exist, it should sign in as
the seeded Acme Fitness owner and seeded Peak CrossFit owner, prove each
owner can read its own rows through RLS, and prove each owner cannot read the
other tenant's rows.

## Key Decisions

- Keep hosted proof unclaimed until a dedicated Supabase project exists.
- Add a read-only hosted readiness script instead of extending local rehearsal
  scripts to hosted, because the rehearsal scripts intentionally mutate state.
- Require `OUTPOST_HOSTED_SUPABASE_PROJECT_REF` so the script can reject known
  non-Outpost project refs and ensure the Supabase URL matches the intended
  hosted project.
- Require `OUTPOST_HOSTED_SEED_PASSWORD` and reject `outpost-local-password` so
  hosted seed rotation remains mandatory.
- Keep full transactional hosted proof in `npm run db:verify:rls:hosted`; the
  readiness script is a baseline API/Auth/RLS gate, not a replacement.

## Explicit Non-Goals

- No Supabase project creation inside the app repo.
- No reuse of existing non-Outpost
  Supabase projects.
- No schema, RPC, migration, provider, notification, billing, POS,
  member-ledger, or live phone/email behavior.
- No hosted proof claim while the quota blocker remains.

## Success Criteria

- `npm run hosted:readiness` exists and fails closed without hosted-specific
  env.
- Tests cover rejection of local Supabase, secret/service-role keys, known
  reused project refs, and the local seed password.
- Hosted setup docs explain where this verifier fits relative to migration,
  seed, Vercel env, browser proof, and SQL/RPC proof.
- `AGENTS.md` and `PLOT.md` record the new harness and preserve the hosted
  quota blocker.
