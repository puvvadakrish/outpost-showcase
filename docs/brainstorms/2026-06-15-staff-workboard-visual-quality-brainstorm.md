# Staff Workboard Visual Quality Brainstorm

Date: 2026-06-15

## What We Are Fixing

The staff workboard is functionally sound after the queue-first polish, but it
still reads too much like a boxed prototype. The mobile screen is technically
responsive, yet the first viewport is heavy: navigation, topbar, page actions,
manual intake, and card chrome delay the actual task content.

## Design Brief

- Product: Outpost, gym front-desk automation SaaS.
- Screen: existing staff task workboard at `/staff/tasks`.
- Direction: Front Desk Command from `DESIGN.md`.
- Goal: make the staff queue feel like a professional SaaS work surface without
  changing backend behavior or workflow semantics.
- Interactivity: preserve all existing controls and states.

## Diagnosis

- Too many boxed surfaces compete with the task row. The detail metadata grid,
  proof panel checklist, manual intake, and task row all use similar borders.
- Mobile spends too much vertical space on app chrome before staff sees the
  selected work item.
- Typography weights are too even: headings, tags, summary text, and next-step
  text all compete instead of creating a task-command hierarchy.
- Task rows still feel like mini forms. The row needs a stronger requester and
  command rhythm with metadata pushed down.
- Pills and controls are visually chunky on mobile, adding clutter and making
  the page feel less polished.

## Recommended Approach

Use a targeted visual-quality pass:

- Keep the existing layout and data flow.
- Reduce generic card borders and replace some boxes with dividers, tinted
  surfaces, and cleaner grouping.
- Make mobile app chrome more compact.
- Make the task row read in this order: requester, status/proof, intent,
  summary, suggested next step, confidence.
- Improve touch ergonomics while keeping the page dense enough for staff use.

## Alternatives Rejected

- Full navigation redesign: too broad for this slice and risky for the whole
  app shell.
- New icon library or animation dependency: package does not currently include
  icon/motion libraries, and the requested improvement can be achieved with the
  existing Next.js/CSS stack.
- Large-radius luxury card direction: conflicts with `DESIGN.md`, which asks
  for operational surfaces with tight radii and queue-first discipline.

## Acceptance Criteria

- Staff workboard looks less box-heavy on desktop.
- Mobile first viewport feels intentional and avoids cramped typography.
- Task rows preserve all required fields without horizontal overflow.
- Manual intake remains available but visually secondary.
- Existing backend/local workflow behavior is unchanged.
