---
title: Operator-assisted channel intake
date: 2026-07-12
status: complete
---

# Operator-assisted Channel Intake

## What We're Building

Advance the phone/email-first product without connecting providers by making
human-entered staff intake channel-aware, fully rehearsable in local mode, and
resilient to accidental navigation while an intake is unfinished.

## Why This Approach

The existing manual task transaction is already tenant-scoped, audited, and
atomic. Extending that boundary is safer than adding an email-specific task
model or automatic classifier. Task channel describes how the request arrived;
the created task event continues to identify human-entered provenance.

## Key Decisions

- Batch 1 adds validated phone, email, or manual channel selection to the
  existing manual-intake transaction and replacement RPC.
- Batch 2 adds local rehearsal creation through a pure domain transition with
  the same validated task and created-event shape, but no hosted authority,
  audit claim, usage claim, or provider claim.
- Batch 3 keeps unfinished intake fields in component memory only, adds an
  explicit clear command and bounded counters, preserves text on validation
  failure, and clears it only after successful creation or Reset local.
- No raw email body, transcript, provider payload, attachment, or secret is
  stored. Summary remains the staff-authored bounded abstraction.
- No classification, automatic task creation, notification, reply, provider,
  invite, public self-serve, billing, POS, access-control, or member-ledger
  behavior is enabled.

## Architecture Assessment

The application service remains the input-validation boundary, repositories
remain persistence adapters, and PostgreSQL remains authoritative for hosted
tenant membership and atomic writes. Local rehearsal is a separate draft-state
transition and is labeled Browser local. Channel and provenance remain separate
dimensions to avoid implying provider ingestion.

## Resolved Questions

- Channel selection defaults to Manual for backward-safe staff behavior.
- Local rehearsal IDs are generated client-side only and never cross into the
  hosted transaction.
- Intake drafts are deliberately session-memory only because requester contact
  and summary can contain customer information.
