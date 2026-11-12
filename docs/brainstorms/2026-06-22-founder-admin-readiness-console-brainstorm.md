---
title: Founder admin owner readiness console brainstorm
date: 2026-06-22
status: complete
---

# Founder Admin Owner Readiness Console Brainstorm

## What We're Building

Add the first production-safe app-side founder/admin readiness console for
operator-assisted beta owners. The console should show the same high-level
readiness picture as `npm run beta:owner-readiness`: beta owner grants, owner
app/Auth linkage, tenant bootstrap counts, live-provider blockers, and rollback
classification.

This is not public self-serve onboarding. It is an authenticated internal support
view that helps an Outpost operator decide whether a beta owner is ready for a
handoff or needs reset/rollback attention.

## Key Decisions

- Use a narrow read-only Neon RPC rather than putting `NEON_API_KEY` or operator
  CLI access into the web app.
- Authorize the RPC through an authenticated active `app_admins` row and active
  founder-admin tenant membership. Normal owner and staff sessions should not
  see the support projection.
- Return only sanitized projection fields: booleans, counts, statuses, tenant
  ids/names, and timestamps. Do not expose grant notes, display names, secrets,
  cookies, raw source content, transcripts, member rosters, or provider
  credentials.
- Keep the console read-only. It must not create owner accounts, send invites,
  enable providers, write billing/POS/member-ledger data, or perform rollback.
- Keep the existing seed/static founder-admin page as the fallback when Neon is
  not configured or the hosted RPC is unavailable.

## Approach Options

1. **Recommended: read-only RPC plus founder-admin page**
   - Pros: app-side support surface uses normal Neon Auth/Data API, keeps
     operator credentials out of the app, and can be browser-tested.
   - Cons: adds a small read-only RPC/migration that needs stronger review.

2. **CLI-only continuation**
   - Pros: already landed and safest.
   - Cons: does not give operators an in-product support surface.

3. **Server-side Neon API key in app route**
   - Pros: avoids new SQL.
   - Cons: unacceptable support/admin credential boundary for a customer-facing
     app deployment.

## Scope Boundaries

- No public owner self-signup.
- No invite delivery or Auth admin provisioning.
- No phone/email provider activation.
- No notifications.
- No billing, POS, access control, or member-ledger writes.
- No support mutations, reset buttons, or rollback execution.
- No raw customer content beyond operational readiness counts.

## Success Criteria

- `/founder-admin` has a hosted Neon mode that is locked unless the session is a
  founder admin.
- Founder admins see a read-only readiness list with grant, app/Auth, tenant,
  workflow-count, provider, and rollback states.
- Owner/staff/non-auth sessions do not receive readiness rows.
- Static tests cover the RPC authorization boundary, no-mutation boundary, UI
  wiring, and no-live-provider copy.
