---
title: "Owner burden report dashboard"
type: brainstorm
date: 2026-06-17
---

# Owner Burden Report Dashboard Brainstorm

## What We're Building

Add an owner-facing local burden-reduction report to `/owner` that turns the
existing local proof rows into a shift-report style dashboard.

The report should show:

- staff tasks created and locally resolved;
- answer review progress;
- manual source facts staged;
- local proof completion;
- hosted/live-provider gates that still block customer readiness.

## Recommended Approach

Use a derived-state UI slice. Add a domain projection over existing tasks,
answer-bank entries, source documents, and the existing beta-loop summary, then
render it as an owner report panel in the current `/owner` workspace.

This keeps the work inside the current local Supabase Docker proof path and
avoids a new model boundary. It also lets the owner see burden reduction without
implying phone/email providers, hosted preview, notifications, billing, POS, or
member-ledger behavior are live.

## Alternatives Considered

### New analytics route

A separate `/owner/report` route would make the report more formal, but it adds
navigation and a second owner surface before there is enough real usage volume.

### Persisted metrics table

A metrics table would be useful later, but it is unnecessary while the product
is still proving the local beta loop. Existing rows already provide the current
answer/source/task state.

### Usage/billing dashboard

Usage and billing analytics are not ready because voice/email providers and
hosted proof remain blocked. Showing billing-like metrics now would overclaim.

## Key Decisions

- Derive the report only from existing local persisted state already loaded by
  `/owner`.
- Keep the visual treatment operational: metric rows, status rails, proof
  progress, and gate tags.
- Keep hosted Supabase proof and live phone/email provider gates explicit.
- Do not add schema, RPCs, provider ingress, notification delivery, billing,
  POS, payment, member-ledger writes, hosted-proof claims, or live channel
  behavior.

## Success Criteria

- `/owner` shows a burden-reduction report above setup work.
- The report separates local proof completion from hosted/live readiness.
- Focused domain and source tests cover the projection and UI wiring.
- Local Supabase Docker remains the end-to-end proof path.

## Open Questions

None. The slice is intentionally derived UI only.
