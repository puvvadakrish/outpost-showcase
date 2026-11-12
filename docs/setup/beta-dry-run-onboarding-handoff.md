# Generic Beta Dry-Run Onboarding Handoff

Use this runbook to rehearse an operator-assisted beta handoff for any gym on
the protected Vercel Preview and hosted Neon proof branch.

This is not public self-serve onboarding. It does not send invites, enable
phone/email providers, send notifications, touch billing, replace POS/access
control, or write member-ledger data.

## Required Inputs

Set the hosted Neon/Vercel proof env used by `hosted:readiness`, plus the
operator-provisioned owner inputs:

```bash
export NEON_API_KEY="..."
export OUTPOST_NEON_PROJECT_ID="..."
export OUTPOST_NEON_BRANCH_NAME="outpost-beta-access-scoped-..."
export NEXT_PUBLIC_NEON_AUTH_URL="https://..."
export NEXT_PUBLIC_NEON_DATA_API_URL="https://..."
export NEXT_PUBLIC_OUTPOST_APP_URL="https://<protected-preview>.vercel.app"
export OUTPOST_OWNER_BETA_EMAIL="nextgym+dry-run@owner.outpost.local"
export OUTPOST_OWNER_BETA_NAME="Next Gym Owner"
export OUTPOST_OWNER_BETA_PASSWORD="<rotated temporary password>"
export OUTPOST_BETA_DRY_RUN_GYM_NAME="Next Gym"
export OUTPOST_BETA_DRY_RUN_ID="nextgym_dry_run_001"
```

For protected Preview smoke without an authenticated Chrome profile, also set:

```bash
export VERCEL_AUTOMATION_BYPASS_SECRET="..."
export OUTPOST_USE_VERCEL_CURL="1"
```

## Run

```bash
npm run beta:dry-run:onboarding
```

The verifier runs hosted readiness, provisions owner access, signs in through
Neon Auth, bootstraps a disposable dry-run tenant, stages manual facts, creates
answer proposals, creates one answer-derived staff task, smokes `/owner`, checks
live-provider gates, and rolls back the disposable rows.

## Retain Data For Browser Smoke

Use this only when you need to inspect the dry-run in Chrome/Codex extension:

```bash
export OUTPOST_BETA_DRY_RUN_KEEP_DATA=1
export OUTPOST_BETA_DRY_RUN_EVIDENCE_PATH="artifacts/beta-dry-run/${OUTPOST_BETA_DRY_RUN_ID}-retained.json"
npm run beta:dry-run:onboarding
```

After browser proof, run rollback-only cleanup:

```bash
export OUTPOST_BETA_DRY_RUN_ROLLBACK_ONLY=1
export OUTPOST_BETA_DRY_RUN_TENANT_ID="<tenant id printed by the retained run>"
export OUTPOST_BETA_DRY_RUN_OWNER_EMAIL="$OUTPOST_OWNER_BETA_EMAIL"
export OUTPOST_BETA_DRY_RUN_EVIDENCE_PATH="artifacts/beta-dry-run/${OUTPOST_BETA_DRY_RUN_ID}-rollback.json"
npm run beta:dry-run:onboarding
```

The rollback guard refuses the seeded Acme Fitness tenant, refuses tenants
whose name does not contain ` Dry Run `, verifies the throwaway owner is the
active owner of only that tenant, then deletes tenant-owned rows, the beta owner
grant, the app user, and the Neon Auth user.

## Evidence

`OUTPOST_BETA_DRY_RUN_EVIDENCE_PATH` is optional. Repo-local evidence paths must
live under ignored `artifacts/`. The non-secret JSON summary records the
Preview origin, Neon branch, gym name, run id, throwaway dry-run owner email,
disposable tenant id/name, checks, rollback status, and blocked live-provider
gate.

Do not put passwords, Neon API keys, JWTs, cookies, or Vercel bypass secrets in
evidence files or packets.

Do not enable phone/email providers, invite delivery, notifications, billing,
POS, access control, or member-ledger writes for this dry run.

## Run Automated Browser Handoff Smoke

Use this when the active desktop Chrome/Codex-extension bridge is unavailable
or you need a repeatable isolated-browser proof:

```bash
export VERCEL_AUTOMATION_BYPASS_SECRET="..."
npm run beta:browser:handoff
```

The command creates retained dry-run data through
`npm run beta:dry-run:onboarding`, launches an isolated Chrome profile with
DevTools Protocol enabled, signs in through the real `/owner/sign-in` form,
verifies `/owner` renders the dry-run tenant and hosted-proof/live-provider
boundary copy, writes non-secret browser evidence under `artifacts/`, and then
runs rollback-only cleanup.

For protected Vercel Preview deployments, the browser smoke requires
`VERCEL_AUTOMATION_BYPASS_SECRET`. Without it, the command fails before creating
dry-run data because an isolated browser profile cannot reuse the operator's
logged-in Vercel session.

For local harness debugging against a Next dev server, keep
`NEXT_PUBLIC_OUTPOST_APP_URL` pointed at the trusted hosted Preview origin used
by Neon Auth, and set `OUTPOST_BETA_BROWSER_APP_URL` to the local browser target
such as `http://127.0.0.1:3010`.

`NEXT_PUBLIC_OUTPOST_APP_URL` and `OUTPOST_BETA_BROWSER_APP_URL` must point at
deployments backed by the same hosted Neon Auth/Data API branch. The dry-run
setup writes data through the former origin while the isolated browser visits
the latter.

## Next Step

After a clean dry run and browser proof, generate a customer-safe beta owner
handoff packet:

```bash
npm run beta:owner-handoff:packet
```

Record `beta:owner-handoff:complete` only after a real owner observes the
protected Preview workflow and every checklist gate is confirmed.
