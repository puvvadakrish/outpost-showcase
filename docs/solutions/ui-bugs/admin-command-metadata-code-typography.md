---
title: Admin command metadata and code typography
category: ui-bugs
date: 2026-07-01
status: verified
related_pr: 150
tags:
  - admin-portal
  - typography
  - command-ui
  - browser-smoke
---

# Admin Command Metadata and Code Typography

## Problem

The Admin portal operator queue rendered metadata values such as `Source` and
terminal command values with the same heavy monospace treatment. In dense
readiness rows this made the UI feel inconsistent and harder to scan: labels,
metadata, and shell commands all competed with the same visual weight.

## Root Cause

The readiness console markup used the same description-list value element for
metadata and commands. The stylesheet then targeted the broad `dd` shape, so
plain metadata inherited command-like typography. Some export command blocks
also leaned on browser default monospace behavior instead of the application
font token.

## Fix

Give command values their own semantic wrapper and style only that wrapper as
code:

- Metadata `dd` values stay in the normal interface font.
- Command values render as `<code>` inside `.founder-proof-command-value`.
- Long command blocks use the app monospace token, stable sizing, and
  horizontal overflow instead of widening the grid.
- Export command blocks use the same monospace token and line-height as the
  queue command values.

## Verification

PR #150 verified the fix with the founder-admin readiness console tests,
typecheck, Next build, Claude Code Opus review, and browser smoke on `/admin`.

## Prevention

For future Admin operator surfaces, keep metadata and terminal commands
semantically distinct. Metadata should use the interface font; copyable or
terminal-only instructions should be actual `<code>` elements inside a
dedicated command class with explicit wrapping/overflow behavior. Browser smoke
is important for these screens because automated tests can confirm the content
exists while missing visual hierarchy regressions.
