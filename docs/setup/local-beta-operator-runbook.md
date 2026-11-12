---
title: Local Beta Operator Runbook
date: 2026-06-17
status: active
---

# Local Beta Operator Runbook

Use this runbook to rehearse the current Outpost Neon Auth/Data API verifier and
the hosted owner/staff beta workflow on a Neon branch. This is hosted-backend
workflow proof; live phone/email providers remain off until a later provider
gate is complete.

## What This Proves

- Seeded Acme Fitness and Peak CrossFit owners can authenticate through
  Neon Auth.
- Seed rows can be applied with the real Neon Auth ids for those users.
- Tenant RLS read isolation hides Peak CrossFit rows from the Acme Fitness
  owner and Acme Fitness rows from the Peak CrossFit owner.
- One Acme Fitness draft answer edit runs through the Neon Data API RPC path
  and writes revision plus audit rows.
- A cross-tenant answer edit attempt is denied.
- On the hosted beta workflow path, an owner can create a staff roster member,
  that staff user can claim the roster through Neon Auth, manual source facts can
  become answer-review rows, an answer-review row can create a staff task, and
  the staff user can see, assign, note, and complete that task.
- `/owner` and `/staff/tasks` can render the current hosted workflow rows through
  the running Next app using Neon Auth session cookies.

## What This Does Not Prove

- Live-provider tenant isolation.
- Vercel preview auth/RLS behavior.
- Retell, Resend, Gmail, provider webhook, or invite-email delivery.
- Live phone calls, live email ingestion, or outbound automated replies.
- Billing, POS, payment processing, member-ledger writes, or Club OS
  replacement.

## Preconditions

1. Use this repo from a clean local branch.
2. Create or reset a Neon branch dedicated to proof.
3. Export `NEXT_PUBLIC_NEON_AUTH_URL` and `NEXT_PUBLIC_NEON_DATA_API_URL` for
   that branch.
4. Use Neon Auth/Data API public endpoints only. Do not use service-role,
   `sb_secret_...`, or direct live-provider credentials.
5. Run the verifier sequence after the Neon branch is clean.

## Operator Sequence

First verify the Neon Auth/Data API branch and the local wrapper boundaries:

```bash
npm run neon:spike:readiness
NEXT_PUBLIC_NEON_AUTH_URL=<Neon Auth URL> NEXT_PUBLIC_NEON_DATA_API_URL=<Neon Data API URL> npm run beta:rehearsal:local
NEXT_PUBLIC_NEON_AUTH_URL=<Neon Auth URL> NEXT_PUBLIC_NEON_DATA_API_URL=<Neon Data API URL> npm run staff:claim:rehearsal:local
```

The two rehearsal commands currently delegate to the same Neon Auth/Data API
verifier.

Then build and start the app against the same hosted Neon branch:

```bash
npm run build
OUTPOST_NEON_PROJECT_ID=<project> OUTPOST_NEON_BRANCH_NAME=<branch> NEXT_PUBLIC_NEON_AUTH_URL=<Neon Auth URL> NEXT_PUBLIC_NEON_DATA_API_URL=<Neon Data API URL> NEXT_PUBLIC_OUTPOST_APP_URL=http://localhost:3102 npx next start -p 3102
```

In a second terminal, run the hosted owner/staff workflow verifier against that
running app:

```bash
OUTPOST_NEON_PROJECT_ID=<project> OUTPOST_NEON_BRANCH_NAME=<branch> NEXT_PUBLIC_NEON_AUTH_URL=<Neon Auth URL> NEXT_PUBLIC_NEON_DATA_API_URL=<Neon Data API URL> NEXT_PUBLIC_OUTPOST_APP_URL=http://localhost:3102 OUTPOST_NEON_SEED_PASSWORD=<rotated password> npm run hosted:beta-workflow
```

The hosted beta workflow command is the full owner source-to-staff and staff
claim rehearsal. It fails closed unless the app server at
`NEXT_PUBLIC_OUTPOST_APP_URL` is reachable before it mutates workflow state.

Inspect the same running app:

- `/owner`: beta readiness checklist, local runbook path, source/answer/task
  proof, and blocked hosted/live gates.
- `/staff/tasks`: staff workboard, task provenance, filters, activity timeline,
  and completed local proof state.
- `/staff/sign-in`: manual roster-claim copy still says no invite email and no
  live provider delivery.

## Browser Smoke Checklist

- Owner page shows Neon branch verifier status, not live-provider readiness.
- Owner readiness gates still include disconnected phone/email providers.
- The owner rehearsal command, staff claim rehearsal command, and hosted beta
  workflow command are visible with clear local-vs-hosted proof boundaries.
- Staff workboard is usable on desktop and mobile without horizontal scrolling.
- No copy suggests Retell, Resend/Gmail, invite email, provider delivery,
  billing, POS, or member-ledger behavior is live.

## Reset After Rehearsal

Reset or recreate the Neon proof branch after recording proof or screenshots so
the next agent starts from seed state.

## Go/No-Go

Go for hosted workflow rehearsal when `npm run hosted:beta-workflow` passes on a
dedicated Neon branch with a rotated seed password. Do not invite a real gym
user, connect live providers, or claim live-channel readiness until Vercel
preview deployment proof and live-provider gate review have passed.

After this local hosted workflow passes, use
`docs/setup/vercel-neon-preview-proof.md` to prove the same workflow through a
deployed Vercel Preview URL before any real beta handoff.
