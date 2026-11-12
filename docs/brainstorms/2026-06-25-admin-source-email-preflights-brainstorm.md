---
title: Admin Source And Email Preflights
date: 2026-06-25
status: captured
---

# Admin Source And Email Preflights

## Scope

After the admin handoff packet and operator rehearsal proof gates, the next
repeatable SaaS work should prepare the first real product surfaces that still
remain outside live-provider scope: public source import and email triage.

## Decisions

- Build two preflight artifacts, not live integrations.
- Keep both terminal-only under `artifacts/` so operators can prepare customer
  handoff context without storing secrets or enabling providers.
- Surface the commands in `/admin` as read-only command cards.
- Do not add database records yet; these are pre-implementation readiness
  packets, not durable customer completion claims.

## Boundaries

- No website scraping or Google API import.
- No automatic answer approval or task generation.
- No Gmail, Resend, SMTP, inbound email, outbound email, or notifications.
- No public self-serve launch, billing, POS, access control, or member-ledger
  writes.

## Success Criteria

- Operators can generate and inspect a source-import preflight packet.
- Operators can generate and inspect an email-channel preflight packet.
- `/admin` shows the next commands without browser approval buttons.
- Tests prove the scripts keep live-provider gates blocked.
