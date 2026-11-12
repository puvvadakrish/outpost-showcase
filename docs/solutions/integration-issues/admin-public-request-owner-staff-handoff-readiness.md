# Admin Public Request Owner/Staff Handoff Readiness

Date: 2026-06-30

## Context

The public request follow-up batch pointed to owner/staff handoff readiness, but
the existing owner/staff script consumed an older approved-beta parent artifact.

## Solution

Add `admin_public_request_owner_staff_handoff_readiness_batch` as a
current-chain bridge from `admin_public_request_followup_readiness_batch`. It
keeps owner access operator-managed, staff handoff no-send/no-create, and hosted
rehearsal/customer proof/first-gym go-no-go pending.

## Durable Learning

When a newer launch chain supersedes an older artifact path, add a narrow bridge
artifact instead of retconning old proof scripts. This keeps historical proof
replayable while allowing the current chain to advance cleanly.
