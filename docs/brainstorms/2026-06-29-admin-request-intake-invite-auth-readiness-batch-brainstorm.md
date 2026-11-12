---
title: Admin Request Intake Invite/Auth Readiness Batch
date: 2026-06-29
status: captured
---

# Admin Request Intake Invite/Auth Readiness Batch

## Context

The approved beta expansion batch now identifies one real non-House-of-Fitness
gym as ready for operator-managed beta progression. The next readiness work
should not stop at two isolated slices; it should package the co-dependent
request intake, invite, and Auth admin dry-run gates together so the next
operator path is repeatable without chat memory.

## Decision

Add one current-lineage artifact that consumes
`admin_approved_beta_expansion_readiness_batch` and records the next batch as:

- operator-managed approved gym fulfillment readiness;
- public request intake as request-only and review-only;
- invite delivery as reviewed no-send preflight;
- Auth admin provisioning as no-create dry-run;
- live-provider, revenue, POS, access-control, and member-ledger gates blocked.

## Boundaries

This batch does not create public owner self-signup, browser approval buttons,
automatic approval, invite delivery, notification sending, phone/email provider
activation, product Auth admin APIs, Auth users, automatic owner/staff grants,
billing, POS, access-control, or member-ledger writes.

## Success Criteria

- A prepare command writes a non-secret JSON artifact under `artifacts/`.
- An inspect command revalidates parent SHA and re-runs the approved expansion
  inspector.
- The Admin portal shows the batch and its larger next-batch set.
- Tests cover happy path, unsafe labels, SHA tamper, and Admin/package exposure.
