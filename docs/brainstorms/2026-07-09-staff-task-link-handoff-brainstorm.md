---
date: 2026-07-09
topic: staff-task-link-handoff
---

# Staff Task Link Handoff

## What We're Building

Make an individual staff task addressable with `/staff/tasks?taskId=<id>`, then
add a staff-only command that copies the selected task link for shift handoff.
The recipient must still authenticate as staff for the same tenant before the
task can be selected.

## Why This Approach

The recent action-lane work makes task pressure visible, but staff still need to
find a referenced task manually. A tenant-validated deep link plus local
clipboard copy is the smallest cross-user workflow improvement. Admin/Owner
queue links were rejected because hosted role enforcement correctly denies
those roles on the staff workspace. Another selected-task explanation was also
deferred because it adds less workflow value than addressability.

## Key Decisions

- Validate requested IDs only against the task rows already loaded for the
  resolved tenant; unknown and foreign IDs silently use the normal fallback.
- Revalidate against tenant-keyed local draft tasks during local hydration.
- Put only the opaque task ID in the URL: no requester, contact, intent, tenant
  slug, or other customer data.
- Copy to the local clipboard only. Do not add sharing, messaging, mailto, or
  outbound delivery.
- Ship deep-link selection and clipboard handoff as separate PRs.

## Open Questions

None. Existing staff role enforcement, tenant-scoped task loading, and client
selection behavior define the required boundary.

## Next Steps

Create and execute one plan for deep-link selection, followed by one plan for
the copy-link command and round-trip verification.
