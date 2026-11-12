# Staff Workboard Mobile Polish Brainstorm

Date: 2026-06-17
Status: implementation input

## Slice

Polish the staff workboard beta path on mobile so a staff member can read an
answer-derived task, change status, adjust assignment, add a note, and inspect
activity without needing to understand backend state.

## Boundaries

- Keep the existing Next.js, TypeScript, Supabase Auth/RLS, and local Docker
  proof direction.
- Do not add schema, RPCs, provider ingress, notifications, invite delivery,
  Auth admin provisioning, hosted proof, billing, POS, ClubOS, or member-ledger
  behavior.
- Preserve current task status, assignment, note, and activity persistence
  boundaries.
- Treat this as frontend polish over existing persisted task rows and events.

## Useful Observations

- The staff sign-in and claim flow now has clearer mobile hierarchy than the
  workboard detail path.
- The workboard already stacks on mobile, but selected-task controls still read
  as generic form sections instead of staff command controls.
- Answer-derived tasks have a proof model in `taskProofSummary`, but task cards
  do not expose the provenance before selection.
- Status, assignee, and note actions need stronger touch targets and clearer
  save feedback on phones.
- Activity rows work functionally, but on narrow screens the actor, timestamp,
  and event kind compete for space.

## Design Direction

Use `DESIGN.md` Front Desk Command:

- Staff work starts with the queue.
- The suggested next step is the command.
- Use compact operational grouping instead of decorative cards.
- On mobile, task rows become stacked command cards with no horizontal scroll.

## Polish Batch

Do in this slice:

- Add visible task provenance to staff task cards, especially answer-review
  tasks created from owner staged answers.
- Tighten task-card metadata so status, channel, assignee, requester, and
  confidence remain legible on mobile.
- Make selected-task status and assignment controls feel like explicit staff
  actions with full-width mobile controls.
- Make note entry read as a handoff action rather than another generic form.
- Make activity rows stack cleanly with readable kind, actor, timestamp, detail,
  and note content.

Leave for later:

- True task due dates and reminders.
- Staff filter/search across task status and assignee.
- Owner-configurable queue columns.
- Notification delivery after assignment or note changes.
- Provider-ingested phone/email task creation.
- Hosted preview validation.
