---
title: Hosted Beta Request Chain Proof
date: 2026-06-24
status: captured
---

# Hosted Beta Request Chain Proof

## Scope

Build the next hosted SaaS proof around the beta owner request queue. The slice
should prove one disposable request can move through public request intake,
operator triage, follow-through outcome recording, operator-managed owner
access fulfillment, and admin ledger verification on a protected Vercel Preview
and hosted Neon branch.

## Decisions

- Keep the path terminal-only after public request submission.
- Reuse existing triage, follow-through, and fulfillment commands instead of
  creating browser approval buttons.
- Verify the chain through hosted Neon rows and admin proof commands, then clean
  up disposable proof rows unless explicitly retained for debugging.
- Keep phone/email providers, invite delivery, notifications, billing, POS,
  access control, and member-ledger writes blocked.

## Rejected

- Public owner approval or self-serve launch: too early.
- Invite delivery: still outside the no-live-provider boundary.
- Provider setup: not needed to prove request queue readiness.

## Success

- A single command can submit a disposable request and prove request, triage,
  follow-through outcome, fulfillment receipt, and blocked provider gates.
- `/admin` exposes the command in the proof command list.
- The proof fails closed for local/non-Vercel Preview origins, production Neon,
  spike branch, weak password reuse, and unexpected live-provider records.
