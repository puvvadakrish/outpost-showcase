---
title: Hosted Beta Operator Access
date: 2026-06-21
status: active
---

# Hosted Beta Operator Access

Use this runbook after the Vercel/Neon hosted proof is green and before handing
a beta owner the `/owner/sign-in` path. It makes owner beta access provisioning
repeatable for a dedicated hosted Neon proof branch.

## What This Proves

- A branch-scoped Neon Auth user exists for the beta owner email.
- The owner email has an active `owner_beta_access_grants` row.
- The signed-in owner can verify only their own beta grant through the hosted
  Neon Data API.
- Live-provider gates remain blocked.

## What This Does Not Prove

- Public owner self-signup.
- Invite email delivery, password reset delivery, or notification delivery.
- Production Vercel promotion.
- Retell, Resend, Gmail, live phone/email, provider webhooks, automated
  outbound replies, billing, POS, payment processing, member-ledger writes,
  access control, or Club OS replacement.

## Inputs

Start from the same hosted proof branch/env used by
`npm run vercel:preview:verify`:

```bash
export NEON_API_KEY='<rotated Neon API key>'
export OUTPOST_NEON_PROJECT_ID='outpost-test-project'
export OUTPOST_NEON_BRANCH_NAME='<dedicated hosted proof branch>'
export NEXT_PUBLIC_NEON_AUTH_URL='https://<branch-auth-host>/neondb/auth'
export NEXT_PUBLIC_NEON_DATA_API_URL='https://<branch-api-host>/neondb/rest/v1'
export OUTPOST_NEON_SEED_PASSWORD="$(cat /tmp/<branch>-seed-password)"
export NEXT_PUBLIC_OUTPOST_APP_URL='https://<preview>.vercel.app'
```

Then set the beta owner handoff fields:

```bash
export OUTPOST_OWNER_BETA_EMAIL='owner@example.com'
export OUTPOST_OWNER_BETA_NAME='Owner Name'
export OUTPOST_OWNER_BETA_PASSWORD='<temporary password stored outside the repo>'
export OUTPOST_OWNER_BETA_NOTE='Acme Fitness hosted beta access'
```

No invite email is sent. Share the temporary password with the owner out of
band, then rotate or discard the proof branch after the beta proof window.

## Run

```bash
npm run beta:operator:owner-access
```

The command refuses Neon production, the Neon migration spike branch, local
hosted-proof endpoints, the local seed password, missing `NEON_API_KEY`, and
weak owner credentials. It creates or verifies the Neon Auth owner, marks the
branch proof user email verified, upserts the active beta access grant, signs in
as that owner, proves the grant through the Data API, and checks provider rows
remain disabled or not configured.

## Fulfill A Queued Request

If the owner submitted the public beta access request form, prefer fulfilling
from the queue instead of copying fields by hand:

```bash
export OUTPOST_OWNER_BETA_REQUEST_EMAIL='owner@example.com'
npm run beta:operator:request-preflight
```

The preflight command reads the queued request and matching hosted support
state without writing rows. It reports whether CLI fulfillment is ready,
requires operator review, or is blocked by an archived/fulfilled request,
existing owner access, existing workspace state, or unexpected live-provider
records. It does not create Auth users, create grants, approve requests, send
invites, bootstrap tenants, execute rollback, or enable providers.

Only after preflight is ready or the operator has reviewed an attention state,
run the mutating fulfillment command:

```bash
export OUTPOST_OWNER_BETA_REQUEST_EMAIL='owner@example.com'
export OUTPOST_OWNER_BETA_PASSWORD='<temporary password stored outside the repo>'
export OUTPOST_OWNER_BETA_REQUEST_FULFILLMENT_NOTE='Approved for June beta proof'
npm run beta:operator:request-fulfillment
```

The fulfillment command reads the queued request from hosted Neon, refuses
production, `outpost-neon-spike`, declined, superseded, missing, already
fulfilled, and weak-password cases, marks the request `reviewing`, runs the
same owner-access provisioner above, then marks the request `approved` with a
secret-free fulfilled timestamp and grant linkage. It also appends a sanitized
fulfillment receipt with the command name, Neon branch, completion timestamp,
recorded status, and no-secret summary. `/admin` shows fulfillment state and
receipt state read-only. It does not send invites, expose the temporary
password, add a web approval button, or enable live providers.

## Hosted Request Fulfillment Proof

Before using the request fulfillment path for a real beta owner, run a
disposable hosted proof against the protected Vercel Preview and dedicated Neon
proof branch:

```bash
export OUTPOST_VERCEL_DEPLOYMENT_URL='https://<preview>.vercel.app'
export OUTPOST_OWNER_BETA_PASSWORD='<temporary proof password stored outside the repo>'
# Optional proof labels. Defaults are disposable @beta-proof.outpost.local values.
export OUTPOST_HOSTED_REQUEST_FULFILLMENT_EMAIL='hosted-request-proof@beta-proof.outpost.local'
export OUTPOST_HOSTED_REQUEST_FULFILLMENT_OWNER_NAME='Hosted Request Proof Owner'
export OUTPOST_HOSTED_REQUEST_FULFILLMENT_GYM_NAME='Hosted Request Proof Gym'

npm run hosted:request-fulfillment-proof
```

The verifier runs `npm run hosted:readiness`, submits a disposable public beta
request through the hosted Data API RPC using a Neon Auth anonymous JWT, runs
`npm run beta:operator:request-fulfillment`, verifies `/admin` sees the
request as approved/fulfilled/grant-linked with a recorded fulfillment receipt
through the sanitized RPC projection, signs in as the disposable owner, proves
the owner can read only their own active beta grant, smokes the protected
Preview `/owner` route to the seedless setup screen, checks live-provider rows
remain blocked, and removes the disposable receipt, request, grant, admin
portal proof user, and Auth users by default.

As of 2026-06-22, this verifier passed against protected Preview deployment
`https://outpost-preview.example.vercel.app`
and hosted Neon branch `outpost-request-proof-20260622104715`. Disposable proof
data was cleaned up by the verifier. This is hosted operator proof only, not a
real customer-observed handoff record.

The disposable owner proof email must use `@beta-proof.outpost.local`, and the
admin portal proof email, if overridden, must use
`@founder-proof.outpost.local`. Use `npm run beta:operator:request-fulfillment`
for real owner emails; this verifier is intentionally cleanup-safe proof data
only.

Set `OUTPOST_HOSTED_REQUEST_FULFILLMENT_RETAIN=1` only when debugging a failed
hosted proof. Retained proof data is not customer handoff evidence and should
be removed by deleting the dedicated Neon proof branch after inspection.

## Acme Fitness Handoff

For a disposable Acme Fitness handoff rehearsal, prefer the dedicated
dry-run gate first:

```bash
npm run acme:dry-run:onboarding
```

See `docs/setup/acme-dry-run-onboarding-handoff.md` for browser-smoke,
rollback-only, and support checklist details.

After the dry-run gate passes and the real customer handoff is approved:

1. Confirm the current Vercel Preview verifier is still green.
2. Send the owner the protected Preview URL and `/owner/sign-in` path.
3. Send the temporary password through a separate channel.
4. Have the owner complete seedless tenant bootstrap, manual source intake,
   answer review, and answer-derived staff task creation.
5. Have staff sign in or sign up through `/staff/sign-in` only after the owner
   has added the staff roster row.

Keep phone/email providers, invite delivery, notifications, billing, POS, and
member-ledger behavior blocked until their separate review gates are green.

## Generic Beta Owner Handoff Checklist

For the next operator-assisted beta gym, prefer generating the full preparation
bundle first. It writes a non-secret run sheet, customer-safe packet, and
manifest from the same inputs:

If you are preparing against a protected Vercel Preview, run the hosted wrapper
first so the owner sign-in entry point is checked before artifacts are written:

```bash
export OUTPOST_VERCEL_DEPLOYMENT_URL='https://<preview>.vercel.app'
export VERCEL_AUTOMATION_BYPASS_SECRET='<bypass secret>'
export OUTPOST_BETA_HANDOFF_GYM_NAME='Summit Strength'
export OUTPOST_BETA_HANDOFF_OWNER_EMAIL='owner@summitstrength.example'
export OUTPOST_BETA_HANDOFF_OWNER_NAME='Owner Name'
export OUTPOST_BETA_HANDOFF_OPERATOR_NAME='Outpost operator'
export OUTPOST_NEON_BRANCH_NAME='<dedicated hosted proof branch>'
export OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW='June beta proof window'
export OUTPOST_BETA_HANDOFF_BUNDLE_PATH='artifacts/beta-owner-handoff/summit-strength-bundle.json'
npm run hosted:owner-handoff:prepare
npm run beta:owner-handoff:inspect
```

Do not paste the Vercel bypass secret into packets, manifests, PRs, issue
comments, shell snippets, or chat. The hosted preparation command checks
`/owner/sign-in` and then delegates to the non-mutating bundle generator. It
does not create accounts, fulfill queued requests, record completion, validate
the final gate, import hosted proof, or mutate hosted data.

Run `npm run beta:owner-handoff:inspect` after preparation and before sharing
the packet. The inspector reads the bundle manifest, verifies the checklist and
packet artifacts exist, confirms customer-observed completion is still pending,
and confirms live-provider gates remain blocked.

```bash
export OUTPOST_BETA_HANDOFF_GYM_NAME='Summit Strength'
export OUTPOST_BETA_HANDOFF_OWNER_EMAIL='owner@summitstrength.example'
export OUTPOST_BETA_HANDOFF_OWNER_NAME='Owner Name'
export OUTPOST_BETA_HANDOFF_OPERATOR_NAME='Outpost operator'
export OUTPOST_BETA_HANDOFF_PREVIEW_URL='https://<preview>.vercel.app'
export OUTPOST_NEON_BRANCH_NAME='<dedicated hosted proof branch>'
export OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW='June beta proof window'
export OUTPOST_BETA_HANDOFF_BUNDLE_PATH='artifacts/beta-owner-handoff/summit-strength-bundle.json'
npm run beta:owner-handoff:bundle
```

The bundle command prepares artifacts only. It does not create accounts, fulfill
queued requests, record customer-observed completion, run the final gate, import
hosted proof, mutate hosted data, or enable live providers.

If you need to regenerate only the run sheet, use:

```bash
export OUTPOST_BETA_HANDOFF_GYM_NAME='Summit Strength'
export OUTPOST_BETA_HANDOFF_OWNER_EMAIL='owner@summitstrength.example'
export OUTPOST_BETA_HANDOFF_OWNER_NAME='Owner Name'
export OUTPOST_BETA_HANDOFF_OPERATOR_NAME='Outpost operator'
export OUTPOST_BETA_HANDOFF_PREVIEW_URL='https://<preview>.vercel.app'
export OUTPOST_NEON_BRANCH_NAME='<dedicated hosted proof branch>'
export OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW='June beta proof window'
export OUTPOST_BETA_HANDOFF_CHECKLIST_PATH='artifacts/beta-owner-handoff/summit-strength-checklist.md'
npm run beta:owner-handoff:checklist
```

The checklist generator writes Markdown only. It does not create accounts,
fulfill queued requests, record customer-observed completion, import hosted
proof, mutate hosted data, or enable live providers. It fails closed when
required inputs are missing, the Preview URL is not HTTPS, a repo-local output
path is outside ignored `artifacts/`, or rendered values look like passwords,
tokens, cookies, API keys, authorization headers, private keys, JWTs, bypass
secrets, signatures, or other credentials.

Use the generated checklist as the operator run sheet. A checklist or packet is
preparation only; do not record completion until a real external beta owner has
observed the protected Preview workflow.

## Generic Beta Owner Handoff Packet

For the next operator-assisted beta gym, generate a reusable customer-safe
packet before the handoff instead of relying on chat notes:

```bash
export OUTPOST_BETA_HANDOFF_GYM_NAME='Summit Strength'
export OUTPOST_BETA_HANDOFF_OWNER_EMAIL='owner@summitstrength.example'
export OUTPOST_BETA_HANDOFF_OWNER_NAME='Owner Name'
export OUTPOST_BETA_HANDOFF_OPERATOR_NAME='Outpost operator'
export OUTPOST_BETA_HANDOFF_PREVIEW_URL='https://<preview>.vercel.app'
export OUTPOST_NEON_BRANCH_NAME='<dedicated hosted proof branch>'
export OUTPOST_BETA_HANDOFF_SUPPORT_WINDOW='June beta proof window'
export OUTPOST_BETA_HANDOFF_PACKET_PATH='artifacts/beta-owner-handoff/summit-strength-packet.md'
npm run beta:owner-handoff:packet
```

The packet generator writes Markdown only. It does not create owner accounts,
send invites, record customer completion, mutate hosted data, or enable live
providers. It fails closed when required inputs are missing, the Preview URL is
not HTTPS, a repo-local output path is outside ignored `artifacts/`, or rendered
values look like passwords, tokens, cookies, API keys, authorization headers,
private keys, JWTs, bypass secrets, signatures, or other credentials.

Use the generated packet to confirm the protected Preview URL, owner sign-in
path, workspace setup, manual source to answer review to staff-task workflow,
expected tenant data, reset/rotate support steps, and explicit no-go gates.
Public self-signup, invite delivery, notifications, phone/email providers,
billing, POS, access control, and member-ledger writes remain blocked until
their separate gates are green.

After a real observed beta handoff completes without stop concerns, write a
non-secret completion record:

```bash
export OUTPOST_BETA_HANDOFF_PACKET_PATH='artifacts/beta-owner-handoff/summit-strength-packet.md'
export OUTPOST_BETA_HANDOFF_COMPLETION_PATH='artifacts/beta-owner-handoff/summit-strength-completion.json'
export OUTPOST_BETA_HANDOFF_SESSION_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export OUTPOST_BETA_HANDOFF_OBSERVER='Outpost operator'
export OUTPOST_BETA_HANDOFF_PARTICIPANT='Summit Strength owner'
export OUTPOST_BETA_HANDOFF_CONFIRMED_PREVIEW=1
export OUTPOST_BETA_HANDOFF_OWNER_SIGNIN=1
export OUTPOST_BETA_HANDOFF_OWNER_WORKSPACE=1
export OUTPOST_BETA_HANDOFF_FIRST_WORKFLOW=1
export OUTPOST_BETA_HANDOFF_RESET_REVIEWED=1
export OUTPOST_BETA_HANDOFF_LIVE_GATES_BLOCKED=1
export OUTPOST_BETA_HANDOFF_NO_UNEXPECTED_DATA=1
export OUTPOST_BETA_HANDOFF_STOP_CONCERNS=none
export OUTPOST_BETA_HANDOFF_CUSTOMER_OBSERVED=1
npm run beta:owner-handoff:complete
```

The completion recorder consumes the packet, re-checks that the packet says
operator-assisted beta and blocked live-provider state, requires every observed
confirmation above plus the explicit customer-observed attestation, and writes
JSON evidence under ignored `artifacts/`. It does not mutate hosted data or
prove public self-serve. If stop concerns are anything other than `none`, do
not write a green completion record; capture the concern separately and keep
the customer gate blocked.

After the packet and completion record exist, validate the final
customer-observed gate:

```bash
export OUTPOST_BETA_HANDOFF_PACKET_PATH='artifacts/beta-owner-handoff/summit-strength-packet.md'
export OUTPOST_BETA_HANDOFF_COMPLETION_PATH='artifacts/beta-owner-handoff/summit-strength-completion.json'
export OUTPOST_BETA_HANDOFF_GATE_PATH='artifacts/beta-owner-handoff/summit-strength-customer-observed-gate.json'
npm run beta:owner-handoff:gate
```

The gate verifier re-reads the packet and completion record together, rejects
internal dry-run participant labels, re-checks customer-observed completion,
blocked live-provider state, stop concerns of `none`, and all observed
confirmation fields, then writes a sanitized JSON gate artifact. This artifact
is the operator handoff gate to review before planning public self-serve,
invite delivery, live providers, billing, POS, access-control, or member-ledger
slices.

## Reset And Rotate

For repeatable hosted proof data:

1. Prefer a fresh Neon proof branch from `production` with
   `npm run hosted:proof-branch:prepare`.
2. Generate a new `OUTPOST_OWNER_BETA_PASSWORD` for each real beta handoff.
3. Remove old `/tmp/<branch>-seed-password` and temporary owner password files
   after proof evidence is recorded.
4. Delete spent proof branches unless they are intentionally retained for a
   short customer-support window.

Do not reuse `outpost-neon-spike`, Neon `production`, or an old proof branch
whose owner password has already been shared.
