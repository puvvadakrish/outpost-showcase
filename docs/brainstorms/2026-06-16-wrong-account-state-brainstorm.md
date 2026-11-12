# Wrong Account State Brainstorm

Date: 2026-06-16

## What We're Building

Replace silent cross-role redirects with a role-aware state for signed-in users
who reach the wrong workspace:

- staff account on `/owner` or `/owner/locations`,
- owner account on `/staff/tasks`,
- authenticated account with no active membership in the first visible tenant.

Signed-out users should still redirect to the relevant sign-in page.

## Why This Approach

The previous session polish correctly separated owner and staff routes, but the
wrong-role path sent users back to sign-in without explaining what happened.
During beta, that is likely to feel broken because the seeded owner and staff
accounts intentionally use different roles. The smallest useful slice is a
read-only explanation surface with a sign-out action and a link back to the
current role's workspace.

## Key Decisions

- Reuse the existing `AppShell` and sign-out server actions.
- Do not add schema, RPCs, RLS policies, providers, notifications, or staff task
  workflow changes.
- Keep the hard boundary: wrong-role users do not load the destination
  workspace data.
- Copy should be operational and short: state the current account, expected
  role, and next action.
- Mobile layout must avoid horizontal overflow.

## Non-Goals

- Multi-tenant account switching.
- Invite delivery, email notifications, or live provider setup.
- Hosted Supabase proof.

