---
topic: admin-public-request-first-gym-proof-evidence-intake-manifest
date: 2026-07-03
status: complete
---

# Admin Public Request First-Gym Proof Evidence Intake Manifest Brainstorm

## What We're Building

Add an evidence intake manifest after the proof-command execution envelope. The
manifest converts the envelope's missing-evidence list into operator-facing
intake rows with expected artifact paths and collection instructions.

It does not collect, import, or record evidence. It only describes what must be
collected from the protected Preview and hosted Neon proof branch before the
real proof commands can run.

## Why This Approach

The execution envelope gives exact command templates, but a real gym session
still needs a checklist of which evidence rows are missing and what source is
allowed for each one. The manifest makes that checklist durable and
inspectable without relying on chat memory.

This is safer than making the go/no-go command more permissive. The existing
proof writers still require real hosted/customer artifacts, and the manifest
keeps every public launch/live-provider/revenue gate blocked.

## Key Decisions

- Consume and SHA-pin
  `admin_public_request_first_gym_proof_command_execution_envelope`.
- Replay the execution-envelope inspector before writing.
- Derive intake rows only from `evidence_summary.missing_evidence`.
- Mark every intake row `not_recorded` and `proof_recorded: false`.
- Exact-match intake rows, command templates, command sequence, and blocked
  gates in the inspector.
- Show the manifest in the Admin portal as a read-only readiness card.

## Open Questions

None. Actual evidence collection remains a later hosted/customer step.
