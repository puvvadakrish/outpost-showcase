---
date: 2026-06-09
topic: outpost-backend-persistence-deployment
status: proposed
scope: technical-architecture-and-deployment-only
origin:
  - docs/brainstorms/2026-06-08-outpost-product-thesis-brainstorm.md
  - docs/plans/2026-06-08-feat-outpost-production-saas-plan.md
  - docs/brainstorms/2026-06-09-outpost-technical-architecture-brainstorm.md
---

# Outpost Backend Persistence And Deployment Brainstorm

## Fixed Product Boundary

This brainstorm does not change product scope. Outpost remains a standalone gym
front-desk automation SaaS with phone and email first, Meta/IG as fast follow,
and no ClubOS, POS, payment processing, billing recovery, member-ledger writes,
live calls, live provider configuration, webhook receivers, or email automation
in the next implementation slice.

The goal is to decide the production spine before converting browser-local
owner and staff workflows into backend-backed SaaS behavior.

## Current Repo State

The merged architecture and workflow slices established:

- Next.js App Router, React, TypeScript, and Vitest.
- SQL-first Postgres schema stubs in `db/schema.sql`.
- Tenant/location/user/role, answer-bank, handoff, notification, provider,
  channel-event, task-event, audit, support-access, and usage placeholder
  models.
- Browser-local owner setup CRUD for answer-bank, handoff-rule, and
  notification-destination records.
- Browser-local staff task detail workflow with status transitions, assignee
  updates, notes, and local task events.

The repo still does not have production auth, sessions, migrations, RLS,
database clients, server actions, API route handlers, queue/workers, object
storage, CI, observability, secrets documentation, deployment configuration, or
provider ingress.

Scala, `scalac`, `cs`, and Coursier are not part of this stack. They were only
checked during local Claude diagnostics and should not influence Outpost's SaaS
architecture.

## Stack Decision

Keep the current product stack:

- **Web app:** Next.js App Router on TypeScript.
- **UI/domain:** React plus focused TypeScript domain modules.
- **Transactional data:** Postgres.
- **Auth and tenant authorization:** Supabase Auth plus Postgres Row Level
  Security, unless a future plan explicitly replaces both together.
- **Tests:** Vitest for domain/application logic, plus browser verification for
  significant UI changes.

This is the right default for Outpost because the product is a multi-tenant
operational SaaS with relational tenant/location boundaries, approval history,
tasks, audit events, provider events, and usage records. A rewrite or Scala/JVM
service split would add complexity before there is a live workflow that needs
it.

## Deployment Direction

Use a simple managed production spine:

- **Vercel** for the Next.js web app and preview deployments.
- **Supabase** for Postgres, Auth, RLS, local development, and SQL migrations.
- **Supabase Storage or Cloudflare R2/S3** for future transcripts, recordings,
  email payload references, and import snapshots. Do not store raw recordings,
  secrets, or large provider payloads in audit rows.
- **Inngest or Trigger.dev** for durable background work when provider/email
  work begins. Webhook handlers should validate, normalize, persist, and enqueue
  quickly rather than run long classification or delivery work inline.
- **Sentry plus structured logs** for web/app errors, server action failures,
  provider-event failures, queue failures, and support/debug traces.
- **GitHub Actions** for typecheck, tests, build, and migration validation.

This direction is intentionally managed-service first. Outpost should avoid
custom auth, custom queues, custom file storage, or custom deployment
orchestration until the product has real scale or compliance pressure that
justifies owning those systems.

## Clean Architecture Direction

Before backend persistence, split the code into explicit boundaries:

- **Domain:** entities, value objects, status transitions, readiness
  computation, approval rules, routing rules, usage-event shape.
- **Application services:** use cases that orchestrate domain logic and
  persistence. Examples: approve answer, edit answer draft, route answer to
  human, add handoff rule, create task, transition task, add task note, record
  audit event, compute readiness.
- **Ports:** repository interfaces and clock/id generation interfaces used by
  application services.
- **Adapters:** Supabase/Postgres repositories, Next.js server actions, route
  handlers, future provider webhooks, future queue functions, and future object
  storage clients.
- **UI:** owner/staff/founder screens that call application services through
  server actions or thin client boundaries, not direct database queries.

The current domain modules can stay. The important next step is preventing
React components, provider handlers, and database clients from becoming the
place where business rules live.

## Bounded Contexts

Recommended initial bounded contexts:

- **Tenancy and identity:** tenants, users, memberships, locations, roles,
  invitations, support/admin access.
- **Answer approval:** source documents, source facts, answer-bank entries,
  answer revisions, approval status, runtime behavior.
- **Handoff policy:** always-human topics, route/notify/transfer intents,
  active windows, destination references.
- **Task workflow:** tasks, task events, status transitions, assignment, notes,
  unresolved-work views.
- **Channel events:** provider connections, conversations, normalized channel
  events, idempotency keys, payload digests/refs.
- **Audit and support:** audit events, support-access grants, admin actions,
  incident/debug traces.
- **Usage and entitlements:** plans, entitlements, append-only usage events,
  period keys, future usage summaries.

## Smallest Next Slice

The smallest next implementation slice after approval should be:

**Backend Persistence And Deployment Spine**

It should create the production foundation without live providers:

1. Choose and document Supabase as the initial auth/Postgres/RLS/migration
   platform.
2. Convert `db/schema.sql` into a real migration path.
3. Add local/preview/prod environment documentation and `.env.example`.
4. Add Supabase client boundaries for server-side use only.
5. Add application-service and repository interfaces for one narrow workflow,
   preferably the smallest owner answer-bank persistence tracer bullet.
6. Add an atomic answer-change boundary so the current answer row, revision row,
   and audit event cannot drift apart.
7. Add deny-by-default RLS policy shape and tests/verification for every table
   reachable by the selected workflow before any customer data or provider
   events are live.
8. Add CI checks for typecheck, tests, build, migration validation, and hosted
   preview tenant-isolation verification.

The slice should not yet add Retell, Resend, Gmail, inbound email, outbound
email, live calls, webhooks, recordings, transcripts, billing, or real usage
overage behavior.

## Alternatives Considered

### Alternative A: Continue Local UI Slices

This is fast and useful for product feel, but it increases the risk that
browser-local shapes harden into the wrong backend contract. It should pause
until auth, persistence, tenant isolation, and migration workflow are planned.

### Alternative B: Jump To Phone Productization

This would create customer-visible value sooner, but it pulls provider secrets,
webhooks, recordings, transfers, usage metering, and support/debugging forward
before tenant isolation and persistence are real. It is too risky.

### Alternative C: Build A Separate Backend Service Now

A separate API/worker service may be useful later for long-running provider
work, but it is premature before the Next.js app has a real persistence seam
and before the first live provider workflow proves its shape.

## Review Gates

Run `architecture-strategist` and `ce-plan` before implementation.

Run `ce-review` before merging any implementation touching:

- Tenant data isolation or RLS policies.
- Auth/session behavior.
- Database migrations that will become production truth.
- Support/admin access to tenant data.
- Provider connections, secrets, webhooks, or signature verification.
- Live calls, transfers, recordings, transcripts, or retention.
- Email ingestion, classification, deliverability, or automatic replies.
- Usage metering that affects billing, overage, or upgrade recommendations.

## Resolved Planning Decisions

- The first backend-backed workflow should be owner answer-bank persistence,
  not staff task persistence. Answer approval is the live-answer safety
  boundary and exercises tenant, location, membership, source, answer,
  revision, and audit shapes without provider ingress.
- The first implementation pass should be a tracer bullet, not the full answer
  lifecycle. Loading answer-bank state plus editing one draft answer with an
  atomic revision and audit append is enough to prove the seam; approve, route,
  and retire actions can follow after the persistence/RLS pattern is proven.
- The first managed job runner should be recorded as a future provider/email
  decision. The contract should be documented now: validate incoming events,
  persist normalized events, enqueue durable work, and return quickly.
- Object storage should default to Supabase Storage for initial simplicity, with
  R2/S3 left as an explicit future option if recording/transcript scale,
  compliance, or cost pressure justifies the split.
- A deployment-spine slice should include real hosted-preview verification, not
  only local migration checks. If hosted Supabase/Vercel preview setup is not
  available, the implementation should be renamed or left incomplete rather
  than claiming deployment proof.

## Recommendation

Proceed to a `ce-plan` for backend persistence and deployment spine before
writing backend code. Keep Next.js, TypeScript, Postgres, and Supabase-style
Auth/RLS as the default stack. Select managed infrastructure now, but implement
only the minimal persistence/auth/migration foundation needed to convert one
browser-local owner workflow into tenant-scoped backend state.
