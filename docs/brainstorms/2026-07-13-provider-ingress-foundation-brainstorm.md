---
topic: provider-ingress-foundation
date: 2026-07-13
status: decided
---

# Provider Ingress Foundation Brainstorm

## Decision

Build provider ingress in three ordered batches: a server-only credential
boundary, provider-specific raw-body signature verification, then a separately
authorized atomic ingress receipt/enqueue transaction. Do not activate a
provider or persist raw transcripts and email bodies in these batches.

## Why This Order

The tenant stop and job runtime are now fail-closed in Production, but the
current authenticated provider-connection read includes `secret_ref`, and the
fixture job shape stores provider payloads that are not suitable for live
customer traffic. A public webhook route must not share the claim/settlement
runtime identity or enqueue unchecked raw payloads.

## Batch Sequence

1. Restrict `secret_ref` to server authority, expose only generated credential
   presence, and resolve abstract secret references through a bounded
   server-only environment adapter.
2. Verify Retell and Resend signatures over the untouched request body with
   their documented replay windows and headers before parsing JSON.
3. Give ingress its own non-owner capability identity and one atomic function
   that validates connection/tenant/location/provider state, deduplicates the
   provider event, and enqueues only a bounded sanitized payload while the
   tenant control remains stopped unless an explicit rehearsal enables it.

## Architecture Boundaries

- Secret values never enter Postgres, domain models, browser data, logs, jobs,
  artifacts, audit payloads, or provider event rows.
- Database references use an Outpost-owned URI, not a Vercel-specific name.
- The environment adapter derives one exact key from the validated reference;
  it cannot read an arbitrary submitted environment variable.
- Signature verification consumes raw bytes/text before JSON parsing.
- Public ingress gets no claim, settlement, normalized persistence, table,
  sequence, schema-create, or function-owner authority.
- Live payload adapters emit only fields required by the existing conservative
  normalizers. Raw transcript, HTML body, recording, and provider response
  objects are not stored in the jobs table.
- Duplicate signed deliveries are idempotent and conflicting reuse fails
  closed.

## Provider Contracts

Retell documents `X-Retell-Signature` as HMAC-SHA256 over raw body plus its
millisecond timestamp with a five-minute replay bound. Resend documents Svix
verification over the raw body using `svix-id`, `svix-timestamp`, and
`svix-signature`. Established provider/Svix implementations should be used
where practical instead of inventing signature formats.

## Protected Route Rehearsal Refinement

The final Batch 3 route is an internal proof seam, not a provider-callable
webhook. It exists only on Vercel Preview when an exact `rehearsal` route mode
is present, requires a dedicated bearer token that is unrelated to Vercel
protection and provider secrets, and receives the opaque ingress lookup UUID in
a header rather than a logged URL. Retell and Resend therefore cannot be pointed
at this endpoint as a live integration.

The handler rejects compressed input, bounds the request stream before
allocation, verifies the untouched UTF-8 body before parsing, and uses signed
provider identity (`call_id` or `svix-id`) plus an exact raw-body digest for the
existing atomic accept transaction. Hosted proof must use a dedicated Neon
proof branch and synthetic signing secrets, restore runtime/connection state in
cleanup, and must not touch Production Neon. A future live-provider design also
needs to bind a credential generation across resolve and accept so concurrent
secret rotation cannot accept an event verified with a superseded secret.

## Explicit Non-Goals

No Retell agent creation, phone number routing, Resend domain/mailbox setup,
outbound reply, task notification, transfer, transcript/recording retention,
provider activation, public self-serve, invite delivery, billing, POS, access
control, or member-ledger write is added.

## Advisor Note

The read-only Fable 5 advisor stalled without output and was stopped. The
fallback was a Compound architecture review against the canonical product plan,
current migrations, runtime authority, provider normalizers, and official
Retell/Resend webhook documentation.
