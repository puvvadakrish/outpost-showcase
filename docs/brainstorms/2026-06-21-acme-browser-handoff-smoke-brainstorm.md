# Acme Fitness browser handoff smoke brainstorm

## What We're Building

Add a repo-owned browser smoke harness for the Acme Fitness dry-run handoff.
The harness should launch an isolated Chrome instance with DevTools Protocol
enabled, create retained dry-run data through the existing verifier, sign in
through the real `/owner/sign-in` page, verify `/owner` renders the disposable
tenant and no-live-provider proof copy, then clean up the dry-run rows through
rollback-only mode.

## Why This Approach

The macOS window-capture bridge failed with `cgWindowNotFound`, and the current
Chrome profile does not expose a CDP port. A harness-owned Chrome profile avoids
both problems while still using a real browser, real app forms, real hosted Neon
Auth, and the protected Preview deployment. This is more durable than asking a
future agent to depend on the active desktop window.

## Alternatives Considered

- Keep manual Chrome extension proof only. Rejected because the handoff gate
  needs repeatable automation when the operator is away.
- Use only `vercel curl`. Rejected because it already passed but does not prove
  form submission and browser navigation.
- Reuse the user's existing Chrome profile. Rejected by default because it
  depends on local profile state and can hit unrelated tabs or permissions.

## Key Decisions

- The harness delegates data setup and cleanup to
  `npm run acme:dry-run:onboarding`.
- Browser automation uses an isolated temporary Chrome profile and CDP.
- Protected Vercel Preview browser runs require
  `VERCEL_AUTOMATION_BYPASS_SECRET`; without it the harness fails closed before
  creating dry-run data.
- The harness does not enable providers, invite delivery, notifications,
  billing, POS, or member-ledger writes.

## Open Questions

None for this slice.
