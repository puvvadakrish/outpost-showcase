---
title: Admin Launch Promotion Gate
type: brainstorm
date: 2026-06-22
---

# Admin Launch Promotion Gate

## What We're Building

Add a fail-closed CLI gate that promotes the existing admin launch-readiness
export from "review artifact" to "promotion candidate checked." The gate should
read the sanitized JSON artifact, verify the same no-live-provider and
public-self-serve blocks, and require explicit operator evidence that the
artifact came from a protected Preview and hosted Neon branch.

This is not public self-serve launch. It is the review checkpoint before any
future launch-enabling slice.

## Why This Approach

The previous slice created a secret-scanned artifact and an inspect command.
The next smallest step is a promotion verifier that can be run from a PR,
release checklist, or local operator terminal without granting browser approval
power or mutating hosted data.

The CLI should stay the source of enforcement because it can fail CI/operator
flows closed. The browser should remain read-only.

## Key Decisions

- Reuse the existing launch-readiness export artifact instead of introducing a
  new database table or hosted write.
- Require all launch review prerequisites to be `ready`, while preserving
  `Live-provider and billing gates` and `Public self-serve launch` as blocked.
- Require a non-local HTTPS Preview URL and Neon proof branch in the artifact.
- Produce a small promotion summary artifact under ignored `artifacts/`.
- Keep phone/email providers, invite delivery, notifications, billing, POS,
  access control, member-ledger writes, and public signup blocked.

## Success Criteria

- Promotion verifier passes on a ready export artifact and writes a secret-free
  summary.
- Promotion verifier fails on pending customer handoff, local Preview URLs,
  missing Neon branch, secret-shaped values, or unblocked live/self-serve gates.
- The package exposes a named command for repeatable operator use.

## Open Questions

None for this slice. The future question is what reviewed launch-enabling slice
will consume the promotion summary; this slice deliberately does not answer it.
