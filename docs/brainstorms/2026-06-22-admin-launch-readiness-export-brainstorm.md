---
topic: admin-launch-readiness-export
created: 2026-06-22
---

# Admin Launch Readiness Export Brainstorm

## What We're Building

Add a non-mutating operator command that writes a sanitized launch-readiness
artifact for the current protected Preview and hosted Neon proof branch. The
artifact should summarize admin portal proof, protected Preview proof,
customer-observed handoff state, beta request fulfillment state, rollback
readiness, and no-live-provider gates without reading secrets or unlocking
public self-serve.

## Why This Approach

The admin portal already derives the readiness matrix and proof ledger. The next
step is a durable export an operator can attach to review notes before any
self-serve launch conversation. This keeps the launch decision outside the
browser while making it repeatable and reviewable.

## Key Decisions

- Generate artifacts under ignored `artifacts/` paths only when repo-local.
- Require explicit Preview URL, Neon branch, operator label, and source status
  inputs so the command does not need API keys or hosted write access.
- Keep the artifact customer-safe and secret-scanned; reject secret-shaped keys
  and values.
- Include blocked public self-serve and no-live-provider gates as first-class
  output, not footer copy.

## Open Questions

None for this slice.

