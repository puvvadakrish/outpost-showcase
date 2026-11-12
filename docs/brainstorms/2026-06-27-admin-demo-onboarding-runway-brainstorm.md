---
title: Admin demo onboarding runway
date: 2026-06-27
status: captured
---

# Admin Demo Onboarding Runway Brainstorm

## Problem

Outpost now has many terminal-only proof packets for hosted Neon, operator
handoff, customer-observed sessions, source workflow rehearsal, and email
workflow rehearsal. The operator can run them, but the next two SaaS slices are
still implicit in chat or scattered commands. That makes it harder to know when
Outpost is ready for an operator-led gym demo and what remains before a gym can
self-serve.

## Scope

Build two small SaaS slices together:

- A customer-safe demo/onboarding runway artifact generated from the
  customer-observed session record. It summarizes whether operator-led demo is
  ready, keeps self-serve blocked, and lists the next two slices.
- A read-only Admin portal runway section showing the same next two slices and
  copyable terminal commands without browser approval buttons or live provider
  controls.

## Chosen Approach

Reuse the existing artifact chain:

1. `admin:handoff-scheduling:packet`
2. `admin:customer-session:record`
3. `admin:customer-session:inspect`
4. new runway prepare/inspect scripts
5. hosted customer-session record proof

The runway should store only labels, hashes, paths, and gate states. It should
not store passwords, tokens, cookies, provider config, email addresses beyond
the already customer-safe owner label/email in existing local artifacts, or any
browser session material.

## Next Two SaaS Slices

1. Hosted customer-session proof run: import the customer-observed session
   digest into hosted Neon and prove founder-admin visibility.
2. Operator-led demo/onboarding rehearsal: use the protected Preview and
   customer-safe handoff checklist to rehearse the next gym owner onboarding
   path.

## Explicit Non-Goals

- No public owner self-signup.
- No invite delivery.
- No Gmail, Resend, SMTP, phone, provider webhook, notification, or outbound
  email activation.
- No billing, POS, access-control, or member-ledger writes.
- No browser mutation controls in Admin.
