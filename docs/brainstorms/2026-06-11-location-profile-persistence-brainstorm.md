---
date: 2026-06-11
topic: location-profile-persistence
---

# Location Profile Persistence Brainstorm

## What We're Building

Build the next smallest backend persistence slice for owner setup: updating an
existing location profile. The owner can edit seeded location name, address,
public phone, routing phone, timezone, and status. The backend persists the
change through one PostgreSQL RPC transaction that updates the location row,
adds a location revision row, and adds an audit event.

This is intentionally an owner setup persistence slice, not a live routing or
provider slice.

## Why This Slice

Locations are upstream context for phone, email, task inbox, and answer
approval. The answer-bank, handoff-rule, and notification-destination slices
already prove the transaction pattern for owner-controlled setup rows. Location
profile persistence completes another core owner setup object without expanding
into live channels.

Local Supabase Docker remains the proof path because hosted Supabase preview
proof is blocked by the active free-project quota. Hosted proof must remain
unclaimed.

## Chosen Approach

Use the established backend persistence pattern:

- Add `location_revisions`.
- Add `update_location_profile(...)` as a `security definer` RPC.
- Keep authorization inside the RPC through `is_active_tenant_owner`.
- Lock the target row with `for update`.
- Write location update, revision, and audit event in the same function.
- Grant execute only to authenticated users.
- Keep RLS deny-by-default for direct writes.
- Add application service, repository, in-memory rollback test, RLS verifier,
  and owner UI wiring.

## Rejected Approaches

- **Client-side/local-only location edits:** too weak now that backend setup
  persistence exists.
- **Generic update RPC:** broader than needed and harder to audit for tenant
  safety.
- **Location create/delete:** useful later, but it adds lifecycle and plan-limit
  questions. Existing-row update is the smallest verifiable next step.
- **Provider/routing behavior from routing phone:** explicitly out of scope.

## Scope Boundaries

- No provider connections are enabled.
- No phone transfer or routing behavior is activated.
- No email delivery, notification attempts, webhooks, billing, POS, Club OS, or
  member-ledger writes.
- No hosted proof claim.
- No tenant creation, location creation, or location deletion.

## Success Criteria

- Owner can persist an existing location profile update through Supabase Auth,
  RLS, and RPC.
- Update creates exactly one revision row and one audit event.
- Cross-tenant RPC update is denied.
- Failure-path test proves no partial location/revision/audit state.
- Existing no-live-provider readiness gates stay blocked.
