---
title: Admin portal rebrand brainstorm
date: 2026-06-22
status: complete
---

# Admin Portal Rebrand Brainstorm

## What We're Building

Rename the operator-facing product surface from "founder admin" to "admin
portal" across the active app, runbooks, durable project docs, and tests. The
portal should read as repeatable SaaS operations infrastructure, not a
founder-only prototype surface.

## Why This Approach

The current phrase "founder admin" leaks an early internal implementation
detail into the product UI. "Admin portal" is clearer for operators, support,
and future non-founder admins while preserving the existing no-live-provider
boundary.

## Key Decisions

- Make `/admin` the canonical route for the internal operator surface.
- Keep `/founder-admin` as a compatibility redirect so existing proof links and
  scripts do not break immediately.
- Update visible UI copy, navigation, lockout text, proof ledger labels, and
  current runbooks to say "Admin portal."
- Add `hosted:admin-portal-readiness` as the preferred script name while
  retaining `hosted:founder-admin-readiness` as a compatibility alias.
- Do not rename the `founder_admin` database role, RPC names, or proof-kind enum
  in this slice. Those are authorization and proof-history identifiers, and
  renaming them would be a larger migration with little product benefit.

## Scope Boundaries

- No new admin mutations.
- No invite delivery, live providers, billing, POS, access control, or
  member-ledger writes.
- No changes to tenant isolation or proof semantics.
- Historical brainstorms and plans may retain their original wording unless the
  current runtime, runbooks, or durable context depends on them.

## Success Criteria

- Users and operators see "Admin portal" rather than "Founder admin" in the app.
- `/admin` renders the existing portal, and `/founder-admin` redirects there.
- Existing proof automation continues to work through compatibility aliases.
- Tests prove the new canonical route/copy and the old compatibility path.
