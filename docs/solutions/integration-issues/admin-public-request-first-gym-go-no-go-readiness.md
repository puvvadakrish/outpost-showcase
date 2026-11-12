# Admin Public Request First-Gym Go/No-Go Readiness

Date: 2026-06-30

## Context

The current public request chain can prepare hosted rehearsal readiness, while
the existing first-gym go/no-go bundle correctly requires recorded hosted
rehearsal evidence and a real customer-observed session.

## Solution

Add `admin_public_request_first_gym_go_no_go_readiness_batch` as a bridge that
consumes `admin_public_request_hosted_rehearsal_readiness_batch`. It records
only that real evidence is still required and keeps the actual go/no-go bundle,
first-gym run approval, public launch, invite delivery, Auth creation,
providers, billing, POS, access control, and member-ledger writes blocked.

## Durable Learning

When the next existing command is intentionally evidence-consuming, add a
pre-evidence readiness bridge rather than weakening the existing command. That
keeps the operator path visible without forging proof.
