---
title: Hosted Beta Proof Run Records
status: complete
date: 2026-06-24
---

# Hosted Beta Proof Run Records

## Problem

The hosted beta proof run now has browser-proof and request-chain artifacts plus a
summary artifact, but the Admin portal cannot show a durable hosted record of the
latest combined proof. Operators still have to remember which ignored artifact
was inspected.

## Decision

Build two adjacent SaaS slices together:

- Import an inspected hosted beta proof-run summary into a founder-admin-gated,
  append-only Neon record table.
- Show the latest imported summary digest in the Admin portal so operators can
  see the Preview URL, hosted Neon branch, proof artifact hashes, cleanup state,
  and blocked launch/provider gates without opening local chat history.

## Scope

The record is evidence metadata only. It must not contain passwords, Neon API
keys, cookies, JWTs, Vercel bypass secrets, or raw browser screenshots. It must
not approve public self-serve, browser approval buttons, invite delivery,
notifications, phone/email providers, billing, POS, access control, or
member-ledger writes.

## Approach

Mirror existing Admin proof-record patterns:

- Use a migration with RLS and a founder-admin-only list RPC.
- Add a terminal script that validates the summary artifact before insertion.
- Thread the report through the existing Neon repository and Admin proof ledger.
- Render a compact Admin portal panel with empty-state command guidance.

## Success Criteria

- The import script fails closed on local/spike/production branch misuse and on
  summary artifacts that do not keep gates blocked.
- The Admin portal shows no proof-run record until one is imported.
- Imported records remain digest-only and customer-safe.
- Existing no-live-provider boundaries remain explicit in docs and UI.
