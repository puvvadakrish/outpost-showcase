---
title: Beta Owner Handoff Packet Brainstorm
date: 2026-06-22
status: captured
---

# Beta Owner Handoff Packet Brainstorm

## What We're Building

Add a generic operator handoff packet generator for any operator-assisted beta
gym. The packet should turn the current beta owner preflight, hosted owner
access runbook, reset/rotate checklist, and no-live-provider gates into a
customer-safe Markdown checklist.

## Why This Approach

The Acme Fitness packet is intentionally customer-zero-specific and tied to
retained dry-run evidence. The next SaaS step is a reusable packet for the next
gym before public self-serve is open. It should make the operator-assisted path
repeatable without relying on chat memory, while avoiding any claim that the
customer has completed onboarding.

## Key Decisions

- Create a new `beta:owner-handoff:packet` command rather than generalizing the
  Acme Fitness evidence packet.
- Require explicit operator inputs for gym name, owner email, preview URL, Neon
  branch, and output path.
- Generate only Markdown under ignored `artifacts/` when repo-local.
- Reuse the existing `betaOwnerPreflight()` copy so product boundary language
  stays consistent with `/owner/sign-in`.
- Fail closed on secret-shaped keys or rendered values.
- Keep this as support documentation, not product state.

## Rejected Approaches

- Reuse `acme:customer-handoff:packet` directly. It correctly requires ACME
  retained/browser/rollback evidence and should stay customer-zero-specific.
- Add database support records now. The immediate problem is repeatable handoff
  guidance, not durable customer support state.
- Generate or send invites. Invite delivery remains outside this gate.

## Success Criteria

- A generic command writes a customer-safe packet for any non-empty gym name and
  beta owner email.
- The packet includes owner access, first-run workflow, reset/rotate support,
  and no-live-provider gates.
- The command refuses repo-local tracked output paths and secret-shaped inputs.
- Tests prove the command is registered, writes the expected packet, and fails
  closed on unsafe input.
- `AGENTS.md`, `PLOT.md`, and hosted beta operator docs reflect the reusable
  packet state.

## Open Questions

None for this slice.
