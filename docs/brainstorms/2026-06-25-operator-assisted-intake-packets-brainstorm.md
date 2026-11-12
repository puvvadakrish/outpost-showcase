---
title: Operator Assisted Intake Packets
date: 2026-06-25
status: captured
---

# Operator Assisted Intake Packets

## Scope

After source and email preflights, operators need a repeatable way to capture
reviewed public facts and sample email triage examples without connecting live
providers. This is the smallest next step toward source import and email v1.

## Decisions

- Build two packet artifacts: reviewed source facts and pasted email sample.
- Require the matching preflight artifact first, then derive packet context from
  its digest.
- Keep packets under ignored `artifacts/` and secret-scan both keys and values.
- Surface commands in `/admin`; do not add browser mutation controls.

## Boundaries

- Source facts packet does not write source rows, approve answers, create tasks,
  scrape websites, or call Google APIs.
- Email sample packet does not connect inboxes, create tasks, send replies, or
  notify anyone.
- Public self-serve, providers, billing, POS, access control, and member-ledger
  writes remain blocked.

## Success Criteria

- Operators can prepare and inspect source facts packets from a source preflight.
- Operators can prepare and inspect email sample packets from an email preflight.
- Inspectors fail when required no-go gates are missing.
- `/admin` shows the next commands alongside the existing preflight cards.
