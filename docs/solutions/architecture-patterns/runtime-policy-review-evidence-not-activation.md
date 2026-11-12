---
title: Keep runtime-policy review evidence separate from execution authority
date: 2026-07-14
last_updated: 2026-07-15
category: architecture-patterns
module: runtime-policy
problem_type: architecture_pattern
component: database
severity: high
applies_when:
  - "A human decision is recorded against immutable compiled configuration"
  - "Positive review evidence could be mistaken for executable approval"
  - "Candidate creation and review can race for the same scope"
  - "A bounded historical projection is anchored to the newest immutable candidate"
  - "An owner-facing walkthrough step is synthesized from already authorized evidence"
tags: [append-only, authorization, concurrency, fail-closed, runtime-policy, lineage, presentation-guidance, transport-validation]
---

# Keep Runtime-Policy Review Evidence Separate From Execution Authority

## Context

An immutable compiled candidate needs durable human review history, but an
`accepted` label is not enough to authorize execution. Source can change after
candidate creation, several owners can review concurrently, and a new candidate
can be recorded while an older one is being reviewed.

## Guidance

Store each review as an append-only row related to the exact immutable
candidate. Keep the browser command minimal and derive tenant, actor, location,
and candidate scope at authenticated server and database boundaries.

For a positive decision, reload tenant-authorized source and compile it again.
Then require PostgreSQL to compare the complete body, compiler revision,
canonical source fingerprint, and compiled policy fingerprint with the stored
candidate. Acquire the same scope lock used by candidate creation before the
candidate lock and latest-candidate check. This turns a creation-versus-review
race into a deterministic order: either acceptance commits first or the new
candidate makes the old candidate stale and acceptance fails closed.

Negative review evidence may target a stale immutable candidate when it grants
no authority. Preserve exact retry replay, same-actor duplicate suppression,
and distinct evidence from different actors. Expose only bounded owner summary
fields and keep audit metadata content-free.

Treat review currentness as a transient observation, not another durable state
machine. Re-read authorized source and derive the latest candidate and latest
decision at request time, then return only a bounded owner-facing outcome. Do
not persist a mutable `is_current` flag, emit a currentness audit event, or let
the observation become an activation precondition that can be reused later.
Any future activation must perform its own fresh exact comparison.

Compose owner onboarding or walkthrough guidance from those existing evidence
views instead of creating another readiness lifecycle. A pure projection may
order already authorized location, candidate-summary, currentness, and routing-
manifest evidence into one next step per location, but it must perform no I/O,
accept no browser authority, and produce no durable row, audit, retry token, or
downstream command. Its positive label is presentation only.

Preserve successful-empty and unavailable reads as different inputs throughout
the presentation layer. An unavailable candidate-summary read must not be
rendered as "No candidate recorded." Require exactly one candidate for the
location, exactly one currentness record bound to that candidate and location,
and exactly one available manifest whose candidate, location, snapshot version,
answer count, and handoff count match. Missing, duplicated, inconsistent, or
mismatched evidence must yield unavailable or corrective guidance, never an
optimistic walkthrough state. Corrective links should target the controls that
can actually resolve the condition, and staff surfaces must remain independent
of the owner-only projection.

Project recent decision history as another exact-candidate read model, not as
an audit browser or mutable workflow state. Let PostgreSQL derive the tenant,
location, and owner relationship from the authenticated actor plus candidate;
return a fixed newest-first window and a total from one statement snapshot; and
omit actor identity, retry keys, row identifiers, source fingerprints, and
policy bodies. The application boundary should validate the raw transport
types as well as the envelope relationships: canonical safe integers only,
the window length must equal the bounded total, `has_more` must agree with the
total, and decision sequences must be positive and strictly descending.

Keep this projection optional per candidate. A failed history read can render
an honest unavailable state while currentness and review commands remain
usable. The read takes no location or candidate lock, appends no audit row, and
cannot become an activation prerequisite.

Treat candidate lineage as a separate evidence projection, not an extension of
decision history. Anchor it to the exact newest candidate already authorized
for the owner, let PostgreSQL derive the current actor, tenant, location, and
latest-candidate relationship, then have the application rebind the returned
candidate, location, and version to that authorized summary. Return only a
fixed newest-five predecessor window containing version, compiler revision,
recorded time, and a sixth-row truncation signal. Omit historical candidate
identifiers, decisions, actors, bodies, fingerprints, exact totals, links, and
actions.

When immutable versions are append-only, undeletable, and allocated
sequentially within the authorization scope, validate the complete transport
window rather than accepting any descending subset. For anchor version `N`,
require exactly `min(N - 1, 5)` entries, require `has_more` exactly when
`N > 6`, and require contiguous predecessors beginning at `N - 1`. This makes
false-empty, partial, skipped, duplicated, reordered, or
truncation-inconsistent envelopes fail closed instead of presenting plausible
but false owner evidence
(`src/infrastructure/neon/runtime-policy-repository.ts:194-258`). Do not import
that rule into storage models that permit deletion, gaps, or independent
version assignment.

Keep lineage optional and bounded at the network boundary too. A short abort
deadline plus candidate-local unavailable rendering prevents a stuck lineage
dependency from taking down currentness, decision history, or review commands
(`src/infrastructure/neon/runtime-policy-repository.ts:382-395`;
`src/app/owner/page.tsx:224-250`). The database read takes no explicit location
or candidate row lock and performs no durable write, so concurrent candidate
and decision writes either coexist with one coherent statement snapshot or
make a later anchor request fail closed.

## Why This Matters

Without fresh rebinding, positive review can describe source that no longer
exists. Without a shared lock order, a new candidate can race between the
latest check and decision insert. Without a separate activation boundary,
downstream code may accidentally treat human sentiment as executable policy.
Without an explicit availability signal and exact-cardinality composition, a
failed or duplicated read can become plausible-looking positive onboarding
guidance.
Accepting an incomplete lineage envelope can also turn transport drift into a
coherent-looking lie even when the database is correct. The combined pattern
preserves honest review history while keeping runtime authority entirely
absent.

## When to Apply

- Compiled or generated configuration is stored immutably for human review.
- Positive review is meaningful only while authoritative source still matches.
- Multiple reviewers or candidate writers can act concurrently.
- Owners need bounded predecessor evidence without a historical browser.
- Owners need a cross-location next-step view over existing authorized evidence.
- Future activation must remain an explicitly separate security design.

## Examples

Outpost implements the pattern in
`neon/migrations/20260714000000_runtime_policy_review_decisions.sql`. The
application performs the acceptance reload and compile in
`src/application/runtime-policy/service.ts`. PostgreSQL 17 contracts prove
authority and stale-source behavior in
`tests/sql/runtime-policy-review-decision-authority.sql`, and the shared lock
ordering in `tests/sql/runtime-policy-review-decision-concurrency.sh`.
Transient review guidance is derived by
`neon/migrations/20260714010000_runtime_policy_review_currentness.sql` and is
covered by `tests/sql/runtime-policy-review-currentness-authority.sql` plus the
non-blocking read harness in
`tests/sql/runtime-policy-review-currentness-concurrency.sh`.
Bounded recent history is derived by
`neon/migrations/20260714020000_runtime_policy_review_history.sql`; its
PostgreSQL contracts cover owner/staff isolation, privacy-minimal fields,
zero/one/five/six/more-than-five boundaries, concurrent appends, and the lack
of durable writes in `tests/sql/runtime-policy-review-history-authority.sql`
and `tests/sql/runtime-policy-review-history-concurrency.sh`. The application
transport contract is covered by `tests/runtime-policy-review-history.test.ts`.
Bounded candidate lineage is derived by
`neon/migrations/20260715000000_runtime_policy_candidate_lineage.sql`; its
application relationship and strict complete-window contracts live in
`src/application/runtime-policy/service.ts` and
`src/infrastructure/neon/runtime-policy-repository.ts`. Focused coverage in
`tests/runtime-policy-candidate-lineage.test.ts`,
`tests/sql/runtime-policy-candidate-lineage-authority.sql`, and
`tests/sql/runtime-policy-candidate-lineage-concurrency.sh` proves malformed
transport rejection, owner/staff isolation, fixed zero/one/five/six
boundaries, bounded timeout degradation, zero durable writes, and non-blocking
composition with candidate and rejection writes. The owner UI states the
non-activation boundary in
`src/components/owner/RuntimePolicyCandidatePanel.tsx`.

The owner walkthrough projection is defined in
`src/domain/runtime-policy-review-guidance.ts` and consumed only by that owner
panel. `tests/runtime-policy-review-guidance.test.ts` covers the ordered states,
exact relationship and duplicate-evidence failures, input immutability, privacy
allowlists, and staff source isolation. Component coverage in
`tests/runtime-policy-candidate-panel.test.tsx` keeps unavailable evidence
distinct from successful-empty results and verifies that corrective links land
on their intended owner destinations. Local browser rehearsal remains local
evidence; it is not hosted, customer-observed, provider, or Production
evidence.

## Related

- `docs/brainstorms/2026-07-14-runtime-policy-review-decisions-brainstorm.md`
- `docs/plans/2026-07-14-001-feat-runtime-policy-review-decisions-plan.md`
- `docs/plans/2026-07-14-002-feat-runtime-policy-review-currentness-plan.md`
- `docs/plans/2026-07-13-feat-runtime-policy-candidate-persistence-plan.md`
- `docs/plans/2026-07-15-001-feat-runtime-policy-candidate-lineage-plan.md`
- `docs/plans/2026-07-15-003-feat-runtime-policy-guided-walkthrough-plan.md`
