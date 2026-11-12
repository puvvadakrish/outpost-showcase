---
title: Admin public request first-gym proof runway batch
type: brainstorm
status: complete
date: 2026-07-01
---

# Admin Public Request First-Gym Proof Runway Batch

## What We're Building

Add a single current-chain operator packet after public-request first-gym
evidence acquisition. The packet should make the next proof run easy to execute
continuously: hosted rehearsal evidence, customer-observed session, hosted
customer-session digest proof, first-gym go/no-go bundle, first-gym operator
run, limited beta review, self-serve preflight, and launch controls.

## Why This Approach

The individual proof writers already exist and have strict inspectors. The
missing product shape is an operator-safe bridge that keeps the sequence visible
without recording proof prematurely. A command-packet-only artifact avoids
parallel proof semantics while giving `/admin` and terminal operators a durable
next batch to run when the real customer/hosted evidence is available.

## Key Decisions

- Consume `admin_public_request_first_gym_evidence_acquisition_batch` as the
  parent and pin its SHA.
- Do not record customer-observed completion, hosted proof, go/no-go, run,
  limited beta, public launch, invite, provider, revenue, POS, access-control,
  or member-ledger claims.
- Keep all live-provider/productization gates false and inspectable.
- Surface the packet in `/admin` as read-only terminal guidance.

## Success Criteria

- New prepare/inspect npm scripts create and verify the runway artifact.
- The inspector replays the evidence-acquisition parent inspector and fails
  closed on parent SHA drift, premature proof flags, and opened gates.
- `/admin` exposes the packet without browser approval buttons or write paths.
