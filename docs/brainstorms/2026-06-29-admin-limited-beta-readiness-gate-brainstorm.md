---
title: Admin Limited Beta Readiness Gate
date: 2026-06-29
status: complete
---

# Admin Limited Beta Readiness Gate

## Context

The current readiness chain prepares hosted customer-session import/proof, but the real owner-observed customer session has not happened yet. The next product step is limited operator-assisted onboarding for another approved gym, but that must remain blocked until customer-session proof exists.

## Decision

Add a terminal-only readiness gate that consumes `admin_customer_session_hosted_import_readiness`, chains its SHA-256 value, and packages the operator-managed limited beta prerequisites without allowing beta onboarding to start.

## Alternatives

- Reuse the older `admin_limited_beta_onboarding_packet`: rejected for this chain because it consumes an older customer-demo-gate artifact.
- Start next-gym onboarding now: rejected because hosted customer-session proof is not green.
- Build public self-serve: rejected because operator-assisted beta evidence is the next controlled step.

## Success Criteria

- The gate verifies hosted import readiness parent chain.
- Limited beta remains blocked without hosted customer-session proof.
- Operator-managed access remains the only allowed mode.
- `/admin` shows the gate in the current readiness chain.
- Tests prove happy path, fail-closed behavior, and UI/package wiring.
