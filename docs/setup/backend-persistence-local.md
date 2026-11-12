---
title: Backend Persistence Local Setup
status: retired
superseded_by: docs/setup/neon-migration-spike.md
---

# Backend Persistence Local Setup

This Supabase-local setup path is retired. Outpost now uses the Neon migration
path as the active backend direction.

Use:

```bash
npm run neon:spike:readiness
```

with `NEXT_PUBLIC_NEON_AUTH_URL` and `NEXT_PUBLIC_NEON_DATA_API_URL` set for
the current Neon proof branch. Keep live phone/email providers, invite delivery,
notifications, billing, POS, and member-ledger writes blocked until the full
Neon owner/staff mutation and browser proof is complete.
