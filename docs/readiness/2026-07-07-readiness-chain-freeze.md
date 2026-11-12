# Readiness Chain Freeze

Date: 2026-07-07
Local main: `193c32c`
Frozen tip: `admin:public-request-first-gym:real-evidence-refresh-coordinator`

## Decision

Freeze the public request first-gym readiness chain at the real evidence refresh
coordinator. The chain stays runnable, but it should not be extended with more
prepare/inspect control artifacts, SHA-pinned readiness layers, or generated
operator packets unless a real blocker appears during a scheduled Acme Fitness owner/customer session.

The chain has already done its useful job: it makes proof fabrication difficult
and keeps public self-serve, live providers, invite delivery, billing, POS,
access control, and member-ledger writes blocked. More control layers now add
process cost without increasing product readiness.

## Thaw Trigger

Thaw only when a real Acme Fitness owner/customer session is scheduled and the
operator has honest protected Preview observations to record. Do not thaw for
synthetic rehearsals, missing local artifacts, or speculative launch planning.

## Live Commands To Keep

- Pre-run guard:
  `npm run admin:public-request-first-gym:real-evidence-execution-guard`
- Guard inspector:
  `npm run admin:public-request-first-gym:real-evidence-execution-guard:inspect`
- Refresh coordinator:
  `npm run admin:public-request-first-gym:real-evidence-refresh-coordinator`
- Refresh coordinator inspector:
  `npm run admin:public-request-first-gym:real-evidence-refresh-coordinator:inspect`
- Hosted rehearsal evidence:
  `npm run admin:public-request-hosted-rehearsal:evidence && npm run admin:public-request-hosted-rehearsal:evidence:inspect`
- Customer-observed session:
  `npm run admin:customer-session:record && npm run admin:customer-session:inspect`
- Hosted digest proof:
  `npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof`

## Thaw Sequence

1. Run and inspect the real evidence execution guard immediately before the
   protected Preview hosted rehearsal command, using the same transient env
   values the manual proof command will use.
2. Require the guard to report `guard_state:
   ready_to_run_next_real_command`.
3. Record only honest hosted rehearsal evidence, then run its inspector.
4. Run the refresh coordinator sequence exactly as recorded by the coordinator.
5. After the real customer-observed session, record the customer session and
   inspect it.
6. Record the hosted digest proof using the single hosted digest proof command
   row, then run its proof command.
7. Regenerate the existing chain through the refresh coordinator. Do not add a
   new chain layer.
8. Only after inspectable hosted and customer evidence exists, continue to the
   existing first-gym go/no-go, first-gym run, and limited beta review commands.

## Current Product Direction

While the chain is frozen, the next SaaS readiness work is product code, not
more launch-control artifacts:

- Replace first-visible-tenant workspace selection with membership-derived
  tenant/session resolution for v1 single-tenant users.
- Add a Neon-backed jobs/outbox substrate drained by a guarded internal route.
- Inspect and port the RequestHandoff Retell phone handling into Outpost's
  provider adapter boundary.
- Add provider-agnostic inbound email ingestion, with Resend inbound as the
  first adapter unless evidence says otherwise.
- Move new real evidence records to append-only Neon records; treat local
  `artifacts/` as scratch/provenance, not the durable system of record.

Provider adapter work remains offline and no-live-delivery until a separate
proof track deliberately opens live providers. Do not place or receive live
calls, send email, deliver invites, or mark provider connections live as part
of the frozen-chain product work.

## Test Split

`npm test` runs the fast product suite (`tests/**/*.test.ts`).

`npm run test:readiness-chain` runs the frozen chain/script suite
(`tests/**/*.test.mjs`) and should be used only when a change plausibly affects
readiness scripts, package aliases, or proof-command behavior.

`npm run check` runs `npm run typecheck && npm test`.
