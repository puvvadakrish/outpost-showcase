---
title: "Admin protected Preview walkthrough batch"
date: 2026-06-28
status: captured
---

# Admin protected Preview walkthrough batch

## Problem

The continuous readiness batch now bridges the handoff proof bundle and
handoff-readiness packet, but the next operator step is still mostly implicit:
use that manifest to run an internal protected Preview walkthrough across
Admin, owner, staff, and reset/rollback surfaces. The system should record this
as an internal proof packet without claiming a real customer-observed handoff.

The closeout should also stop presenting only two slices when the actual SaaS
readiness work is a batch. The Admin surface and durable docs need to name the
next set of readiness gates so future turns can continue from the artifact
chain instead of chat memory.

## Chosen Approach

Add a terminal-only protected Preview walkthrough record and inspect command.
The record consumes `admin_continuous_readiness_batch`, requires operator yes
confirmations for Admin, owner, staff, reset/rollback, no unexpected data, and
blocked live-provider claims, and writes one sanitized artifact under
`artifacts/`.

Expose the packet in `/admin` and let the packet show a batch runway with more
than two downstream items: customer-observed handoff, limited operator-assisted
beta onboarding, public self-serve preflight, and live-provider/revenue gates.

## Alternatives Rejected

- **Browser approval buttons in Admin:** rejected because operator proof must
  remain terminal-only until public self-serve is intentionally designed.
- **Automatic Chrome/protected Preview proof in product code:** rejected
  because Vercel bypass/session handling is an operator/CI concern, not a
  product runtime path.
- **Customer completion claim:** rejected until the real gym owner observes the
  protected Preview and handoff path.

## Success Criteria

- One command records an internal protected Preview walkthrough artifact from
  sanitized operator evidence.
- One inspect command verifies parent SHA, Preview/Neon context, required
  observations, and all blocked gates.
- `/admin` exposes the new commands and a batch runway with more than two next
  readiness items.
- Tests cover happy path, parent tampering, missing observations, unsafe
  branches, existing output, and secret-shaped values.

## Next Gate

After this batch, run the protected Preview walkthrough against the real
Preview with the user-accessible Chrome path or a Vercel automation bypass
secret. Only then schedule the customer-observed handoff gate with the real gym
owner.
