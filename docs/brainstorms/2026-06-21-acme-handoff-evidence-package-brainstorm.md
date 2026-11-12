# Acme Fitness handoff evidence package brainstorm

## What We're Building

Add a small operator evidence package to the existing Acme Fitness dry-run
handoff flow. The verifier should be able to write a non-secret JSON summary
that captures the Preview URL, Neon proof branch, dry-run owner email, tenant
id, workflow checks, rollback status, and blocked live-provider status. The
runbook should explain how to store and use that artifact during the
customer-safe handoff.

## Why This Approach

The current dry-run verifier already proves the important hosted workflow and
rollback boundaries. The remaining operational gap is evidence capture: an
operator has to copy terminal output into notes, which is easy to miss during a
customer handoff. A verifier-written artifact gives the team a repeatable proof
trail without adding schema, UI, provider integrations, billing, or support
access to customer data.

## Alternatives Considered

- Build an owner-facing handoff page. Rejected for this slice because it would
  change customer-facing UI while the direct Chrome handoff gate is still open.
- Add database-backed support evidence rows. Rejected for now because this is
  operator proof metadata, not product state, and adding persistence would
  increase tenant-data review scope.
- Keep terminal-only evidence. Rejected because it is too manual for a
  customer-zero handoff.

## Key Decisions

- Evidence output is opt-in through an environment variable.
- Evidence contains no passwords, Neon API keys, JWTs, cookies, or bypass
  secrets.
- The artifact records whether data was rolled back, retained, or cleaned up by
  rollback-only mode.
- The no-live-provider boundary remains explicit in both code and docs.

## Open Questions

None for this slice.
