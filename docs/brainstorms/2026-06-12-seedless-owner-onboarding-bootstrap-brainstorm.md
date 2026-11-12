---
title: "Seedless owner onboarding bootstrap"
type: brainstorm
date: 2026-06-12
status: complete
---

# Seedless Owner Onboarding Bootstrap Brainstorm

## What We're Building

Build the smallest seedless onboarding step that lets a newly authenticated
owner create a real Outpost tenant and first location in local Supabase. The
result should remove the Acme Fitness seed dependency for the next product
loop, while keeping live providers, billing, email, phone, and task creation
disabled.

This slice is not the full signup funnel. It is the backend-backed bootstrap
boundary after a Supabase-authenticated user exists.

## Why This Slice First

Source intake and task creation should not continue to hang off fixed seed
tenants. The next durable product path needs a real tenant owner membership,
location row, source placeholder, default handoff rules, default task-queue
destination, disabled provider stubs, and an audit event before the owner can
import facts or generate tasks.

The important architecture wrinkle is that a brand-new authenticated user does
not yet have a `users` or `tenant_memberships` row, so normal
`is_active_tenant_owner(...)` checks cannot be the entry condition. The
bootstrap RPC must derive identity from `auth.uid()`, create or reuse the app
user, and then create the owner membership inside the same transaction.

## Chosen Approach

Use one PostgreSQL `security definer` RPC, exposed only to authenticated users:
`bootstrap_owner_tenant(...)`.

The RPC should atomically create:

- an app `users` row for `auth.uid()` if needed;
- one `tenants` row in `setup` status;
- one active owner `tenant_memberships` row;
- one draft `locations` row;
- one manual `source_documents` placeholder;
- default human-safety `handoff_rules`;
- one ready task-queue `notification_destinations` row;
- disabled/not-configured phone and email `provider_connections`;
- one `audit_events` row for the bootstrap.

It should return a compact tenant/location payload that the app can redirect to
`/owner` or render as the new setup workspace.

## Alternatives Considered

### Client-side inserts through RLS

Rejected. This would require broad insert policies on foundational tenant
tables and would make it harder to guarantee that membership, location,
defaults, and audit are created together.

### Service-role route handler

Rejected for this slice. It would work, but the repo has intentionally moved
write boundaries into explicit PostgreSQL RPC transactions so RLS and audit
behavior can be proven locally.

### Full public signup plus bootstrap

Deferred. Supabase Auth signup can be added to the UI, but the durable tenant
boundary should land first. Password signup/email confirmation behavior differs
between local and hosted Auth settings, while the bootstrap RPC is the stable
application contract needed for later signup UI.

## Scope Boundaries

In scope:

- authenticated owner bootstrap for a user with no tenant membership;
- deterministic, tenant-scoped starter records;
- deny-by-default RLS with no direct table insert grants;
- local API/RLS/RPC proof;
- `/owner` behavior that can load the signed-in user's tenant instead of only
  customer zero.

Out of scope:

- hosted Supabase proof;
- public marketing signup polish;
- staff invites;
- source extraction or answer generation;
- task creation;
- notifications;
- Retell, Resend, Gmail, live email, live phone, webhooks, billing, payments,
  POS, Club OS, or member-ledger writes.

## Success Criteria

- A new authenticated local Supabase user can bootstrap one tenant and first
  location without seed data.
- The bootstrap writes all starter rows plus audit atomically.
- A failure-path test proves there is no partial tenant/location/membership
  state.
- The authenticated user can read their new tenant through existing RLS.
- A different tenant user cannot read the bootstrapped tenant.
- Anonymous users cannot execute the bootstrap RPC.
- Existing owner/staff seed flows continue to pass.

## Next Slices

1. Manual source intake: persist owner-pasted source documents and proposed
   source facts for the bootstrapped tenant.
2. Draft answer generation from source facts: create owner-review answer-bank
   drafts, still requiring approval.
3. Manual/simulated task creation: create tasks plus task events/audit from
   app workflows before provider ingress.
