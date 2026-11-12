---
topic: runtime-policy-review-decisions
date: 2026-07-14
status: decided
---

# Runtime Policy Review Decisions

## What We're Building

Append-only owner review evidence for an exact immutable runtime-policy
candidate. An active owner can record `accepted` or `rejected`, and can see only
the latest bounded decision summary needed to continue review. Neither state is
approval to execute and neither creates an active or current policy.

## Why This Is Next

Outpost can compile and persist immutable policy candidates, but it cannot yet
preserve what an owner reviewed. Mutating the candidate or treating an accept
button as activation would collapse human evidence, runtime authority, and
historical provenance into one unsafe boundary.

## Chosen Lifecycle

- A decision is a new immutable row bound to one candidate, location, tenant,
  and database-derived owner actor.
- `accepted` is current-positive evidence. The authenticated server reloads
  tenant-authorized source and recompiles it, and PostgreSQL independently
  requires the target to remain the latest candidate and match the complete
  stored body, compiler revision, canonical source fingerprint, and compiled
  policy fingerprint.
- `rejected` is exact negative evidence. It may target an authorized stale
  candidate without recompilation because it grants no execution authority.
- Later decisions supersede only the bounded effective summary. They never
  mutate or delete earlier rows or audits.
- Exact retry keys replay the original matching row. An immediate same-owner,
  same-state repeat reuses current evidence. A different owner appends distinct
  actor evidence even when choosing the same state.
- Reviews serialize under the same location lock as candidate creation and
  then the candidate lock, so a candidate cannot become stale between the
  positive latest check and the decision insert.

## Authority Boundaries

- Browser input contains only candidate ID, decision intent, and a
  candidate-bound retry key. Tenant, owner, location, policy body, source
  fingerprints, activation state, and executable authority are absent.
- The authenticated server derives the tenant and owner session and performs
  the fresh compile required for acceptance.
- PostgreSQL derives the current actor and candidate relationship, rechecks
  tenant and location authority, and owns append, replay, and concurrency
  semantics.
- The existing `outpost_policy_compiler` capability remains an exact
  one-function candidate writer. Review decisions use role-specific
  authenticated owner RPCs and do not widen that capability.
- Staff, anonymous callers, foreign owners, and disabled owners receive no
  candidate, decision, or review-audit visibility or mutation authority.

## Audit And Presentation

Each new decision emits one owner-only audit containing bounded identifiers,
decision state and sequence, decision-time latest evidence, and explicit
non-executable boundary labels. It omits policy content, source identifiers,
fingerprints, retry keys, contact data, email, and display name. The owner
surface receives only the latest decision state, time, and exact count for the
latest candidate per location.

## Rejected Alternatives

- Mutate a decision column on the candidate: rejected because it destroys
  review history and makes concurrent actors overwrite one another.
- Let the browser submit tenant, actor, location, or candidate content:
  rejected because those values are authority-bearing and already derivable.
- Give acceptance to the policy compiler capability: rejected because review
  is an authenticated owner command and would widen an exact role boundary.
- Require current source for rejection: rejected because it would erase honest
  negative evidence about an immutable historical candidate.
- Infer activation from the latest accepted decision: rejected because review
  evidence is not runtime authority.

## Scope Boundaries

No activation pointer, current-policy selector, evaluator, rollout, rollback,
provider configuration, provider call, task write, usage write, notification,
or outbound delivery is added. No live-provider state becomes representable.
Public self-serve, invites, billing, POS, access control, and member-ledger
writes remain blocked. Verification is local only; no Production migration or
hosted/customer evidence is authorized.

## Success Criteria

- PostgreSQL 17 proves exact acceptance rebinding, stale rejection, immutable
  history, bounded audit, actor-scoped retries, concurrent review ordering,
  candidate-creation races, and staff/foreign/disabled denial.
- Application tests prove browser payload minimization, server-side source
  reload, and separate accept/reject paths.
- Desktop and narrow-mobile Chrome rehearsal proves bounded owner summaries,
  explicit evidence-only language, usable actions, and no overflow.

## Open Questions

None for this batch. Activation remains a separate future architecture decision
that must recompile current source and establish independent execution
authority rather than consuming a review state.
