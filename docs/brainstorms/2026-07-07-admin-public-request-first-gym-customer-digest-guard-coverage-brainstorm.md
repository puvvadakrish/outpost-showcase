# Admin Public Request First-Gym Customer Digest Guard Coverage Brainstorm

## What We're Building

Harden the real evidence execution guard for the future customer-observed
session plus hosted digest lane. The hosted rehearsal lane is currently active,
but once hosted rehearsal evidence becomes inspectable the packet will advance
to `record_customer_observed_session_and_hosted_digest`. That next lane should
be tested and documented before the real session reaches it, and the upstream
proof-control chain must preserve inspectable rows after hosted proof lands.

## Why This Approach

The execution guard already handles the active hosted rehearsal lane. Claude's
review correctly called out that the customer/digest lane was structurally
handled but not exercised. A fixture-driven test that builds the real hosted-
only parent chain gives confidence that the guard derives the customer lane
from actual upstream state, checks the customer session record create-only
path, and keeps hosted digest proof as a manual downstream command.

## Key Decisions

- Do not add a new proof writer. This is a guard-hardening and
  partial-evidence regeneration batch.
- Build a hosted-only evidence chain in tests, then let the existing
  coordinator/preflight/attempt/packet scripts advance to the customer lane.
- Carry full ledger-derived evidence rows through runbook and execution pack
  so regenerated progress can see both missing and inspectable evidence.
- Carry both missing and inspectable rows through the intake manifest so the
  handoff/session ledger does not drop hosted proof after regeneration.
- Check the real customer session record env name:
  `OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH`.
- Treat the customer session record as the create-only artifact output for the
  combined customer/digest command. The hosted digest proof remains a manual
  command that consumes the inspected record and hosted Preview credentials.
- Keep all public self-serve, provider, billing, POS, access-control, and
  member-ledger gates blocked.

## Success Criteria

- A hosted-only parent chain produces an execution packet whose next step is
  `record_customer_observed_session_and_hosted_digest`.
- The execution guard can inspect that packet with customer-session env names.
- The guard marks a missing/existing customer session record path correctly.
- Tests fail if the customer lane output policy drifts from the real writer's
  env name.
- The proof-control chain can be regenerated after hosted evidence exists
  without dropping the hosted evidence row or claiming new proof.
