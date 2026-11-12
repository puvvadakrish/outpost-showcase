---
title: Vercel Neon Preview Proof
date: 2026-06-21
status: active
---

# Vercel Neon Preview Proof

Use this runbook after `npm run hosted:beta-workflow` is green locally against a
dedicated Neon branch. It proves the same hosted owner/staff beta workflow
through a deployed Vercel Preview URL without promoting production or enabling
live providers.

## What This Proves

- The Vercel project can build and deploy the current Outpost app as a Preview.
- The deployed app can derive its public origin from `VERCEL_URL` when
  `NEXT_PUBLIC_OUTPOST_APP_URL` is not explicitly set.
- The preview is wired to a dedicated hosted Neon Auth/Data API branch.
- The hosted owner/staff beta workflow passes through the deployed `/owner` and
  `/staff/tasks` routes.
- Unauthenticated owner beta grant checks fail closed at the hosted Data API
  boundary.
- Authenticated owner beta grant checks are scoped to the caller email.
- Ungranted owner Auth accounts are denied seedless owner workspace bootstrap
  without leaving partial app rows.
- Deployment protection can remain enabled while automation uses Vercel's
  protection-bypass header when needed.

## What This Does Not Prove

- Production Vercel promotion.
- Public owner self-signup.
- Invite email delivery.
- Retell, Resend, Gmail, provider webhooks, live calls, live email ingestion, or
  outbound automated replies.
- Notifications, billing, POS, payment processing, member-ledger writes, access
  control, or Club OS replacement.

## Prepare A Fresh Neon Proof Branch

Use a new branch for each deployment proof run so proof data and seed passwords
do not drift across rehearsals:

```bash
# Use an authenticated Neon CLI session, or export NEON_API_KEY if needed.
export OUTPOST_NEON_PROJECT_ID='outpost-test-project'
export OUTPOST_NEON_BRANCH_NAME="outpost-vercel-preview-$(date +%Y%m%d%H%M%S)"

npm run hosted:proof-branch:prepare
```

The command creates a fresh Neon branch from `production`, applies
`neon/migrations`, enables Neon Auth and the Data API, and writes a rotated seed
password to `/tmp/<branch>-seed-password`. It prints the branch-specific Auth
and Data API URLs; export those values for the deploy and verifier commands.
Project-scoped Neon API keys are supported through explicit CLI `--api-key`
arguments when `NEON_API_KEY` is set.

## Link Vercel Project

`.vercel/` is gitignored. Link this local worktree when needed:

```bash
vercel link --yes --project outpost-preview-20260610
```

## Deploy Preview

Deploy from this branch with explicit hosted Neon env. Do not pass
`NEXT_PUBLIC_OUTPOST_APP_URL`; the deployed app derives `https://${VERCEL_URL}`.
The repo `vercel.json` pins the project to the Next.js framework preset so this
preview does not inherit a generic static-output directory.

Runtime-policy candidate recording additionally requires a SQL-created login
with only `outpost_policy_compiler`, and `OUTPOST_POLICY_DATABASE_URL` must use
the same branch endpoint as the Data API. Run
`npm run db:policy-authority:verify` before deployment. In the observed Neon
catalog, the capability retains one `cloud_admin`-granted database-owner
administrator row with `INHERIT FALSE` and `SET FALSE`. It does not directly
inherit or assume the capability, but its `ADMIN TRUE` option remains provider
migration authority rather than an application security boundary. The verifier
requires exactly one non-admin executable application login. Both the
capability and login may retain only their observed directly non-executable
managed-owner row; every additional member shape is rejected.
The capability must also retain its exact `NOLOGIN NOSUPERUSER NOCREATEDB
NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS` attributes, and the protected
function ACL must expose execute only to its owner and the capability role.
The capability's execute entry must not carry grant option.

```bash
env -u OUTPOST_POLICY_DATABASE_URL \
NEXT_PUBLIC_NEON_AUTH_URL="$NEXT_PUBLIC_NEON_AUTH_URL" \
NEXT_PUBLIC_NEON_DATA_API_URL="$NEXT_PUBLIC_NEON_DATA_API_URL" \
vercel build --yes --target preview

vercel deploy --prebuilt \
  --yes \
  --target preview \
  --project outpost-preview-20260610 \
  -e NEXT_PUBLIC_NEON_AUTH_URL="$NEXT_PUBLIC_NEON_AUTH_URL" \
  -e NEXT_PUBLIC_NEON_DATA_API_URL="$NEXT_PUBLIC_NEON_DATA_API_URL" \
  -e OUTPOST_POLICY_DATABASE_URL="$OUTPOST_POLICY_DATABASE_URL"
```

The prebuilt flow is required for policy proof: it keeps the SQL credential out
of the build environment and injects it only into the deployed functions.

Save the deployment URL printed by Vercel.

## Verify Preview

The verifier defaults to `vercel curl` for route smoke so protected previews can
be checked by an authenticated Vercel CLI session without disabling SSO
protection. If you prefer raw fetch, set `OUTPOST_USE_VERCEL_CURL=0` and provide
`VERCEL_AUTOMATION_BYPASS_SECRET`.

```bash
export OUTPOST_VERCEL_DEPLOYMENT_URL='https://<deployment>.vercel.app'
export OUTPOST_NEON_SEED_PASSWORD="$(cat /tmp/<branch>-seed-password)"
# Optional when using raw fetch instead of vercel curl:
export VERCEL_AUTOMATION_BYPASS_SECRET='<bypass secret>'

npm run vercel:preview:verify
```

The verifier waits for the Vercel deployment, rejects production targets and
non-HTTPS/local URLs, validates the hosted Neon config, adds the Preview URL to
the branch's Neon Auth trusted domains if needed, and then runs
`npm run hosted:beta-workflow` against the deployed Preview URL.

## Reset And Rotate

For the next proof run, create a new branch name and run
`npm run hosted:proof-branch:prepare` again. Treat the previous `/tmp` seed
password file as spent proof material and remove it after recording evidence.

Do not reset or reuse `outpost-neon-spike`, `production`, or a branch already
used for customer-facing proof.

## Go/No-Go

Go for a real customer beta handoff only after this Vercel Preview verifier
passes and the proof status is recorded in `AGENTS.md` / `PLOT.md`. Phone/email
productization remains blocked until the separate live-provider gate review.

## Current Proof Status

As of 2026-06-22, `npm run vercel:preview:verify` passed against fresh Neon proof
branch `outpost-proof-records-202606220520` and protected Vercel Preview
deployment
`https://outpost-preview.example.vercel.app`.
The proof used a rotated seed password file outside the repo, proved hosted
readiness, owner beta grant denial/scoping, ungranted owner bootstrap rollback,
owner manual source to answer review to staff-task flow, staff claim/workboard
completion, admin portal readiness access, owner/staff/anonymous denial for
readiness and proof-run RPCs, admin portal `/admin` rendering, owner
`/admin` lockout, blocked live-provider gates, and passed
`hosted_founder_admin_readiness` plus `vercel_preview_verify` records scoped to
the same Preview origin.

As of 2026-06-22, `npm run vercel:preview:verify` also passed against fresh Neon
proof branch `outpost-request-proof-20260622104715` and protected Vercel
Preview deployment
`https://outpost-preview.example.vercel.app`.
That run proved hosted readiness, owner/staff workflow, admin portal
readiness, protected route smoke through `vercel curl`, blocked live-provider
gates, and a new `vercel_preview_verify` proof record for the same Preview
origin. A separate `npm run hosted:request-fulfillment-proof` run against the
same branch and Preview proved beta access request capture with Neon Auth
anonymous JWTs, operator fulfillment, admin portal fulfilled/grant-linked state
with recorded fulfillment receipt projection, disposable owner grant
visibility, protected `/owner` smoke, cleanup, and blocked live-provider gates.
