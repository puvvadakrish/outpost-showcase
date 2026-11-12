---
title: Hosted Beta Request Browser Proof
date: 2026-06-24
status: captured
---

# Hosted Beta Request Browser Proof Brainstorm

## Goal

Prove the public owner beta request front door through a real browser path before relying on the terminal-only request chain proof. The proof should exercise `/owner/sign-in`, submit the request form, verify hosted Neon recorded the request, and leave a non-secret evidence artifact operators can inspect.

## Chosen Approach

Add a disposable browser verifier command instead of adding product UI controls. The command launches an isolated Chrome profile through the existing DevTools Protocol pattern, fills the owner beta request form, waits for the customer-safe success message, verifies the hosted Neon request row and blocked live-provider gates through the Neon CLI, writes a sanitized artifact, and cleans up proof rows unless explicitly retained.

## Boundaries

- No public owner account creation.
- No browser approval or fulfillment button.
- No invite delivery or notification sending.
- No phone/email provider activation.
- No billing, POS, access control, or member-ledger writes.
- Protected Vercel Preview browser proof requires `VERCEL_AUTOMATION_BYPASS_SECRET`.

## Companion Slice

Surface the browser proof command in the Admin portal proof ledger and durable docs so the request-chain proof has a repeatable front-door prerequisite rather than relying on chat memory.
