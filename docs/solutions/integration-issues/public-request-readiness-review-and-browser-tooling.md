---
title: Public request readiness review and browser tooling
category: integration-issues
date: 2026-07-01
status: verified
related_pr: 148
tags:
  - admin-readiness
  - claude-code
  - browser-smoke
  - vitest
---

# Public Request Readiness Review and Browser Tooling

## Problem

During the public request first-gym current-chain bridge, three operational
issues showed up at once:

- A full readiness-chain test run failed once because an existing
  subprocess-heavy test had a hard-coded 15 second timeout.
- Claude Code Opus was authenticated and could answer small prompts, but
  tool-enabled full branch review sessions hung without output.
- Active Chrome/Codex-extension attachment failed with `cgWindowNotFound`, even
  though deterministic browser proof through Playwright was available.

## Root Cause

The readiness artifact tests spawn multiple Node scripts and recursively inspect
parent artifacts. As the chain grows, 15 seconds is too tight under full-suite
contention even when the same test passes in isolation.

For Claude Code, the `opus` model alias worked, but tool-enabled review sessions
could deadlock or buffer indefinitely. A static/narrow diff review avoided the
tool-permission path and returned a usable reviewer result.

For browser proof, the active desktop Chrome bridge is separate from Playwright
and can fail due to window/profile/connection state. That failure should not be
misreported as user-browser proof.

## Working Solution

Use a layered verification strategy:

1. Keep readiness-chain tests focused, but give subprocess-heavy fail-closed
   cases realistic timeouts.
2. Run full suite after timeout hardening.
3. Try Claude Code Opus tool review first with a bounded timeout.
4. If tool review hangs but a tiny Opus prompt works, run a static or narrower
   diff review through Opus and record the fallback.
5. Try active Chrome/Computer Use when available, but fall back to deterministic
   Playwright smoke and clearly report that live Chrome attachment was not
   available.

## Prevention

- Treat recursive artifact inspectors as integration tests, not tiny unit tests.
- Add regression assertions when reviewer feedback finds defense-in-depth gaps.
- Never claim active Chrome/Codex-extension user testing unless the bridge
  actually attaches.
- Keep PR bodies explicit about reviewer fallback and browser proof mode.
- Add post-merge implementation notes to `AGENTS.md` for non-trivial slices so
  future batches can see both the product decision and the verification pattern.

## Verification Example

```bash
PATH="~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
  ./node_modules/.bin/vitest run --no-file-parallelism --testTimeout=120000

perl -e 'alarm shift; exec @ARGV' 60 \
  ~/.local/bin/claude --print --model opus \
  --effort high --permission-mode dontAsk --output-format text \
  "Reply with exactly: opus-ok"
```

## Related Documentation

- `docs/solutions/integration-issues/admin-public-request-first-gym-evidence-acquisition.md`
- `docs/solutions/integration-issues/admin-public-request-first-gym-go-no-go-readiness.md`
- `docs/solutions/integration-issues/admin-post-customer-proof-readiness-batch.md`
