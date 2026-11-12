---
topic: runtime-authority-and-tenant-stop
date: 2026-07-13
status: decided
---

# Runtime Authority And Tenant Stop

## What We're Building

A pre-live processing boundary that removes the internal job drain from the
migration-owner credential and gives an authenticated tenant owner an audited,
reversible stop for that tenant's background processing. The stop applies to
job claiming and normalized provider persistence without enabling provider
ingress, delivery, credentials, or any other blocked product gate.

## Why This Is Next

Review of the owner setup expansion found that a UI-only emergency toggle
would be false safety: the current `OUTPOST_DATABASE_URL` can use a migration
owner, and an in-flight job could race a pause. Live provider work must not
start until runtime code has least privilege and PostgreSQL is the single
fail-closed authority.

## Chosen Architecture

- Add a dedicated `outpost_job_runtime` NOLOGIN capability role. A separately
  provisioned login receives membership and only the job claim, settlement,
  pause-deferral, and normalized-persistence function grants.
- Keep runtime processing state in a separate tenant-keyed control table.
  Tenant lifecycle (`setup`, `active`, `paused`, `disabled`) remains account
  authority and is not overloaded with worker state.
- Backfill every tenant to stopped. Missing control rows also mean stopped.
- Claim only null-tenant jobs or tenant jobs whose control is enabled and whose
  tenant lifecycle is not paused/disabled.
- Fence normalized persistence to the exact running job, lease owner, unexpired
  lease, provider context, and claimed pause generation before acquiring shared
  tenant/control locks. A stop takes the conflicting row locks, creating a
  clear commit boundary: work committed before the stop is earlier; stale,
  resumed, recovered, or post-stop work fails without domain writes.
- Convert the specific stopped-state persistence failure into an atomic job
  deferral that clears the lease and reverses the claim attempt. Other failures
  retain the existing retry/dead-letter semantics.
- Require the runtime route to prove its connected role has exactly the
  capability membership and SECURITY DEFINER allowlist, no elevated attribute,
  schema-creation path, function ownership, or direct relation authority before
  claiming work. A migration-owner or drifted URL fails closed.
- Record owner state changes through one security-definer RPC with a
  payload-bound operation key, immutable operation receipt, audit event, and
  row lock. Replays return the original receipt; changed-payload key reuse
  fails.
- Enabling processing is rejected while the tenant lifecycle is paused or
  disabled. It grants no provider credential or ingress path.

## Concurrency Contract

1. A stop committed before persistence acquires its shared lock causes
   persistence to reject without domain writes.
2. Persistence that acquired the shared lock first may finish; the stop waits
   and becomes effective at its commit.
3. A job claimed just before a stop is returned to queued work without losing
   a retry attempt when the persistence guard rejects it.
4. Stopped tenant jobs are not reclaimed until an explicit audited enable.
5. Worker settlement remains lease-owner scoped.
6. A stop followed by enable does not revive a pre-stop lease; generation must
   still match, and a recovered/expired lease cannot persist.
7. Runtime definers resolve `public` before `pg_temp`, and provider identity
   conflicts are serialized and rejected across tenant provenance.

## Rejected Alternatives

- Wrap an unchecked persistence body: rejected because the current owner
  credential could bypass the wrapper.
- Reuse `tenants.status`: rejected because legacy paused/disabled lifecycle
  state has different ownership and resume semantics.
- Check state only in TypeScript: rejected because multiple workers and direct
  function calls would race or bypass it.
- Mark stop rejections as ordinary failures: rejected because administrative
  stops must not consume retry budgets or dead-letter valid work.
- Store a runtime login password in migrations: rejected because migration
  history is not a secret store and Neon branch credentials can differ.

## Scope Boundaries

No webhook, live phone/email provider, outbound delivery, invite delivery,
public self-serve, billing, POS, access-control, or member-ledger behavior is
added. The capability role cannot enqueue arbitrary jobs or write tables
directly. Hosted activation remains a separate deployment operation after the
migration and privilege contract pass.

## Success Criteria

- The internal drain rejects a migration-owner connection.
- The capability role can execute exactly the required runtime mutation RPCs
  and cannot directly read or write application tables.
- Disposable PostgreSQL proves stopped-claim exclusion, in-flight stop
  serialization, attempt-neutral deferral, replay-safe owner control, and
  cross-tenant denial.
- Owner UI state reconciles from authoritative rows and never claims that a
  stop cancels work already committed before the stop transaction.
- Existing local workflows and all blocked gates remain unchanged.

## Open Questions

None. The user authorized the safest architecture path and continuous
execution; production credential provisioning occurs only after the schema and
application contract are merged and verified.
