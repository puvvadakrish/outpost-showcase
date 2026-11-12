---
title: Operator Packet Rehearsals
date: 2026-06-25
status: complete
---

# Operator Packet Rehearsals

## Scope

Build the next two admin SaaS slices after source-facts and email-sample packets:

- Source workflow rehearsal: turn reviewed source facts packet into customer-safe operator steps for existing manual source intake, answer review, and optional answer-derived staff task follow-up.
- Email triage rehearsal: turn one email sample packet into read-only triage guidance and a manual staff-task draft without connecting inboxes or sending mail.

## Chosen Approach

Use terminal-only artifacts and `/admin` command cards. This keeps the work repeatable for the operator while avoiding premature runtime writes, provider ingress, or customer-facing self-serve.

## Rejected Alternatives

- Directly write source facts into hosted Neon from the packet. Rejected because owner/manual intake is the proven write path and automatic import is still blocked.
- Create staff tasks from email samples. Rejected because email provider ingress and automatic task creation are not proven yet.
- Add browser approval buttons. Rejected because current admin readiness surfaces are command-oriented and safer for gated beta operation.

## Boundaries

No website scraping, Google API import, email inbox connection, provider webhook, outbound email, notifications, automatic answer approval, task generation, billing, POS, access-control, or member-ledger writes.

## Success Criteria

- Each rehearsal has a prepare and inspect command.
- Inspectors fail closed if blocked gates are missing.
- `/admin` displays the commands and blocked gates.
- Tests prove happy path and tampered-gate rejection.
