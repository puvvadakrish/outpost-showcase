---
date: 2026-06-08
topic: outpost-product-thesis
status: canonical-draft
customer_zero: Acme Fitness
source_context:
  - RequestHandoff docs and Acme Fitness phone-first prototype
  - (pasted notes, not included)
---

# Outpost Product Thesis Brainstorm

## Thesis

Outpost is a gym front-desk automation SaaS. It takes repetitive phone and email
work off the person behind the desk, creates staff-ready tasks, and gives owners
visibility into the front-desk burden the system removed.

The first promise is:

> Take repetitive front-desk work off your staff.

Acme Fitness is customer zero and design partner, but Outpost is not a custom
Acme Fitness build. Every v1 decision should generalize to the next gym that
signs up, creates locations, approves answers, connects phone/email, tests the
workflow, and goes live.

## Customer Signal

The owner signal is not simply "missed calls." It is front-desk labor
protection. Gym staff are expected to greet members, answer routine calls,
reply to emails, handle tours, route cancellation/freeze requests, watch social
messages, and still sell memberships or follow up with leads.

The existing RequestHandoff prototype proves the phone pattern: Retell answers
first, handles approved routine questions, captures lead/tour/member intent,
allows natural human transfer, and sends an immediate post-call email through
Resend. Outpost should productize that pattern in a separate multi-tenant SaaS.

RequestHandoff remains the integration-neutral phone handoff product. Outpost is
the gym front-desk automation product.

## ICP

Initial ICP:

- Gyms and fitness clubs.
- One to five locations.
- Owner-operated or manager-led.
- Meaningful routine call/email volume.
- Front desk staff are overloaded with low-value interruptions.
- Membership/tour leads have enough value that one saved conversion can justify
  the product.
- Owner wants predictable SaaS pricing and operational visibility, not
  club-management replacement.

## Personas

- **Owner/operator:** wants fewer interruptions, more staff time for sales and
  follow-up, predictable cost, and visibility into work removed.
- **General manager:** wants clean handoffs, fewer ambiguous messages, and a
  simple unresolved-work queue.
- **Front desk associate:** wants routine calls/emails out of the way without
  losing a simple path to route real human issues.
- **Staff follow-up owner:** wants context, next action, and clear task status.
- **Outpost founder/admin:** needs tenant setup, provider configuration, logs,
  usage metering, support/debugging, and emergency controls.

## Jobs-To-Be-Done

- Answer routine phone and email questions about hours, locations, amenities,
  pricing ranges, tours, membership basics, and common policies.
- Capture lead, tour, membership, training, equipment, and callback intent.
- Route human-only requests without button-menu IVR behavior.
- Convert handled interactions into Outpost tasks or resolved records.
- Notify staff immediately by email while maintaining a unified task inbox.
- Show owners calls/emails handled, tasks created, common repetitive questions,
  human handoffs, and estimated staff time saved.
- Detect cancellation/freeze intent, collect reason, optionally send approved
  save language, and route to staff without changing the member account.
- Turn uncertain, conflicting, or unapproved facts into staff tasks.

## MVP Scope

Outpost Core v1:

- Guided self-serve signup with concierge assist.
- Tenant account, locations, staff users, and roles.
- Website, Google profile, and public-profile import for core front-desk facts.
- Owner approval checkpoints for generated answer-bank content.
- Owner-editable answer bank, handoff rules, transfer numbers, notification
  destinations, and always-human topics.
- Phone channel using the Acme Fitness prototype pattern.
- Email channel in the same v1 cycle: inbound triage, task creation, and
  optional approved replies.
- Unified task inbox plus email notifications.
- Simple task statuses: `new`, `needs human`, `in progress`, `done`, `ignored`.
- Burden-reduction dashboard.
- Usage metering for voice minutes, calls, emails, tasks, transfers, and
  deliveries.

## Fast Follow

- Meta/IG social inbox routing for FAQs, DMs, comments, tour/member intent, and
  unresolved work.
- Meta/IG social marketing assist: post/caption help, scheduling support,
  approvals, campaign support, and later ad-workflow assistance.
- Calendar reminders or due dates for tasks.
- Sales follow-up workflow for tours and membership leads.
- Richer sales analytics once staff outcomes are captured.
- More advanced cancellation-save playbooks after account-changing boundaries
  are proven.

## Explicit Exclusions

Club OS is completely separate from Outpost.

Outpost v1 does not include Club Automation replacement, POS, payment
processing, failed-card recovery, member ledger writes, access control, direct
cancellation/freeze/account changes, direct booking guarantees, full autonomous
social posting, medical/injury/legal decisions, or RequestHandoff scope
expansion.

## Operating Principles

- Setup should be expansive; runtime should be conservative.
- During setup, gather the best public facts from website, Google profile,
  public social profiles, and other public content.
- If public sources conflict, propose the best answer but require owner
  approval before customer-facing use.
- During live phone/email interactions, answer only approved facts.
- If a fact is missing, conflicting, or unapproved, say staff will follow up and
  create a task.
- A gym is live only after approved facts, always-human topics, transfer number,
  notification destinations, test phone call, test email, visible task inbox,
  usage metering, and emergency disable/rollback are confirmed.

## Pricing Posture

Use configurable per-location SaaS tiers with included voice allowances and
explicit per-minute overage. Voice allowance should be pooled by tenant across
locations. If a customer consistently pays more in overage than they would on
the next package, Outpost should recommend the cheaper upgrade path.

The pricing promise is predictable monthly pricing with transparent usage
limits. Avoid "unlimited voice" because calls are the variable cost that can
break margins.

## Acme Fitness Observation Plan

The next customer-zero session should map repetitive front-desk work by
category: calls, emails, walk-ins, tours, member questions, cancellation/freeze,
billing/account questions to route, IG/Facebook messages, facility issues,
manager escalations, staff follow-up calls, and shift handoff patterns.

Do not use this session to gather Club OS replacement scope.

## Key Decisions

- Outpost is gym front-desk burden reduction SaaS, not Club OS.
- Acme Fitness is customer zero and design partner.
- Productize from day one for the next gym.
- Phone + email are core v1.
- Meta/IG is fast follow, with social inbox routing before social marketing.
- Guided self-serve onboarding with concierge assist is the setup model.
- Website/Google/public-profile import plus owner approval is the source of
  truth model.
- Unified task inbox plus email notifications is the staff workflow.
- Burden reduction is the first analytics story.
- Pricing is location-based with included pooled voice allowance and explicit
  overage.

## Open Questions For Planning

- What exact Acme Fitness phone/email workflows should be supported in the
  first customer-zero release?
- Which email provider and inbound mailbox approach should v1 use?
- Which public-profile import sources are acceptable for v1 besides website and
  Google profile?
- What is the minimum task inbox UX that front desk staff will actually use?
- What are the exact first tier limits and overage rates?
