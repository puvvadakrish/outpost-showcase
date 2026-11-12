---
title: Admin public launch controls batch
status: complete
date: 2026-06-30
---

# Admin Public Launch Controls Batch Brainstorm

## What We're Building

Extend the admin readiness chain after `admin_public_self_serve_launch_preflight`
with a current public launch controls batch. The batch packages the next launch
workstreams together: public request intake as review-only, invite/Auth as
no-send/no-create dry runs, and live-provider/revenue/member-system proof tracks
as blocked.

## Why This Approach

The previous batch created a launch preflight but did not give operators one
current command that summarizes the next workstreams. Older scripts exist for
similar areas, but they hang from earlier proof chains. A small current-chain
artifact avoids chat-memory drift and keeps the launch boundary explicit.

## Key Decisions

- Start from `admin_public_self_serve_launch_preflight`.
- Do not create a public request form, browser approval buttons, invites, Auth
  users, providers, billing, POS, access-control, or member-ledger writes.
- Keep owner access operator-managed until a later reviewed launch gate.
- Represent request intake as request-only and human-reviewed.
- Represent invite/Auth as no-send/no-create.
- Represent live-provider/revenue/member-system work as separate blocked proof
  tracks.

## Success Criteria

- Parent preflight SHA is validated and parent inspector is replayed.
- Artifact is non-secret and under `artifacts/`.
- Admin console shows the batch as read-only command guidance.
- Tests prove happy path and parent-tamper failure.
