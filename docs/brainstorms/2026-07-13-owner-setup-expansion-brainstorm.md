---
topic: owner-setup-expansion
date: 2026-07-13
status: decided
---

# Owner Setup Expansion Brainstorm

## What We're Building

Complete the owner setup workflows that currently stop at browser-local draft
rows. An authenticated active tenant owner can create a draft handoff rule and
a draft notification destination. A later slice in the same readiness bundle
adds plan-enforced additional-location creation with safe starter setup rows,
followed by a separately reviewed emergency-stop contract.

## Why This Is Next

The protected Preview and provider-neutral persistence foundations are already
implemented. Real customer evidence requires the Acme Fitness owner and
cannot be synthesized. The owner UI, however, visibly offers Add draft actions
that cannot be saved to Neon. Closing that dead end is a real SaaS setup gap and
does not require live providers, delivery, self-serve access, or billing.

## Architecture Decisions

- Use separate create RPCs rather than overloading update semantics.
- PostgreSQL generates opaque row, revision, and audit IDs.
- Creation is always `draft`; submitted status is not authoritative.
- The RPC derives the actor from the authenticated session and requires active
  owner membership.
- Optional location scope is accepted only after a same-tenant location check.
- Each create operation atomically inserts the configuration row, an initial
  revision snapshot, and an audit event.
- Existing update RPCs remain unchanged and continue locking existing rows.
- Direct table writes remain unavailable to authenticated clients.
- Browser-local draft IDs are editing keys only. Successful creation must
  reconcile from backend state and remove the local row.
- Manual answer creation remains source-backed through manual facts and answer
  proposals; no source-less answer path is added.

## Sequential Slices

1. Persist draft handoff-rule creation.
2. Persist draft notification-destination creation.
3. Add additional-location creation only with database-enforced plan allowance
   and starter disabled/not-configured channel setup.
4. Add an audited tenant emergency stop as its own architecture/security slice
   before any live-provider activation work.

## Rejected Alternatives

- Add source-less answer drafts: rejected because manual source intake already
  provides provenance and conflict handling.
- Enable providers next: rejected because credentials, webhook signatures,
  runtime gating, delivery, and rollback are not yet proven.
- Treat `localStorage` as persisted setup: rejected because it is neither
  tenant-authoritative nor available across owner devices.
- Add delete operations: rejected because draft/disabled states provide
  reversible lifecycle control without destructive writes.

## Scope Boundaries

No provider secret, webhook, phone call, email delivery, transfer, notification
attempt, invite, public self-serve, billing, POS, access-control, or member-
ledger behavior is enabled. A stored `ready` destination or `active` rule still
describes configuration only.

## Advisor And Review Note

The read-only Fable 5 CLI invocation stalled without output and was stopped.
The fallback is an independent Codex explorer audit plus local Compound
architecture review. The independent audit confirmed the same ordering and
identified emergency stop as a pre-live blocker, not part of these create
transactions.

## Success Criteria

- A same-tenant active owner creates each draft through Auth/RLS/RPC.
- Staff, anonymous users, and cross-tenant owners cannot create the rows.
- Each success produces exactly one configuration row, one initial revision,
  and one audit event in one transaction.
- Invalid location scope and invalid/bounded fields fail without partial state.
- The owner can immediately edit the newly created backend row with the
  existing update workflow.
- Local and hosted verification make no live-channel claim.
