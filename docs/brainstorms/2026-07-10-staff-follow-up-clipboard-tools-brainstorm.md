---
date: 2026-07-10
topic: staff-follow-up-clipboard-tools
---

# Staff Follow-Up Clipboard Tools

## What We're Building

Give staff three explicit local copy commands in selected task detail: requester
contact, suggested next step, and a compact staff task brief. Ship each command
as an independently reviewed batch over one shared clipboard feedback and
fallback contract.

## Why This Approach

The workboard now helps staff find and traverse work, but staff still retype the
contact and handoff context into their normal phone/email workflow. Local
clipboard commands reduce that repetitive work without connecting an outbound
provider or implying that Outpost sent anything.

`mailto:`, `tel:`, share sheets, and message composition were rejected because
they begin an external action and need a deliberate delivery/audit contract.
Copying raw provider payloads, proof metadata, audit events, tenant IDs, or task
IDs was rejected because staff need operational context, not internal data.

## Key Decisions

- Clipboard writes happen only after an explicit staff click.
- Every command uses the existing selectable fallback when clipboard access is
  missing or denied.
- A monotonically increasing request token prevents out-of-order clipboard
  promises from showing stale feedback when commands are clicked quickly.
- Selection changes invalidate pending feedback and clear fallback content.
- Contact and next-step copies preserve the staff-visible field value.
- The task brief is a pure, whitespace-normalized projection containing only
  requester, contact, channel, intent, summary, and suggested next step.
- Add no external launch, message composition, delivery, notification,
  provider behavior, task write, invite, public self-serve, billing, POS,
  access-control, or member-ledger behavior.

## Open Questions

None. Existing selected-task fields and the established copy-link fallback
contract define the behavior.

## Next Steps

Ship Copy contact, Copy next step, and Copy task brief as three PRs.
