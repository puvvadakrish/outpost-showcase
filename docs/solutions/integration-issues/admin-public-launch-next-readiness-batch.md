# Admin Public Launch Next Readiness Batch

Date: 2026-06-30

## Context

After `admin_public_launch_controls_batch`, the next SaaS work was too broad to
track as two isolated slices. Public intake, invite/Auth dry-runs, provider and
revenue/member-system gates, and limited beta review are connected launch
preconditions.

## Solution

Add a single current-chain artifact,
`admin_public_launch_next_readiness_batch`, that consumes
`admin_public_launch_controls_batch`, records its SHA-256, and packages the next
four workstreams without enabling them.

The artifact explicitly keeps blocked:

- public owner self-signup and public request form submission
- browser approval and automatic approval
- invite delivery, notifications, outbound email, magic links
- product Auth admin APIs, Auth user creation, automatic owner/staff grants
- phone/email providers, provider ingress/egress
- billing, POS, access control, and member-ledger writes

## Durable Learning

When the next steps are co-dependent, prefer a single inspected current-chain
readiness artifact over disconnected older artifacts. The artifact should make
the batch memory explicit while keeping all launch gates false.
