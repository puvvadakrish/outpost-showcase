# Acme Fitness dry-run onboarding handoff brainstorm

Date: 2026-06-21

## Goal

Prove the next customer-handoff gate on the protected Vercel Preview without
turning on live channels. The proof should show that an operator can provision a
hosted owner access path, a Acme Fitness dry-run owner can bootstrap a tenant,
and the first owner workflow can move from manual source facts to answer review
to a staff task. The same slice must include a customer-safe reset and rollback
procedure.

## Product boundary

- This is a hosted customer-readiness gate, not phone or email productization.
- The default verifier uses a throwaway dry-run owner and tenant, not the seeded
  `tenant_acme_fitness` row and not a real customer email.
- The proof may create hosted Auth, app user, membership, tenant, location,
  manual source, answer, task, audit, usage, and revision rows only for the
  dry-run tenant.
- Phone/email providers, invite delivery, notifications, billing, POS,
  access-control, and member-ledger writes remain blocked.

## Architecture decision

Use an executable hosted verifier plus a runbook rather than a one-off manual
checklist. The verifier should:

1. Run the existing hosted readiness gate.
2. Run the existing operator-provisioned owner access gate.
3. Sign in as the provisioned dry-run owner.
4. Bootstrap a Acme Fitness dry-run tenant through the seedless owner path.
5. Exercise manual source intake, answer proposal staging, answer-derived task
   creation, and a protected Preview `/owner` route smoke.
6. Refuse live-provider state.
7. Roll back only when the tenant id, tenant name prefix, and dry-run owner
   email all match the verifier's safety rules.

Rollback must be explicit because the schema intentionally does not cascade
tenant deletion across most tenant-owned rows. The rollback should delete
tenant-scoped children in dependency order, then remove the throwaway owner app
user, owner beta grant, and Neon Auth user only when no active membership
remains.

## Rejected options

- Reusing `owner-acme@example.com` and `tenant_acme_fitness` for this proof:
  that would mix customer-handoff rehearsal data with seeded proof data and make
  rollback unsafe.
- Adding a live invite or email delivery path: this gate is about operator
  handoff, not customer-facing invite infrastructure.
- Proving only with dashboard screenshots: this needs an executable, repeatable
  path against the protected Preview and hosted Neon branch.

## Done signal

The slice is ready when local checks pass, the verifier can run in dry-run mode
against the hosted Neon proof branch and protected Vercel Preview, rollback is
proved clean, docs tell an operator exactly how to run/support/reset the handoff,
and a high-scrutiny review finds no tenant-safety or live-provider regressions.
