---
title: Beta Dry-Run Onboarding Harness Brainstorm
date: 2026-06-21
status: captured
---

# Beta Dry-Run Onboarding Harness Brainstorm

## What We're Building

Add a generic hosted beta dry-run onboarding harness for any operator-assisted
gym. It should reuse the proven Acme Fitness dry-run shape: hosted readiness,
operator-provisioned owner access, disposable tenant bootstrap, manual source to
answer review to staff task proof, protected Preview route smoke, blocked
live-provider check, non-secret evidence, and guarded rollback.

## Why This Approach

The current dry-run proof is reliable but Acme Fitness-specific. The generic
packet and completion commands now support any beta gym, so the missing proof
step is a reusable dry-run harness that produces evidence those commands can
feed. Keeping this as a CLI/operator tool avoids adding product support state
or claiming self-serve readiness.

## Key Decisions

- Add `npm run beta:dry-run:onboarding` rather than generalizing public product
  UI.
- Use explicit `OUTPOST_BETA_DRY_RUN_*` env names for gym, run id, tenant name,
  owner email, evidence path, keep-data, and rollback-only mode.
- Keep hosted readiness and operator owner access as mandatory upstream gates.
- Keep rollback limited to disposable tenants whose names include `Dry Run`,
  never seeded tenants or shared users.
- Write only non-secret evidence under ignored `artifacts/` when requested.
- Preserve no-live-provider gates.

## Rejected Approaches

- Reuse the ACME command for every gym. It has correct ACME-specific safety
  checks and packet assumptions, but it should not become the generic contract.
- Add database support records now. That would widen support-access scope before
  the dry-run harness is proven reusable.
- Treat a successful dry run as customer-observed completion. It only proves an
  operator-controlled rehearsal.

## Success Criteria

- A generic command exists and is documented.
- Static tests prove it runs hosted readiness before owner access, exercises
  the first-run owner workflow, writes non-secret evidence, and rolls back
  guarded disposable tenant data.
- Durable docs record that this is operator dry-run proof, not self-serve or
  live-provider readiness.

## Open Questions

None for this slice.
