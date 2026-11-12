---
title: Admin Limited Beta Readiness Gate
category: integration-issues
date: 2026-06-29
status: active
---

# Admin Limited Beta Readiness Gate

## Problem

The repo already had an older limited beta onboarding packet, but it belongs to the older customer-demo-gate evidence lineage. The current readiness chain now flows through customer handoff scheduling, customer handoff gate preflight, and hosted customer-session import readiness.

Using the older packet directly would blur proof lineage and make it unclear that hosted customer-session proof is still required.

## Solution

Add `admin_limited_beta_readiness_gate` as a bridge artifact after `admin_customer_session_hosted_import_readiness`. It prepares next-gym operator-managed beta prerequisites while keeping limited beta onboarding blocked until hosted customer-session proof exists.

The gate records:

- `customer_session_proof_required: true`
- `limited_beta_onboarding_allowed_without_customer_proof: false`
- `operator_managed_access_only: true`
- no-live-provider, no-public-self-serve, no-invite-delivery gates

## Prevention

When a newer readiness lane supersedes an older artifact lineage, add a bridge artifact instead of repointing historical commands. Keep parent SHA verification and blocked gates explicit in both prepare and inspect paths.
