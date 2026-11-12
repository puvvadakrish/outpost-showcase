---
date: 2026-06-30
topic: admin-public-request-first-gym-evidence-acquisition
status: captured
---

# Admin Public Request First Gym Evidence Acquisition Brainstorm

## What We're Building

Add the next current-chain SaaS readiness batch after public request first-gym
go/no-go readiness. The batch should make the real evidence acquisition path
repeatable for the first approved gym without recording any evidence itself.

The packet should point operators to the existing strict commands for:

- approved-gym hosted rehearsal evidence;
- customer-observed session recording;
- hosted customer-session digest import/proof;
- first-gym go/no-go bundle;
- first-gym operator-assisted run record.

## Why This Approach

The repository already has stricter commands that record real proof. Reusing
those commands keeps one source of truth for evidence while letting the newer
public-request chain tell operators exactly what to run next.

This avoids a fake green state. The packet can be prepared before the owner is
available, but hosted rehearsal, customer-observed completion, hosted import,
go/no-go, first-gym run, public self-serve, and live-provider gates all remain
blocked until their real evidence exists.

## Key Decisions

- Add a command-packet artifact, not a proof artifact.
- Chain to `admin_public_request_first_gym_go_no_go_readiness_batch` by SHA.
- Preserve existing real-evidence commands as the only writers of real proof.
- Expose the packet in `/admin` as read-only operational guidance.
- Keep invite delivery, provider activation, billing, POS, access control, and
  member-ledger writes blocked.

## Open Questions

None for implementation. The real customer-observed session still requires the
gym owner to attend.
