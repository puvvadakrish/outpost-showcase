---
title: Acme Fitness Dry-Run Onboarding Handoff
date: 2026-06-21
status: active
---

# Acme Fitness Dry-Run Onboarding Handoff

Use this runbook after the protected Vercel Preview, hosted Neon readiness, and
operator owner-access gates are green. It proves the Acme Fitness handoff
shape with disposable hosted data before a real customer touches the Preview.

## What This Proves

- A throwaway owner is provisioned through the operator-managed owner access
  path.
- The owner can sign in through hosted Neon Auth and verify only their own beta
  access grant.
- The owner can bootstrap a Acme Fitness dry-run tenant through the seedless
  owner path.
- The owner can save manual source facts, stage answer proposals, create one
  answer-derived staff task, and render `/owner` on the protected Preview.
- The support reset path can remove the dry-run tenant, owner beta grant, app
  user, and Neon Auth user without touching the seeded Acme Fitness tenant.
- Live-provider gates remain blocked.

## What This Does Not Prove

- Real Acme Fitness onboarding.
- Public self-signup.
- Invite email delivery, password reset delivery, notification delivery, Retell,
  Resend, Gmail, provider webhooks, automated replies, phone/email providers,
  billing, POS, payment processing, access control, or member-ledger writes.

## Current Operator State

The internal protected-Preview handoff proof is complete, but the real
Acme Fitness owner-observed handoff remains pending until the owner or staff
observer is actually available. `/owner` includes a Acme Fitness handoff
ledger that keeps those states separate: internal operator dry run is marked
done, customer packet and observed session remain pending, and live-provider
productization remains blocked.

It is safe to pause here. When the owner is available, generate a fresh
retained dry run, browser proof, rollback evidence, and customer-safe packet
before the call instead of reusing stale proof artifacts.

## Inputs

Start from the same dedicated hosted Neon proof branch and protected Vercel
Preview used by `npm run vercel:preview:verify`:

```bash
export NEON_API_KEY='<rotated Neon API key>'
export OUTPOST_NEON_PROJECT_ID='outpost-test-project'
export OUTPOST_NEON_BRANCH_NAME='<dedicated hosted proof branch>'
export NEXT_PUBLIC_NEON_AUTH_URL='https://<branch-auth-host>/neondb/auth'
export NEXT_PUBLIC_NEON_DATA_API_URL='https://<branch-api-host>/neondb/rest/v1'
export OUTPOST_NEON_SEED_PASSWORD="$(cat /tmp/<branch>-seed-password)"
export NEXT_PUBLIC_OUTPOST_APP_URL='https://<preview>.vercel.app'
export OUTPOST_USE_VERCEL_CURL=1
# Required only for raw fetch mode or automation outside an authenticated
# Vercel CLI session against a deployment-protected Preview.
export VERCEL_AUTOMATION_BYPASS_SECRET='<Vercel protection bypass secret>'
```

Use a throwaway owner address. By default, the verifier refuses
`owner-acme@example.com` and refuses non-dry-run addresses:

```bash
export OUTPOST_OWNER_BETA_EMAIL='acme+dry-run-001@owner.outpost.local'
export OUTPOST_OWNER_BETA_NAME='Acme Fitness Dry Run Owner'
export OUTPOST_OWNER_BETA_PASSWORD='<temporary proof password, not the seed password>'
export OUTPOST_OWNER_BETA_NOTE='Acme Fitness dry-run onboarding handoff'
export OUTPOST_ACME_DRY_RUN_ID='acme_dry_run_001'
export OUTPOST_ACME_DRY_RUN_EVIDENCE_PATH="artifacts/acme-dry-run/${OUTPOST_ACME_DRY_RUN_ID}.json"
```

## Run With Automatic Rollback

```bash
npm run acme:dry-run:onboarding
```

The command runs hosted readiness, provisions owner access, signs in as the
throwaway owner, bootstraps a dry-run tenant, runs manual source to answer review
to staff-task proof, smokes `/owner` through the protected Preview, checks live
providers remain blocked, and then removes the dry-run rows.

When `OUTPOST_ACME_DRY_RUN_EVIDENCE_PATH` is set, the verifier writes a
non-secret JSON summary with the Preview URL, Neon proof branch, dry-run owner
email, tenant id/name, checks completed, live-provider gate status, and rollback
status. Do not put passwords, Neon API keys, JWTs, cookies, or Vercel bypass
secrets into the evidence file or its filename.

## Run For Browser Smoke

Use this only when you need a user-like browser pass with the Chrome Codex
extension before cleanup:

```bash
export OUTPOST_ACME_DRY_RUN_KEEP_DATA=1
export OUTPOST_ACME_DRY_RUN_EVIDENCE_PATH="artifacts/acme-dry-run/${OUTPOST_ACME_DRY_RUN_ID}-retained.json"
npm run acme:dry-run:onboarding
```

Then use Chrome with the Chrome Codex extension to sign in at:

```text
<NEXT_PUBLIC_OUTPOST_APP_URL>/owner/sign-in
```

Expected browser checks:

- The protected Preview unlocks correctly.
- The throwaway owner can sign in.
- `/owner` renders the dry-run tenant name.
- Manual source, answer review, and staff task proof rows are visible.
- The UI still communicates that hosted proof must stay current and live
  providers are blocked.

After browser smoke, run the rollback command printed by the verifier.

## Run Automated Browser Handoff Smoke

Use this when the active desktop Chrome/Codex-extension bridge is unavailable
or too dependent on the current window state:

```bash
export VERCEL_AUTOMATION_BYPASS_SECRET='<Vercel protection bypass secret>'
npm run acme:browser:handoff
```

The command creates retained dry-run data through
`npm run acme:dry-run:onboarding`, launches an isolated Chrome profile with
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
by Neon Auth, and set `OUTPOST_ACME_BROWSER_APP_URL` to the local browser target
such as `http://127.0.0.1:3010`.

## Prepare The Customer Handoff Packet

After retained dry-run setup, browser proof, and rollback-only cleanup have all
written non-secret evidence, generate the operator packet for the real Acme Fitness session:

```bash
export OUTPOST_ACME_RETAINED_EVIDENCE_PATH="artifacts/acme-dry-run/${OUTPOST_ACME_DRY_RUN_ID}-retained.json"
export OUTPOST_ACME_BROWSER_EVIDENCE_PATH="artifacts/acme-browser-handoff/${OUTPOST_ACME_DRY_RUN_ID}-browser.json"
export OUTPOST_ACME_ROLLBACK_EVIDENCE_PATH="artifacts/acme-dry-run/${OUTPOST_ACME_DRY_RUN_ID}-rollback.json"
export OUTPOST_ACME_CUSTOMER_PACKET_PATH="artifacts/acme-customer-handoff/${OUTPOST_ACME_DRY_RUN_ID}-packet.md"
npm run acme:customer-handoff:packet
```

The packet generator validates that all three evidence files refer to the same
dry-run owner, run id, tenant id/name, and blocked live-provider state. It fails
closed when rollback evidence is missing or when evidence contains
secret-shaped keys or rendered values such as password, token, cookie, API key,
authorization, credential, private key, JWT, bypass, signature, or secret. The
generated Markdown is an operator/customer-session aid; it is not product state
and should stay under ignored `artifacts/` or another customer-safe support
folder.

Use the packet to run the real customer-observed Acme Fitness handoff:

- Confirm the protected Preview URL.
- Explain that Outpost is still in owner-approved, staff-task-only beta mode.
- Walk through owner sign-in and owner workspace orientation.
- Show manual source facts, answer review, and the staff task handoff path.
- Confirm no phone/email automation, invite delivery, notifications, billing,
  POS, access control, or member-ledger writes are enabled.
- Stop the handoff if the customer sees unexpected tenant data, live-provider
  claims, or account access behavior.

## Record The Customer-Observed Completion Record

After the customer-observed handoff finishes without stop concerns, write the
final non-secret completion record:

```bash
export OUTPOST_ACME_CUSTOMER_PACKET_PATH="artifacts/acme-customer-handoff/${OUTPOST_ACME_DRY_RUN_ID}-packet.md"
export OUTPOST_ACME_CUSTOMER_COMPLETION_PATH="artifacts/acme-customer-handoff/${OUTPOST_ACME_DRY_RUN_ID}-customer-observed-completion.json"
export OUTPOST_ACME_CUSTOMER_SESSION_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export OUTPOST_ACME_CUSTOMER_OBSERVER='Outpost operator'
export OUTPOST_ACME_CUSTOMER_PARTICIPANT='Acme Fitness owner or staff observer'
export OUTPOST_ACME_CUSTOMER_CONFIRMED_PREVIEW=1
export OUTPOST_ACME_CUSTOMER_OWNER_SIGNIN=1
export OUTPOST_ACME_CUSTOMER_OWNER_WORKSPACE=1
export OUTPOST_ACME_CUSTOMER_STAFF_HANDOFF=1
export OUTPOST_ACME_CUSTOMER_RESET_REVIEWED=1
export OUTPOST_ACME_CUSTOMER_LIVE_GATES_BLOCKED=1
export OUTPOST_ACME_CUSTOMER_NO_UNEXPECTED_DATA=1
export OUTPOST_ACME_CUSTOMER_STOP_CONCERNS=none
npm run acme:customer-handoff:complete
```

The completion recorder reads the generated packet, re-checks the packet's
recorded blocked live-provider state and rollback-only cleanup, requires every
observed-session checkpoint above, and writes JSON evidence under ignored
`artifacts/`. It fails closed when the packet targets the seeded tenant, when
any live-provider gate is not blocked, when stop concerns are not exactly
`none`, when output would be written to a tracked repo path, or when
packet/session values contain secret-shaped content.

Do not use the completion record to claim self-serve onboarding. It only proves
that the operator-run protected Preview handoff was observed by Acme Fitness
without a stop concern. If the output path is outside this repo, the operator is
responsible for keeping that support folder private and out of source control.

## Rollback Only

If a dry run is interrupted after bootstrap, set the tenant id printed by the
verifier and the dry-run owner email:

```bash
OUTPOST_ACME_DRY_RUN_ROLLBACK_ONLY=1 \
OUTPOST_ACME_DRY_RUN_TENANT_ID='<tenant id printed by verifier>' \
OUTPOST_ACME_DRY_RUN_OWNER_EMAIL='acme+dry-run-001@owner.outpost.local' \
OUTPOST_ACME_DRY_RUN_EVIDENCE_PATH="artifacts/acme-dry-run/${OUTPOST_ACME_DRY_RUN_ID}-rollback.json" \
npm run acme:dry-run:onboarding
```

The rollback refuses to remove `tenant_acme_fitness` and refuses tenant names
that do not start with `Acme Fitness Dry Run`. It deletes tenant-owned rows in
dependency order, then removes the throwaway app user, beta grant, and Neon Auth
user only when the provided email is the active owner of that dry-run tenant and
has no other tenant memberships.

## Support Checklist

- Record the Vercel Preview URL, Neon branch name, dry-run owner email, dry-run
  tenant id, verifier output, evidence JSON path, and browser-smoke notes.
- Keep evidence artifacts in a customer-safe support folder. The files should
  contain only non-secret proof metadata and should be deleted with other
  temporary proof artifacts when the handoff branch is retired.
- If owner sign-in fails, do not create a live provider or send an invite. Rotate
  the temporary owner password or use a fresh dry-run owner email.
- If bootstrap fails, confirm the beta access grant is active and the owner email
  matches the Neon Auth JWT email claim.
- If the verifier fails after bootstrap, the default mode attempts rollback
  before exiting. If rollback also fails, use the printed tenant id and run the
  rollback-only command after inspecting the guard failure.
- If rollback fails, stop and inspect the exact tenant id/name guard failure
  before making manual SQL changes.
- Delete temporary password files and shell history snippets that contain proof
  passwords after evidence is captured.

## No-Go Gates

Do not hand the real Acme Fitness owner the Preview until:

- `npm run acme:dry-run:onboarding` passes with rollback.
- A retained-data browser smoke or `npm run acme:browser:handoff` passes against
  the protected Preview with `VERCEL_AUTOMATION_BYPASS_SECRET`, and
  rollback-only cleanup passes.
- `npm run typecheck`, `npm test`, and `npm run build` pass on the branch.
- Claude Code Opus review has no unresolved tenant-safety or live-provider
  findings.
- `npm run acme:customer-handoff:packet` produces a customer-safe packet from
  retained dry-run, browser proof, and rollback evidence.
- `npm run acme:customer-handoff:complete` produces a customer-observed
  completion record after the real handoff finishes with every checklist gate
  explicitly confirmed.

Do not enable phone/email providers, invite delivery, notification sending,
billing, POS, access control, or member-ledger writes until the real customer
handoff gate is green and separately reviewed.
