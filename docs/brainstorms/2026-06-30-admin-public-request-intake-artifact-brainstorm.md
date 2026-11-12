---
title: Admin public request intake artifact
date: 2026-06-30
status: captured
---

# Admin Public Request Intake Artifact

## What We're Building

Create the first concrete item after `admin_public_launch_next_readiness_batch`:
a request-only public intake artifact and read-only Admin preview. This gives
operators a repeatable shape for reviewing future public requests without
accepting public submissions or provisioning access.

## Key Decisions

- Chain from `admin_public_launch_next_readiness_batch`, not older approved-gym
  artifacts.
- Keep the artifact read-only and non-persistent. It may carry operator-entered
  preview metadata, but it must not represent a public form submission.
- The Admin portal should expose command guidance only; no submit, approve,
  provision, invite, or send buttons.

## Success Criteria

- Prepare/inspect scripts preserve parent SHA and fail closed.
- All launch, send, create, provider, revenue, POS, access-control, and
  member-ledger gates remain false.
- Tests cover happy path, parent tamper, nested read-only preview tamper, and
  Admin portal wiring.
