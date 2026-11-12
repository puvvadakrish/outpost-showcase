---
title: Admin handoff proof batch
date: 2026-06-28
status: captured
---

# Admin handoff proof batch

## Goal

Move the Admin portal from operator-prepared owner/staff access artifacts into a repeatable internal end-to-end handoff proof batch. The batch should make the next gym onboarding testable without relying on chat memory, while still keeping public self-serve, invite delivery, live providers, notifications, billing, POS, access control, and member-ledger writes blocked.

## Scope

Build four chained, terminal-only proof artifacts:

1. Owner access completion proof from protected Preview/browser sign-in evidence after owner access fulfillment.
2. Staff roster claim handoff evidence after staff no-send preflight and owner access completion.
3. Operator-assisted onboarding rehearsal evidence that reconciles owner and staff handoff proof before a real customer-observed pass.
4. Replayable handoff proof bundle that lists the evidence chain, replay commands, ready gates, and blocked gates.

## Approach

Use the existing Admin readiness pattern: local JSON artifacts under `artifacts/`, SHA chaining to parent artifacts, inspect scripts that fail closed, read-only Admin portal packets, and focused tests for script behavior plus domain/UI wiring. Do not introduce database writes, hosted mutations, provider SDKs, browser buttons, invite sending, or customer-visible completion claims.

## Architecture Notes

- This remains an operator evidence layer, not a product provisioning layer.
- Artifacts may contain emails, labels, Preview URLs, and branch names, but must reject secret-shaped keys and values.
- Each child artifact validates its parent artifact kind, status, safety booleans, and SHA.
- The bundle is the batch handoff entry point for the next thorough operator-assisted test run.

## Rejected Alternatives

- Productizing owner/staff provisioning now: rejected because the Auth/admin and invite-delivery gates are intentionally not green.
- Combining all evidence into one unchained artifact: rejected because it weakens auditability and replay.
- Claiming Acme Fitness customer-observed completion: rejected until Acme Fitness actually observes the protected Preview and handoff path.

## Success Criteria

- New scripts and Admin portal panels exist for all four batch artifacts.
- Each inspect script proves no-live-provider and no-send gates remain blocked.
- Focused tests cover happy paths, tampering, unsafe artifact paths, secret-shaped content, and domain/UI packet wiring.
- Full typecheck, tests, build, browser smoke, and Claude Code Opus 4.8 review pass before merge.
