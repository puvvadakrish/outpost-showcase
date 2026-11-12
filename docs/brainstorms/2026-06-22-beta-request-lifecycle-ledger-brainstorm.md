# Beta Request Lifecycle Ledger Brainstorm

Date: 2026-06-22

## Scope

The founder-admin request console can show queued beta access requests and
operator fulfillment state, but the handoff lifecycle still requires the
operator to mentally join request rows, owner access grants, owner sign-in,
workspace bootstrap, hosted proof, and customer handoff gates. The next slice
should make that lifecycle visible without adding another write path.

## Product Boundary

- Show the beta request lifecycle as a read-only operator ledger.
- Derive the ledger from existing hosted Neon projections:
  owner beta access requests, owner access grants, owner account linkage,
  tenant bootstrap, hosted proof runs, and customer handoff records.
- Keep actual access fulfillment in the CLI.
- Do not store or render temporary passwords, API keys, JWTs, cookies, provider
  secrets, or raw customer notes.
- Do not add browser approve/decline buttons, invite delivery, public
  self-serve account creation, phone/email providers, notifications, billing,
  POS behavior, access control, or member-ledger writes.
- Do not claim customer-observed handoff completion unless an imported
  customer-observed proof record exists.

## Architecture Choice

Use a domain projection instead of schema changes:

1. Add a typed lifecycle-step helper for each beta access request.
2. Compute stage state from existing read models:
   - request queued
   - operator review
   - access fulfilled
   - owner signed in
   - workspace bootstrapped
   - handoff ready
3. Treat declined and superseded requests as archived/blocked for active
   handoff purposes.
4. Use the hosted proof ledger only as evidence for the final handoff-ready
   stage. A bootstrapped workspace without matching protected Preview proof is
   still pending.
5. Render the lifecycle inside each request row as a compact operational step
   list with status pills and short details.

## Non-Goals

- New migrations or RPCs.
- Public owner-facing lifecycle UI.
- Automated fulfillment.
- Email invite or notification delivery.
- Live provider setup.
- Billing, POS, access-control, or member-ledger behavior.

## Design Notes

Use Outpost's row-first founder-admin pattern. The lifecycle should read as a
status rail and checklist attached to the request, not as a decorative timeline
or standalone dashboard. On mobile, stack lifecycle steps into one column and
keep long command templates contained in the existing operator packet.
