---
title: Admin public request limited beta readiness batch
date: 2026-07-01
type: brainstorm
---

# Admin Public Request Limited Beta Readiness Batch

## What We're Building

Continue the public-request current-chain runway after the first-gym operator
run record. Add public-request-specific limited beta review and public
self-serve launch preflight artifacts so the next readiness state no longer
falls back to the older approved-gym artifact lane.

## Why This Approach

The prior batch made the first-gym go/no-go bundle and operator-run evidence
explicit for the public-request chain. The next batch should extend that same
lineage instead of reusing `admin_first_gym_operator_run_record`, because the
operator needs a single readable chain from public request to first-gym run to
limited beta review.

## Key Decisions

- Add new public-request artifact kinds rather than mutating old approved-gym
  artifacts.
- Keep all artifacts terminal-only and under ignored `artifacts/`.
- Rerun parent inspectors before trusting parent JSON or SHA values.
- Keep public self-serve, browser approvals, invites, product Auth admin APIs,
  providers, notifications, billing, POS, access control, and member-ledger
  writes blocked.
- Update the Admin portal runway so the operator sees the current-chain commands
  directly.
- Record post-merge implementation notes in `AGENTS.md` going forward so the
  project history explains both what changed and why.

## Scope

- Public-request limited beta review prepare/inspect scripts.
- Public-request public self-serve launch preflight prepare/inspect scripts.
- Package scripts, Admin portal/domain cards, focused tests, and durable docs.
- Compound solution doc for the last completed batch's tooling/test lessons.

## Out Of Scope

- Public owner self-signup.
- Public request form submission.
- Browser approval buttons.
- Invite delivery or magic links.
- Product Auth admin APIs.
- Phone/email providers, notification sending, billing, POS, access control, or
  member-ledger writes.
- Hosted data mutations beyond existing proof lanes.

## Success Criteria

- The new limited beta review consumes
  `admin_public_request_first_gym_operator_run_record`.
- The new public self-serve preflight consumes the new public-request limited
  beta review.
- Inspectors reject tampered parent SHAs, unsafe gates, secret-shaped values,
  and mismatched artifact kinds.
- `/admin` shows the new current-chain commands without adding write buttons.
- Typecheck, tests, build, browser smoke, and Opus review are clean before
  merge.
