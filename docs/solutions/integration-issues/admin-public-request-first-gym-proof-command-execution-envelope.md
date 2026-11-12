# Admin Public Request First-Gym Proof-Command Execution Envelope

Date: 2026-07-03

## Context

The first-gym proof chain had a launch checkpoint that determined whether the
dedicated go/no-go, first-gym run, and limited beta review commands could be
run with real hosted/customer evidence. Operators still needed a repeatable
handoff from that checkpoint into the exact command templates.

## Decision

Add an envelope-only artifact after launch checkpoint. It replays the parent
inspector, SHA-pins the checkpoint, copies the evidence and input summaries,
and exact-matches command templates for the real proof writers.

## Guardrails

- The envelope never records proof or launch readiness.
- The inspector rejects stale parent SHA, command-template drift, input
  requirement drift, and any live-provider/public-launch gate flip.
- Placeholder command values are safe examples only; operators must supply real
  protected Preview, hosted Neon branch, and customer-observed evidence values.

## Commands

```sh
npm run admin:public-request-first-gym:proof-command-execution-envelope
npm run admin:public-request-first-gym:proof-command-execution-envelope:inspect
```

## Reusable Pattern

When a readiness chain reaches a high-risk operational handoff, add an
envelope-only artifact that exact-matches the next commands instead of letting
operators rely on chat history or ad hoc command reconstruction.
