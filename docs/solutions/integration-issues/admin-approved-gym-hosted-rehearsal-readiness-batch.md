---
title: Admin Approved Gym Hosted Rehearsal Readiness Batch
category: integration-issues
date: 2026-06-29
status: active
---

# Admin Approved Gym Hosted Rehearsal Readiness Batch

## Problem

After owner/staff handoff readiness, the next work should move toward a real
approved-gym end-to-end run. Jumping straight to customer-observed completion
would overclaim proof, while leaving the next steps only in chat would make the
operator path fragile.

## Solution

Add `admin_approved_gym_hosted_rehearsal_readiness_batch`. It consumes
`admin_owner_staff_handoff_readiness_batch`, verifies the parent SHA and
inspector, then writes one non-secret manifest showing the hosted rehearsal
command path is prepared while hosted proof, customer-observed walkthrough, and
first-gym go/no-go remain separate gates.

## Prevention

Keep rehearsal readiness, rehearsal evidence, customer-observed completion, and
first-gym go/no-go as separate artifact states. Do not record customer proof or
enable public/live-provider gates from a readiness artifact.
