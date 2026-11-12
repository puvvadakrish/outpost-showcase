---
title: Admin customer session hosted proof record
date: 2026-06-27
status: captured
---

# Admin Customer Session Hosted Proof Record Brainstorm

## Problem

The admin customer-observed session record is currently a terminal-only artifact. That is enough for operator proof on one machine, but the Admin portal still cannot show that a customer-observed protected Preview session was recorded unless someone remembers the artifact path from chat or local shell history.

## Scope

Build the next two SaaS slices together:

- Import the inspected customer-observed session artifact into hosted Neon as an append-only, founder-admin-visible digest record.
- Add a hosted proof verifier that inspects the artifact, imports it, signs in through a temporary founder-admin proof identity, verifies the Admin portal RPC can read the digest, and cleans up proof-only auth/app rows.

## Chosen Approach

Follow the existing hosted admin evidence pattern used by launch package, beta proof-run summary, and handoff packet records:

- Add a migration for a narrow append-only table with no launch/provider flags enabled.
- Add a founder-admin gated `list_*` RPC returning sanitized metadata only.
- Add a record script that re-runs `admin:customer-session:inspect`, verifies Preview/Neon branch context, hashes the artifact, and inserts idempotently by digest.
- Add a proof script that performs record + admin RPC read verification.
- Add read-only `/admin` projection and copyable commands.

## Rejected Approaches

- **Mutate the existing `customer_handoff_gate_records`:** rejected because that older table represents the broader final handoff gate. This new artifact-only session record is a separate operational proof.
- **Store full artifact JSON in hosted Neon:** rejected because the Admin portal only needs digests and high-level metadata; full artifacts may contain customer labels and should stay local.
- **Add UI approval/completion buttons:** rejected because this remains operator-assisted proof, not public self-serve productization.

## Success Criteria

- Hosted Neon contains a digest-only customer session record table with RLS enabled and no anonymous/public table access.
- Founder-admin RPC returns only sanitized record metadata.
- Record script fails closed unless the artifact inspector passes and Preview/branch context matches hosted env.
- Proof script verifies the RPC can read the imported digest through founder-admin identity.
- `/admin` shows recent digest evidence and the record/proof commands.
- Public self-serve, invite delivery, providers, notifications, billing, POS, access control, and member-ledger writes remain blocked.
