---
topic: admin-launch-decision-packet
date: 2026-06-24
---

# Admin Launch Decision Packet Brainstorm

## What We're Building

Build the next two SaaS launch-governance slices after the hosted launch package
record proof:

1. A hosted terminal command that creates a sanitized admin launch decision
   packet from the inspected launch-readiness bundle and the matching hosted
   Neon launch package record.
2. A read-only `/admin` summary that shows whether the current Preview and Neon
   branch are ready for that packet, including the exact command and blocked
   gates.

This is a final review packet for operators, not product launch enablement.

## Why This Approach

The current chain proves protected Preview, admin portal visibility,
customer-observed handoff, launch bundle generation, and hosted package record
import. The missing step is a concise go/no-go review artifact that ties those
proofs together without adding a browser approval button or mutating product
launch state.

Keeping the packet terminal-only preserves the existing safety boundary:
operators can attach the packet to PR/release review, but the application cannot
approve itself for public launch.

## Key Decisions

- Query hosted Neon for a matching `admin_launch_package_records` row instead
  of trusting only local artifact files.
- Require the inspected bundle path, Preview origin, Neon proof branch, package
  row, and launch bundle hash to match before writing the packet.
- Mark the packet as `manual_launch_review_packet`, with public self-serve and
  launch enablement explicitly false.
- Surface the command and packet status in `/admin` using the existing dense
  operations layout.
- Keep phone/email providers, invite delivery, notifications, billing, POS,
  access control, and member-ledger writes blocked.
- Use Claude Code Opus 4.8 with the Compound `/ce-code-review` semantics as the
  default after each non-trivial Outpost slice; reserve official `/code-review`
  for PR-comment review when a GitHub PR already exists.

## Non-Goals

- No public owner self-signup.
- No browser approval or launch button.
- No invite delivery, email sending, notification sending, or provider ingress.
- No billing, POS, access-control, or member-ledger writes.
- No production promotion claim.

## Success Criteria

- `hosted:launch-decision:packet` fails closed without hosted Neon config and
  writes only a secret-scanned JSON artifact when all proof rows match.
- `admin:launch-decision:inspect` rejects packets that allow public launch,
  launch enablement, invite delivery, or live providers.
- `/admin` shows launch decision packet readiness without exposing secrets.
- Tests cover the script registration, fail-closed checks, domain projection,
  and rendered admin summary.
