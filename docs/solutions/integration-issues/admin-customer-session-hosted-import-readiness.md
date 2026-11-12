---
title: Admin Customer Session Hosted Import Readiness
category: integration-issues
date: 2026-06-29
status: active
---

# Admin Customer Session Hosted Import Readiness

## Problem

The Admin readiness lane could prepare a real customer-observed handoff, and the repo already had hosted customer-session import/proof commands. The missing step was a durable bridge that explains when those hosted commands are allowed.

Without that bridge, future operators could either skip the hosted import proof or accidentally imply customer proof before the real owner-observed session exists.

## Solution

Add `admin_customer_session_hosted_import_readiness` as a terminal-only artifact. It consumes `admin_customer_handoff_gate_preflight`, verifies the parent through the preflight inspector, and emits the required record, inspect, hosted import, and hosted proof sequence.

The artifact explicitly sets:

- `customer_session_record_required: true`
- `hosted_customer_session_import_allowed_without_record: false`
- `hosted_customer_session_proof_allowed_without_record: false`
- customer completion and handoff claim flags to `false`

## Prevention

When a readiness lane depends on an external human event, add a bridge artifact that prepares the next proof step but keeps the impossible event false. Do not let downstream hosted proof scripts become the first place operators discover that a real customer record is missing.
