---
title: Admin public request first-gym proof runway
category: integration-issues
date: 2026-07-01
status: solved
tags:
  - admin-portal
  - readiness
  - first-gym
  - fail-closed
---

# Admin Public Request First-Gym Proof Runway

## Problem

After current-chain evidence acquisition, the next work depends on real hosted
and customer-observed proof. The individual proof writers already exist, but
operators needed one durable packet that showed the continuous command sequence
without relying on chat history or prematurely recording completion.

## Root Cause

The readiness chain had strict proof writers but no single bridge artifact for
the execution run. Without that bridge, future operators could confuse
"commands are ready to run" with "proof has been recorded," or skip the order
between hosted rehearsal evidence, customer session proof, first-gym go/no-go,
operator run, limited beta review, and launch controls.

## Solution

Add `admin_public_request_first_gym_proof_runway_batch`. It consumes
`admin_public_request_first_gym_evidence_acquisition_batch`, replays its
inspector, pins the parent SHA-256, and writes a terminal-only execution plan
covering:

- hosted rehearsal evidence
- customer-observed session record
- hosted customer-session digest import and proof
- first-gym go/no-go bundle
- first-gym operator-assisted run
- limited beta operator review
- current-chain self-serve preflight
- public launch controls

Every proof-recording flag remains `false`, and every public/live-provider/
revenue/member-system gate remains blocked.

## Prevention

When real-world evidence is the blocker, use a runway packet instead of
duplicating proof writers. A runway should replay the parent inspector, chain
the parent SHA, list the real commands, and make all completion/proof flags
fail-closed until the real command runs.
