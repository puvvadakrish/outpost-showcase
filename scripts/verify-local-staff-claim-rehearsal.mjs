#!/usr/bin/env node

// Neon branch-backed staff claim rehearsal entry point.
// The canonical Neon verifier owns Auth/Data API setup and RLS proof while the
// hosted beta workflow verifier owns full staff-claim mutation proof. This
// local entry point does not claim hosted beta workflow proof.
// Invite email and live providers remain blocked.
await import("./verify-neon-spike-readiness.mjs");
