# Concepts

Shared domain vocabulary for this project — entities, named processes, and
status concepts with project-specific meaning. Seeded with core domain
vocabulary, then accretes as ce-compound and ce-compound-refresh process
learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Runtime policy review

### Runtime Policy Candidate

An immutable compiled representation of owner-authorized setup at one point in
time, preserved for human review but carrying no execution authority.

### Review Decision

Append-only owner evidence that accepts or rejects one exact Runtime Policy
Candidate; acceptance records a reviewed match but does not approve execution.

### Review Currentness

A request-time observation of whether the latest accepted Review Decision still
matches current authorized source and candidate state, never durable activation
or selection state.

### Candidate Lineage

A bounded owner-only sequence of immutable Runtime Policy Candidate predecessors
relative to one exact newest candidate, showing historical existence without
decisions, navigation, comparison, rollback, selection, or execution control.

## Relationships

A Runtime Policy Candidate can accumulate Review Decisions. Review Currentness
re-evaluates current source against the latest candidate and decision, while
Candidate Lineage describes predecessor ordering only; neither creates runtime
authority.
