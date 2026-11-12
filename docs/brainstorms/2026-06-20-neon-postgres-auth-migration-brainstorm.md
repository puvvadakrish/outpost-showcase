---
date: 2026-06-20
topic: neon-postgres-auth-migration
status: proposed
scope: backend-platform-migration-spike
origin:
  - docs/brainstorms/2026-06-09-outpost-backend-persistence-deployment-brainstorm.md
  - docs/setup/backend-persistence-local.md
  - docs/setup/backend-persistence-hosted.md
---

# Neon Postgres Auth Migration Brainstorm

## What We Are Considering

Evaluate whether Outpost can move its backend spine from Supabase
Postgres/Auth/RLS to Neon Postgres plus either Neon Auth or Clerk, primarily to
avoid the current Supabase free-project quota blocker while preserving the same
tenant-isolation and no-live-provider readiness gates.

This does not change product scope. The migration must not add live providers,
notifications, billing, POS/member-ledger writes, provider ingress, hosted-proof
claims, or task automation.

## Current Repo Reality

Outpost is not using Supabase as only a hosted Postgres database. The current
backend proof path uses:

- Supabase CLI and local Docker for reset-backed local Auth/RLS/RPC proof.
- Supabase Auth sessions in Next.js middleware/proxy and server actions.
- `@supabase/ssr` and `@supabase/supabase-js` for auth, table reads, and RPCs.
- SQL migrations under `supabase/migrations`.
- RLS policies and security-definer RPCs that call `auth.uid()` and
  `auth.jwt()`.
- Seed data that writes preview/local users into `auth.users`.
- `hosted:readiness` that signs in through Supabase Auth and proves RLS denial.

Neon is similar to Supabase at the Postgres layer, but not at the complete app
runtime layer. Moving to Neon means replacing Supabase Auth/session helpers, the
PostgREST-style client API, auth helper functions, seed strategy, hosted
readiness harness, and local reset workflow.

## Approaches Considered

### Approach A: Keep Supabase And Free A Project Slot

This remains the lowest-risk path. It preserves all current code, tests, local
Docker proof, RLS functions, and hosted readiness harness. It only requires a
fresh Supabase slot or paid month.

Best when the goal is fastest real beta readiness.

### Approach B: Neon Postgres Plus Neon Auth

Neon Auth is the closest conceptual replacement because auth data lives in the
Neon database and branches with database branches. Current Neon docs mark Neon
Auth with Better Auth as beta, but it supports managed sessions, JWTs, and
database/RLS integration.

This is the best migration spike target if the goal is to stay on one vendor and
preserve branchable preview environments. The main risk is beta maturity and
whether the Neon Data API/client can cover Outpost's existing table-read and RPC
shape cleanly enough.

### Approach C: Neon Postgres Plus Clerk

Clerk is more mature as an auth product and has a large free tier. It is a
credible production auth provider, but it makes Outpost a two-vendor backend:
Clerk for identity/sessions and Neon for data. Outpost would need to map Clerk's
string user IDs into the current app user model, replace sign-in/sign-up flows,
and implement RLS context for every database access path.

This is likely production-sturdier than Neon Auth today, but it is a larger
integration surface and less similar to the current single-vendor Supabase
runtime.

### Approach D: Neon Postgres Only, Custom Auth Context

Use Neon as Postgres and keep authentication entirely in application code, with
server-side database transactions setting local auth context before every query.
This can preserve Postgres RLS, but it is the most security-sensitive option
because every data access path must correctly set transaction-local identity and
must never use an owner role that bypasses RLS.

This is viable only if Neon Auth/Data API cannot support the current model and
Clerk is rejected.

## Recommendation

Do not do a full migration immediately. Do a narrow, disposable spike branch
with Neon Postgres plus Neon Auth first, and explicitly compare it against a
Clerk variant only if Neon Auth fails the proof criteria.

The minimum proof is not "the app signs in." The minimum proof is:

- Neon project can be created and managed from CLI.
- Local development can run without Supabase Docker.
- The initial schema and seed can be applied to Neon/local Postgres without
  Supabase-only `auth.users` assumptions.
- Owner sign-in creates a session.
- Owner and staff identity can map to `users.external_auth_id`.
- Existing owner setup rows can be loaded through RLS.
- At least one existing RPC-style workflow can run atomically.
- Cross-tenant reads and RPCs are denied.
- The hosted readiness harness equivalent fails closed and does not claim proof
  without dedicated Neon credentials.

## Key Decisions

- Treat this as a backend-platform spike before migration, not as a production
  switch.
- Preserve current Supabase code until a Neon branch passes equivalent proof.
- Prefer Neon Auth first because it is closer to Supabase's "auth plus
  database" product shape, despite beta risk.
- Keep Clerk as the fallback if Neon Auth maturity or Data API/RLS/RPC support
  blocks proof.
- Keep local Docker/Postgres proof as the day-to-day test target even if Neon is
  selected; hosted Neon proof is still required before customer beta.

## Open Questions

- Does Neon Auth's beta status meet the risk bar for the first real gym beta?
- Can Neon Data API or the serverless driver cover Outpost's current RPC-heavy
  repository pattern without weakening RLS?
- Should `users.external_auth_id` remain `uuid` for Neon Auth or become `text`
  to support Clerk and broader auth providers?
- Does the team prefer one-vendor beta convenience or mature auth with Clerk?

## Sources

- Neon CLI: https://neon.com/docs/reference/neon-cli
- Neon plans: https://neon.com/docs/introduction/plans
- Neon Auth overview: https://neon.com/docs/auth/overview
- Neon Auth flow: https://neon.com/docs/auth/authentication-flow
- Neon Data API and RLS: https://neon.com/docs/data-api/get-started
- Neon local development: https://neon.com/guides/local-development-with-neon
- Clerk pricing: https://clerk.com/pricing
- Clerk Neon integration: https://clerk.com/docs/guides/development/integrations/databases/neon
