---
date: 2026-06-21
topic: vercel-neon-preview-hardening
---

# Vercel Neon Preview Hardening Brainstorm

## What We're Building

Add a repeatable deployment proof path for Outpost's Vercel Preview app wired to
a dedicated hosted Neon Auth/Data API proof branch. This is the next gate after
the hosted Neon owner/staff workflow proof: the same owner/staff beta workflow
must run through a deployed Vercel Preview URL, not only a local `next start`
server.

The proof should stay operational and narrow. It should verify that the Vercel
project is linked, the preview deployment points at the intended Neon branch,
the deployed app derives the correct public origin, protected preview routes can
be smoke-tested by automation, and proof data can be reset by creating a fresh
Neon branch with a rotated seed password.

## Why This Approach

The next risk is deployment wiring, not new product behavior. A hardening harness
keeps the current no-live-provider boundary while moving the hosted proof from
local browser smoke to an actual Vercel Preview deployment. Vercel Preview
environment variables can be scoped by environment or branch, and the CLI can
deploy with explicit runtime/build-time env, so the first proof does not need to
promote production or change live domains.

The app also should not require a hard-coded preview URL before deployment. On
Vercel, the final deployment hostname is known only after deployment, so the
server-side Neon Auth origin should derive from `VERCEL_URL` when
`NEXT_PUBLIC_OUTPOST_APP_URL` is unset. Local proof keeps the explicit localhost
path; deployed proof uses the Vercel-provided origin.

## Key Decisions

- Prove Vercel Preview only; do not promote production.
- Keep Vercel deployment protection enabled. Automation may use Vercel's
  protection-bypass mechanism or `vercel curl`, but the deployment should not be
  made broadly public just to run smoke checks.
- Use a fresh non-spike Neon proof branch and rotated seed password for each
  promotion proof run.
- Verify the deployment by reusing the hosted beta workflow, with
  `NEXT_PUBLIC_OUTPOST_APP_URL` set to the deployed preview URL.
- Preserve no-live-provider gates: no Retell, Resend, Gmail, provider ingress,
  notifications, billing, POS, or member-ledger writes.

## Explicit Non-Goals

- No live provider setup.
- No invite email delivery.
- No production Vercel promotion.
- No billing, POS, payment, member ledger, access control, or Club OS behavior.
- No claim that a real gym user can be invited until Vercel preview proof and
  reset/rotation procedure both pass.

## Success Criteria

- A branch-safe script can prepare a fresh hosted Neon proof branch and write a
  rotated seed password outside the repo.
- The app derives `https://${VERCEL_URL}` on Vercel when no explicit app URL is
  configured.
- A Vercel preview verifier confirms a deployed preview URL is ready, then runs
  the hosted owner/staff beta workflow against that URL.
- Docs record the Vercel Preview proof sequence and the reset/rotate procedure.
- Tests cover fail-closed guardrails and no-live-provider boundaries.
