---
title: Production foundation corrections
date: 2026-07-12
status: complete
---

# Production Foundation Corrections

## What We're Building

A bounded correction program before Outpost resumes feature batches. The program closes four production-readiness gaps: missing automated regression gates, unsafe database migration execution, incomplete hosted owner data parity, and insufficient operational/security defaults. It does not expand Outpost's product boundary or enable public self-serve, providers, invite delivery, billing, POS, access control, or member-ledger writes.

## Why This Approach

The modular-monolith direction, tenant model, PostgreSQL authority, transactional RPCs, and phone/email-first product boundary remain sound. The main risk is sequencing: feature throughput has outpaced repeatable deployment, regression, and runtime controls. A rewrite would add risk without addressing those controls. Three independently reviewable batches provide smaller rollback surfaces and let feature work resume after the foundation is demonstrably safer.

## Key Decisions

- Keep the current Next.js modular monolith and Neon/PostgreSQL authority model.
- Establish a fast required PR gate from the existing typecheck, behavioral test, build, and dependency-audit commands. Keep the long evidence/readiness chain outside the routine gate until it is partitioned.
- Remove unused direct Neon beta packages that pull vulnerable Better Auth code; retain only the PostgREST client actually imported by the application.
- Load owner task events from the same authenticated tenant boundary as owner tasks so hosted analytics do not combine hosted tasks with seed events.
- Harden anonymous beta requests in PostgreSQL with a generic response, cooldown, and immutable original request details. This is abuse resistance, not public self-serve enablement.
- Adopt a proven migration ledger and checksum workflow compatible with the existing timestamped SQL migrations. Never reapply the full migration bundle to an established database.
- Add PII-minimal structured server diagnostics and baseline response headers without introducing an observability vendor.
- Reduce admin information overload through progressive disclosure and focused operator navigation while preserving every existing gate and command.

## Architecture Pressure Test

The corrections reinforce existing boundaries: pages orchestrate authenticated application services; repositories remain tenant-scoped; PostgreSQL functions remain mutation authority; CI and migration tooling sit outside domain code. Anonymous-request protection belongs in the database function because application-instance memory cannot provide authoritative throttling on a horizontally scaled host. Migration history belongs in a standard ledger rather than a project-specific control artifact.

## Sequencing

1. Regression and anonymous-ingress baseline: CI, dependency cleanup, owner event parity, beta request hardening.
2. Database deployment integrity: checksummed incremental migrations, baseline procedure, drift validation, and deployment verification.
3. Runtime operations: security headers, PII-safe diagnostics, test-suite tiers, and focused admin information architecture.
4. Re-run hosted protected Preview evidence only after the correction program passes local and adversarial review.

## Success Criteria

- A pull request cannot merge cleanly without typecheck, fast tests, production build, and a high-severity production dependency audit.
- Hosted owner analytics consume hosted tenant task events.
- Repeated anonymous submissions cannot overwrite an existing request's customer-entered details during or after cooldown.
- Established databases receive only pending verified migrations, with checksums and an explicit baseline path.
- Production responses carry reviewed security headers and server failures emit no customer content.
- Staff, owner, and admin browser rehearsals remain usable with no regression in blocked gates.

## Non-Goals

- No provider activation, outbound messaging, invitation delivery, public account creation, billing, POS, access-control, or ledger integration.
- No database platform migration and no big-bang frontend or repository rewrite.
- No claim that local or Preview rehearsal is production customer evidence.

## Resolved Questions

- Database platform remains Neon unless verified evidence requires a change; no such evidence was found.
- Existing schema and feature architecture remain in place; correction work targets deployment and operational controls.
- Fable 5 is advisory only. Local tests, code review, and browser evidence remain authoritative.

## Open Questions

None. The user authorized the safest correction path and asked execution to continue without interruption unless blocked.
