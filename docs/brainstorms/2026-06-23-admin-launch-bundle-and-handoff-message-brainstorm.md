---
topic: admin-launch-bundle-and-handoff-message
date: 2026-06-23
status: captured
---

# Admin Launch Bundle And Handoff Message Brainstorm

## What We're Building

Two adjacent operator-artifact slices:

1. A single launch-readiness bundle command that composes the existing admin
   export, inspection, promotion, and release-note artifacts into one
   secret-scanned manifest under `artifacts/`.
2. A customer-safe beta owner handoff message packet generated from an existing
   prepared handoff bundle. The packet gives an operator paste-ready handoff
   language without sending an invite, provisioning an account, or claiming the
   customer-observed session happened.

## Why This Approach

The admin portal already exposes the right evidence gates, but an operator still
has to run several commands and mentally connect the resulting files. A bundle
manifest gives the launch packet one durable index and makes later PR/release
review less dependent on chat memory.

The owner handoff path already has checklist, packet, completion, gate, and
record commands. What is missing is a customer-safe message artifact that an
operator can review and adapt before a real beta owner session. Keeping it as a
file preserves the no-live-provider boundary.

## Key Decisions

- Keep both slices non-mutating and artifact-only.
- Reuse the existing fail-closed scripts instead of reimplementing their gate
  checks.
- Require generated artifacts to live under ignored `artifacts/` when
  repo-local.
- Scan generated JSON and Markdown for secret-shaped values.
- Do not add browser approval, fulfillment, reset, invite, provider,
  notification, billing, POS, access-control, or member-ledger actions.

## Rejected Options

- Add a browser button to generate or approve launch bundles. Rejected because
  the admin portal must stay read-only at this stage.
- Send an email or invite from the handoff message generator. Rejected because
  invite delivery and notification sending remain blocked.
- Treat bundle generation as hosted proof. Rejected because these artifacts are
  operator packaging, not live runtime proof.

## Success Criteria

- `npm run admin:launch-readiness:bundle` creates export, promotion, release
  note, and manifest artifacts from explicit operator-supplied evidence states.
- The bundle command fails closed for incomplete promotion gates, unsafe paths,
  local Preview URLs, and secret-shaped values.
- `npm run beta:owner-handoff:message` creates a customer-safe Markdown message
  from a prepared handoff bundle without recording completion or sending
  anything.
- `/admin` surfaces the launch bundle command as a read-only next command.
- Tests cover happy path, failure path, no-live-provider boundaries, and package
  command registration.

## Open Questions

None for this slice.
