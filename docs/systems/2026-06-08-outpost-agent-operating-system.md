---
title: Outpost Agent Operating System
date: 2026-06-08
status: historical-superseded
source: "Obsidian note: How to Build a SaaS MVP in One Afternoon Using 7 AI Agents"
---

> **Historical notice:** This retired seven-agent scaffold and its original
> workflow syntax are preserved as historical context, not active authority.
> Use `../../AGENTS.md` for stable operating rules and `../../PLOT.md` for the
> checked-out repository's current state.

# Outpost Agent Operating System

This system adapts the seven-agent MVP workflow from the referenced article to
Outpost's actual product boundary. It is a complementary scaffold for Compound
Engineering, not a replacement for Compound Engineering. The goal is not to
outsource judgment or create ritual. The goal is to remove early product chaos
by separating modes of thought, preserving independent critique, and reducing
each slice to one smallest provable workflow.

Outpost is not an AI website audit product. Outpost is gym front-desk
automation SaaS. The reusable lesson from the article is the operating model:
specialized thinking, small proof workflows, explainable decisions, QA attack,
human approval before outbound automation, and real-user validation before
scope expansion.

## Relationship To Compound Engineering

Compound Engineering remains the governing workflow:

1. `ce-brainstorm` decides what should exist.
2. `ce-plan` decides how to build it.
3. `ce-review` attacks sensitive surfaces before they go live.
4. `ce-compound` saves durable learnings only when they are worth preserving.

The seven-role system fits inside those phases:

- In `ce-brainstorm`, use the Research, Product, UX, QA, and Launch lenses to
  clarify the workflow, customer signal, non-goals, risks, and validation plan.
- In `ce-plan`, use the Frontend and Backend lenses to turn the chosen workflow
  into concrete surfaces, data models, provider flows, tests, and rollout
  gates.
- In `ce-review`, use the QA lens as the starting attack list, then apply the
  stricter review requirements for tenant data, live calls, email automation,
  provider config, usage metering, and support/debugging.
- In `ce-compound`, save only new durable lessons from shipped behavior. Do not
  save every role artifact just because it exists.

Use the seven-role scaffold when the slice changes product behavior,
customer-facing workflows, channel automation, provider behavior, tenant data,
or launch positioning. For mechanical edits, small UI copy changes, dependency
updates, or narrow bug fixes with clear requirements, skip it and follow the
normal lightweight Compound path.

## Compatibility Assessment

The systems are compatible if their responsibilities stay separate:

- Compound Engineering is the lifecycle and quality gate.
- The seven-role scaffold is a thinking tool that improves brainstorm, plan,
  and review quality.
- Outpost product boundaries remain the source of truth.

Potential conflicts and resolutions:

| Conflict | Risk | Resolution |
| --- | --- | --- |
| Seven roles can add ceremony. | Simple work slows down. | Use it only for non-trivial slices; skip it for mechanical edits. |
| The article favors one-afternoon speed. | Sensitive Outpost workflows could ship too fast. | `ce-review` remains mandatory before live calls, email automation, provider config, tenant data, usage metering, or support/debugging. |
| Agent outputs can feel authoritative. | We blindly inherit bad assumptions. | Treat role outputs as drafts; repo docs, Acme Fitness evidence, tests, and founder judgment win. |
| Launch framing can overpromise. | Buyers may infer autonomous account changes or Club OS replacement. | Launch artifacts must state what routes to humans and preserve explicit v1 exclusions. |
| QA in the article is generic. | Outpost-specific privacy and tenant risks get missed. | Start from the Outpost QA attack list and add `ce-review` for sensitive surfaces. |

The article's useful lesson is separation of concerns. Its weak point is that
it can imply process speed matters more than evidence. For Outpost, evidence and
safety gates win.

## Core Loop

Every meaningful Outpost slice starts with one sentence:

> For a gym front desk, Outpost will turn `[inbound workload]` into
> `[resolved record or staff-ready task]` so `[owner/staff outcome]`.

Examples:

- Phone tour inquiry -> approved answer, captured lead context, staff-ready task.
- Cancellation/freeze email -> safe acknowledgement, always-human task, no
  member-account change.
- Unknown hours question -> answer only if approved, otherwise create task.
- Missed confidence threshold -> human follow-up task with source context.

If a slice cannot be expressed in this shape, it is too vague to build.

## Seven Roles

Use these roles for non-trivial product, implementation, or launch slices. The
roles may be handled by one person or one agent sequentially, but the artifacts
should stay separate before they are merged when the slice is large or risky.

### 1. Research Agent

Owns customer and market truth.

Required artifact:

- Target gym profile.
- Acme Fitness signal or research source.
- Repetitive front-desk workload being removed.
- Current workaround and cost of doing nothing.
- Competitor or substitute behavior.
- Evidence gaps.

Outpost-specific checks:

- Does this reduce front-desk burden, or is it adjacent CRM/POS scope?
- Is Acme Fitness a useful customer-zero proxy for the next gym?
- Is the workflow common enough to become repeatable SaaS?

### 2. Product Agent

Owns MVP scope and hard cuts.

Required artifact:

- One core workflow.
- Actor list: owner, staff, requester, founder/admin.
- Included behavior.
- Explicit exclusions.
- Success criteria.
- Pricing or entitlement impact, if any.

Outpost-specific checks:

- Phone and email are v1. Meta/IG is fast follow.
- Owner-approved answers are required before live use.
- Account-changing work routes to staff; Outpost does not write member ledgers.
- Club OS, POS, payment processing, billing recovery, and access control stay
  out of v1.

### 3. UX Agent

Owns the operator flow.

Required artifact:

- Page or screen sequence.
- Staff default view.
- Owner setup checkpoints.
- Empty/loading/error states.
- Human review step before risky outbound behavior.

Outpost-specific checks:

- The primary proof object is a staff-ready task.
- Staff should land on today's unresolved workboard.
- Owner setup should feel prefilled and reviewable, not like a giant form.
- Missing, conflicting, or unapproved facts must be visibly routed.

### 4. Frontend Agent

Owns product surface structure.

Required artifact:

- Component list.
- Data needed by each component.
- Responsive layout notes.
- State map for loading, empty, error, disabled, active, and success.
- Accessibility and copy constraints.

Outpost-specific checks:

- Follow `DESIGN.md` Front Desk Command.
- Avoid chatbot theater and generic AI-dashboard patterns.
- Use task rows, status rails, setup checklists, approval states, and usage
  meters before decorative cards.
- Product UI should be operational, not a marketing hero.

### 5. Backend Agent

Owns explainable workflow logic and data boundaries.

Required artifact:

- Data model additions.
- Provider events and state transitions.
- Tenant isolation strategy.
- Classification, scoring, or routing rules.
- Idempotency and retry behavior.
- Retention and audit events.

Outpost-specific checks:

- Every automated answer traces to an approved answer-bank entry.
- Every uncertain or unapproved answer creates a task.
- Provider webhooks require signature verification before live use.
- Usage events must be explainable and auditable.
- Admin/support access must be recorded.

### 6. QA Agent

Owns adversarial review.

Required artifact:

- Failure modes.
- Edge cases.
- Abuse or privacy risks.
- Missing states.
- Tenant isolation risks.
- Manual QA checklist.
- Tests required before merge.

Outpost-specific attack list:

- Wrong tenant sees another gym's task.
- Email auto-reply sends unsafe or unapproved language.
- Caller asks for emergency, medical, billing, cancellation, or account-change
  help.
- Provider retries duplicate a task or usage event.
- Transfer fails silently.
- Transcript or recording is retained longer than expected.
- Usage overage is miscomputed.
- Founder/admin view exposes too much customer data.
- Emergency disable does not actually stop live behavior.

### 7. Launch Agent

Owns positioning, rollout, and adoption.

Required artifact:

- One-line promise.
- Owner-facing value language.
- Staff-facing value language.
- Pilot rollout checklist.
- Customer-zero validation script.
- Five-real-user test plan.

Outpost-specific checks:

- Lead with burden removed, not "AI automation."
- Explain what staff no longer has to do.
- Explain what still routes to humans.
- Do not imply autonomous account changes, direct booking, Club OS replacement,
  or fully autonomous marketing.

## Merge Artifact

After the seven artifacts are produced, merge them into one slice blueprint with
these sections:

- Workflow sentence.
- Customer signal.
- Screen flow.
- Data and provider flow.
- Approval and human-review gates.
- Failure states.
- Tests and manual QA.
- Launch or pilot validation.
- Explicit non-goals.

The merge artifact should be shorter than the source artifacts. It is the build
contract, not a place to preserve every idea.

## Outpost MVP Scorecard

Use this 100-point scorecard before implementation starts. A slice below 80 is
not ready to build unless the missing points are intentionally deferred.

| Category | Points | What Good Looks Like |
| --- | ---: | --- |
| Burden reduction | 25 | A repetitive front-desk task becomes resolved or staff-ready work. |
| SaaS repeatability | 15 | The workflow generalizes beyond Acme Fitness. |
| Approval safety | 20 | Live answers come only from approved facts; risky topics route to humans. |
| Operational UX | 15 | Staff and owners can see status, next action, and failure state quickly. |
| Tenant/data safety | 15 | Tenant boundaries, auditability, and retention are explicit. |
| Validation plan | 10 | Five real users or customer-zero sessions can test the workflow. |

## Slice Readiness Checklist

- [ ] One workflow sentence is written.
- [ ] Relevant role artifacts exist, or skipped roles are intentionally skipped
  with a reason.
- [ ] Explicit exclusions are documented.
- [ ] Owner/staff/customer-zero success criteria are documented.
- [ ] QA attack list has been answered.
- [ ] Sensitive surfaces have a `ce-review` checkpoint.
- [ ] The first implementation step is the smallest proof of the workflow.
- [ ] Five-real-user or Acme Fitness validation plan exists.

## Recommended First Application

Apply this system to the first real operating slice:

> For a gym front desk, Outpost will turn phone and email tour/member inquiries
> into staff-ready tasks and approved safe answers so staff can stop context
> switching on repetitive interruptions.

Smallest proof:

- One tenant.
- One location.
- Approved answer bank entries.
- Always-human topics.
- Task inbox.
- Phone/email event stubs or test ingestion.
- No live autonomous replies until owner approval, provider review, and
  customer-zero validation are complete.

## Workflow Rule

For non-trivial Outpost work, do not start by asking one model to "build the
feature." Start with Compound Engineering, use the seven-role scaffold when it
helps expose scope, UX, backend, QA, or launch gaps, then merge the output into
the smallest buildable slice. The founder still owns taste, judgment, shipping,
distribution, and the final decision to go live.
