---
date: 2026-06-09
topic: outpost-technical-architecture
status: approved
scope: technical-architecture-only
origin:
  - docs/brainstorms/2026-06-08-outpost-product-thesis-brainstorm.md
  - docs/plans/2026-06-08-feat-outpost-production-saas-plan.md
---

# Outpost Technical Architecture Brainstorm

## Fixed Product Boundary

This brainstorm does not change product scope. Outpost remains a standalone gym
front-desk automation SaaS with phone and email first, Meta/IG as fast follow,
and no ClubOS, POS, payment processing, billing recovery, member-ledger writes,
or live provider behavior in the current Slice 2 work.

## Recommended Architecture Direction

Use a tenant-scoped core with explicit location, membership, answer approval,
handoff rule, task, channel, event, audit, and usage records. Keep runtime
behavior conservative: live channels may only use approved facts, and missing,
conflicting, low-confidence, or always-human topics must create staff tasks.

The core database should be boring and relational. Every customer-owned object
should carry `tenant_id`; location-scoped objects should also carry
`location_id` when the rule, answer, task, source, provider connection, or
destination differs by gym location. Future RLS should be possible without
rewriting table ownership boundaries.

The architecture should separate five concepts that are easy to blur:

- **Source evidence:** imported website, Google profile, owner notes, and later
  social/public sources.
- **Approved answer state:** what Outpost may answer live, what needs review,
  what conflicts, and what is intentionally routed.
- **Handoff policy:** topics or conditions that force staff work, notify staff,
  or transfer only when a live provider is explicitly configured.
- **Operational work:** staff tasks with status transitions and assignment.
- **Event/audit history:** immutable records of imports, approvals, channel
  events, task changes, staff actions, and support/admin access.

## Alternatives Considered And Rejected

### Alternative A: Keep Slice 2 as UI-only arrays

This is fastest, but it lets product language outrun the architecture. It also
delays tenant isolation, approval lifecycle, auditability, and provider
boundaries until later slices, where those choices become more expensive.

Rejected because Outpost's sensitive surfaces depend on clear ownership and
audit boundaries even before providers are live.

### Alternative B: Build provider-first models now

This would start with Retell, Resend, inbound email, and provider-specific event
payloads, then derive Outpost objects from those payloads.

Rejected for Slice 2 because it would pull live-call and email automation
concerns forward. The provider layer should adapt to Outpost's tenant, answer,
handoff, task, and audit model, not define it.

### Alternative C: One polymorphic activity table for everything

One generic `activities` or `events` table could hold imports, approvals, calls,
emails, staff actions, and task updates.

Rejected as the primary model because it would hide important invariants. Use
specific core tables for tasks, answers, handoff rules, provider connections,
and usage; add an immutable event/audit stream beside them.

## Tenant, User, Membership, Role, And Location Boundaries

`tenants` are the account boundary. `users` are global identities.
`tenant_memberships` attach users to tenants with roles. The minimum role set
can stay `owner`, `staff`, and `founder_admin` for now, but founder/admin access
should not be modeled as ordinary tenant membership long term.

Recommended split:

- `tenant_memberships`: customer-side users only, usually owner/staff.
- `founder_admins` or app-level admin identity: Outpost internal operators.
- `support_access_grants`: explicit, time-bound support/admin access to a
  tenant when needed.
- `audit_events`: records support access, data reads, writes, approvals, and
  sensitive configuration changes.

Locations belong to tenants and should own local routing context: address,
timezone, public phone, staff routing destination, notification defaults, and
location-specific status. Answers, handoff rules, provider connections,
notification destinations, tasks, conversations, and usage can be tenant-wide
or location-scoped.

## Answer Bank And Approval Lifecycle

The answer bank should model the owner-approved source of truth rather than
just visible rows. Keep these states:

- `draft`: imported or proposed, not usable live.
- `approved`: usable for live customer-facing answers.
- `conflict`: sources disagree; owner must resolve before live use.
- `routed`: intentionally never answered directly; create a task or transfer
  when live.
- `retired`: removed from active use but retained for audit/history.

Recommended fields for `answer_bank_entries`:

- `tenant_id`, optional `location_id`.
- `topic`, `question`, `answer`.
- `approval_status`.
- `runtime_behavior`: answer live, needs owner review, create staff task, or
  blocked until resolved.
- `source_document_id` or `source_label`.
- `approved_by_user_id`, `approved_at`, `retired_at`.
- `created_at`, `updated_at`.

Add `answer_bank_revisions` before real CRUD persistence becomes important.
Each edit, import proposal, approval, conflict resolution, route decision, and
retirement should append a revision. The current row is the read model; the
revision table is the evidence trail.

## Source Documents And Imported Facts

Keep `source_documents` for website, Google profile, owner notes, and later
public social sources. Add a more granular `source_facts` table when import work
starts:

- `source_documents`: source identity, URL/ref, status, check time, digest.
- `source_facts`: extracted topic, value, confidence, conflict group, proposed
  answer entry, and review status.

Do not build scrapers or external profile integrations in Slice 2. Stubs should
make the review workflow concrete without implying import automation is live.

## Handoff Rules And Always-Human Topics

`handoff_rules` should remain distinct from answer entries. An answer can be
approved, but a rule may still force human review for a topic, confidence band,
or explicit customer request.

Recommended handoff dimensions:

- Trigger: topic, low confidence, explicit human request, missing fact,
  conflict, after-hours, emergency/unsafe.
- Action: create task, notify staff, transfer when live, block automation.
- Destination: task queue, notification destination, future provider transfer
  target.
- Scope: tenant-wide or location-specific.
- Active window: always, staffed hours, after-hours, custom schedule.
- Priority and status.

Always-human defaults should include cancellation/freeze, billing/account
questions, medical/injury/legal topics, explicit person requests, source
conflicts, and low-confidence answers.

## Task Lifecycle And Status Transitions

Keep the visible task statuses from the product plan:

- `new`
- `needs_human`
- `in_progress`
- `done`
- `ignored`

Recommended transition guardrails:

- New task from channel/import/manual entry starts as `new` or `needs_human`.
- `needs_human` can move to `in_progress`, `done`, or `ignored`.
- `new` can move to `in_progress`, `needs_human`, `done`, or `ignored`.
- `in_progress` can move to `done`, `needs_human`, or `ignored`.
- `done` and `ignored` should be terminal by default, with reopen later as an
  explicit audited action.

Add `task_events` for assignment, status change, note, notification, source
link, and reopen. Keep task rows optimized for the workboard; event rows carry
history.

## Channel Abstraction

Use a first-class channel enum or table with `phone`, `email`, `manual`, and
later `social`. Avoid provider-specific channels in core workflow tables.

Recommended split:

- `provider_connections`: tenant/location, channel, provider key, status,
  external IDs, secret reference, disabled reason. Slice 2 should keep these as
  stubs only.
- `conversations`: channel-agnostic interaction container for future phone,
  email, and social threads.
- `channel_events`: normalized event envelope with provider event ID, event
  type, payload digest/ref, received time, and processing status.
- `call_events` and `email_events`: optional typed side tables only when the
  channel needs fields that do not belong in the normalized event envelope.

Do not configure providers, secrets, webhook receivers, or outbound behavior in
Slice 2.

## Event And Audit Model

Use two related streams:

- `domain_events`: operational events generated by imports, conversations,
  tasks, deliveries, usage, and workflow processing.
- `audit_events`: human/admin/security-sensitive changes, including approvals,
  rule edits, task status changes, support access, provider config changes, and
  emergency disable.

Both should carry `tenant_id`, actor when available, subject type/id, action,
timestamp, and compact metadata. Provider payloads and transcripts should not be
stored directly in audit rows; store references or digests where possible.

This gives later slices room for provider webhooks, retries, usage metering,
support debugging, and incident review without changing the owner/workboard
model.

## Founder-Admin And Support Boundaries

Founder/admin tooling should be separate from tenant membership. Internal
operators need setup and support visibility, but every support access should be
auditable and ideally time-bound.

Slice 2 can show founder-admin setup stubs, but should not add privileged live
data tools. Later live support behavior should require `ce-review` before it
ships.

## Tenant Isolation And Future RLS

Design now for RLS even if local stubs are not enforcing it yet:

- Every tenant-owned table should include `tenant_id`.
- Every location-owned table should include `tenant_id` and `location_id`; do
  not rely only on joins through `locations`.
- Avoid cross-tenant natural keys except global user email and tenant slug.
- Add indexes by `tenant_id` and operational filters such as status, channel,
  location, and created time.
- Keep provider external IDs unique within provider/channel where needed, not
  globally unless the provider guarantees global uniqueness.

RLS policy shape later:

- Owners/admins can see tenant setup, answers, handoff rules, tasks, and
  analytics for their tenant.
- Staff can see assigned or location-visible tasks, not billing/provider/admin
  secrets.
- Founder/admin access is app-level, audited, and not represented as a normal
  tenant staff role.

## Usage Metering Placeholders

Add `usage_events` early as append-only placeholders, but do not implement
billing behavior in Slice 2.

Recommended meters:

- `voice_seconds` or `voice_minutes`
- `call_started`, `call_completed`, `call_transferred`
- `email_received`, `email_classified`, `email_replied`
- `task_created`
- `notification_attempted`, `notification_delivered`
- later `social_message_processed`

Each event should carry tenant, optional location, source type/id, quantity,
period key, and timestamp. Billing calculations, overage invoices, and upgrade
recommendations belong later.

## What Belongs In Slice 2

Slice 2 should establish owner-controlled setup and architecture-safe local
state:

- Answer-bank CRUD affordances and local/state-backed behavior.
- Approval lifecycle states and revision/event shape.
- Source document and imported fact stubs.
- Always-human handoff rule management.
- Notification destination setup records.
- Readiness gates that block live phone/email until providers, tests, approved
  facts, destinations, usage metering, and emergency disable exist.
- SQL/type stubs for future event, audit, provider connection, and usage
  boundaries where they clarify the next slices.

Slice 2 should not include:

- Provider setup or secrets.
- Webhook endpoints.
- Live calls or transfers.
- Email ingestion or outbound replies.
- Real usage billing, overage computation, or plan changes.
- RLS enforcement unless the project chooses to wire auth/database in this
  slice.

## Concrete Data Model Changes To Consider

Keep current Slice 2 additions and consider adding these before planning the
next implementation pass:

- `answer_bank_revisions`
- `source_facts`
- `task_events`
- `domain_events`
- `audit_events`
- `provider_connections` as disabled stubs
- `conversations` as future channel containers
- `usage_events` as append-only metering placeholders
- `support_access_grants` or an equivalent app-admin access model

These can be schema/type stubs first. Only promote them to interactive UI when
the next slice needs them.

## Smallest Next Implementation Slice

The smallest next slice should be **Slice 2 architecture foundation**, not live
provider work:

1. Normalize current TypeScript and SQL stubs around answer approvals, source
   documents, handoff rules, notification destinations, provider stubs, audit
   events, task events, and usage event placeholders.
2. Add local owner setup interactions for approving, editing, routing, and
   retiring answers.
3. Add local handoff-rule and notification-destination editing affordances.
4. Keep readiness gates explicit that phone/email are not live.
5. Add focused tests for lifecycle guards and readiness computation.

After this architecture foundation is approved and planned, later slices can
move into task detail workflow, phone productization, email triage, and burden
analytics with fewer model rewrites.

## Risks Requiring ce-review Before Going Live

Run `ce-review` before any of these become live behavior:

- Tenant data isolation and RLS policies.
- Founder/admin or support access to tenant data.
- Provider connections, webhook receivers, secrets, or signature validation.
- Live calls, transfers, duration caps, recordings, transcripts, or retention.
- Email ingestion, classification, deliverability, or automatic replies.
- Social APIs.
- Usage metering that affects billing, overage, or upgrade recommendations.
- Emergency disable, rollback, and incident/debug tooling.

## Open Questions

None. Architecture defaults were approved on 2026-06-09.

## Resolved Questions

- `founder_admin` can remain a temporary membership role during prototype work,
  but Slice 2 should introduce a separate app-admin/support-access model stub so
  founder/admin access does not become ordinary tenant membership long term.
- `domain_events` and `audit_events` should be separate stubs immediately so
  operational workflow history and sensitive human/admin changes do not blur.
- `answer_bank_revisions` should be stubbed in SQL and TypeScript during Slice
  2. Interactive revision history can wait until persistent answer editing
  lands.

## Next Step

If this direction is approved, run `ce-plan` against this brainstorm and the
existing production SaaS plan. Do not implement until that technical plan is
approved.
