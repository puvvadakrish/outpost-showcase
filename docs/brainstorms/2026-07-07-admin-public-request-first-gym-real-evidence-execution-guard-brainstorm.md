# Admin Public Request First-Gym Real Evidence Execution Guard Brainstorm

## What We're Building

Add a control-only guard after the real evidence execution packet. The guard
prepares the operator to run the next real evidence command by inspecting and
SHA-pinning the execution packet, checking required environment input names,
checking create-only evidence output path risk, and writing a no-secret
pre-run guard artifact.

## Why This Approach

The current chain can name the next real command, but the operator still has to
mentally confirm whether every required observation input is present and
whether the proof writer would overwrite an existing artifact. That is where a
real session can be mis-run. The guard turns those pre-run checks into an
inspectable artifact without running proof writers or storing observation
values.

## Key Decisions

- Keep the guard after
  `admin_public_request_first_gym_real_evidence_execution_packet`, not beside
  the proof writer, so it remains a control surface and inherits the existing
  protected Preview lineage.
- Store only input names, expected state, and present/missing/confirmed state.
  Do not store observation values, cookies, tokens, hosted URLs with secrets,
  customer notes, or proof claims.
- Check the default/create-only hosted rehearsal evidence output path and mark
  the guard blocked if the proof writer would overwrite an existing artifact.
- Keep the next real command manual. The guard can say the command is ready,
  but it must not execute it.
- Keep go/no-go, first-gym run, limited beta, public self-serve, provider,
  billing, POS, access-control, and member-ledger gates blocked.

## Alternatives Considered

- Auto-run the next proof writer when the guard is ready. Rejected because it
  would mix a pre-run control with evidence creation and raises the risk of
  accidentally fabricating or overwriting proof.
- Add another broad session packet. Rejected because the execution packet
  already carries lanes and regeneration order; the missing capability is a
  concrete pre-run guard for the immediate command.
- Only update docs. Rejected because the operator needs executable checks for
  env names and output-path safety.

## Success Criteria

- The guard consumes and SHA-pins an inspected real evidence execution packet.
- The guard derives the next real command and required input checks from the
  packet.
- Missing required input env vars produce a blocked guard artifact, not a fake
  proof.
- Ready inputs produce a ready guard artifact without recording observations.
- The inspector rejects stale packet SHA, altered input checks, altered output
  policy, proof claims, and unlocked public/live/revenue gates.
