# Beta Fulfillment Preflight Brainstorm

Date: 2026-06-22

## Scope

Outpost can now collect public owner beta access requests, show their lifecycle
in founder-admin, and fulfill a selected request through the operator CLI. The
remaining gap before more real-customer handoffs is an explicit, repeatable
preflight that tells an operator whether a request is safe to fulfill before
they run the mutating command.

## Product Boundary

- Add a non-mutating operator preflight for a selected beta request.
- Show the preflight result in founder-admin as read-only support state.
- Keep the real owner access creation and request fulfillment in CLI-only
  commands.
- Keep temporary passwords, API keys, JWTs, cookies, provider secrets, raw
  request notes, and fulfillment notes out of the browser.
- Do not add approve, decline, fulfill, reset, or rollback buttons to the app.
- Do not enable invite delivery, notifications, live phone/email providers,
  billing, POS, access control, or member-ledger writes.

## Architecture Choice

Use a deterministic preflight projection rather than a new app mutation:

1. Reuse the existing hosted Neon proof-env guardrails from the fulfillment
   command.
2. Read the selected request, any matching owner grant, app user/Auth linkage,
   tenant bootstrap state, and provider-gate state.
3. Classify fulfillment readiness as:
   - `ready`: unfulfilled active request with no active grant, no linked app
     user, no tenant, and no live-provider surprises.
   - `attention`: request can be handled, but an operator must review existing
     owner access or bootstrap state before proceeding.
   - `blocked`: request is missing, declined, superseded, already fulfilled,
     production/spike branch targeted, or live-provider gates are not clean.
4. Write no rows during preflight. A separate optional proof row can be added
   later only after a successful mutating fulfillment command; this slice keeps
   the preflight itself dry-run.
5. Render the same classification beside each founder-admin request row so the
   operator sees why the CLI is or is not safe before copying the command.

## Non-Goals

- No new owner-facing UI.
- No automated fulfillment.
- No owner Auth password generation inside the browser.
- No request approval/decline workflow in the browser.
- No customer-observed handoff completion claim.
- No live providers, invite email delivery, billing, POS, access-control, or
  member-ledger writes.

## Design Notes

Keep the preflight attached to each request row as an operational readiness
object. Use compact status rows and short reasons, not a standalone dashboard.
On mobile, the preflight rows should stack beneath the lifecycle ledger without
horizontal overflow.
