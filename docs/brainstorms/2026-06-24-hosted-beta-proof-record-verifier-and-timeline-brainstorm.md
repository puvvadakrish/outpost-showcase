---
title: Hosted Beta Proof Record Verifier And Timeline
status: complete
date: 2026-06-24
---

# Hosted Beta Proof Record Verifier And Timeline

## Problem

The hosted beta proof-run summary can now be imported into Neon, but operators
still need a repeatable verifier that proves the imported digest is visible
through the founder-admin Data API RPC. The Admin portal also has several proof
record sections, but the sequence is hard to scan as one operational timeline.

## Decision

Build two adjacent slices:

- Add a `hosted:beta-proof-run:record-proof` command that inspects the summary,
  imports it, signs in as a temporary founder-admin proof user, calls the
  founder-admin RPC over the Neon Data API, and verifies the digest record is
  visible with public self-serve and live-provider flags still false.
- Add a compact read-only Admin portal evidence timeline that summarizes the
  latest proof-run, beta proof summary, customer handoff, launch package,
  launch decision, follow-through, and rehearsal records.

## Scope

This is proof hardening only. It does not create customer-facing approvals,
send invites, provision beta owners, enable notifications, activate phone/email
providers, promote public self-serve, or touch billing, POS, access control, or
member-ledger writes.

## UX Direction

Use the existing Front Desk Command style: compact rows, small operational
states, digest hashes, timestamps, and next-action copy. Avoid a new bento or
marketing layout. The timeline is an operator scan surface, not a launch
approval workflow.

## Success Criteria

- The new verifier fails closed on missing/malformed summary, missing imported
  record, unauthorized RPC response, branch/Preview mismatch, unexpected launch
  flags, or secret-shaped output.
- The Admin timeline renders useful empty and ready states without exposing
  secrets or enabling actions.
- The broken proof-run summary record RPC is corrected to use the current Neon
  schema (`users` and `tenant_memberships`).
