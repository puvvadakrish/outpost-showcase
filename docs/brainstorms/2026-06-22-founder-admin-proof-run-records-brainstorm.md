# Founder Admin Proof Run Records Brainstorm

Date: 2026-06-22

## Scope

The founder-admin console currently shows a secret-free status ledger, but it
cannot distinguish "ready to rerun" from "last hosted proof passed" because
command output is not durable product state. The next slice should make hosted
proof evidence durable without widening the beta surface.

## Product Boundary

- Record only operator-run hosted proof results.
- Store sanitized metadata: proof kind, status, branch, Preview origin,
  timestamps, and safe checklist summary.
- Do not store command output, cookies, tokens, seed passwords, API keys, auth
  URLs with secrets, raw owner notes, or support grant details.
- Do not let owner, staff, or anonymous sessions read the proof ledger.
- Do not add public self-serve onboarding, invite delivery, provider ingress,
  notifications, billing, POS behavior, access control, or member-ledger writes.
- Do not mark a customer-observed handoff complete from internal proof records.

## Architecture Choice

Use an append-only Neon table plus founder-admin-gated read RPC:

1. Hosted verifier scripts append a row only after all proof checks pass.
2. The table is not exposed directly to client roles.
3. `/founder-admin` reads a sanitized projection through a `security definer`
   RPC that reuses the founder-admin authorization rule.
4. The UI derives proof-gate readiness from the latest successful matching
   proof kinds:
   - `hosted_founder_admin_readiness` proves the founder-admin support view.
   - `vercel_preview_verify` proves the protected Preview deployment plus
     hosted beta workflow and founder-admin proof chain.
5. If no successful record exists, the UI remains conservative and shows rerun
   guidance.

## Non-Goals

- Failure-log ingestion.
- Public audit export.
- Customer-observed handoff completion.
- Provider setup or live channel tests.
- Product UI mutations for proof records.
