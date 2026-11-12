---
title: Align Unicode contracts across PostgreSQL and TypeScript
date: 2026-07-15
category: architecture-patterns
module: runtime-policy
problem_type: architecture_pattern
component: database
severity: medium
applies_when:
  - PostgreSQL and TypeScript independently validate the same bounded Unicode field
  - A database-owned ordered projection is checked again at an application boundary
  - Length or ordering limits must agree for non-BMP text across SQL and JavaScript
tags:
  - runtime-policy
  - unicode
  - postgresql
  - typescript
  - utf-8
  - collation
  - transport-validation
---

# Align Unicode contracts across PostgreSQL and TypeScript

## Context

Outpost validates an immutable runtime-policy candidate in PostgreSQL and then
validates its bounded review-manifest projection again in TypeScript. That
trust shape is safe only when both runtimes use the same units and ordering
relation.

The stored-candidate contract bounds topics with PostgreSQL `char_length`
([candidate snapshot migration](../../../neon/migrations/20260713040000_runtime_policy_candidate_snapshots.sql)).
JavaScript `String.length` instead counts UTF-16 code units, so an astral
character such as an emoji occupies two units in JavaScript while PostgreSQL
counts one character. Ordering has the same hazard: JavaScript relational
comparison follows UTF-16 code units, while PostgreSQL text ordering follows a
selected collation.

Earlier candidate-persistence reviews already treated the database and
TypeScript adapters as one fail-closed boundary, but did not formalize Unicode
length or ordering equivalence (session history). The review-manifest work in
PR #321 exposed both mismatches when strict application validation rejected
values the database had validly produced.

## Guidance

Define the shared Unicode contract in runtime-independent terms, then implement
that exact contract on both sides.

1. Use Unicode code-point count for shared character bounds. PostgreSQL keeps
   `char_length`; TypeScript iterates the string by code point with
   `Array.from(value).length`. The manifest mapper applies that rule at
   [runtime-policy-repository.ts:290](../../../src/infrastructure/neon/runtime-policy-repository.ts#L290).

2. Use UTF-8 byte order for database-owned canonical text order. The projection
   sorts with explicit `COLLATE "C"` in
   [the manifest migration:71](../../../neon/migrations/20260715010000_runtime_policy_candidate_review_manifest.sql#L71),
   and the TypeScript mapper compares unsigned UTF-8 bytes with one shared
   `TextEncoder` at
   [runtime-policy-repository.ts:136](../../../src/infrastructure/neon/runtime-policy-repository.ts#L136)
   and
   [runtime-policy-repository.ts:298](../../../src/infrastructure/neon/runtime-policy-repository.ts#L298).

3. Keep the mapper fail closed. Runtime agreement is not a reason to trust a
   database result without validation; the mapper still rejects blank,
   overlong, duplicated, and out-of-order topics at
   [runtime-policy-repository.ts:342](../../../src/infrastructure/neon/runtime-policy-repository.ts#L342).

4. Test non-ASCII counterexamples through both runtimes. An astral string
   proves the length unit, while a BMP/non-BMP pair whose UTF-8 and UTF-16
   orders differ proves the relation. The TypeScript contract covers both at
   [runtime-policy-candidate-review-manifest.test.ts:223](../../../tests/runtime-policy-candidate-review-manifest.test.ts#L223),
   and PostgreSQL 17 verifies the same envelope at
   [runtime-policy-candidate-review-manifest-authority.sql:261](../../../tests/sql/runtime-policy-candidate-review-manifest-authority.sql#L261).

## Why This Matters

Without one explicit contract, independently correct implementations can
produce an application-level false negative. A valid 81-emoji topic satisfies
PostgreSQL's 160-character bound but fails `string.length <= 160`. Likewise,
PostgreSQL can return a canonical Unicode sequence that JavaScript's native
comparison declares reversed.

Both cases make honest owner evidence appear unavailable even though neither
the candidate nor the database projection is malformed. Matching code-point
length and UTF-8 byte order preserves strict boundary validation without
silently excluding valid Unicode content or relying on an ambient database
collation.

## When to Apply

- A database and JavaScript or TypeScript both enforce a character limit on
  the same field.
- A database query returns ordered text that the application checks for
  monotonicity, uniqueness, truncation, or pagination continuity.
- JSON or JSONB Unicode strings cross a strict transport mapper.
- Existing tests use only ASCII and therefore cannot distinguish code points,
  UTF-16 code units, UTF-8 bytes, or locale-sensitive order.
- A fail-closed optional read can become unavailable when two runtimes disagree
  even though each implementation is internally valid.

## Examples

Avoid independently chosen runtime defaults:

```ts
// UTF-16 units do not match PostgreSQL char_length for astral characters.
topic.length <= 160;

// Native string comparison does not reproduce PostgreSQL C ordering.
topicKey > previousTopicKey;
```

```sql
-- Ambient collation is not a cross-runtime ordering contract.
order by answer.value->>'topicKey';
```

Use one named contract on both sides:

```ts
const bounded = Array.from(topic).length <= 160;
const ordered = compareUtf8Bytes(topicKey, previousTopicKey) > 0;
```

```sql
order by (answer.value->>'topicKey') collate "C", answer.ordinality;
```

The prevention fixture should include at least one astral string for length and
one BMP/non-BMP pair whose UTF-8 and UTF-16 orders differ. Outpost uses repeated
emoji plus fullwidth A in the focused TypeScript and PostgreSQL 17 contracts.

## Related

- [Runtime-policy review evidence is not activation](runtime-policy-review-evidence-not-activation.md)
  documents the broader exact-candidate, bounded-projection, and fail-closed
  authority boundary. This learning defines only the narrower cross-runtime
  Unicode contract.
- [PR #321](PR #321) applies the pattern
  to the owner candidate review manifest.
