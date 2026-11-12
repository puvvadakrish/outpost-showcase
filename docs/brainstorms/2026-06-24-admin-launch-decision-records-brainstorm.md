---
title: Admin launch decision records
date: 2026-06-24
status: captured
---

# Admin launch decision records

## What We're Building

Add the next two pre-self-serve SaaS slices after the admin launch decision
packet:

1. A terminal-only command that records the human review result for a launch
   decision packet as sanitized hosted Neon evidence.
2. A read-only Admin portal summary that shows the latest decision record and
   history without adding browser approval or launch enablement.

## Why This Approach

The current packet is the final manual-review artifact, but the review outcome
still lives outside durable product state. Recording a small append-only
decision row makes the launch path repeatable for the next operator-assisted
gym while preserving the hard boundary that public self-serve and live providers
remain blocked.

The Admin portal should show the result because operators need one place to
answer: "Is the packet reviewed, and what is still blocked?" The browser stays
read-only to avoid turning internal support visibility into a launch approval
surface.

## Key Decisions

- Store decision records in a new append-only `admin_launch_decision_records`
  table with a founder-admin-gated list RPC.
- Accept only terminal-provided reviewer, decision, and note metadata.
- Keep accepted decisions narrow: `reviewed_for_next_launch_slice`,
  `changes_requested`, and `deferred`.
- Require the packet to keep `launch_enablement_allowed = false`,
  `public_self_serve_launch_allowed = false`, and blocked live-provider gates.
- Render decision state in `/admin` as proof history, not as an approval button.

## Boundaries

- No public owner self-signup.
- No browser approval or mutation controls.
- No invite delivery or notification sending.
- No phone/email provider activation.
- No billing, POS, access control, or member-ledger writes.

## Success Criteria

- The record command fails closed without hosted Neon config, unsafe packet
  content, missing reviewer/decision metadata, production Neon branch, or
  launch-enabling packet values.
- The Admin portal shows the latest decision record and a record command only
  after a decision packet is eligible.
- Tests cover valid recording shape, blocked decisions, unsafe packet rejection,
  and UI summary rendering.
