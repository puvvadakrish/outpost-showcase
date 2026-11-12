---
title: Admin demo onboarding completion proof
date: 2026-06-27
---

# Admin demo onboarding completion proof

## Goal

Finish the operator-led demo/onboarding rehearsal slice after the demo runway
artifact, while keeping the hosted customer-session proof as a hard prerequisite
and preserving all no-live-provider gates.

## Chosen Approach

Use the existing terminal-only artifact chain instead of adding hosted writes or
browser approval buttons. A new completion recorder consumes the inspected
`admin_demo_onboarding_runway` artifact, requires explicit operator
confirmations, records parent SHA-256 values, and writes a sanitized completion
artifact under ignored `artifacts/`.

The Admin portal should remain read-only: show commands, state, blocked gates,
and the next two SaaS slices after completion. It should not create customer
claims, send invites, activate providers, approve answers, generate tasks, or
touch billing/POS/member-ledger systems.

## Key Decisions

- Hosted customer-session proof stays a prerequisite; missing hosted proof is a
  blocked state, not a fake pass.
- Completion evidence is operator-observed only. Real customer-observed
  completion still requires the gym owner to see the protected Preview,
  workspace, staff handoff path, reset/rollback checklist, and no unexpected
  data or live-provider claims.
- The next two slices after completion are:
  1. Customer-observed gym demo gate.
  2. Limited operator-assisted beta onboarding for the next gym.

## Non-Goals

- No public owner self-signup.
- No invite delivery.
- No Gmail, Resend, SMTP, phone, provider webhook, notification, or outbound
  email activation.
- No billing, POS, access-control, or member-ledger writes.
- No browser mutation controls in Admin.
