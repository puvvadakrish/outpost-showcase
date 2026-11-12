---
title: Beta Browser Handoff Smoke Brainstorm
date: 2026-06-22
status: captured
---

# Beta Browser Handoff Smoke Brainstorm

## What We're Building

Add a generic automated browser handoff smoke command for any operator-assisted
beta gym. It should use the generic beta dry-run onboarding harness for retained
setup and rollback, then launch an isolated Chrome/DevTools session, sign in
through the real `/owner/sign-in` form, verify `/owner` renders the dry-run
tenant and live-provider boundary copy, and write non-secret browser evidence.

## Why This Approach

The Acme Fitness browser smoke already solved the fragile desktop Chrome
automation problem with an isolated Chrome profile. The generic beta dry-run
harness now makes setup and rollback reusable, so the smallest SaaS slice is a
generic browser smoke that composes those pieces. This keeps proof in operator
tooling rather than product state.

## Key Decisions

- Add `npm run beta:browser:handoff`.
- Delegate retained setup and rollback to `npm run beta:dry-run:onboarding`.
- Use `OUTPOST_BETA_BROWSER_*` env names for browser target, headless mode, and
  evidence directory.
- Keep protected Preview proof fail-closed without `VERCEL_AUTOMATION_BYPASS_SECRET`.
- Write browser evidence under ignored `artifacts/`.
- Preserve no-live-provider gates and no customer-observed completion claim.

## Rejected Approaches

- Use the active desktop Chrome/Codex extension as the automated path. It is
  useful for manual proof, but the repo already learned that desktop-window
  attachment can fail from the agent runtime.
- Add persisted product proof state. Browser evidence is operator proof and
  should stay outside the app database for now.
- Reuse `acme:browser:handoff` with generic env values. ACME still has
  customer-zero-specific packet/evidence semantics.

## Success Criteria

- A generic browser smoke command exists and is documented.
- Tests prove it launches isolated Chrome/CDP, uses the generic dry-run command,
  submits the real owner sign-in form, checks `/owner` proof copy, writes
  non-secret evidence, and preserves no-live-provider gates.
- Durable docs record that this is generic operator browser proof, not a real
  customer-observed completion.

## Open Questions

None for this slice.
