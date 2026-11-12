# Answer Proposals From Manual Source Facts Brainstorm

Date: 2026-06-13

## Slice

Stage owner-review answer-bank proposals from already persisted manual source
facts.

## Scope

- Use only existing manual `source_documents` and `source_facts`.
- Create draft or conflict answer-bank entries for proposed facts.
- Write answer entries, answer revisions, source-fact proposal links, source
  document review state, and audit evidence in one PostgreSQL RPC transaction.
- Keep owner approval as a separate action.
- Preserve tenant isolation and deny-by-default direct table writes.

## Non-Goals

- No live answer approval.
- No phone, email, Retell, Resend, Gmail, webhooks, provider setup, billing,
  POS, payments, member-ledger, or staff task workflows.
- No scraping, importing, AI extraction, or automated source refresh.
- No hosted Supabase proof claim while the free-project quota blocker remains.

## Decision

The smallest useful next step is an owner-only RPC that stages answer proposals
from manual facts with `review_status = 'proposed'` and no existing
`proposed_answer_entry_id`.

Facts without conflict groups become draft answers with
`runtime_behavior = 'needs_owner_review'`. Facts with a conflict group become
conflict answers with `runtime_behavior = 'blocked_until_resolved'`. In both
cases the answers are not live until the existing owner approval RPC approves
them.
