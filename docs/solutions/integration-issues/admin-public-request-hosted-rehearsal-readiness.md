# Admin Public Request Hosted Rehearsal Readiness

Date: 2026-06-30

## Context

The current public request chain reached owner/staff handoff readiness, but the
next hosted rehearsal artifact still existed only on the older approved-gym
proof chain.

## Solution

Add `admin_public_request_hosted_rehearsal_readiness_batch` as a narrow bridge
from `admin_public_request_owner_staff_handoff_readiness_batch`. It records
only browser-rehearsal prerequisites and keeps hosted proof, customer-observed
handoff, first-gym go/no-go, public launch, invite delivery, Auth creation,
providers, billing, POS, access control, and member-ledger writes blocked.

## Durable Learning

When a product readiness chain advances, prefer a small current-chain bridge
over changing historical proof artifacts. This keeps prior evidence replayable
and gives the Admin portal a single visible path forward.
