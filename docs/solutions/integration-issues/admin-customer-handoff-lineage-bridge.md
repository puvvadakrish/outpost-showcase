---
title: Admin Customer Handoff Lineage Bridge
category: integration-issues
date: 2026-06-29
status: active
---

# Admin Customer Handoff Lineage Bridge

## Problem

The Admin readiness flow had two customer-session lineages:

- Older `admin_handoff_scheduling_packet` artifacts used by `admin:customer-session:record`.
- Newer `admin_customer_handoff_scheduling_batch` artifacts produced after protected Preview walkthrough proof.

Using the older recorder directly from the newer readiness batch would fail kind validation or encourage operators to skip the newer parent SHA chain.

## Solution

Add a bridge artifact, `admin_customer_handoff_gate_preflight`, between scheduling and the real customer-observed session. The bridge consumes the newer scheduling batch, verifies its parent SHA, and emits the exact customer observations and command templates for the eventual owner-observed session without claiming completion.

`admin:customer-session:record` and `admin:customer-session:inspect` now accept both scheduling lineages. They still require all real owner-observed confirmations before recording customer proof.

## Guardrails

- Customer-observed completion remains false in preflight artifacts.
- Session record still requires explicit owner-present and observation env vars.
- Public self-serve, invite delivery, notifications, providers, Auth admin product APIs, automatic grants, billing, POS, access control, and member-ledger writes remain blocked.
- Prefer adding a small bridge artifact when readiness lanes diverge rather than rewriting historical artifacts or bypassing parent SHA verification.
