---
title: "Admin portal proof loop and worktree merge hygiene"
category: integration-issues
status: documented
date: 2026-06-22
components:
  - admin portal
  - beta owner handoff
  - hosted Neon proof
  - GitHub PR merge
  - Codex worktrees
related_files:
  - AGENTS.md
  - PLOT.md
  - DESIGN.md
  - src/components/founder-admin/FounderAdminReadinessConsole.tsx
  - src/domain/founder-admin-readiness.ts
  - tests/founder-admin-readiness-console.test.ts
---

# Admin Portal Proof Loop And Worktree Merge Hygiene

## Problem

The beta onboarding work touched several integration boundaries at once:
hosted Neon proof state, protected Vercel Preview proof, operator-generated
handoff packets, customer-observed completion gates, Chrome browser smoke, and
GitHub PR landing. Without a repeatable pattern, the team could accidentally
claim customer readiness from internal proof, expose write controls in the
Admin portal, or get blocked by stale local worktrees during PR merge.

One concrete merge symptom was `gh pr merge` completing the remote merge but
failing the local checkout/update step because another worktree still had
`main` checked out.

## Root Cause

The core product risk was mixing three separate states:

- Internal proof: local tests, hosted verifier records, and browser smoke.
- Operator readiness: whether a beta owner request has a safe handoff packet,
  receipt, sign-in, bootstrap, and rollback path.
- Customer-observed completion: a real external owner has seen the protected
  Preview flow and no stop condition appeared.

The local Git issue came from Git's normal worktree safety rule: one branch
cannot be checked out in multiple worktrees at the same time. A stale Codex
worktree with `main` checked out can therefore block local checkout even when
the remote PR merge succeeds.

## Solution

Keep the Admin portal as a read-only, derived operator surface:

- Product-facing copy says "Admin portal"; internal `founder_admin` role,
  RPC, script, and compatibility route names can remain until a deliberate
  breaking migration is worth the churn.
- Handoff status is derived from existing request, receipt, proof, owner
  readiness, and rollback projections.
- The browser never gets approve, fulfill, invite, reset, provider, billing,
  POS, access-control, or member-ledger write controls.
- Customer-observed completion stays a separate gate from internal proof.
- Durable status belongs in `AGENTS.md`, `PLOT.md`, slice brainstorms, and
  slice plans rather than chat memory.

Before merging PRs from Codex worktrees:

1. Run `git worktree list`.
2. If another worktree has `main` checked out, inspect it with
   `git -C <path> status --short`.
3. If it is clean and stale, remove it with `git worktree remove <path>`.
4. Merge the PR, then confirm local `main` fast-forwarded with
   `git status --short --branch` and `git log -1 --oneline`.

For sensitive Admin portal slices:

1. Use the Compound Engineering loop: brainstorm, plan, implement, review.
2. Run typecheck, tests, and build.
3. Smoke the relevant route in Chrome/Codex extension.
4. Use Claude Code Opus 4.8 review when available.
5. Record exactly what was proven locally, what was proven hosted, and what
   remains unproven.

## Prevention

- Treat no-live-provider gates as product requirements, not comments. Tests and
  copy should continue to assert that invite delivery, phone/email providers,
  billing, POS, access control, and member-ledger writes remain blocked until
  explicitly proven.
- Prefer derived domain projections for operator readiness. Pure functions are
  easier to test for secret exposure, blocked states, and customer-proof
  wording than browser-side imperative flows.
- Add tests for archived/blocked states whenever a new timeline or readiness
  projection is introduced.
- Do not call a workflow customer-observed unless a real external customer or
  owner observed it. Internal browser smoke can make a packet ready, but it
  cannot complete that final gate.

## Verification Pattern

Use this checklist for future beta onboarding support slices:

- `npm run typecheck`
- `npm test`
- `npm run build`
- Chrome/Codex-extension smoke for the affected route
- Claude Code Opus review for Admin portal, proof, tenant, or support-access
  changes
- `git worktree list` before merge if a previous PR had local checkout trouble

## Cross-References

- `docs/solutions/ui-bugs/staff-task-activity-state-reconciliation.md`
- `docs/brainstorms/2026-06-22-admin-owner-onboarding-timeline-brainstorm.md`
- `docs/plans/2026-06-22-feat-admin-owner-onboarding-timeline-plan.md`
- `docs/brainstorms/2026-06-22-admin-portal-rebrand-brainstorm.md`
- `docs/plans/2026-06-22-refactor-admin-portal-rebrand-plan.md`
