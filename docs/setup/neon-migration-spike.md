---
date: 2026-06-20
topic: neon-migration-spike
status: active-default-backend
origin:
  - docs/brainstorms/2026-06-20-neon-postgres-auth-migration-brainstorm.md
  - docs/plans/2026-06-20-spike-neon-postgres-auth-migration-plan.md
---

# Neon Migration Spike

Outpost is moving to Neon as the default backend. The app runtime now uses Neon
Auth and the Neon Data API adapter path; the old Supabase project directory,
direct SDK dependencies, local Docker reset scripts, and hosted Supabase
readiness path have been removed from the active code path.

Do not claim live-provider readiness from this migration. Neon Auth/Data API RLS
read proof and the hosted owner/staff beta workflow proof are green, but Vercel
preview deployment, invite delivery, and live-provider gates still need separate
proof before inviting a real gym user.

## Current Neon Project

- Organization: `<org>`
- Org id: `org-example-000000`
- Project: `Outpost`
- Project id: `outpost-test-project`
- Region: `aws-us-east-1`
- Postgres: 18
- Production branch: `production`
- Production branch id: `br-example-main`
- Spike branch: `outpost-neon-spike`
- Spike branch id: `br-example-preview`
- Database: `neondb`
- Owner role: `neondb_owner`
- Neon Auth roles present: `anonymous`, `authenticated`, `authenticator`
- Schemas present after Neon Auth setup: `auth`, `neon_auth`, `public`
- Data API is enabled in the console.

## Portal Status

No more portal work is required for the first CLI/code spike. Migration tests
should target the `outpost-neon-spike` branch until the port is proven.

Later portal work before beta:

- Rotate the `neondb_owner` password before any real beta.
- Add the real Vercel preview URL to Neon Auth domain/redirect settings.
- Decide whether open public signup is acceptable while Neon Auth restricted
  signups remain unavailable, or add an application-level invite/allowlist gate.
- Protect the Neon production branch once the migration path is proven.

## CLI Checks Run

```bash
neon me --output json
neon orgs list --output json
neon projects list --org-id org-example-000000 --output json
neon branches list --project-id outpost-test-project --output json
neon databases list --project-id outpost-test-project --branch production --output json
neon roles list --project-id outpost-test-project --branch production --output json
neon connection-string production --project-id outpost-test-project --database-name neondb --role-name neondb_owner --psql -- -c "select current_database(), current_user, version();"
neon branches create --project-id outpost-test-project --name outpost-neon-spike --output json
```

The CLI is authenticated and database connectivity works through Neon CLI's
embedded psql fallback.

A controlled apply of the existing initial Supabase migration on the first
spike branch failed at `references auth.users(id)`, as expected. A second
transform pass reached role grants before failing because Neon uses
`anonymous`, not Supabase's `anon` role. Those branches were deleted and
recreated clean before continuing.

## Compatibility Findings

Neon Auth creates an `auth` schema with helper functions that are close to the
current Supabase RLS shape:

- `auth.uid()` returns `uuid`.
- `auth.user_id()` returns `text`.
- `auth.jwt()` returns `jsonb`.
- `auth.session()` returns `jsonb`.
- `auth.jwt_session_init(jwt text)` exists for session initialization.

Neon Auth stores users in `neon_auth.user`, not Supabase `auth.users`.

Important `neon_auth.user` columns:

- `id uuid`
- `email text`
- `"emailVerified" boolean`
- `name text`
- `"createdAt" timestamptz`
- `"updatedAt" timestamptz`

This means most existing RLS helper logic can likely keep using `auth.uid()`
and `auth.jwt()`, but the schema and staff-claim checks must stop depending on
Supabase `auth.users`.

## Replaced Backend Seams

- Direct Supabase runtime dependencies were removed from `package.json`.
- `src/proxy.ts` no longer refreshes legacy provider sessions.
- `src/server/neon/*` owns Neon Auth session handling and Data API access.
- Owner/staff sign-in, sign-up, sign-out, and callback server actions.
- `src/infrastructure/neon/*` table-read and RPC adapters replace the old
  provider-specific repository path.
- `neon/migrations/*` references `neon_auth."user"` instead of provider auth
  tables.
- `neon/seed.sql` seeds application rows only; Neon Auth users are created
  through the verifier.
- `scripts/verify-local-beta-rehearsal.mjs`,
  `scripts/verify-local-staff-claim-rehearsal.mjs`, and
  `scripts/verify-hosted-preview-readiness.mjs` route through the Neon
  verifier.
- `db:reset`, `db:verify:rls`, and hosted-readiness scripts no longer invoke
  the old local Docker backend.

## First SQL Port

The first Neon migration pass should:

1. Copy the current Outpost application schema into a Neon migration path.
2. Replace `users.external_auth_id uuid unique references auth.users(id)` with
   a Neon-compatible reference to `neon_auth.user(id)` or a nullable plain UUID
   plus explicit lookup checks.
3. Replace staff-claim's Supabase `auth.users.email_confirmed_at` check with a
   `neon_auth.user."emailVerified"` check.
4. Preserve `auth.uid()` and `auth.jwt()` if Neon Data API/session tests prove
   they are populated correctly for authenticated requests.
5. Keep all direct writes deny-by-default and all write workflows inside
   security-definer RPCs.

`neon/migrations` is now the sole schema source and Atlas is the only current
migration workflow. Follow `docs/runbooks/neon-migration-ledger.md` to validate
the checksummed history, preview pending SQL, and apply only pending revisions.
Do not build or apply a concatenated migration bundle.

`npm run neon:spike:readiness` proves the first Neon Auth/Data API path. It:

- creates or reuses the seeded owner/staff users through Neon Auth;
- marks those local spike users email-verified in the Neon Auth table;
- applies the existing app seed rows with the real Neon Auth user ids;
- signs in both seeded owners through Neon Auth;
- fetches Neon Auth JWTs from `/token`;
- reads `tenants` through the Neon Data API; and
- verifies own-tenant visibility plus cross-tenant denial through RLS;
- edits one owner draft answer through a security-definer RPC; and
- verifies that the edit writes revision/audit rows while the cross-tenant edit
  is denied.

Run it with branch-specific Auth/Data API URLs:

```bash
NEXT_PUBLIC_NEON_AUTH_URL='https://<branch-auth-host>/neondb/auth' \
NEXT_PUBLIC_NEON_DATA_API_URL='https://<branch-api-host>/neondb/rest/v1' \
npm run neon:spike:readiness
```

Current proof status:

- `npm run typecheck` passed.
- `npm test` passed: 26 files, 176 tests.
- `npm run build` passed.
- `npm run neon:spike:readiness` passed against the `outpost-neon-spike`
  branch with Neon Auth/Data API endpoints, including read isolation, one
  answer-edit mutation, revision/audit side-effect proof, and cross-tenant
  mutation denial.
- `npm run hosted:readiness` passed against the dedicated non-spike
  `outpost-browser-proof-20260621` branch with a rotated seed password.
- `/owner` and `/staff/tasks` rendered through the running Next app using real
  Neon Auth session cookies and Neon Data API-backed tenant reads.
- `npm run hosted:beta-workflow` passed against the dedicated non-spike
  `outpost-beta-workflow-20260621` branch with a rotated seed password. It
  proved owner staff-roster setup, staff Neon Auth roster claim, manual source
  intake, answer proposal staging, answer-derived staff task creation, staff
  task visibility, assignment, note, completion, owner/staff route smoke, and
  no-live-provider guardrails.
- Owner beta access hardening passed against the dedicated non-spike
  `outpost-beta-access-scoped-20260621102658` branch with a rotated seed password. It
  requires database-backed approved owner beta emails for seedless owner
  workspace bootstrap, keeps owner account creation operator-managed for the
  preview, and the hosted beta workflow verifier includes unauthenticated grant
  check denial, authenticated caller-email scoping, and an ungranted-owner
  bootstrap denial with no partial app rows.
- `npm run vercel:preview:verify` passed against fresh Neon branch
  `outpost-beta-access-scoped-20260621102658` and protected Vercel Preview
  deployment
  `https://outpost-preview.example.vercel.app`.
  It verified the deployed app origin, Neon Auth trusted domain, hosted
  readiness, owner/staff beta workflow, owner/staff route smoke through Vercel
  deployment protection, and no-live-provider guardrails.
- `npm run beta:operator:owner-access` passed against the same branch and
  Preview deployment with a throwaway owner email and temporary password stored
  outside the repo. It proved operator-managed Neon Auth owner provisioning,
  an active beta access grant, caller-scoped hosted Data API grant visibility,
  and no-live-provider guardrails. `npm run hosted:beta-workflow` passed again
  afterward.

Do not treat this as full beta readiness. It proves the database/auth/RLS read
spine, hosted readiness gate, hosted owner/staff beta workflow, owner beta
access bootstrap denial, authenticated grant self-scoping, protected Vercel
Preview route smoke, and operator-managed beta owner access provisioning. It
still does not prove public owner self-signup, production promotion, invite
delivery, Retell/Resend/Gmail/live providers, notifications, billing,
POS/member-ledger writes, or real customer beta readiness.

## Immediate Next Commands

Use Neon CLI instead of portal copy/paste whenever possible:

```bash
neon branches list --project-id outpost-test-project --output json
neon connection-string outpost-neon-spike --project-id outpost-test-project --database-name neondb --role-name neondb_owner --psql
```

Avoid writing real connection strings to tracked files. Use `.env.neon.local`
or shell environment variables for secrets.
