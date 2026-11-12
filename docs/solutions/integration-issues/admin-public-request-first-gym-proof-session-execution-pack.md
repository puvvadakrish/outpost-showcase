---
title: "Operator execution packs from proof runbooks"
date: 2026-07-02
category: integration-issues
status: documented
tags:
  - admin-readiness
  - proof-chain
  - customer-safe-runbooks
---

# Operator Execution Packs From Proof Runbooks

## Problem

A proof runbook is enough to tell an operator which commands are missing, but
not quite enough to safely run a live owner/customer session. The operator also
needs preflight observations, a worksheet, and a manifest of expected evidence
without any artifact claiming the session has completed.

## Working Pattern

Create an execution pack that consumes the runbook, pins its SHA-256, replays
the runbook inspector, and derives the session worksheet from the runbook
command sequence. The pack can list what should be seen and what artifacts
should appear later, but every evidence row stays
`recorded_by_execution_pack: false`.

## Prevention

When building readiness tooling around human/customer proof, separate:

- Command source of truth: runbook.
- Session operating surface: execution pack.
- Actual proof claim: dedicated proof command and inspector.

Do not let the session operating surface record customer completion, launch
readiness, provider activation, invite delivery, or revenue/member-system
writes.
