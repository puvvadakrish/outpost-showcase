--- title: "Admin Handoff Scheduling Packet" date: 2026-06-26 status: complete ---
# Admin Handoff Scheduling Packet Brainstorm

## Scope

After the admin launch evidence bundle is prepared, operators need a
customer-safe agenda for scheduling a real owner-observed session. This should
not mark the session complete or send an invite. It should tell the operator
what to walk through, what to stop on, and which no-live-provider gates remain
closed.

## Approach Chosen

Add two terminal-only slices:

- `admin:handoff-scheduling:packet` prepares a JSON scheduling packet from the
  launch evidence bundle after first running the bundle inspector.
- `admin:handoff-scheduling:inspect` re-hashes the launch evidence bundle,
  reruns its inspector, and verifies the scheduling packet keeps completion,
  invite delivery, public self-serve, providers, notifications, billing, POS,
  and member-ledger writes blocked.

## Non-Goals

- No invite delivery or notification sending.
- No customer-observed completion record.
- No owner account creation or public self-serve signup.
- No provider activation, email ingress/outbound, billing, POS, access-control,
  or member-ledger writes.

## Success Criteria

- `/admin` exposes prepare/inspect commands for scheduling.
- The packet contains customer session agenda and support checklist.
- The inspector rejects stale launch evidence hashes and forged completion or
  invite claims.
