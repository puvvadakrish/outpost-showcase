---
title: Operator Apply Rehearsals
date: 2026-06-26
status: complete
---

# Operator Apply Rehearsals

## Scope

Build the next two admin SaaS slices after operator packet rehearsals:

- Source apply rehearsal: convert a source workflow rehearsal into browser/manual owner-workspace steps for applying reviewed facts through the existing manual source intake and answer review flow.
- Email task rehearsal: convert an email triage rehearsal into browser/manual staff-workboard steps for creating a human-entered follow-up task only when owner review says it is needed.

## Chosen Approach

Use terminal-only artifacts and `/admin` command cards. The artifacts carry route labels, browser steps, expected observations, and payloads, but they do not perform database writes or live-provider actions. This keeps the operator handoff repeatable without moving product boundaries.

## Rejected Alternatives

- Automatically write source facts into Neon. Rejected because existing owner manual source intake remains the allowed write path.
- Automatically create staff tasks from email samples. Rejected because email ingress and automatic task generation are still blocked.
- Connect Gmail/Resend/SMTP for proof. Rejected because provider activation is a later gate.

## Boundaries

No public self-serve, source scraping, Google API import, automatic answer approval, automatic task generation, provider webhooks, email ingress, outbound email, notifications, billing, POS, access-control, or member-ledger writes.

## Success Criteria

- Each apply rehearsal has a prepare and inspect command.
- Inspectors fail closed on forged/tampered artifacts.
- `/admin` displays the new commands and blocked gates.
- Tests prove happy paths, parent tampering, path escape, secret-shaped input, overwrite refusal, and forged artifact rejection.
