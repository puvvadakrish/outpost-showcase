---
title: Hosted Proof Record Execution Brainstorm
date: 2026-06-22
status: complete
---

# Hosted Proof Record Execution Brainstorm

## Goal

Finish the founder-admin hosted proof-record slice by proving the new
`hosted_proof_runs` table and founder-admin projection on a protected Vercel
Preview backed by a dedicated hosted Neon branch.

## Scope

- Use a fresh non-production, non-spike Neon proof branch created from Neon
  `production`.
- Apply the current `neon/migrations` bundle, including
  `hosted_proof_runs`.
- Enable Neon Auth and Data API for the proof branch.
- Deploy a protected Vercel Preview with explicit branch Auth/Data API env.
- Run `npm run vercel:preview:verify` so the hosted beta workflow,
  founder-admin readiness proof, and Vercel Preview proof records are appended.
- Confirm the founder-admin console can read real passed proof records for the
  current Preview origin.

## Boundaries

- Do not use Neon `production` or `outpost-neon-spike`.
- Do not expose seed passwords, API keys, Vercel bypass secrets, cookies, or
  JWTs in committed docs or PR notes.
- Do not enable public self-signup, invite delivery, phone/email providers,
  notifications, billing, POS, access control, or member-ledger writes.

## Decision

Allow `npm run hosted:proof-branch:prepare` to rely on the authenticated Neon
CLI session instead of requiring `NEON_API_KEY` in the environment. This keeps
proof branch creation repeatable without pasting API keys into shell commands.
