---
status: active
created: 2026-06-08
product: Outpost
---

# Outpost Design System

Outpost is gym front-desk automation software. The interface should feel like a
calm operations desk for a busy gym: clear, fast, staff-friendly, and credible
under real front-desk pressure.

## Direction

Use **Front Desk Command** as the canonical direction.

- Tone: operational, calm, gym-aware, human, direct.
- Buyer feel: "this protects my staff's time."
- Staff feel: "this tells me what needs action right now."
- Primary proof object: a staff-ready task, not a transcript or generic AI chat.
- Visual density: medium. Owner dashboard can breathe; staff queue should be
  scannable and compact.

Do not reuse RequestHandoff's Local Operator Premium palette directly.
RequestHandoff is warm home-service handoff. Outpost should feel like a gym
operations console with lighter surfaces, sharper task hierarchy, and more
front-desk immediacy.

## Visual Signature

The memorable product object should be a **front-desk workboard**: a live queue
where every row shows what Outpost handled, what needs a human, and what the
staff member should do next.

Signature motifs:

- Left navigation as the operations post.
- Task queue as the center of gravity.
- Thin status rails on task rows for channel and urgency.
- Approved/draft/conflict states shown as operational tags.
- Usage and burden metrics shown like a shift report, not a marketing chart.
- Sparse, purposeful motion: row arrival, status change, skeleton loading.
- On staff surfaces, the suggested next step should read as the operational
  command, not as an equal-weight metadata column.
- On mobile staff surfaces, task provenance and staff actions should stay
  visible without backend mental-model work: answer-review, manual, and seeded
  tasks need explicit provenance labels, while status, assignment, and note
  controls should stack as thumb-friendly action groups.

Avoid generic SaaS bento cards as the primary product identity. Use bento-style
composition only on marketing or owner overview surfaces where it helps explain
the product.

## Brand Mark

Use the generated workboard mark direction as the source for Outpost's product
identity, with a simplified vector treatment inside the application.

The app mark should use:

- A rounded operations-post shell that loosely suggests an `O`.
- A left vertical rail to echo the sidebar and task-row status rails.
- An inner workboard panel with small status dots and task lines.
- Dark pine, teal, mint, and amber from the product tokens.

Avoid placing the generated PNGs directly in product chrome. They are useful as
brand direction, but their glows and dark backgrounds lose clarity at sidebar,
favicon, and mobile-header sizes. Avoid checkmark-led logo variants in the core
mark because they make Outpost feel like a generic task-completion app instead
of a front-desk command layer.

## Design Principles

1. Lead with burden removed.
   Show calls handled, emails handled, tasks created, human handoffs, and staff
   time saved before abstract automation claims.

2. Staff work starts with the queue.
   Staff should land on today's unresolved tasks. Analytics and settings are for
   owners/admins, not the front desk default.

3. Approved facts are visible.
   The owner should always understand which answers are approved, draft,
   conflicted, or routed to a human.

4. No chatbot theater.
   Outpost is not a chat UI. It is an operating layer that turns inbound noise
   into resolved records or staff tasks.

5. Fast setup, obvious checkpoints.
   Imported facts should feel prefilled and editable, not like a giant form.

## Typography

Use a modern sans-serif and a mono for operational numbers. In the Next.js app,
load Geist and Geist Mono through `next/font` so the product does not fall back
to whatever fonts happen to be installed locally.

Preferred stack:

```css
--op-font-sans: var(--font-geist-sans, "Geist"), "Satoshi", ui-sans-serif, system-ui, sans-serif;
--op-font-mono: var(--font-geist-mono, "Geist Mono"), "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace;
```

Rules:

- No serif fonts in product UI.
- Avoid Inter as the brand/product font.
- Use mono for voice minutes, timestamps, usage, confidence, and counts.
- Keep headings controlled. This is a work surface, not a marketing hero.
- For all-day front-desk use, favor strong scan hierarchy over decorative type:
  requester, status, and next step must be readable at a glance.

## Color Tokens

Outpost should use a quiet neutral base with one clear action accent and two
semantic support colors.

```css
:root {
  --op-bg: #f4f5ef;
  --op-surface: #ffffff;
  --op-surface-raised: #fbfcf8;
  --op-surface-soft: #f7f8f2;
  --op-ink: #14201f;
  --op-muted: #657674;
  --op-line: #d9e0da;
  --op-line-strong: #b9c8c4;
  --op-sidebar: #132322;
  --op-sidebar-muted: #a8bbb6;
  --op-accent: #0f766e;
  --op-accent-strong: #0a4f4a;
  --op-attention: #b7791f;
  --op-attention-ink: #7a4a12;
  --op-danger: #a23b3b;
  --op-success: #2f7a55;
}
```

Usage:

- `--op-bg`: app background.
- `--op-surface`: tables, panels, setup forms.
- `--op-surface-soft`: tactile controls and row hover surfaces.
- `--op-sidebar`: persistent app navigation.
- `--op-accent`: primary action and active navigation.
- `--op-attention`: needs-human, low-confidence, missing fact.
- `--op-attention-ink`: accessible text on attention surfaces.
- `--op-danger`: disabled, failed delivery, unsafe/blocked topic.
- `--op-success`: approved, done, delivery success.

Avoid:

- Purple/blue AI gradients.
- Neon glows.
- Pure black.
- Beige-heavy RequestHandoff reuse.
- Overly soft SaaS pastels.

## Shape, Spacing, Surfaces

```css
--op-radius-sm: 10px;
--op-radius-md: 14px;
--op-radius-lg: 20px;
--op-radius-xl: 28px;
--op-radius-pill: 999px;
--op-shadow-diffuse: 0 24px 68px rgb(20 32 31 / 9%);
--op-shadow-contact: 0 1px 0 rgb(255 255 255 / 72%) inset;
--op-page-x: clamp(20px, 3vw, 40px);
--op-page-y: 32px;
```

Rules:

- Use the larger shell radius for persistent app chrome, panels, and mobile
  command cards. Dense field groups can still use the small radius.
- Prefer tables, lists, dividers, and grouped rows over decorative cards.
- Use panels for repeated objects or contained workflows only.
- Do not nest cards inside cards.
- Use compact spacing in staff queue views.
- Use slightly more whitespace in owner setup and analytics.
- Visual inspiration may come from refined consumer SaaS surfaces, including
  soft curvature, object-like glyphs, subtle inner highlights, and confident
  high-contrast actions. Translate that into Outpost's operational command
  system; do not copy a marketing layout, serif hero treatment, or beige-heavy
  brand palette.
- On mobile staff views, task rows become stacked command cards. Do not require
  horizontal scrolling to triage task status, requester, intent, next step,
  confidence, or assignee.
- On mobile setup views, convert location and setup tables into stacked
  field groups. Owners should be able to inspect location readiness without
  horizontal scrolling.

## Core Product Surfaces

### Staff Task Inbox

Default staff landing page.

Must show:

- Status.
- Channel: phone, email, future social.
- Requester and contact.
- Intent.
- Summary.
- Suggested next step.
- Confidence.
- Assignee/status.

Status order:

1. `needs_human`
2. `new`
3. `in_progress`
4. `done`
5. `ignored`

### Owner Dashboard

Lead with burden reduction:

- Calls handled.
- Emails handled.
- Tasks created.
- Human handoffs.
- Common repetitive questions.
- Estimated staff time saved.
- Voice usage and overage visibility.

During local beta, report only what existing rows prove. A local
burden-reduction report can show staff tasks created/resolved, answer review
progress, manual facts staged, local proof completion, and blocked hosted/live
gates. Do not make local reports look like billing dashboards or live-channel
analytics until hosted proof and providers exist.

### Answer Bank

The answer bank should make approval state obvious:

- `approved`: safe to answer live.
- `draft`: imported or proposed, not live.
- `conflict`: public sources disagree.
- `routed`: always create a task or transfer.

### Onboarding

The setup flow should feel guided, not interrogative:

1. Create gym profile.
2. Add locations.
3. Import public facts.
4. Review suggested answers.
5. Set always-human topics.
6. Configure phone/email destinations.
7. Run test call/email.
8. Go live.

## Components

Use these primitives before adding a component library:

- App shell with persistent left navigation.
- Topbar with tenant/location context.
- Status pill.
- Task table.
- Task detail panel.
- Answer approval row.
- Usage meter.
- Setup checklist.
- Staff access roster.
- Inline warning for unapproved/conflicting facts.
- Empty state for no tasks.
- Operational empty states for no staged facts, no answer proposals, and filtered
  queues.
- Queue controls for search, status, and assignee filtering when a workboard can
  hold more than a handful of tasks.
- Skeleton rows for loading.
- Inline error state for provider/setup failures.
- Skip links in shared app chrome so long owner/staff sessions remain keyboard
  navigable.

Required states:

- Loading: skeleton rows sized like the eventual table/list content.
- Empty: explain what will appear and the next action to create it.
- Error: inline, specific, and recoverable.
- Active: buttons and rows should use a subtle press or highlight state.
- Disabled: show why the action is unavailable when it affects go-live.

## Motion

Motion should be restrained and practical.

- Use hover/active feedback for buttons and rows.
- Use subtle row highlight when task status changes.
- Use skeleton shimmer for loading task rows.
- Do not use cinematic motion or decorative perpetual animation on operational
  screens.
- Respect `prefers-reduced-motion`.

Animate only `transform` and `opacity`. Do not animate layout properties like
width, height, top, or left. Avoid perpetual animation on dashboard surfaces.

## Copy Rules

Capitalization:

- Use sentence case for human-facing UI labels and state text: "Phone",
  "Email", "Social", "Needs human", "Not configured", "Off", "Stub".
- Keep raw lowercase or snake_case only when the UI is intentionally showing a
  technical identifier, database key, entitlement key, or code-like value.
- Do not rely on CSS `text-transform` for product copy. Format display labels in
  the component or data adapter so capitalization is intentional.

Use:

- "Take repetitive front-desk work off your staff."
- "Needs human."
- "Approved to answer."
- "Staff will follow up."
- "Voice minutes used."
- "Common questions handled."

Avoid:

- "AI receptionist" as the main product label.
- "Replace your front desk."
- "Autonomous workforce."
- "Seamless," "next-gen," "revolutionary," "unlock."
- Claims implying booking, billing changes, cancellation completion, or Club OS
  replacement.

## Relationship To RequestHandoff

Borrow these principles from RequestHandoff:

- Outcome over AI.
- Trust made visible.
- Product proof objects over generic screenshots.
- Small radii and operational credibility.
- Conservative customer-facing answers.

Do not borrow these directly:

- Warm home-service palette.
- Field-service imagery.
- RequestHandoff naming, lead-card framing, or home-service positioning.

## Implementation Notes

- The current app scaffold uses plain CSS. Keep tokens in CSS variables.
- Before adding any third-party UI or icon dependency, check `package.json`.
- Do not assume icon libraries are installed. If icons are needed, add an
  explicit install step or use small accessible CSS/SVG primitives.
- Do not use emoji in product UI, code, alt text, or status labels.
- Replace the current scaffold's generic Inter/system font styling with the
  Outpost font tokens during the next UI pass.
- Prefer simple tables/lists for Slice 1.
- Ensure mobile layouts collapse to a single column under tablet widths.
- Avoid horizontally scrolling tables for primary mobile workflows. If the
  table is core to setup or triage, provide a stacked mobile representation.
- Keep touch targets at least 44px where staff may use the app on mobile.
- Use a design review before turning the scaffold into polished customer-facing
  UI.
- Use `design-html` only after a specific screen is approved for visual
  finalization.

## Current Implementation Decisions

These decisions are now part of the active Slice 1 design system:

- Typography is loaded through `next/font` using Geist and Geist Mono; the CSS
  tokens include fallback-safe `var()` usage so browsers never fall back to
  serif defaults.
- The staff task inbox orders status tabs by operational priority:
  "Needs human", "New", "In progress", "Done", "Ignored".
- The suggested next step is the strongest visual action area in each task row.
- Manual task intake is available from the staff workboard, but it should read
  as a secondary disclosure rather than the first visual object on the page.
- Mobile staff task rows use stacked command-card anatomy rather than squeezed
  desktop columns.
- Mobile setup views, including locations, use stacked field groups instead of
  primary horizontal tables.
- Channel and provider setup states are shown as human labels, not raw enum
  values.
- The owner setup surface is a guided approval workspace: checklist first,
  answer review rows/cards second, and handoff/readiness context in the rail.
- Answer-bank rows must show topic, question, approval state, owner boundary,
  source, and update freshness so owners can approve or route conservatively.
- On mobile owner setup, avoid repeating large overview metric cards when the
  topbar already carries the same summary. Bring the setup checklist into view
  before the answer review list.
- Owner workspace proof and readiness should be compact. Use topbar metrics and
  proof-path strips instead of duplicate overview cards; keep local rehearsal
  commands in a collapsed disclosure unless the owner is actively running local
  proof.
- Owner setup forms should read as operating rows, not questionnaires. Use
  sentence-case sans labels for editable fields, reserve mono styling for
  commands, counts, confidence, timestamps, and technical identifiers, and give
  the fact/answer text column priority over metadata columns.
- Staff access management should use roster rows, not decorative people cards.
  Show identity, role, access state, and the invite/auth boundary in one
  scannable row. On mobile, stack identity above role/status and place the form
  below the roster; never require horizontal scrolling to understand who has
  local staff access.
- Staff claim handoff should stay attached to the roster panel, not become a
  separate marketing card. Show claimed versus needs-claim state in the roster
  row, then place the manual `/staff/sign-in` handoff path and live-provider
  boundary below the roster/form. Copy should say what staff do next without
  implying invite email, notification delivery, or Auth admin provisioning.
- Staff claim rehearsal commands may appear below the staff handoff path as
  compact mono proof strips. Keep them visually secondary to the roster rows and
  label them as local Docker proof, not hosted readiness.
- Beta readiness runbooks should stay attached to the owner proof path. Show the
  operator sequence, local-only commands, readiness checks, and no-go gates as
  compact operational rows; keep long commands behind disclosure and display
  repo runbook paths as file references rather than dead app links.
- Staff sign-in claim failures should render as operational result states, not
  generic form errors. Show a short title, the backend-derived message, and the
  next staff action while keeping no-invite/no-live-provider boundary copy in
  the same visual object.
- On mobile, panel headers should stack content and actions so buttons never
  squeeze into awkward word-by-word columns. Give header actions their own row
  and center or stretch the touch target.
- Staff workboards that can grow beyond seed/demo volume should expose compact
  Queue controls above the task list: search across requester/intent/source,
  status filtering, assignee filtering, a visible result count, and a clear
  action. Keep the filters client-side when they operate on already loaded RLS
  data; do not add provider or automation behavior just to filter the view.
- Operational empty states should look intentional, not like missing content.
  Use a quiet bordered surface with a short title, one sentence explaining what
  will appear, and the next available action. Apply this to filtered task queues,
  source-intake staging, and answer-review completion states.
- Manual source intake facts should prioritize fact text over metadata on
  mobile. Number fact rows, allow removing unused rows before save, and collapse
  the row to one column below tablet widths so topic, fact, confidence, and
  conflict group never overflow horizontally.
- Admin portal beta access requests should render as operator queue rows, not
  wide audit grids or decorative cards. Use a status rail, request summary,
  readiness checks, and a collapsed operator handoff packet. Keep temporary
  password handling and fulfillment execution in the CLI; the web UI may show
  placeholder command templates only, with long commands contained in code
  blocks rather than forcing page-level horizontal overflow.
- Admin portal request lifecycle should stay attached to each request row.
  Use compact step rows or rails for queued, reviewing, fulfilled, signed-in,
  bootstrapped, and handoff-ready state. Do not turn lifecycle proof into a
  separate decorative dashboard; the request row remains the operator object.
- Admin portal fulfillment preflight should also stay attached to each request
  row. Show the dry-run state, reasons, and preflight command as compact
  operator readiness rows. Do not add browser approve/decline/fulfill buttons
  or a separate preflight dashboard; the mutating command remains CLI-only.
- Admin portal fulfillment receipts should stay attached to the same request
  row as compact evidence, not a separate audit dashboard. Show only command
  name, recorded timestamp, Neon branch, and receipt status. Missing receipts
  should read as an operator attention state, especially when fulfillment is
  already linked. Do not expose grant notes, temporary passwords, command
  output, tokens, API keys, cookies, or provider secrets.
- Admin portal owner onboarding timelines should stay attached to each beta
  request row and read as an operator checklist, not a separate decorative
  dashboard. Show request, receipt, owner sign-in, workspace bootstrap, handoff
  packet, and rollback status as compact step rows. Keep packet and rollback
  steps derived from existing proof/readiness rows, with no browser buttons for
  fulfillment, reset, invite delivery, provider setup, billing, POS, access
  control, or member-ledger writes.
