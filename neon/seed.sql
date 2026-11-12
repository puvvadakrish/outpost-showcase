
insert into plans (
  id,
  name,
  included_locations,
  included_voice_minutes,
  included_emails,
  included_users,
  overage_voice_minute_cents
) values
  ('plan_single_location', 'Single Location', 1, 900, 1000, 8, 18)
on conflict (id) do nothing;

insert into tenants (id, name, slug, status, plan_id, billing_mode, support_tier) values
  ('tenant_acme_fitness', 'Acme Fitness', 'acme-fitness', 'setup', 'plan_single_location', 'pilot', 'concierge'),
  ('tenant_crossfit_north', 'Peak CrossFit', 'peak-crossfit', 'setup', 'plan_single_location', 'pilot', 'standard')
on conflict (id) do nothing;

insert into users (id, external_auth_id, email, name) values
  ('user_owner_acme', '00000000-0000-0000-0000-000000000101', 'owner-acme@example.com', 'Acme Fitness Owner'),
  ('user_owner_north', '00000000-0000-0000-0000-000000000202', 'owner-north@example.com', 'Peak CrossFit Owner'),
  ('user_staff_acme', '00000000-0000-0000-0000-000000000303', 'staff-acme@example.com', 'Acme Fitness Front Desk')
on conflict (id) do nothing;

insert into owner_beta_access_grants (id, email, display_name, status, note) values
  ('beta_owner_acme', 'owner-acme@example.com', 'Acme Fitness Owner', 'active', 'Seeded owner for hosted beta proof.'),
  ('beta_owner_north', 'owner-north@example.com', 'Peak CrossFit Owner', 'active', 'Seeded cross-tenant owner for hosted beta proof.')
on conflict (email) do update
  set display_name = excluded.display_name,
      status = excluded.status,
      note = excluded.note,
      updated_at = now();

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status) values
  ('member_owner_acme', 'tenant_acme_fitness', 'user_owner_acme', 'owner', 'active'),
  ('member_owner_north', 'tenant_crossfit_north', 'user_owner_north', 'owner', 'active'),
  ('member_staff_acme', 'tenant_acme_fitness', 'user_staff_acme', 'staff', 'active')
on conflict (tenant_id, user_id) do nothing;

insert into locations (id, tenant_id, name, address, public_phone, routing_phone, timezone, status) values
  ('loc_acme_main', 'tenant_acme_fitness', 'Acme Fitness Main', 'Customer-zero location', '(555) 010-1000', '(555) 010-2000', 'America/Chicago', 'draft'),
  ('loc_north_main', 'tenant_crossfit_north', 'Peak CrossFit Main', 'Second tenant verification location', '(555) 010-3000', '(555) 010-4000', 'America/Chicago', 'draft')
on conflict (id) do nothing;

insert into source_documents (
  id,
  tenant_id,
  location_id,
  source_type,
  label,
  status,
  facts_found,
  conflicts_found
) values
  ('source_acme_owner_notes', 'tenant_acme_fitness', 'loc_acme_main', 'manual', 'Owner setup notes', 'ready', 4, 0),
  ('source_north_owner_notes', 'tenant_crossfit_north', 'loc_north_main', 'manual', 'Owner setup notes', 'ready', 2, 0)
on conflict (id) do nothing;

insert into answer_bank_entries (
  id,
  tenant_id,
  location_id,
  topic,
  question,
  answer,
  approval_status,
  source_document_id,
  source_label,
  owner_action,
  runtime_behavior,
  review_note
) values
  (
    'answer_hours',
    'tenant_acme_fitness',
    'loc_acme_main',
    'hours',
    'What are your staffed hours?',
    'Staffed hours are pending owner approval before live use.',
    'draft',
    'source_acme_owner_notes',
    'owner seed',
    'edit',
    'needs_owner_review',
    'Seeded draft for backend persistence tracer bullet.'
  ),
  (
    'answer_north_hours',
    'tenant_crossfit_north',
    'loc_north_main',
    'hours',
    'What are your staffed hours?',
    'Second tenant hours are private to that tenant.',
    'draft',
    'source_north_owner_notes',
    'owner seed',
    'edit',
    'needs_owner_review',
    'Seeded cross-tenant denial record.'
  )
on conflict (id) do nothing;

insert into handoff_rules (
  id,
  tenant_id,
  location_id,
  trigger,
  topic,
  action,
  destination,
  active_window,
  priority,
  status
) values
  (
    'rule_cancellation_always_human',
    'tenant_acme_fitness',
    'loc_acme_main',
    'always_human',
    'cancellation or freeze',
    'create_task',
    'front desk queue',
    'always',
    10,
    'active'
  ),
  (
    'rule_low_confidence',
    'tenant_acme_fitness',
    'loc_acme_main',
    'low_confidence',
    'unapproved or low-confidence fact',
    'create_task',
    'front desk queue',
    'always',
    20,
    'active'
  ),
  (
    'rule_person_request',
    'tenant_acme_fitness',
    'loc_acme_main',
    'topic',
    'caller asks for a person',
    'transfer_when_live',
    'configured staff number',
    'staffed hours',
    30,
    'draft'
  ),
  (
    'rule_north_cancellation',
    'tenant_crossfit_north',
    'loc_north_main',
    'always_human',
    'cancellation or freeze',
    'create_task',
    'front desk queue',
    'always',
    10,
    'active'
  )
on conflict (id) do nothing;

insert into notification_destinations (
  id,
  tenant_id,
  location_id,
  destination_type,
  label,
  destination,
  status
) values
  (
    'dest_acme_queue',
    'tenant_acme_fitness',
    'loc_acme_main',
    'task_queue',
    'Unified task inbox',
    'Front-desk workboard',
    'ready'
  ),
  (
    'dest_acme_staff_email',
    'tenant_acme_fitness',
    'loc_acme_main',
    'staff_email',
    'Staff notification email',
    'frontdesk@example.com',
    'draft'
  ),
  (
    'dest_acme_owner_email',
    'tenant_acme_fitness',
    'loc_acme_main',
    'owner_email',
    'Owner review digest',
    'owner@example.com',
    'draft'
  ),
  (
    'dest_north_queue',
    'tenant_crossfit_north',
    'loc_north_main',
    'task_queue',
    'North task inbox',
    'North private workboard',
    'ready'
  )
on conflict (id) do nothing;

insert into tasks (
  id,
  tenant_id,
  location_id,
  channel,
  requester_name,
  requester_contact,
  intent,
  summary,
  confidence,
  suggested_next_step,
  assignee_user_id,
  status,
  created_at,
  updated_at
) values
  (
    'task_new_tour',
    'tenant_acme_fitness',
    'loc_acme_main',
    'email',
    'Taylor Morgan',
    'taylor@example.com',
    'tour',
    'Prospect wants a tour after work and asked about staffed hours.',
    0.82,
    'Confirm preferred tour window and staffed-hour policy.',
    'user_staff_acme',
    'new',
    '2026-06-08T14:05:00.000Z',
    '2026-06-08T14:05:00.000Z'
  ),
  (
    'task_needs_human_freeze',
    'tenant_acme_fitness',
    'loc_acme_main',
    'phone',
    'Jordan Lee',
    '(555) 010-3333',
    'membership freeze',
    'Member asked about freezing for travel. Account changes are out of scope.',
    0.63,
    'Have staff explain the approved freeze process.',
    null,
    'needs_human',
    '2026-06-08T15:20:00.000Z',
    '2026-06-08T15:20:00.000Z'
  ),
  (
    'task_north_tour',
    'tenant_crossfit_north',
    'loc_north_main',
    'email',
    'North Prospect',
    'north@example.com',
    'tour',
    'Second tenant task for RLS denial verification.',
    0.8,
    'Keep this private to Peak CrossFit.',
    null,
    'new',
    '2026-06-08T14:05:00.000Z',
    '2026-06-08T14:05:00.000Z'
  )
on conflict (id) do nothing;

insert into task_events (
  id,
  tenant_id,
  location_id,
  task_id,
  event_type,
  to_status,
  note,
  created_at
) values
  (
    'task_event_new_tour_created',
    'tenant_acme_fitness',
    'loc_acme_main',
    'task_new_tour',
    'created',
    'new',
    'Seeded task event; no email ingestion is connected.',
    '2026-06-08T14:05:00.000Z'
  ),
  (
    'task_event_north_tour_created',
    'tenant_crossfit_north',
    'loc_north_main',
    'task_north_tour',
    'created',
    'new',
    'Seeded cross-tenant task event for denial verification.',
    '2026-06-08T14:05:00.000Z'
  )
on conflict (id) do nothing;
