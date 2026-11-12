---
title: Admin Owner Staff Handoff Readiness Batch
category: integration-issues
date: 2026-06-29
status: active
---

# Admin Owner Staff Handoff Readiness Batch

## Problem

After request intake, invite, and Auth dry-run gates were packaged, the next
work could have split into owner evidence, staff no-send evidence, hosted
rehearsal, customer-observed walkthrough, and launch gates. Splitting those only
in chat would make it easy to overstate customer proof or accidentally blur
no-send/no-create boundaries.

## Solution

Add `admin_owner_staff_handoff_readiness_batch`. It consumes
`admin_request_intake_invite_auth_readiness_batch`, verifies the parent SHA and
inspector, then writes one non-secret manifest showing:

- owner access fulfillment evidence is required and not recorded;
- staff no-send preflight is required and not recorded;
- approved-gym hosted rehearsal is pending;
- customer-observed handoff is not recorded;
- public self-serve, invite delivery, providers, notifications, Auth admin
  product APIs, automatic grants, billing, POS, access-control, and
  member-ledger writes remain blocked.

## Prevention

Future proof batches should keep evidence-readiness separate from evidence
completion. A batch can make the next actions repeatable, but it must not claim
customer-observed or hosted proof until an artifact records that proof and an
inspector verifies it.
