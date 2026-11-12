---
title: Admin Public Request First-Gym Proof Session Progress Batch
date: 2026-07-02
status: captured
---

# Admin Public Request First-Gym Proof Session Progress Batch

## What We're Building

Add a current-chain Admin readiness batch after the proof-session execution
pack that can be rerun during or after a real first-gym proof session. It
structurally validates the pinned execution pack as the session source of truth,
re-inspects any expected evidence artifacts that now exist, marks absent
artifacts as missing, and writes the next missing command plus a completion
check.

## Why This Approach

The current blocker is not missing code for proof claims; it is missing real
hosted/customer evidence. The safest next slice is therefore a status-only
progress control artifact, not another writer that could imply completion. This
keeps the operator loop continuous while preserving the rule that each proof
claim must come from its own dedicated command.

## Key Decisions

- Consume and SHA-pin
  `admin_public_request_first_gym_proof_session_execution_pack`.
- Reuse the execution pack's expected evidence manifest as the source of truth.
- Treat missing files as `missing` and present files as `inspectable` only
  after their dedicated inspector passes.
- Include three internal slices in one batch: progress ledger, next-step
  packet, and completion check.
- Keep every public launch, provider, invite, Auth admin, billing, POS,
  access-control, and member-ledger gate blocked.

## Non-Goals

- Do not record hosted proof, customer-observed completion, first-gym run
  success, limited beta review, public self-serve readiness, or live-provider
  readiness.
- Do not add browser approval buttons or public request submission.
- Do not create Auth users, magic links, invites, notifications, billing, POS,
  access-control, provider ingress/egress, or member-ledger writes.

## Success Criteria

- Operators can run one progress command after the execution pack.
- The artifact tells them the next missing proof command.
- If evidence artifacts are present, their existing inspectors must pass and
  their SHA-256 values must be pinned.
- Admin portal exposes the command without adding an approval surface.
