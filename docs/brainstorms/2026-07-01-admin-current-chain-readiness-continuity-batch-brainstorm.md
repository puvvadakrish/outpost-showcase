---
title: Admin current-chain readiness continuity batch
type: brainstorm
status: complete
date: 2026-07-01
---

# Admin Current-Chain Readiness Continuity Batch

## What We're Building

Continue the public-request readiness chain after the current-chain self-serve launch preflight. The next batch should prove that the newly merged public-request artifacts can drive downstream launch controls, next-readiness, request intake, and follow-up readiness without falling back to older approved-gym artifact kinds.

## Why This Approach

The stable operator command surface already exists for public launch controls, next readiness, intake artifact, and follow-up readiness. Duplicating those scripts would add noise and two operator paths. A better bridge is to let the launch controls batch validate either legacy or current-chain self-serve preflight parents, then pin whichever parent SHA/kind was actually used.

## Key Decisions

- Preserve no-live-provider gates: no public signup, browser approval, invite delivery, Auth admin provisioning, provider ingress/egress, notifications, billing, POS, access control, or member-ledger writes.
- Keep launch controls as the compatibility boundary between old approved-gym artifacts and new current-chain public-request artifacts.
- Prove downstream continuity through tests rather than adding browser write behavior.
- Use browser smoke only for Admin portal visibility; artifact chain behavior remains terminal/test driven.

## Success Criteria

- Current-chain `admin_public_request_self_serve_launch_preflight` can prepare and inspect public launch controls.
- Controls, next readiness, public request intake, and follow-up readiness all chain SHA evidence from the current-chain parent.
- Existing legacy tests still pass.
- Admin portal continues to show terminal-only guidance and blocked gates.
