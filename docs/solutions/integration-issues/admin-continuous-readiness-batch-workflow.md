---
title: "Admin continuous SaaS readiness batch workflow"
category: integration-issues
date: 2026-06-28
status: documented
---

# Admin continuous SaaS readiness batch workflow

## Problem

Outpost readiness work can drift into chat-memory sequencing: one turn names
two next slices, another turn asks for a larger batch, and reviewer/browser
tooling may not be available in the same way each run. That makes it easy to
over-claim hosted or customer proof, lose no-live-provider boundaries, or rerun
Claude Code Opus with a noisy full workspace startup instead of a useful code
review.

## Working Pattern

Use artifact-driven batches. Each batch consumes the prior inspected artifact,
stores the parent raw-file SHA-256, writes one sanitized JSON artifact under
`artifacts/`, and exposes a matching inspect command. The Admin portal can show
the commands and gates, but the executable scripts own the proof claims.

For implementation work:

1. Run CE brainstorm and plan before code changes.
2. Implement terminal-only record/inspect scripts that fail closed on missing
   parent artifacts, unsafe Neon branches, local/non-HTTPS Preview URLs,
   secret-shaped values, existing output files, and any unblocked live-provider
   gates.
3. Keep customer-observed completion separate from internal protected Preview
   proof.
4. Review with Claude Code Opus 4.8 using constrained pasted-diff
   `/ce-code-review mode:agent` semantics and tools disabled if full Claude
   startup/MCP output is noisy.
5. Prefer Chrome/Codex-extension proof when exposed. If the runtime cannot
   attach to Chrome, use the bundled Playwright runtime for layout/browser
   smoke and label it honestly as browser automation, not user-profile Chrome
   proof.
6. Close out with the next readiness batch set, not only two slices, when the
   work ahead is a coordinated SaaS readiness sequence.
7. When an older artifact lane exists but hangs from a different parent, do not
   force reuse. Add a small bridge artifact for the current proof chain so
   lineage stays inspectable by parent SHA.

## Prevention

- Do not put proof claims only in docs or UI cards; add an inspect command.
- Do not record customer-observed completion from internal operator evidence.
- Do not store passwords, API keys, JWTs, cookies, Vercel bypass secrets, or
  session data in artifacts.
- Do not mix artifact lineages just because a similarly named packet already
  exists. The current parent proof should be explicit in the artifact kind,
  evidence basis, path, and SHA.
- Do not let public self-serve, invite delivery, notifications, providers,
  product Auth admin APIs, automatic grants, billing, POS, access control, or
  member-ledger writes move from blocked to allowed without a separate CE slice
  and proof artifact.

## Related Files

- `scripts/prepare-admin-continuous-readiness-batch.mjs`
- `scripts/record-admin-protected-preview-walkthrough.mjs`
- `scripts/inspect-admin-protected-preview-walkthrough.mjs`
- `scripts/prepare-admin-customer-handoff-scheduling-batch.mjs`
- `scripts/inspect-admin-customer-handoff-scheduling-batch.mjs`
- `src/domain/founder-admin-readiness.ts`
- `src/components/founder-admin/FounderAdminReadinessConsole.tsx`
