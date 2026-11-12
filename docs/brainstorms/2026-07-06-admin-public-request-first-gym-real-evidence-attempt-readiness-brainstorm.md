---
date: 2026-07-06
topic: admin-public-request-first-gym-real-evidence-attempt-readiness
---

# Admin Public Request First-Gym Real Evidence Attempt Readiness

## What We're Building

Add a control-only readiness artifact after the protected Preview evidence
preflight. The artifact should take the real evidence path as far as the repo
can go without fabricating proof: replay the protected Preview preflight,
derive the next admissible dedicated evidence command, list the exact operator
inputs required for that command, and preserve the regeneration sequence after
any real evidence artifact changes.

This is not a new proof writer. It must not record hosted rehearsal evidence,
customer-observed completion, hosted customer-session digest proof, go/no-go
approval, first-gym run success, limited beta review, public self-serve
readiness, invite delivery, notifications, providers, billing, POS, access
control, or member-ledger writes.

## Why This Approach

Three approaches were considered:

- Run the real proof commands automatically. Rejected because the repo does not
  have real protected Preview observations or customer session confirmations in
  the current environment, and automatically setting those would fabricate
  proof.
- Add another broad runway. Rejected because the preflight already provides the
  run path; another runway would be redundant.
- Add a narrow attempt-readiness artifact. Chosen because it makes the next
  real operator action inspectable, names the missing inputs, and keeps the
  dedicated proof commands as the only source of proof.

## Key Decisions

- Derive next action from the inspected protected Preview preflight instead of
  from chat memory.
- Store required input names and stop conditions, not operator-entered values or
  observations.
- Keep every public/live/revenue/member-system flag false and inspect that
  invariant.
- Keep go/no-go, first-gym run, and beta review held until dedicated evidence
  artifacts are inspectable through the existing ledger/readiness chain.

## Open Questions

None. The next human-world blocker is real protected Preview/customer evidence,
and the code path should stop cleanly until that exists.

## Next Steps

Write the plan, implement the prepare/inspect scripts, wire Founder Admin,
cover tamper tests, run CE review plus Claude Opus 4.8 review, and merge if
clean.
