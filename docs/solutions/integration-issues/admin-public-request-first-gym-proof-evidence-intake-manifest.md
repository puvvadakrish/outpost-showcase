# Admin Public Request First-Gym Proof Evidence Intake Manifest

Date: 2026-07-03

## Context

The proof-command execution envelope prepares exact command templates for the
real first-gym proof run. Operators still needed a durable, inspectable list of
which evidence artifacts remain missing and where each must come from.

## Decision

Add a manifest-only artifact after the execution envelope. It replays the
parent inspector, SHA-pins the envelope, derives intake rows from
`evidence_summary.missing_evidence`, and marks every row as not recorded.

## Guardrails

- The manifest never records proof or evidence.
- The inspector rejects stale parent SHA, intake-row drift, command-template
  drift, command-sequence drift, and any live-provider/public-launch gate flip.
- Intake instructions explicitly require protected Preview and hosted Neon
  proof-branch evidence for hosted proof rows.

## Commands

```sh
npm run admin:public-request-first-gym:proof-evidence-intake-manifest
npm run admin:public-request-first-gym:proof-evidence-intake-manifest:inspect
```

## Reusable Pattern

When a proof chain is ready for real-world operator action, add a manifest-only
artifact that describes admissible evidence and expected artifact paths before
any writer records proof.
