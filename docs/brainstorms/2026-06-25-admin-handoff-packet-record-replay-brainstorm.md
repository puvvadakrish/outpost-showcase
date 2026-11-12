---
title: "Admin handoff packet record and replay proof"
date: 2026-06-25
status: captured
---

# Admin handoff packet record and replay proof

## Problem

The Admin handoff readiness packet is useful as a terminal artifact, but the admin portal does not yet show durable history for packets that an operator reviewed, and there is no repeatable replay check to prove a packet still matches the current protected Preview and hosted Neon branch before a customer handoff is scheduled.

## Chosen Approach

Add two narrow SaaS slices:

1. Append-only hosted Neon packet record ledger.
2. Terminal-only packet replay verifier.

The ledger follows existing Admin evidence patterns: sanitized artifact digest, Preview URL, Neon branch, readiness state, blocked-gate booleans, recorded metadata, and a founder-admin-gated read RPC. The replay verifier reads the packet plus its source artifacts and fails closed if branch, Preview, freshness, status, digest, or no-live-provider gates drift.

## Alternatives Considered

- Reuse launch decision records: rejected because handoff packet state is a separate operational proof object and should not imply launch approval.
- Add browser approval or in-app record buttons: rejected because Admin must remain read-only for this stage.
- Store full packet JSON in Neon: rejected because digest and metadata are enough for current proof and reduce accidental customer/secret data exposure.

## Boundaries

- No public self-serve approval.
- No browser mutation controls.
- No invite delivery or notification sending.
- No phone/email provider activation.
- No billing, POS, access-control, or member-ledger writes.
- No customer-observed claim unless a separate observed handoff is actually recorded.

## Success Criteria

- Operator can import a reviewed packet digest into hosted Neon through a terminal command.
- `/admin` shows latest packet records as read-only evidence.
- Operator can replay a packet against current source artifacts before handoff.
- Replay and record scripts fail closed on stale proof, mismatched Preview/branch, unsafe branch, enabled live gates, unsafe paths, or secret-shaped values.
