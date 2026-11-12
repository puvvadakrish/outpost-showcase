---
title: Admin Public Request First-Gym Proof Session Diagnostics
date: 2026-07-02
status: captured
---

# Admin Public Request First-Gym Proof Session Diagnostics

## What We're Building

Add the next Admin readiness batch after proof-session resume. The batch
produces a diagnostics artifact that explicitly inspects the current runbook,
execution pack, progress batch, and resume packet, then summarizes missing
evidence, inspectable evidence, next operator actions, and whether the chain is
ready for dedicated follow-up proof commands.

## Why This Approach

The real gate remains external: a hosted/customer-observed first-gym session.
Diagnostics should therefore strengthen the operator chain without pretending
proof exists. This gives the operator one current status surface for the whole
proof-session lane while keeping all proof claims delegated to existing
dedicated commands.

## Key Decisions

- Consume and SHA-pin
  `admin_public_request_first_gym_proof_session_resume_packet`.
- Re-run every parent inspector: runbook, execution pack, progress, and resume.
- Copy current evidence status from the verified resume packet rather than
  inventing new proof state.
- Emit exact operator next actions and a diagnostic guard.
- Harden resume inspection by rejecting extra operator-action keys and
  verifying the completion handoff action text.
- Keep every public launch, self-serve, invite, provider, Auth admin, billing,
  POS, access-control, provider ingress/egress, and member-ledger gate blocked.

## Non-Goals

- Do not record hosted proof, customer-observed completion, first-gym go/no-go,
  first-gym run, limited beta review, public self-serve readiness, or launch
  approval.
- Do not add public request submission, browser approval buttons, invite
  delivery, notifications, phone/email providers, Auth admin APIs, Auth user
  creation, magic links, or automatic grants.
- Do not touch billing, POS, access control, provider ingress/egress, or
  member-ledger writes.

## Success Criteria

- Operators can prepare and inspect a diagnostics artifact from the current
  resume packet.
- Diagnostics fails closed on stale resume/progress/pack/runbook lineage.
- Diagnostics exposes current missing evidence and next commands without
  recording proof.
- Admin portal exposes diagnostics as read-only operator guidance.
