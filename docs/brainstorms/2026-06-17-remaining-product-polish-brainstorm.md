---
date: 2026-06-17
topic: remaining-product-polish
status: implemented
---

# Remaining Product Polish Brainstorm

## Frame

The local beta loop is functional, but the remaining rough edges are product
surface issues rather than persistence gaps. Owners need the manual
source-to-answer-review path to feel complete when there is nothing staged yet.
Staff need queue controls before task volume grows beyond a seed/demo set. The
shared shell needs basic accessibility support for long sessions.

## Scope Decision

Keep this as a UI-only polish slice:

- Add shared app-shell skip navigation.
- Add staff workboard search, status, and assignee filters against already
  loaded tenant-scoped task rows.
- Add filtered task empty states.
- Improve owner manual source intake row control and staging empty state.
- Improve owner answer-review completion empty state.
- Document the durable design rules in `DESIGN.md`, `AGENTS.md`, and `PLOT.md`.

## Explicit Non-Goals

- No schema, migrations, RPCs, or repository changes.
- No provider ingress, Retell, Resend/Gmail, live email, phone routing, or
  webhooks.
- No billing, POS, payments, ClubOS, or member-ledger work.
- No hosted Supabase proof claim; the free-project quota blocker remains.

## Product Notes

- The staff workboard should not require staff to read backend state. Filtering
  should answer "what needs my next touch?" with requester, intent, source,
  status, and assignee searchable in one place.
- Empty states should not feel like blank sections. They should name what is
  missing and point to the next available local beta action.
- Manual source intake should let owners remove unused fact rows before save so
  mobile does not feel like a mandatory oversized form.
