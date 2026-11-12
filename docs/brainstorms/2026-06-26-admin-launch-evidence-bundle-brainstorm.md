--- title: "Admin Launch Evidence Bundle" date: 2026-06-26 status: complete ---
# Admin Launch Evidence Bundle Brainstorm

## Scope

After source apply completion and email task completion records exist, operators
need one customer-safe prelaunch evidence artifact that says what has been
observed and what remains blocked. This should be repeatable from `/admin`
without relying on chat memory.

## Approach Chosen

Add two terminal-only slices:

- Prepare a launch evidence bundle from the source and email completion records.
- Inspect the launch evidence bundle by re-hashing child artifacts and rejecting
  any self-serve, customer-observed, live-provider, email, notification,
  billing, POS, access-control, or member-ledger claims.

The bundle is deliberately not the existing launch-readiness promotion bundle.
That existing path requires customer-observed completion. This new bundle sits
earlier: it is an internal operator go/no-go packet for deciding whether a real
customer-observed session can be scheduled.

## Non-Goals

- No Neon writes.
- No public self-serve, invite delivery, or customer-observed completion claim.
- No website scraping, Google import, automatic approval, or automatic tasking.
- No Gmail, Resend, SMTP, provider webhooks, inbound email, outbound delivery,
  notifications, phone/email provider activation, billing, POS, access-control,
  or member-ledger writes.

## Success Criteria

- `/admin` exposes prepare/inspect commands for the launch evidence bundle.
- The prepare script refuses missing or unsafe child completion records.
- The inspect script refuses forged bundle hashes or opened gates.
- The bundle is safe to hand to an operator as a pre-self-serve go/no-go packet.
