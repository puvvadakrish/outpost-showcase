# Hosted Launch Package Proof Brainstorm

Date: 2026-06-23

## Scope

Build the next two SaaS slices after the admin launch package record work:

1. A hosted launch-package record proof command that composes the existing proof, bundle, message, and import commands without weakening the customer-observed gate.
2. A read-only admin portal summary that shows whether the current Preview and Neon branch have a complete launch package record, plus the exact missing proof gates.

## Architecture Notes

- The launch package import must remain terminal-only and downstream of real evidence.
- The existing `admin:launch-package:record` command correctly refuses bundles unless `customer_observed_completion_claimed` is true. Do not bypass that check.
- The new hosted proof command should verify persisted hosted proof state before writing:
  - matching `vercel_preview_verify` proof run
  - matching `hosted_founder_admin_readiness` proof run
  - matching customer-observed handoff gate record
  - at least one owner beta access fulfillment receipt
  - a rollback-ready disposable owner workspace for the fulfilled owner email
- If those prerequisites are present, it may generate the sanitized launch bundle and owner handoff message, import the package record, and verify that the record exists for the same app origin and Neon branch.
- The admin portal should remain a read-only operational cockpit. No browser approval buttons, no public self-serve toggles, and no live-provider controls.

## Product Boundary

This is launch-readiness packaging, not launch. It does not add owner self-signup, invite delivery, phone/email provider activation, notifications, billing, POS, access control, or member-ledger writes.

## UX Direction

Keep the admin portal dense and operational:

- Show one compact launch package readiness summary near the proof ledger.
- Use short state chips and concrete details.
- Surface the operator command only as copyable-looking text; do not add browser mutation actions.
- Make missing evidence easy to scan without making the page feel like a marketing checklist.
