---
title: Admin Post Customer Proof Readiness Batch
category: integration-issues
date: 2026-06-29
status: active
---

# Admin Post Customer Proof Readiness Batch

## Problem

The current readiness lane needed a bridge after
`admin_limited_beta_readiness_gate`. Older limited-beta onboarding and
public-self-serve artifacts existed, but they belonged to an older
customer-demo-gate lineage. Reusing them directly would make it unclear whether
hosted customer-session proof had actually happened.

## Solution

Add `admin_post_customer_proof_readiness_batch`. The prepare script consumes the
limited beta readiness gate and a real customer-observed session record, runs
both existing parent inspectors, requires
`OUTPOST_ADMIN_POST_CUSTOMER_PROOF_HOSTED_PROOF_OBSERVED=yes`, rejects internal
or dry-run participant labels, and writes one non-secret batch artifact. The
inspect script revalidates both parent SHA-256 values and blocked gates.

## Prevention

Keep post-proof readiness as its own executable bridge whenever the parent proof
lane changes. Do not repoint historical readiness commands without a bridge
artifact that names the evidence basis and preserves no-live-provider gates.
