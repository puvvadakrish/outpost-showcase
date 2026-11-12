#!/usr/bin/env node

// Neon branch-backed local beta proof.
// Applies the Neon migration/seed path, creates or reuses Neon Auth seed users,
// signs in through Neon Auth, and verifies tenant RLS through the Neon Data API.
// This local entry point does not claim hosted beta workflow proof; phone,
// email, invite email, billing, and live providers remain blocked.
await import("./verify-neon-spike-readiness.mjs");
