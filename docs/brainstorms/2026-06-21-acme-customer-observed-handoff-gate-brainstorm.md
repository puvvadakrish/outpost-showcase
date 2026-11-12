# Acme Fitness Customer-Observed Handoff Gate Brainstorm

Date: 2026-06-21

## Scope

The previous slices proved the protected Preview dry run, browser handoff path,
rollback, and customer-safe packet generation. The missing piece is a repeatable
operator gate that distinguishes "handoff packet is ready" from "Acme Fitness
observed the handoff and no stop condition appeared."

This slice should add an evidence recorder for the real customer-observed
handoff. It should consume the generated packet, require explicit operator
confirmations, reject secret-shaped content, and write ignored support evidence
under `artifacts/`.

## Architecture

- Keep the gate outside product runtime. This is operator tooling, not app UI or
  database state.
- Reuse the existing `artifacts/` proof pattern so customer/session notes do not
  get committed.
- Treat completion as fail-closed: no green handoff record unless every required
  customer-observed checkpoint is explicitly confirmed.
- Preserve the live-provider boundary by requiring the packet's blocked
  live-provider status and explicit no-live-provider confirmations.
- Avoid names, credentials, tokens, bypass secrets, cookies, or JWTs in the
  output. The output should be suitable for support review but not for secret
  storage.

## Non-Goals

- No phone/email provider activation.
- No invite delivery.
- No notification sending.
- No billing, POS, access-control, or member-ledger writes.
- No Auth admin product API or support database table.
- No claim that customer onboarding is self-serve.

## Decision

Add `npm run acme:customer-handoff:complete` as a strict completion recorder for
the observed Acme Fitness session. It will read the generated packet, validate
packet boundaries, require operator/session/checklist env vars, and write a
non-secret JSON completion record under ignored `artifacts/`.
