---
title: Approved gym follow-through and public request intake dry-run
date: 2026-06-27
status: captured
---

# Approved Gym Follow-Through And Public Request Intake Dry-Run Brainstorm

## Scope

Build the next two SaaS slices after limited beta/self-serve preflight:

1. Approved gym request follow-through for one non-House-of-Fitness gym.
2. Public request intake dry-run that remains request-only and review-only.

## Key Decisions

- Keep both slices terminal-only packet flows plus read-only Admin portal visibility.
- Reuse the existing owner beta request triage/follow-through path as input evidence instead of adding new hosted writes.
- Require the approved gym to be explicitly non-House-of-Fitness so the product moves toward repeatable SaaS proof.
- Keep owner access operator-managed through existing CLI paths.
- Keep public request intake as shape/checklist proof only: no public form enablement, no automatic approval, no owner provisioning, no invite delivery.
- Preserve no-live-provider gates: no phone/email providers, inbox connection, outbound delivery, notifications, billing, POS, access control, or member-ledger writes.

## Approach

Use the same artifact chain pattern as the prior Admin readiness slices:

- `admin_public_self_serve_preflight` plus `owner_beta_request_followthrough` feed an `admin_approved_gym_request_followthrough_packet`.
- That approved follow-through packet feeds an `admin_public_request_intake_dry_run`.
- `/admin` renders both as blocked/read-only operational panels with artifact paths, commands, gates, and next two recommended slices.

## Rejected Approaches

- Do not add hosted Neon mutation tables for these two slices yet. The existing request triage/follow-through and fulfillment paths already cover hosted evidence; these packets compose proof without new data-model risk.
- Do not add a browser approval button, public request submission form, invite sending, or Auth admin provisioning. Those are later gates.
- Do not record a real customer completion claim from these packets.

## Success Criteria

- Packet scripts refuse unsafe parent artifacts, Acme Fitness reuse for this next-gym slice, automatic grants, launch enablement, overwrite, path traversal, and secret-shaped values.
- Admin portal shows both new packets without making the already dense page harder to scan.
- Local typecheck, tests, build, browser smoke, and Claude Code Opus 4.8 review pass before merge.

## Open Questions

None. User asked to proceed using the CE loop and implement the next two slices together.
