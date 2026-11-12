---
date: 2026-06-13
topic: manual-source-intake
status: captured
---

# Manual Source Intake Brainstorm

## What We're Building

Add the next backend persistence slice for owner/staff manual source intake.
An active tenant member can create or update one manual source document for an
existing tenant location, along with proposed source facts, through a single
Postgres RPC transaction.

This is setup/source persistence only. It does not scrape websites, import
Google data, connect providers, create tasks, route automation, send email, or
make any fact live.

## Why This Approach

The previous backend slices use narrow PostgreSQL RPCs for multi-table writes,
tenant membership checks via `auth.uid()`, read-only RLS for application tables,
and executable local verification. Manual source intake touches both
`source_documents` and `source_facts`, plus audit state, so it should follow the
same atomic boundary instead of granting broad insert/update/delete permissions.

The smallest useful workflow is:

- verify the signed-in user is an active member of the tenant;
- verify the location belongs to that tenant;
- upsert a manual source document;
- replace that document's proposed facts;
- append one audit event;
- return the current source document.

## Key Decisions

- Use active tenant membership rather than owner-only access so both owner and
  staff can support manual source intake.
- Keep source facts as `proposed`; approval/live answer behavior remains in the
  answer-bank workflow.
- Replace the fact set for the manual document on each write to avoid stale
  proposed facts lingering after an owner/staff correction.
- Keep source document and source fact direct writes denied to authenticated
  clients; only the RPC can mutate them.
- Extend local RLS verification with success, cross-tenant denial, direct-write
  denial, and failure-path no-partial-state checks.

## Explicit Non-Goals

- No website scraping or public import implementation.
- No Google import.
- No live phone, Retell, email, Resend, Gmail, webhooks, or provider ingress.
- No automatic answer approval, task creation, notifications, billing, POS,
  payments, ClubOS, or member-ledger writes.

## Success Criteria

- Manual source document upsert persists document metadata and proposed facts
  atomically.
- Failure after document mutation leaves no partial source/fact/audit state.
- Cross-tenant RPC attempts fail without changing source/fact/audit counts.
- Local Supabase Docker proof remains the only claimed backend proof while the
  hosted Supabase free-project quota blocker remains.
