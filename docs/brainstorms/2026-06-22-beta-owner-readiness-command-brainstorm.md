---
title: Beta Owner Readiness Command Brainstorm
date: 2026-06-22
status: complete
---

# Beta Owner Readiness Command Brainstorm

## Goal

Build the pre-self-serve owner onboarding readiness slice for operator-assisted
beta gyms. The operator needs one safe place to inspect hosted Neon state before
or after an owner handoff: beta owner grant status, whether the owner has
bootstrapped a tenant, whether workflow proof rows exist, whether packet or
completion artifacts are present, and whether rollback is safe or requires
manual review.

## Chosen Approach

Add a production-safe CLI command rather than a web admin page for this slice.
The command can use the existing hosted Neon proof env and Neon CLI access
without putting operator credentials or support data into the app runtime. It
will run read-only SQL, redact note-like fields, accept an optional owner-email
filter, and write optional non-secret evidence only under gitignored
`artifacts/`.

## Why This Approach

- The existing `/founder-admin` page is static seed visibility, while this
  slice needs hosted Neon state.
- A web admin surface would require an app-side authorization model for support
  access, which is a larger sensitive surface than the current need.
- Existing operator scripts already use `readHostedReadinessConfig`, Neon CLI
  psql, artifact path guards, and no-live-provider assertions. Reusing those
  patterns keeps this slice narrow.

## Boundaries

- No schema, RLS, or RPC changes.
- No support/admin app login or customer-data browser.
- No invite delivery, public self-serve signup, notifications, phone/email
  providers, billing, POS, access control, or member-ledger writes.
- No passwords, Neon API keys, JWTs, cookies, bypass secrets, or raw packet
  contents in output.

## Success Criteria

- `npm run beta:owner-readiness` is registered.
- The command refuses unsafe hosted proof env the same way current hosted
  readiness scripts do.
- The command reports owner grant, Auth/app-user linkage, tenant bootstrap,
  workflow proof counts, live-provider blocked state, packet/completion artifact
  presence, and rollback readiness.
- Tests prove the command is read-only, secret-safe, scoped, and explicit about
  no-live-provider gates.
