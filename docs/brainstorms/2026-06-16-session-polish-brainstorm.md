# Session Polish Brainstorm

Date: 2026-06-16

## Slice

Make the owner and staff beta surfaces feel account-aware without expanding the
backend product boundary:

- show the signed-in user identity in shared app chrome,
- provide a clear sign-out affordance,
- redirect signed-out backend users to the matching sign-in page,
- redirect already-authorized users away from sign-in forms,
- keep live providers and hosted proof out of scope.

## Boundary

This is a UI/session-routing slice over existing Supabase Auth, RLS, and
tenant-membership data. It does not add schema, RPCs, provider delivery,
webhooks, notifications, billing, POS/member-ledger writes, or hosted Supabase
proof.

## Architecture Notes

- Use the signed-in Supabase server client and existing RLS-readable
  `tenant_memberships -> users` relationship to derive display identity.
- Do not use service-role reads for session chrome.
- Keep role gating conservative:
  - `/owner` requires an authenticated user when Supabase is configured, then
    either loads owner-visible state or shows owner bootstrap.
  - `/staff/tasks` requires an authenticated user when Supabase is configured,
    then loads tenant-scoped staff task state through existing repository
    paths.
  - sign-in pages redirect only when the authenticated account has the matching
    active role, so a staff account does not get mistaken for an owner account.
- Put sign-out in one shared server action that clears the Supabase session and
  redirects to the role-specific sign-in page.

## Design Notes

- This is operational SaaS chrome, not a marketing moment.
- Keep account UI compact, scan-friendly, and mobile-safe.
- Preserve existing Outpost typography and surface tokens; add only small shell
  variants needed for account context.
- The shell should distinguish tenant context from user context. The current
  tenant stays the page title; the sidebar/footer account block shows the user.

## Risks

- Client components already render `AppShell`, so sign-out must be passed as a
  server action prop rather than imported directly into a client component.
- Membership queries must avoid broadening data access. They should rely on the
  authenticated browser/server Supabase client and RLS.
- Redirects must not break local mode when Supabase env is absent.

