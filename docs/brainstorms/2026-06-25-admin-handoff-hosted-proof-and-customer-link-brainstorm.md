---
title: Admin handoff hosted proof and customer link brainstorm
date: 2026-06-25
status: complete
---

# Admin Handoff Hosted Proof and Customer Link Brainstorm

## Scope

Build the next two SaaS-readiness slices after the Admin handoff packet record/replay work:

1. A terminal-only hosted packet proof runner that replays the Admin handoff readiness packet against its source artifacts, imports the sanitized packet record, and writes a non-secret proof summary.
2. A packet-linked customer-observed handoff gate so the final customer handoff record can reference the Admin packet digest that was reviewed before the session.

## Decisions

- Keep the work terminal-first and founder-admin-visible; do not add browser approval buttons or public owner self-serve.
- Reuse the existing packet replay and record commands instead of creating another import boundary.
- Keep customer handoff linkage as a digest reference. The customer handoff record may carry the Admin packet SHA-256, but it must not store packet body, credentials, cookies, bypass secrets, or owner passwords.
- Store the customer linkage in hosted Neon only as sanitized metadata, with the existing founder-admin read RPC projection.
- Preserve all no-live-provider gates: no invite delivery, notifications, phone/email providers, billing, POS, access control, or member-ledger writes.

## Acceptance Criteria

- A new package command runs packet replay plus packet record import and writes a non-secret hosted proof summary artifact.
- The runner fails closed for production, spike branch, local preview, missing reviewer, drifted artifacts, and secret-shaped output.
- Customer handoff gate artifacts can include an Admin handoff packet digest when supplied, and the recorded customer handoff row persists that digest.
- The customer handoff read projection exposes only the digest metadata needed by `/admin`.
- Tests cover script wiring, no-live-provider boundaries, packet digest linkage, and founder-admin projection shape.
