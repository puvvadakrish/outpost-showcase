begin;
\set ON_ERROR_STOP on

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

do $$
declare
  audit_events_after integer;
  approval_audit_events_after integer;
  approval_audit_events_before integer;
  approval_revisions_after integer;
  approval_revisions_before integer;
  approved answer_bank_entries;
  conflict_edit_audit_events_after integer;
  conflict_edit_audit_events_before integer;
  conflict_edit_revisions_after integer;
  conflict_edit_revisions_before integer;
  answer_proposal_audit_events_after integer;
  answer_proposal_audit_events_before integer;
  answer_proposal_conflict_audit_events_after integer;
  answer_proposal_conflict_audit_events_before integer;
  answer_proposal_conflict_entries_after integer;
  answer_proposal_conflict_entries_before integer;
  answer_proposal_conflict_facts_after integer;
  answer_proposal_conflict_facts_before integer;
  answer_proposal_conflict_revisions_after integer;
  answer_proposal_conflict_revisions_before integer;
  answer_proposal_entries_after integer;
  answer_proposal_entries_before integer;
  answer_proposal_facts_after integer;
  answer_proposal_facts_before integer;
  answer_proposal_result record;
  answer_proposal_revisions_after integer;
  answer_proposal_revisions_before integer;
  answer_proposal_refresh_audit_events_after integer;
  answer_proposal_refresh_audit_events_before integer;
  answer_proposal_refresh_entries_after integer;
  answer_proposal_refresh_entries_before integer;
  answer_proposal_refresh_result record;
  answer_proposal_refresh_revisions_after integer;
  answer_proposal_refresh_revisions_before integer;
  answer_task_audit_events_after integer;
  answer_task_audit_events_before integer;
  answer_task_after_terminal tasks;
  answer_task_created tasks;
  answer_task_duplicate tasks;
  answer_task_events_after integer;
  answer_task_events_before integer;
  answer_tasks_after integer;
  answer_tasks_before integer;
  answer_task_usage_events_after integer;
  answer_task_usage_events_before integer;
  audit_events_before integer;
  assigned_task tasks;
  assignable_members_count integer;
  assignment_audit_events_after integer;
  assignment_audit_events_before integer;
  assignment_task_events_after integer;
  assignment_task_events_before integer;
  edited answer_bank_entries;
  handoff_audit_events_after integer;
  handoff_audit_events_before integer;
  handoff_revisions_after integer;
  handoff_revisions_before integer;
  location_audit_events_after integer;
  location_audit_events_before integer;
  location_revisions_after integer;
  location_revisions_before integer;
  manual_source_audit_events_after integer;
  manual_source_audit_events_before integer;
  manual_source_documents_after integer;
  manual_source_documents_before integer;
  manual_source_facts_after integer;
  manual_source_facts_before integer;
  manual_created_task tasks;
  manual_source_document source_documents;
  manual_tasks_after integer;
  manual_tasks_before integer;
  manual_task_audit_events_after integer;
  manual_task_audit_events_before integer;
  manual_task_events_after integer;
  manual_task_events_before integer;
  manual_task_usage_events_after integer;
  manual_task_usage_events_before integer;
  notification_audit_events_after integer;
  notification_audit_events_before integer;
  notification_revisions_after integer;
  notification_revisions_before integer;
  retired answer_bank_entries;
  retirement_audit_events_after integer;
  retirement_audit_events_before integer;
  retirement_revisions_after integer;
  retirement_revisions_before integer;
  review_conflict_answer_id text;
  task_note_event task_events;
  task_audit_events_after integer;
  task_audit_events_before integer;
  task_events_after integer;
  task_events_before integer;
  note_audit_events_after integer;
  note_audit_events_before integer;
  note_task_events_after integer;
  note_task_events_before integer;
  staff_access_audit_events_after integer;
  staff_access_audit_events_before integer;
  staff_access_disable_audit_events_after integer;
  staff_access_disable_audit_events_before integer;
  staff_access_member record;
  staff_access_memberships_after integer;
  staff_access_memberships_before integer;
  staff_access_projection_disabled_count integer;
  staff_access_projection_count integer;
  staff_access_projection_claimed_count integer;
  staff_access_users_after integer;
  staff_access_users_before integer;
  updated_location locations;
  updated_rule handoff_rules;
  updated_destination notification_destinations;
  updated_task tasks;
  bootstrap_result record;
  revisions_after integer;
  revisions_before integer;
  visible_cross_tenant_locations integer;
  visible_cross_tenant_handoff_rules integer;
  visible_cross_tenant_notification_destinations integer;
  visible_cross_tenant_source_documents integer;
  visible_cross_tenant_source_facts integer;
  visible_cross_tenant_task_events integer;
  visible_cross_tenant_tasks integer;
  visible_cross_tenant_answers integer;
  visible_own_locations integer;
  visible_own_handoff_rules integer;
  visible_own_notification_destinations integer;
  visible_own_source_documents integer;
  visible_own_source_facts integer;
  visible_own_task_events integer;
  visible_own_tasks integer;
  visible_own_answers integer;
begin
  if has_function_privilege(
    'anon',
    'bootstrap_owner_tenant(text, text, text, text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute owner bootstrap RPC';
  end if;

  if has_function_privilege(
    'public',
    'bootstrap_owner_tenant(text, text, text, text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute owner bootstrap RPC';
  end if;

  if has_function_privilege(
    'anon',
    'edit_answer_bank_draft(text, text, text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute answer-bank edit RPC';
  end if;

  if has_function_privilege(
    'public',
    'edit_answer_bank_draft(text, text, text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute answer-bank edit RPC';
  end if;

  if has_function_privilege(
    'anon',
    'approve_answer_bank_entry(text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute answer-bank approval RPC';
  end if;

  if has_function_privilege(
    'public',
    'approve_answer_bank_entry(text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute answer-bank approval RPC';
  end if;

  if has_function_privilege(
    'anon',
    'retire_answer_bank_entry(text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute answer retirement RPC';
  end if;

  if has_function_privilege(
    'public',
    'retire_answer_bank_entry(text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute answer retirement RPC';
  end if;

  if has_function_privilege(
    'anon',
    'propose_answers_from_manual_source(text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute answer proposal RPC';
  end if;

  if has_function_privilege(
    'public',
    'propose_answers_from_manual_source(text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute answer proposal RPC';
  end if;

  if has_function_privilege(
    'anon',
    'update_location_profile(text, text, text, text, text, text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute location update RPC';
  end if;

  if has_function_privilege(
    'public',
    'update_location_profile(text, text, text, text, text, text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute location update RPC';
  end if;

  if has_function_privilege(
    'anon',
    'update_handoff_rule(text, text, text, text, text, text, text, integer, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute handoff-rule update RPC';
  end if;

  if has_function_privilege(
    'public',
    'update_handoff_rule(text, text, text, text, text, text, text, integer, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute handoff-rule update RPC';
  end if;

  if has_function_privilege(
    'anon',
    'update_notification_destination(text, text, text, text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute notification-destination update RPC';
  end if;

  if has_function_privilege(
    'public',
    'update_notification_destination(text, text, text, text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute notification-destination update RPC';
  end if;

  if has_function_privilege(
    'anon',
    'update_task_status(text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute task status update RPC';
  end if;

  if has_function_privilege(
    'public',
    'update_task_status(text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute task status update RPC';
  end if;

  if has_function_privilege(
    'anon',
    'assign_task(text, text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute task assignment RPC';
  end if;

  if has_function_privilege(
    'public',
    'assign_task(text, text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute task assignment RPC';
  end if;

  if has_function_privilege(
    'anon',
    'add_task_note(text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute task note RPC';
  end if;

  if has_function_privilege(
    'public',
    'add_task_note(text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute task note RPC';
  end if;

  if has_function_privilege(
    'anon',
    'list_active_tenant_members(text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute active tenant member list RPC';
  end if;

  if has_function_privilege(
    'public',
    'list_active_tenant_members(text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute active tenant member list RPC';
  end if;

  if has_function_privilege(
    'anon',
    'upsert_tenant_staff_member(text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon staff access RPC unexpectedly executable';
  end if;

  if has_function_privilege(
    'public',
    'upsert_tenant_staff_member(text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public staff access RPC unexpectedly executable';
  end if;

  if has_function_privilege(
    'anon',
    'disable_tenant_staff_member(text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon staff access disable RPC unexpectedly executable';
  end if;

  if has_function_privilege(
    'public',
    'disable_tenant_staff_member(text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public staff access disable RPC unexpectedly executable';
  end if;

  if has_function_privilege(
    'anon',
    'list_tenant_staff_access_members(text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon staff access projection RPC unexpectedly executable';
  end if;

  if has_function_privilege(
    'public',
    'list_tenant_staff_access_members(text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public staff access projection RPC unexpectedly executable';
  end if;

  if has_function_privilege(
    'anon',
    'claim_staff_roster_membership()'::regprocedure,
    'execute'
  ) then
    raise exception 'anon staff claim RPC unexpectedly executable';
  end if;

  if has_function_privilege(
    'public',
    'claim_staff_roster_membership()'::regprocedure,
    'execute'
  ) then
    raise exception 'public staff claim RPC unexpectedly executable';
  end if;

  if has_function_privilege(
    'anon',
    'create_manual_task(text, text, text, text, text, text, text, numeric)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute manual task creation RPC';
  end if;

  if has_function_privilege(
    'public',
    'create_manual_task(text, text, text, text, text, text, text, numeric)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute manual task creation RPC';
  end if;

  if has_function_privilege(
    'anon',
    'create_task_from_answer_bank_entry(text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute answer task creation RPC';
  end if;

  if has_function_privilege(
    'public',
    'create_task_from_answer_bank_entry(text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute answer task creation RPC';
  end if;

  if has_function_privilege(
    'anon',
    'upsert_manual_source_document(text, text, text, text, jsonb)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon can execute manual source intake RPC';
  end if;

  if has_function_privilege(
    'public',
    'upsert_manual_source_document(text, text, text, text, jsonb)'::regprocedure,
    'execute'
  ) then
    raise exception 'public can execute manual source intake RPC';
  end if;

  select count(*) into visible_own_answers
  from answer_bank_entries
  where tenant_id = 'tenant_acme_fitness';

  if visible_own_answers <> 1 then
    raise exception 'expected exactly one own-tenant answer, saw %', visible_own_answers;
  end if;

  select count(*) into visible_cross_tenant_answers
  from answer_bank_entries
  where tenant_id = 'tenant_crossfit_north';

  if visible_cross_tenant_answers <> 0 then
    raise exception 'cross-tenant answer leaked through RLS';
  end if;

  select count(*) into visible_own_locations
  from locations
  where tenant_id = 'tenant_acme_fitness';

  if visible_own_locations <> 1 then
    raise exception 'expected exactly one own-tenant location, saw %', visible_own_locations;
  end if;

  select count(*) into visible_cross_tenant_locations
  from locations
  where tenant_id = 'tenant_crossfit_north';

  if visible_cross_tenant_locations <> 0 then
    raise exception 'cross-tenant location leaked through RLS';
  end if;

  select count(*) into visible_own_source_documents
  from source_documents
  where tenant_id = 'tenant_acme_fitness';

  if visible_own_source_documents <> 1 then
    raise exception 'expected exactly one own-tenant source document, saw %', visible_own_source_documents;
  end if;

  select count(*) into visible_cross_tenant_source_documents
  from source_documents
  where tenant_id = 'tenant_crossfit_north';

  if visible_cross_tenant_source_documents <> 0 then
    raise exception 'cross-tenant source document leaked through RLS';
  end if;

  select count(*) into visible_own_source_facts
  from source_facts
  where tenant_id = 'tenant_acme_fitness';

  if visible_own_source_facts <> 0 then
    raise exception 'expected no own-tenant source facts before manual intake proof, saw %', visible_own_source_facts;
  end if;

  select count(*) into visible_cross_tenant_source_facts
  from source_facts
  where tenant_id = 'tenant_crossfit_north';

  if visible_cross_tenant_source_facts <> 0 then
    raise exception 'cross-tenant source fact leaked through RLS';
  end if;

  select count(*) into visible_own_handoff_rules
  from handoff_rules
  where tenant_id = 'tenant_acme_fitness';

  if visible_own_handoff_rules <> 3 then
    raise exception 'expected exactly three own-tenant handoff rules, saw %', visible_own_handoff_rules;
  end if;

  select count(*) into visible_cross_tenant_handoff_rules
  from handoff_rules
  where tenant_id = 'tenant_crossfit_north';

  if visible_cross_tenant_handoff_rules <> 0 then
    raise exception 'cross-tenant handoff rule leaked through RLS';
  end if;

  select count(*) into visible_own_notification_destinations
  from notification_destinations
  where tenant_id = 'tenant_acme_fitness';

  if visible_own_notification_destinations <> 3 then
    raise exception 'expected exactly three own-tenant notification destinations, saw %',
      visible_own_notification_destinations;
  end if;

  select count(*) into visible_cross_tenant_notification_destinations
  from notification_destinations
  where tenant_id = 'tenant_crossfit_north';

  if visible_cross_tenant_notification_destinations <> 0 then
    raise exception 'cross-tenant notification destination leaked through RLS';
  end if;

  select count(*) into visible_own_tasks
  from tasks
  where tenant_id = 'tenant_acme_fitness';

  if visible_own_tasks <> 2 then
    raise exception 'expected exactly two own-tenant tasks, saw %', visible_own_tasks;
  end if;

  select count(*) into visible_cross_tenant_tasks
  from tasks
  where tenant_id = 'tenant_crossfit_north';

  if visible_cross_tenant_tasks <> 0 then
    raise exception 'cross-tenant task leaked through RLS';
  end if;

  select count(*) into visible_own_task_events
  from task_events
  where tenant_id = 'tenant_acme_fitness';

  if visible_own_task_events <> 1 then
    raise exception 'expected exactly one own-tenant task event, saw %', visible_own_task_events;
  end if;

  select count(*) into visible_cross_tenant_task_events
  from task_events
  where tenant_id = 'tenant_crossfit_north';

  if visible_cross_tenant_task_events <> 0 then
    raise exception 'cross-tenant task event leaked through RLS';
  end if;

  select count(*) into assignable_members_count
  from list_active_tenant_members('tenant_acme_fitness');

  if assignable_members_count <> 2 then
    raise exception 'expected exactly two active assignable tenant members, saw %',
      assignable_members_count;
  end if;

  select count(*) into staff_access_projection_count
  from list_tenant_staff_access_members('tenant_acme_fitness');

  if staff_access_projection_count <> 1 then
    raise exception 'expected exactly one staff access projection row, saw %',
      staff_access_projection_count;
  end if;

  select count(*) into staff_access_projection_claimed_count
  from list_tenant_staff_access_members('tenant_acme_fitness')
  where email = 'staff-acme@example.com'
    and role = 'staff'
    and invite_status = 'active'
    and auth_linked;

  if staff_access_projection_claimed_count <> 1 then
    raise exception 'staff access projection did not expose claimed staff row';
  end if;

  select count(*) into staff_access_memberships_before
  from tenant_memberships
  where tenant_id = 'tenant_acme_fitness';

  select count(*) into staff_access_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'tenant_membership'
    and action = 'tenant_membership.staff_upserted';

  select * into staff_access_member
  from upsert_tenant_staff_member(
    'tenant_acme_fitness',
    'FrontDesk-Lead@Example.com',
    'Front Desk Lead'
  );

  if staff_access_member.email <> 'frontdesk-lead@example.com' then
    raise exception 'staff access did not normalize staff email';
  end if;

  if staff_access_member.role <> 'staff' then
    raise exception 'staff access did not create staff role';
  end if;

  if staff_access_member.invite_status <> 'active' then
    raise exception 'staff access did not create active staff membership';
  end if;

  select count(*) into staff_access_users_after
  from list_active_tenant_members('tenant_acme_fitness')
  where email = 'frontdesk-lead@example.com';

  if staff_access_users_after <> 1 then
    raise exception 'staff access did not create user row';
  end if;

  select count(*) into staff_access_memberships_after
  from tenant_memberships
  where tenant_id = 'tenant_acme_fitness';

  if staff_access_memberships_after <> staff_access_memberships_before + 1 then
    raise exception 'staff access did not create active staff membership row';
  end if;

  select count(*) into staff_access_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'tenant_membership'
    and subject_id = staff_access_member.membership_id
    and action = 'tenant_membership.staff_upserted';

  if staff_access_audit_events_after <> staff_access_audit_events_before + 1 then
    raise exception 'staff access audit event missing';
  end if;

  select count(*) into staff_access_disable_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'tenant_membership'
    and subject_id = staff_access_member.membership_id
    and action = 'tenant_membership.staff_disabled';

  select * into staff_access_member
  from disable_tenant_staff_member(
    'tenant_acme_fitness',
    staff_access_member.membership_id
  );

  if staff_access_member.invite_status <> 'disabled' then
    raise exception 'staff access did not disable staff membership';
  end if;

  select count(*) into staff_access_users_after
  from list_active_tenant_members('tenant_acme_fitness')
  where email = 'frontdesk-lead@example.com';

  if staff_access_users_after <> 0 then
    raise exception 'disabled staff access remained assignable as active member';
  end if;

  select count(*) into staff_access_projection_disabled_count
  from list_tenant_staff_access_members('tenant_acme_fitness')
  where email = 'frontdesk-lead@example.com'
    and invite_status = 'disabled';

  if staff_access_projection_disabled_count <> 1 then
    raise exception 'staff access projection did not expose disabled staff row';
  end if;

  select count(*) into staff_access_disable_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'tenant_membership'
    and subject_id = staff_access_member.membership_id
    and action = 'tenant_membership.staff_disabled';

  if staff_access_disable_audit_events_after <> staff_access_disable_audit_events_before + 1 then
    raise exception 'staff access disable audit event missing';
  end if;

  select * into staff_access_member
  from upsert_tenant_staff_member(
    'tenant_acme_fitness',
    'frontdesk-lead@example.com',
    'Front Desk Lead Reactivated'
  );

  if staff_access_member.invite_status <> 'active' then
    raise exception 'staff access did not reactivate disabled staff membership';
  end if;

  select count(*) into staff_access_users_after
  from list_active_tenant_members('tenant_acme_fitness')
  where email = 'frontdesk-lead@example.com';

  if staff_access_users_after <> 1 then
    raise exception 'reactivated staff access did not restore active member visibility';
  end if;

  select count(*) into revisions_before
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and answer_bank_entry_id = 'answer_hours'
    and revision_intent = 'edit';

  select count(*) into audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'answer_bank_entry'
    and subject_id = 'answer_hours'
    and action = 'answer_bank_entry.draft_edited';

  select * into edited
  from edit_answer_bank_draft(
    'tenant_acme_fitness',
    'answer_hours',
    'hours',
    'What are your verified staffed hours?',
    'Staffed hours are still pending final owner approval.',
    'RLS verification edit.'
  );

  if edited.answer <> 'Staffed hours are still pending final owner approval.' then
    raise exception 'RPC did not return edited answer';
  end if;

  select count(*) into revisions_after
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and answer_bank_entry_id = 'answer_hours'
    and revision_intent = 'edit';

  if revisions_after <> revisions_before + 1 then
    raise exception 'expected one persisted answer revision, before %, after %', revisions_before, revisions_after;
  end if;

  select count(*) into audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'answer_bank_entry'
    and subject_id = 'answer_hours'
    and action = 'answer_bank_entry.draft_edited';

  if audit_events_after <> audit_events_before + 1 then
    raise exception 'expected one persisted audit event, before %, after %', audit_events_before, audit_events_after;
  end if;

  select count(*) into approval_revisions_before
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and answer_bank_entry_id = 'answer_hours'
    and revision_intent = 'approval';

  select count(*) into approval_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'answer_bank_entry'
    and subject_id = 'answer_hours'
    and action = 'answer_bank_entry.approved';

  select * into approved
  from approve_answer_bank_entry(
    'tenant_acme_fitness',
    'answer_hours',
    'RLS verification approval.'
  );

  if approved.approval_status <> 'approved' then
    raise exception 'approval RPC did not approve the answer';
  end if;

  if approved.approved_by_user_id <> 'user_owner_acme' then
    raise exception 'approval RPC used unexpected approver %', approved.approved_by_user_id;
  end if;

  if approved.runtime_behavior <> 'answer_live' then
    raise exception 'approval RPC did not move runtime behavior to answer_live';
  end if;

  select count(*) into approval_revisions_after
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and answer_bank_entry_id = 'answer_hours'
    and revision_intent = 'approval';

  if approval_revisions_after <> approval_revisions_before + 1 then
    raise exception 'expected one persisted approval revision, before %, after %',
      approval_revisions_before, approval_revisions_after;
  end if;

  select count(*) into approval_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'answer_bank_entry'
    and subject_id = 'answer_hours'
    and action = 'answer_bank_entry.approved';

  if approval_audit_events_after <> approval_audit_events_before + 1 then
    raise exception 'expected one persisted approval audit event, before %, after %',
      approval_audit_events_before, approval_audit_events_after;
  end if;

  select count(*) into location_revisions_before
  from location_revisions
  where tenant_id = 'tenant_acme_fitness'
    and location_id = 'loc_acme_main';

  select count(*) into location_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'location'
    and subject_id = 'loc_acme_main'
    and action = 'location.updated';

  select * into updated_location
  from update_location_profile(
    'tenant_acme_fitness',
    'loc_acme_main',
    'Acme Fitness HQ',
    'Customer-zero verified location',
    '(555) 010-1111',
    '(555) 010-2222',
    'America/Chicago',
    'active',
    'RLS verification location update.'
  );

  if updated_location.name <> 'Acme Fitness HQ' then
    raise exception 'location RPC did not return updated name';
  end if;

  if updated_location.status <> 'active' then
    raise exception 'location RPC did not return updated status';
  end if;

  select count(*) into location_revisions_after
  from location_revisions
  where tenant_id = 'tenant_acme_fitness'
    and location_id = 'loc_acme_main';

  if location_revisions_after <> location_revisions_before + 1 then
    raise exception 'expected one persisted location revision, before %, after %',
      location_revisions_before, location_revisions_after;
  end if;

  select count(*) into location_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'location'
    and subject_id = 'loc_acme_main'
    and action = 'location.updated';

  if location_audit_events_after <> location_audit_events_before + 1 then
    raise exception 'expected one persisted location audit event, before %, after %',
      location_audit_events_before, location_audit_events_after;
  end if;

  select count(*) into handoff_revisions_before
  from handoff_rule_revisions
  where tenant_id = 'tenant_acme_fitness'
    and handoff_rule_id = 'rule_low_confidence';

  select count(*) into handoff_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'handoff_rule'
    and subject_id = 'rule_low_confidence'
    and action = 'handoff_rule.updated';

  select * into updated_rule
  from update_handoff_rule(
    'tenant_acme_fitness',
    'rule_low_confidence',
    'low_confidence',
    'unapproved or uncertain fact',
    'create_task',
    'front desk queue',
    'always',
    25,
    'active',
    'RLS verification handoff rule update.'
  );

  if updated_rule.topic <> 'unapproved or uncertain fact' then
    raise exception 'handoff-rule RPC did not return updated topic';
  end if;

  if updated_rule.priority <> 25 then
    raise exception 'handoff-rule RPC did not return updated priority';
  end if;

  select count(*) into handoff_revisions_after
  from handoff_rule_revisions
  where tenant_id = 'tenant_acme_fitness'
    and handoff_rule_id = 'rule_low_confidence';

  if handoff_revisions_after <> handoff_revisions_before + 1 then
    raise exception 'expected one persisted handoff revision, before %, after %',
      handoff_revisions_before, handoff_revisions_after;
  end if;

  select count(*) into handoff_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'handoff_rule'
    and subject_id = 'rule_low_confidence'
    and action = 'handoff_rule.updated';

  if handoff_audit_events_after <> handoff_audit_events_before + 1 then
    raise exception 'expected one persisted handoff audit event, before %, after %',
      handoff_audit_events_before, handoff_audit_events_after;
  end if;

  select count(*) into notification_revisions_before
  from notification_destination_revisions
  where tenant_id = 'tenant_acme_fitness'
    and notification_destination_id = 'dest_acme_staff_email';

  select count(*) into notification_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'notification_destination'
    and subject_id = 'dest_acme_staff_email'
    and action = 'notification_destination.updated';

  select * into updated_destination
  from update_notification_destination(
    'tenant_acme_fitness',
    'dest_acme_staff_email',
    'staff_email',
    'Staff notification inbox',
    'team@example.com',
    'ready',
    'RLS verification notification destination update.'
  );

  if updated_destination.label <> 'Staff notification inbox' then
    raise exception 'notification-destination RPC did not return updated label';
  end if;

  if updated_destination.status <> 'ready' then
    raise exception 'notification-destination RPC did not return updated status';
  end if;

  select count(*) into notification_revisions_after
  from notification_destination_revisions
  where tenant_id = 'tenant_acme_fitness'
    and notification_destination_id = 'dest_acme_staff_email';

  if notification_revisions_after <> notification_revisions_before + 1 then
    raise exception 'expected one persisted notification destination revision, before %, after %',
      notification_revisions_before, notification_revisions_after;
  end if;

  select count(*) into notification_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'notification_destination'
    and subject_id = 'dest_acme_staff_email'
    and action = 'notification_destination.updated';

  if notification_audit_events_after <> notification_audit_events_before + 1 then
    raise exception 'expected one persisted notification destination audit event, before %, after %',
      notification_audit_events_before, notification_audit_events_after;
  end if;

  select count(*) into manual_source_documents_before
  from source_documents
  where tenant_id = 'tenant_acme_fitness';

  select count(*) into manual_source_facts_before
  from source_facts
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes';

  select count(*) into manual_source_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'source_document'
    and subject_id = 'source_acme_owner_notes'
    and action = 'source_document.manual_intake_upserted';

  select * into manual_source_document
  from upsert_manual_source_document(
    'tenant_acme_fitness',
    'loc_acme_main',
    'source_acme_owner_notes',
    'Owner setup notes',
    jsonb_build_array(
      jsonb_build_object(
        'topic', 'hours',
        'value', 'Staffed hours are staged from owner manual notes and need review.',
        'confidence', 0.9
      ),
      jsonb_build_object(
        'topic', 'tours',
        'value', 'Tour requests should remain staff-routed until owner approval.',
        'confidence', 0.88
      ),
      jsonb_build_object(
        'topic', 'pricing',
        'value', 'Pricing facts are conflict-tagged until an owner resolves the final public copy.',
        'confidence', 0.71,
        'conflictGroup', 'pricing-public-copy'
      )
    )
  );

  if manual_source_document.source_type <> 'manual'
    or manual_source_document.status <> 'needs_review'
    or manual_source_document.facts_found <> 3
    or manual_source_document.conflicts_found <> 1 then
    raise exception 'manual source intake RPC did not return staged manual source';
  end if;

  select count(*) into manual_source_documents_after
  from source_documents
  where tenant_id = 'tenant_acme_fitness';

  if manual_source_documents_after <> manual_source_documents_before then
    raise exception 'manual source update changed source document count, before %, after %',
      manual_source_documents_before, manual_source_documents_after;
  end if;

  select count(*) into manual_source_facts_after
  from source_facts
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes'
    and review_status = 'proposed';

  if manual_source_facts_after <> manual_source_facts_before + 3 then
    raise exception 'expected three persisted manual source facts, before %, after %',
      manual_source_facts_before, manual_source_facts_after;
  end if;

  select count(*) into manual_source_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'source_document'
    and subject_id = 'source_acme_owner_notes'
    and action = 'source_document.manual_intake_upserted';

  if manual_source_audit_events_after <> manual_source_audit_events_before + 1 then
    raise exception 'expected one persisted manual source audit event, before %, after %',
      manual_source_audit_events_before, manual_source_audit_events_after;
  end if;

  select count(*) into answer_proposal_entries_before
  from answer_bank_entries
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes'
    and approval_status = 'draft'
    and runtime_behavior = 'needs_owner_review';

  select count(*) into answer_proposal_conflict_entries_before
  from answer_bank_entries
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes'
    and approval_status = 'conflict'
    and runtime_behavior = 'blocked_until_resolved';

  select count(*) into answer_proposal_revisions_before
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and revision_intent = 'import_proposal'
    and source_document_id = 'source_acme_owner_notes';

  select count(*) into answer_proposal_conflict_revisions_before
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and revision_intent = 'import_proposal'
    and source_document_id = 'source_acme_owner_notes'
    and next_status = 'conflict';

  select count(*) into answer_proposal_facts_before
  from source_facts
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes'
    and proposed_answer_entry_id is not null;

  select count(*) into answer_proposal_conflict_facts_before
  from source_facts
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes'
    and review_status = 'conflict'
    and proposed_answer_entry_id is not null;

  select count(*) into answer_proposal_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'source_document'
    and subject_id = 'source_acme_owner_notes'
    and action = 'source_document.answer_proposals_staged';

  select count(*) into answer_proposal_conflict_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'source_document'
    and subject_id = 'source_acme_owner_notes'
    and action = 'source_document.answer_proposals_staged'
    and (metadata->>'conflict_count')::integer = 1;

  select * into answer_proposal_result
  from propose_answers_from_manual_source(
    'tenant_acme_fitness',
    'source_acme_owner_notes',
    'RLS verification answer proposal staging.'
  );

  if answer_proposal_result.proposed_count <> 3 or answer_proposal_result.conflict_count <> 1 then
    raise exception 'answer proposal RPC returned unexpected counts';
  end if;

  select count(*) into answer_proposal_entries_after
  from answer_bank_entries
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes'
    and approval_status = 'draft'
    and runtime_behavior = 'needs_owner_review';

  if answer_proposal_entries_after <> answer_proposal_entries_before + 2 then
    raise exception 'expected two staged draft answer proposals, before %, after %',
      answer_proposal_entries_before, answer_proposal_entries_after;
  end if;

  select count(*) into answer_proposal_conflict_entries_after
  from answer_bank_entries
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes'
    and approval_status = 'conflict'
    and runtime_behavior = 'blocked_until_resolved';

  if answer_proposal_conflict_entries_after <> answer_proposal_conflict_entries_before + 1 then
    raise exception 'expected one staged conflict answer proposal, before %, after %',
      answer_proposal_conflict_entries_before, answer_proposal_conflict_entries_after;
  end if;

  select count(*) into answer_proposal_revisions_after
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and revision_intent = 'import_proposal'
    and source_document_id = 'source_acme_owner_notes';

  if answer_proposal_revisions_after <> answer_proposal_revisions_before + 3 then
    raise exception 'expected three answer proposal revisions, before %, after %',
      answer_proposal_revisions_before, answer_proposal_revisions_after;
  end if;

  select count(*) into answer_proposal_conflict_revisions_after
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and revision_intent = 'import_proposal'
    and source_document_id = 'source_acme_owner_notes'
    and next_status = 'conflict';

  if answer_proposal_conflict_revisions_after <> answer_proposal_conflict_revisions_before + 1 then
    raise exception 'expected one conflict answer proposal revision, before %, after %',
      answer_proposal_conflict_revisions_before, answer_proposal_conflict_revisions_after;
  end if;

  select count(*) into answer_proposal_facts_after
  from source_facts
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes'
    and proposed_answer_entry_id is not null
    and review_status = 'needs_review';

  if answer_proposal_facts_after <> answer_proposal_facts_before + 2 then
    raise exception 'expected two linked source facts, before %, after %',
      answer_proposal_facts_before, answer_proposal_facts_after;
  end if;

  select count(*) into answer_proposal_conflict_facts_after
  from source_facts
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes'
    and proposed_answer_entry_id is not null
    and review_status = 'conflict';

  if answer_proposal_conflict_facts_after <> answer_proposal_conflict_facts_before + 1 then
    raise exception 'expected one linked conflict source fact, before %, after %',
      answer_proposal_conflict_facts_before, answer_proposal_conflict_facts_after;
  end if;

  select count(*) into answer_proposal_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'source_document'
    and subject_id = 'source_acme_owner_notes'
    and action = 'source_document.answer_proposals_staged';

  if answer_proposal_audit_events_after <> answer_proposal_audit_events_before + 1 then
    raise exception 'expected one answer proposal audit event, before %, after %',
      answer_proposal_audit_events_before, answer_proposal_audit_events_after;
  end if;

  select count(*) into answer_proposal_conflict_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'source_document'
    and subject_id = 'source_acme_owner_notes'
    and action = 'source_document.answer_proposals_staged'
    and (metadata->>'conflict_count')::integer = 1;

  if answer_proposal_conflict_audit_events_after <> answer_proposal_conflict_audit_events_before + 1 then
    raise exception 'expected answer proposal audit event to record one conflict, before %, after %',
      answer_proposal_conflict_audit_events_before, answer_proposal_conflict_audit_events_after;
  end if;

  if not exists (
    select 1
    from source_documents
    where tenant_id = 'tenant_acme_fitness'
      and id = 'source_acme_owner_notes'
      and status = 'conflict'
      and conflicts_found = 1
  ) then
    raise exception 'answer proposal RPC did not roll source document up to conflict status';
  end if;

  select id into review_conflict_answer_id
  from answer_bank_entries
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes'
    and topic = 'pricing'
    and approval_status = 'conflict'
  order by updated_at desc, id desc
  limit 1;

  if review_conflict_answer_id is null then
    raise exception 'answer proposal RPC did not create conflict answer for review';
  end if;

  select count(*) into conflict_edit_revisions_before
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and answer_bank_entry_id = review_conflict_answer_id
    and revision_intent = 'conflict_resolution';

  select count(*) into conflict_edit_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'answer_bank_entry'
    and subject_id = review_conflict_answer_id
    and action = 'answer_bank_entry.conflict_resolved';

  select * into edited
  from edit_answer_bank_draft(
    'tenant_acme_fitness',
    review_conflict_answer_id,
    'pricing',
    'What should staff say about pricing?',
    'Pricing should stay in owner-reviewed draft language before approval.',
    'RLS verification conflict edit.'
  );

  if edited.approval_status <> 'draft' then
    raise exception 'conflict edit RPC did not move answer back to draft';
  end if;

  if edited.runtime_behavior <> 'needs_owner_review' then
    raise exception 'conflict edit RPC did not move runtime behavior to needs_owner_review';
  end if;

  select count(*) into conflict_edit_revisions_after
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and answer_bank_entry_id = review_conflict_answer_id
    and revision_intent = 'conflict_resolution';

  if conflict_edit_revisions_after <> conflict_edit_revisions_before + 1 then
    raise exception 'expected one persisted conflict edit revision, before %, after %',
      conflict_edit_revisions_before, conflict_edit_revisions_after;
  end if;

  select count(*) into conflict_edit_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'answer_bank_entry'
    and subject_id = review_conflict_answer_id
    and action = 'answer_bank_entry.conflict_resolved';

  if conflict_edit_audit_events_after <> conflict_edit_audit_events_before + 1 then
    raise exception 'expected one persisted conflict edit audit event, before %, after %',
      conflict_edit_audit_events_before, conflict_edit_audit_events_after;
  end if;

  perform upsert_manual_source_document(
    'tenant_acme_fitness',
    'loc_acme_main',
    'source_acme_owner_notes',
    'Owner setup notes',
    jsonb_build_array(
      jsonb_build_object(
        'topic', 'hours',
        'value', 'Refreshed staffed hours from a second manual intake.',
        'confidence', 0.93
      ),
      jsonb_build_object(
        'topic', 'tours',
        'value', 'Refreshed tour guidance from a second manual intake.',
        'confidence', 0.9
      ),
      jsonb_build_object(
        'topic', 'pricing',
        'value', 'Refreshed conflict-tagged pricing copy remains blocked.',
        'confidence', 0.72,
        'conflictGroup', 'pricing-public-copy'
      )
    )
  );

  select count(*) into answer_proposal_refresh_entries_before
  from answer_bank_entries
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes';

  select count(*) into answer_proposal_refresh_revisions_before
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and revision_intent in ('import_proposal', 'conflict_resolution')
    and source_document_id = 'source_acme_owner_notes';

  select count(*) into answer_proposal_refresh_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'source_document'
    and subject_id = 'source_acme_owner_notes'
    and action = 'source_document.answer_proposals_staged';

  select * into answer_proposal_refresh_result
  from propose_answers_from_manual_source(
    'tenant_acme_fitness',
    'source_acme_owner_notes',
    'RLS verification answer proposal refresh.'
  );

  if answer_proposal_refresh_result.proposed_count <> 3
    or answer_proposal_refresh_result.conflict_count <> 1 then
    raise exception 'answer proposal refresh RPC returned unexpected counts';
  end if;

  select count(*) into answer_proposal_refresh_entries_after
  from answer_bank_entries
  where tenant_id = 'tenant_acme_fitness'
    and source_document_id = 'source_acme_owner_notes';

  if answer_proposal_refresh_entries_after <> answer_proposal_refresh_entries_before then
    raise exception 'answer proposal refresh created duplicate answer rows, before %, after %',
      answer_proposal_refresh_entries_before, answer_proposal_refresh_entries_after;
  end if;

  select count(*) into answer_proposal_refresh_revisions_after
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and revision_intent in ('import_proposal', 'conflict_resolution')
    and source_document_id = 'source_acme_owner_notes';

  if answer_proposal_refresh_revisions_after <> answer_proposal_refresh_revisions_before + 3 then
    raise exception 'expected three answer proposal refresh revisions, before %, after %',
      answer_proposal_refresh_revisions_before, answer_proposal_refresh_revisions_after;
  end if;

  select count(*) into answer_proposal_refresh_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'source_document'
    and subject_id = 'source_acme_owner_notes'
    and action = 'source_document.answer_proposals_staged';

  if answer_proposal_refresh_audit_events_after <> answer_proposal_refresh_audit_events_before + 1 then
    raise exception 'expected one answer proposal refresh audit event, before %, after %',
      answer_proposal_refresh_audit_events_before, answer_proposal_refresh_audit_events_after;
  end if;

  if not exists (
    select 1
    from answer_bank_entries
    where tenant_id = 'tenant_acme_fitness'
      and source_document_id = 'source_acme_owner_notes'
      and topic = 'hours'
      and answer = 'Refreshed staffed hours from a second manual intake.'
      and approval_status = 'draft'
  ) then
    raise exception 'answer proposal refresh did not update existing hours proposal';
  end if;

  select count(*) into answer_tasks_before
  from tasks
  where tenant_id = 'tenant_acme_fitness'
    and channel = 'manual';

  select count(*) into answer_task_events_before
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and event_type = 'created';

  select count(*) into answer_task_usage_events_before
  from usage_events
  where tenant_id = 'tenant_acme_fitness'
    and source_type = 'task'
    and meter = 'task_created';

  select count(*) into answer_task_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and action = 'task.created_from_answer';

  select * into answer_task_created
  from create_task_from_answer_bank_entry(
    'tenant_acme_fitness',
    review_conflict_answer_id
  );

  if answer_task_created.channel <> 'manual' or answer_task_created.status <> 'new' then
    raise exception 'answer task creation RPC did not return a manual new task';
  end if;

  if answer_task_created.location_id <> 'loc_acme_main' then
    raise exception 'answer task creation RPC did not derive the answer location';
  end if;

  if answer_task_created.summary not like '%What should staff say about pricing?%' then
    raise exception 'answer task creation RPC did not derive the answer summary';
  end if;

  select count(*) into answer_tasks_after
  from tasks
  where tenant_id = 'tenant_acme_fitness'
    and channel = 'manual';

  if answer_tasks_after <> answer_tasks_before + 1 then
    raise exception 'expected one persisted answer-derived task, before %, after %',
      answer_tasks_before, answer_tasks_after;
  end if;

  select count(*) into answer_task_events_after
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and event_type = 'created';

  if answer_task_events_after <> answer_task_events_before + 1 then
    raise exception 'expected one persisted answer-derived task event, before %, after %',
      answer_task_events_before, answer_task_events_after;
  end if;

  if not exists (
    select 1
    from task_events
    where tenant_id = 'tenant_acme_fitness'
      and task_id = answer_task_created.id
      and event_type = 'created'
      and note like '%' || review_conflict_answer_id || '%'
  ) then
    raise exception 'answer-derived task event did not record answer provenance';
  end if;

  select count(*) into answer_task_usage_events_after
  from usage_events
  where tenant_id = 'tenant_acme_fitness'
    and source_type = 'task'
    and meter = 'task_created';

  if answer_task_usage_events_after <> answer_task_usage_events_before + 1 then
    raise exception 'expected one persisted answer-derived usage event, before %, after %',
      answer_task_usage_events_before, answer_task_usage_events_after;
  end if;

  if not exists (
    select 1
    from usage_events
    where tenant_id = 'tenant_acme_fitness'
      and source_type = 'task'
      and meter = 'task_created'
      and source_id = answer_task_created.id
  ) then
    raise exception 'answer-derived usage event did not reference the created task';
  end if;

  select count(*) into answer_task_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and action = 'task.created_from_answer';

  if answer_task_audit_events_after <> answer_task_audit_events_before + 1 then
    raise exception 'expected one persisted answer-derived audit event, before %, after %',
      answer_task_audit_events_before, answer_task_audit_events_after;
  end if;

  if not exists (
    select 1
    from audit_events
    where tenant_id = 'tenant_acme_fitness'
      and subject_type = 'task'
      and subject_id = answer_task_created.id
      and action = 'task.created_from_answer'
      and metadata->>'answer_bank_entry_id' = review_conflict_answer_id
  ) then
    raise exception 'answer-derived audit event did not record answer provenance';
  end if;

  select count(*) into answer_tasks_before from tasks;
  select count(*) into answer_task_events_before from task_events;
  select count(*) into answer_task_usage_events_before from usage_events;
  select count(*) into answer_task_audit_events_before from audit_events;

  select * into answer_task_duplicate
  from create_task_from_answer_bank_entry(
    'tenant_acme_fitness',
    review_conflict_answer_id
  );

  if answer_task_duplicate.id <> answer_task_created.id then
    raise exception 'answer task creation RPC did not return existing open task';
  end if;

  select count(*) into answer_tasks_after from tasks;
  select count(*) into answer_task_events_after from task_events;
  select count(*) into answer_task_usage_events_after from usage_events;
  select count(*) into answer_task_audit_events_after from audit_events;

  if answer_tasks_after <> answer_tasks_before then
    raise exception 'duplicate answer task request changed task count';
  end if;
  if answer_task_events_after <> answer_task_events_before then
    raise exception 'duplicate answer task request changed task event count';
  end if;
  if answer_task_usage_events_after <> answer_task_usage_events_before then
    raise exception 'duplicate answer task request changed usage event count';
  end if;
  if answer_task_audit_events_after <> answer_task_audit_events_before then
    raise exception 'duplicate answer task request changed audit event count';
  end if;

  perform update_task_status(
    'tenant_acme_fitness',
    answer_task_created.location_id,
    answer_task_created.id,
    'done'
  );

  select count(*) into answer_tasks_before
  from tasks
  where tenant_id = 'tenant_acme_fitness'
    and channel = 'manual';

  select count(*) into answer_task_events_before
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and event_type = 'created';

  select count(*) into answer_task_usage_events_before
  from usage_events
  where tenant_id = 'tenant_acme_fitness'
    and source_type = 'task'
    and meter = 'task_created';

  select count(*) into answer_task_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and action = 'task.created_from_answer';

  select * into answer_task_after_terminal
  from create_task_from_answer_bank_entry(
    'tenant_acme_fitness',
    review_conflict_answer_id
  );

  if answer_task_after_terminal.id = answer_task_created.id then
    raise exception 'answer task creation RPC reused terminal task';
  end if;

  select count(*) into answer_tasks_after
  from tasks
  where tenant_id = 'tenant_acme_fitness'
    and channel = 'manual';

  if answer_tasks_after <> answer_tasks_before + 1 then
    raise exception 'expected terminal answer task to allow one new task, before %, after %',
      answer_tasks_before, answer_tasks_after;
  end if;

  select count(*) into answer_task_events_after
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and event_type = 'created';

  if answer_task_events_after <> answer_task_events_before + 1 then
    raise exception 'expected terminal answer task to allow one new created event, before %, after %',
      answer_task_events_before, answer_task_events_after;
  end if;

  select count(*) into answer_task_usage_events_after
  from usage_events
  where tenant_id = 'tenant_acme_fitness'
    and source_type = 'task'
    and meter = 'task_created';

  if answer_task_usage_events_after <> answer_task_usage_events_before + 1 then
    raise exception 'expected terminal answer task to allow one new usage event, before %, after %',
      answer_task_usage_events_before, answer_task_usage_events_after;
  end if;

  select count(*) into answer_task_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and action = 'task.created_from_answer';

  if answer_task_audit_events_after <> answer_task_audit_events_before + 1 then
    raise exception 'expected terminal answer task to allow one new audit event, before %, after %',
      answer_task_audit_events_before, answer_task_audit_events_after;
  end if;

  select count(*) into retirement_revisions_before
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and answer_bank_entry_id = review_conflict_answer_id
    and revision_intent = 'retirement';

  select count(*) into retirement_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'answer_bank_entry'
    and subject_id = review_conflict_answer_id
    and action = 'answer_bank_entry.retired';

  select * into retired
  from retire_answer_bank_entry(
    'tenant_acme_fitness',
    review_conflict_answer_id,
    'RLS verification retirement.'
  );

  if retired.approval_status <> 'retired' then
    raise exception 'retirement RPC did not retire the answer';
  end if;

  if retired.owner_action <> 'retire' then
    raise exception 'retirement RPC did not record owner retire action';
  end if;

  if retired.retired_at is null then
    raise exception 'retirement RPC did not set retired_at';
  end if;

  select count(*) into retirement_revisions_after
  from answer_bank_revisions
  where tenant_id = 'tenant_acme_fitness'
    and answer_bank_entry_id = review_conflict_answer_id
    and revision_intent = 'retirement';

  if retirement_revisions_after <> retirement_revisions_before + 1 then
    raise exception 'expected one persisted retirement revision, before %, after %',
      retirement_revisions_before, retirement_revisions_after;
  end if;

  select count(*) into retirement_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'answer_bank_entry'
    and subject_id = review_conflict_answer_id
    and action = 'answer_bank_entry.retired';

  if retirement_audit_events_after <> retirement_audit_events_before + 1 then
    raise exception 'expected one persisted retirement audit event, before %, after %',
      retirement_audit_events_before, retirement_audit_events_after;
  end if;

  select count(*) into manual_tasks_before
  from tasks
  where tenant_id = 'tenant_acme_fitness'
    and channel = 'manual';

  select count(*) into manual_task_events_before
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and event_type = 'created';

  select count(*) into manual_task_usage_events_before
  from usage_events
  where tenant_id = 'tenant_acme_fitness'
    and source_type = 'task'
    and meter = 'task_created';

  select count(*) into manual_task_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and action = 'task.created';

  select * into manual_created_task
  from create_manual_task(
    'tenant_acme_fitness',
    'loc_acme_main',
    'Jordan Lee',
    'jordan@example.com',
    'Tour follow-up',
    'Jordan asked the desk for a weekday tour and pricing overview.',
    'Call Jordan back and offer two tour windows this week.',
    0.9
  );

  if manual_created_task.channel <> 'manual' or manual_created_task.status <> 'new' then
    raise exception 'manual task creation RPC did not return a manual new task';
  end if;

  select count(*) into manual_tasks_after
  from tasks
  where tenant_id = 'tenant_acme_fitness'
    and channel = 'manual';

  if manual_tasks_after <> manual_tasks_before + 1 then
    raise exception 'expected one persisted manual task, before %, after %',
      manual_tasks_before, manual_tasks_after;
  end if;

  select count(*) into manual_task_events_after
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and event_type = 'created';

  if manual_task_events_after <> manual_task_events_before + 1 then
    raise exception 'expected one persisted manual task event, before %, after %',
      manual_task_events_before, manual_task_events_after;
  end if;

  select count(*) into manual_task_usage_events_after
  from usage_events
  where tenant_id = 'tenant_acme_fitness'
    and source_type = 'task'
    and meter = 'task_created';

  if manual_task_usage_events_after <> manual_task_usage_events_before + 1 then
    raise exception 'expected one persisted manual task usage event, before %, after %',
      manual_task_usage_events_before, manual_task_usage_events_after;
  end if;

  select count(*) into manual_task_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and action = 'task.created';

  if manual_task_audit_events_after <> manual_task_audit_events_before + 1 then
    raise exception 'expected one persisted manual task audit event, before %, after %',
      manual_task_audit_events_before, manual_task_audit_events_after;
  end if;

  select count(*) into task_events_before
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and task_id = 'task_new_tour'
    and event_type = 'status_changed';

  select count(*) into task_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and subject_id = 'task_new_tour'
    and action = 'task.status_changed';

  select * into updated_task
  from update_task_status(
    'tenant_acme_fitness',
    'loc_acme_main',
    'task_new_tour',
    'in_progress'
  );

  if updated_task.status <> 'in_progress' then
    raise exception 'task status RPC did not return updated status';
  end if;

  select count(*) into task_events_after
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and task_id = 'task_new_tour'
    and event_type = 'status_changed';

  if task_events_after <> task_events_before + 1 then
    raise exception 'expected one persisted task event, before %, after %',
      task_events_before, task_events_after;
  end if;

  select count(*) into task_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and subject_id = 'task_new_tour'
    and action = 'task.status_changed';

  if task_audit_events_after <> task_audit_events_before + 1 then
    raise exception 'expected one persisted task audit event, before %, after %',
      task_audit_events_before, task_audit_events_after;
  end if;

  select count(*) into assignment_task_events_before
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and task_id = 'task_new_tour'
    and event_type = 'assigned';

  select count(*) into assignment_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and subject_id = 'task_new_tour'
    and action = 'task.assigned';

  select * into assigned_task
  from assign_task(
    'tenant_acme_fitness',
    'loc_acme_main',
    'task_new_tour',
    'user_owner_acme',
    'Owner picked up the tour follow-up.'
  );

  if assigned_task.assignee_user_id <> 'user_owner_acme' then
    raise exception 'task assignment RPC did not return assigned task';
  end if;

  select count(*) into assignment_task_events_after
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and task_id = 'task_new_tour'
    and event_type = 'assigned';

  if assignment_task_events_after <> assignment_task_events_before + 1 then
    raise exception 'assignment_task_events_after <> assignment_task_events_before + 1';
  end if;

  select count(*) into assignment_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and subject_id = 'task_new_tour'
    and action = 'task.assigned';

  if assignment_audit_events_after <> assignment_audit_events_before + 1 then
    raise exception 'expected one persisted task assignment audit event, before %, after %',
      assignment_audit_events_before, assignment_audit_events_after;
  end if;

  select count(*) into note_task_events_before
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and task_id = 'task_new_tour'
    and event_type = 'note_added';

  select count(*) into note_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and subject_id = 'task_new_tour'
    and action = 'task.note_added';

  select * into task_note_event
  from add_task_note(
    'tenant_acme_fitness',
    'loc_acme_main',
    'task_new_tour',
    'Left voicemail and will retry after 4 PM.'
  );

  if task_note_event.event_type <> 'note_added' or task_note_event.note <> 'Left voicemail and will retry after 4 PM.' then
    raise exception 'task note RPC did not return note event';
  end if;

  select count(*) into note_task_events_after
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and task_id = 'task_new_tour'
    and event_type = 'note_added';

  if note_task_events_after <> note_task_events_before + 1 then
    raise exception 'note_task_events_after <> note_task_events_before + 1';
  end if;

  select count(*) into note_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and subject_id = 'task_new_tour'
    and action = 'task.note_added';

  if note_audit_events_after <> note_audit_events_before + 1 then
    raise exception 'expected one persisted task note audit event, before %, after %',
      note_audit_events_before, note_audit_events_after;
  end if;
end;
$$;

reset role;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000404',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'bootstrap-owner@example.com',
  crypt('outpost-local-password', gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
) on conflict (id) do nothing;

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  '00000000-0000-0000-0000-000000000404',
  '00000000-0000-0000-0000-000000000404',
  '{"sub":"00000000-0000-0000-0000-000000000404","email":"bootstrap-owner@example.com","email_verified":true}'::jsonb,
  'email',
  now(),
  now(),
  now()
) on conflict (provider_id, provider) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000404', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000404","email":"bootstrap-owner@example.com","role":"authenticated"}',
  true
);

do $$
declare
  boot_audit_events integer;
  boot_handoff_rules integer;
  boot_locations integer;
  boot_memberships integer;
  boot_notification_destinations integer;
  boot_provider_connections integer;
  boot_source_documents integer;
  boot_tenant_id text;
  boot_tenants integer;
begin
  select tenant_id
    into boot_tenant_id
    from bootstrap_owner_tenant(
      'bootstrap-owner@example.com',
      'Bootstrap Owner',
      'Bootstrap Strength',
      'Bootstrap Main',
      '100 Bootstrap Way',
      'America/Chicago',
      '(555) 010-4040'
    );

  select count(*) into boot_tenants
  from tenants
  where id = boot_tenant_id
    and name = 'Bootstrap Strength';

  if boot_tenants <> 1 then
    raise exception 'bootstrap did not create one tenant';
  end if;

  select count(*) into boot_memberships
  from tenant_memberships
  where tenant_id = boot_tenant_id
    and role = 'owner'
    and invite_status = 'active';

  if boot_memberships <> 1 then
    raise exception 'bootstrap did not create one owner membership';
  end if;

  select count(*) into boot_locations
  from locations
  where tenant_id = boot_tenant_id
    and name = 'Bootstrap Main';

  if boot_locations <> 1 then
    raise exception 'bootstrap did not create one location';
  end if;

  select count(*) into boot_source_documents
  from source_documents
  where tenant_id = boot_tenant_id
    and source_type = 'manual'
    and status = 'missing';

  if boot_source_documents <> 1 then
    raise exception 'bootstrap did not create source placeholder';
  end if;

  select count(*) into boot_handoff_rules
  from handoff_rules
  where tenant_id = boot_tenant_id;

  if boot_handoff_rules <> 3 then
    raise exception 'bootstrap did not create starter handoff rules';
  end if;

  select count(*) into boot_notification_destinations
  from notification_destinations
  where tenant_id = boot_tenant_id
    and destination_type = 'task_queue'
    and status = 'ready';

  if boot_notification_destinations <> 1 then
    raise exception 'bootstrap did not create task queue destination';
  end if;

  select count(*) into boot_provider_connections
  from provider_connections
  where tenant_id = boot_tenant_id
    and status = 'not_configured';

  if boot_provider_connections <> 2 then
    raise exception 'bootstrap did not create provider stubs';
  end if;

  select count(*) into boot_audit_events
  from audit_events
  where tenant_id = boot_tenant_id
    and subject_type = 'tenant'
    and subject_id = boot_tenant_id
    and action = 'tenant.bootstrapped';

  if boot_audit_events <> 1 then
    raise exception 'bootstrap audit event missing';
  end if;
end;
$$;

do $$
begin
  insert into tenants (
    id,
    name,
    slug,
    status,
    plan_id,
    billing_mode,
    support_tier
  ) values (
    'tenant_direct_insert_denial',
    'Direct Insert Denial',
    'direct-insert-denial',
    'setup',
    'plan_single_location',
    'pilot',
    'standard'
  );

  raise exception 'direct tenant insert unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner-acme@example.com","role":"authenticated"}',
  true
);

do $$
declare
  leaked_bootstrap_tenants integer;
begin
  select count(*) into leaked_bootstrap_tenants
  from tenants
  where name = 'Bootstrap Strength';

  if leaked_bootstrap_tenants <> 0 then
    raise exception 'cross-tenant bootstrap tenant leaked through RLS';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000303","email":"staff-acme@example.com","role":"authenticated"}',
  true
);

do $$
begin
  perform bootstrap_owner_tenant(
    'staff-acme@example.com',
    'Staff Should Not Bootstrap',
    'Staff Bootstrap Denial',
    'Staff Main',
    '100 Staff Way',
    'America/Chicago',
    null
  );

  raise exception 'staff bootstrap unexpectedly succeeded';
exception
  when unique_violation then
    null;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000404', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000404","role":"authenticated"}',
  true
);

do $$
begin
  perform bootstrap_owner_tenant(
    'different-bootstrap-owner@example.com',
    'Mismatched Claim Owner',
    'Mismatched Claim Gym',
    'Mismatched Claim Main',
    '100 Mismatched Claim Way',
    'America/Chicago',
    null
  );

  raise exception 'mismatched email claim bootstrap unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform bootstrap_owner_tenant(
    'missing-claim@example.com',
    'Missing Claim Owner',
    'Missing Claim Gym',
    'Missing Claim Main',
    '100 Missing Claim Way',
    'America/Chicago',
    null
  );

  raise exception 'missing email claim bootstrap unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner-acme@example.com","role":"authenticated"}',
  true
);

do $$
begin
  perform update_task_status(
    'tenant_acme_fitness',
    'loc_acme_main',
    'task_new_tour',
    'new'
  );

  raise exception 'illegal task status transition unexpectedly succeeded';
exception
  when invalid_parameter_value then
    null;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);

do $$
declare
  staff_audit_events_after integer;
  staff_audit_events_before integer;
  staff_task_events_after integer;
  staff_task_events_before integer;
  staff_updated_task tasks;
begin
  select count(*) into staff_task_events_before
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and task_id = 'task_needs_human_freeze'
    and event_type = 'status_changed';

  select count(*) into staff_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and subject_id = 'task_needs_human_freeze'
    and action = 'task.status_changed';

  select * into staff_updated_task
  from update_task_status(
    'tenant_acme_fitness',
    'loc_acme_main',
    'task_needs_human_freeze',
    'in_progress'
  );

  if staff_updated_task.status <> 'in_progress' then
    raise exception 'staff task status RPC did not return updated status';
  end if;

  select count(*) into staff_task_events_after
  from task_events
  where tenant_id = 'tenant_acme_fitness'
    and task_id = 'task_needs_human_freeze'
    and event_type = 'status_changed';

  if staff_task_events_after <> staff_task_events_before + 1 then
    raise exception 'expected one persisted staff task event, before %, after %',
      staff_task_events_before, staff_task_events_after;
  end if;

  select count(*) into staff_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and subject_type = 'task'
    and subject_id = 'task_needs_human_freeze'
    and action = 'task.status_changed';

  if staff_audit_events_after <> staff_audit_events_before + 1 then
    raise exception 'expected one persisted staff task audit event, before %, after %',
      staff_audit_events_before, staff_audit_events_after;
  end if;
end;
$$;

do $$
begin
  perform update_location_profile(
    'tenant_acme_fitness',
    'loc_acme_main',
    'staff should not update location',
    'staff should not update address',
    '(555) 010-3333',
    '(555) 010-4444',
    'America/Chicago',
    'active',
    'Staff owner-only RPC denial verification.'
  );

  raise exception 'staff owner-only location RPC unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform propose_answers_from_manual_source(
    'tenant_acme_fitness',
    'source_acme_owner_notes',
    'Staff owner-only proposal denial verification.'
  );

  raise exception 'staff owner-only answer proposal RPC unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform retire_answer_bank_entry(
    'tenant_acme_fitness',
    'answer_hours',
    'Staff owner-only retirement denial verification.'
  );

  raise exception 'staff owner-only answer retirement RPC unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  insert into answer_bank_entries (
    id,
    tenant_id,
    location_id,
    topic,
    question,
    answer,
    approval_status,
    owner_action,
    runtime_behavior
  ) values (
    'answer_direct_write_denial',
    'tenant_acme_fitness',
    'loc_acme_main',
    'direct write',
    'Direct answer write denial?',
    'Direct answer write denial verification.',
    'draft',
    'edit',
    'needs_owner_review'
  );

  raise exception 'direct answer bank entry table insert unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  insert into answer_bank_revisions (
    id,
    tenant_id,
    location_id,
    answer_bank_entry_id,
    actor_user_id,
    revision_intent,
    next_status,
    note
  ) values (
    'answer_revision_direct_write_denial',
    'tenant_acme_fitness',
    'loc_acme_main',
    'answer_hours',
    'user_owner_acme',
    'edit',
    'draft',
    'Direct answer revision write denial verification.'
  );

  raise exception 'direct answer bank revision table insert unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  insert into source_documents (
    id,
    tenant_id,
    location_id,
    source_type,
    label,
    status
  ) values (
    'source_direct_write_denial',
    'tenant_acme_fitness',
    'loc_acme_main',
    'manual',
    'Direct source write denial',
    'needs_review'
  );

  raise exception 'direct source document table insert unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  insert into source_facts (
    id,
    tenant_id,
    location_id,
    source_document_id,
    topic,
    value,
    confidence
  ) values (
    'fact_direct_write_denial',
    'tenant_acme_fitness',
    'loc_acme_main',
    'source_acme_owner_notes',
    'direct write',
    'Direct source fact insert denial verification.',
    0.9
  );

  raise exception 'direct source fact table insert unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  update source_facts
     set review_status = 'approved'
   where tenant_id = 'tenant_acme_fitness'
     and source_document_id = 'source_acme_owner_notes';

  raise exception 'direct source fact table update unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
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
    suggested_next_step
  ) values (
    'task_direct_write_denial',
    'tenant_acme_fitness',
    'loc_acme_main',
    'manual',
    'Direct Writer',
    'direct@example.com',
    'direct write',
    'Direct task insert denial verification.',
    0.9,
    'This insert should be denied.'
  );

  raise exception 'direct task table insert unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  update tasks
     set status = 'done'
   where tenant_id = 'tenant_acme_fitness'
     and id = 'task_new_tour';

  raise exception 'direct task table update unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  insert into task_events (
    id,
    tenant_id,
    location_id,
    task_id,
    event_type,
    to_status,
    note
  ) values (
    'task_event_direct_write_denial',
    'tenant_acme_fitness',
    'loc_acme_main',
    'task_new_tour',
    'status_changed',
    'done',
    'Direct task event write denial verification.'
  );

  raise exception 'direct task event table insert unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  insert into audit_events (
    id,
    tenant_id,
    actor_user_id,
    subject_type,
    subject_id,
    action,
    metadata
  ) values (
    'audit_event_direct_write_denial',
    'tenant_acme_fitness',
    'user_staff_acme',
    'task',
    'task_new_tour',
    'task.created',
    '{"direct":"denied"}'::jsonb
  );

  raise exception 'direct audit event table insert unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  insert into usage_events (
    id,
    tenant_id,
    location_id,
    meter,
    quantity,
    source_type,
    source_id,
    period_key
  ) values (
    'usage_event_direct_write_denial',
    'tenant_acme_fitness',
    'loc_acme_main',
    'task_created',
    1,
    'task',
    'task_new_tour',
    '2026-06'
  );

  raise exception 'direct usage event table insert unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  anon_visible_task_events integer;
  anon_visible_tasks integer;
  anon_visible_usage_events integer;
begin
  if has_table_privilege('anon', 'tasks', 'select') then
    select count(*) into anon_visible_tasks from tasks;
    if anon_visible_tasks <> 0 then
      raise exception 'anon can read tasks';
    end if;
  end if;

  if has_table_privilege('anon', 'task_events', 'select') then
    select count(*) into anon_visible_task_events from task_events;
    if anon_visible_task_events <> 0 then
      raise exception 'anon can read task events';
    end if;
  end if;

  if has_table_privilege('anon', 'usage_events', 'select') then
    select count(*) into anon_visible_usage_events from usage_events;
    if anon_visible_usage_events <> 0 then
      raise exception 'anon can read usage events';
    end if;
  end if;

  if has_function_privilege(
    'anon',
    'create_manual_task(text, text, text, text, text, text, text, numeric)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon manual task creation unexpectedly succeeded';
  end if;
end;
$$;

do $$
begin
  if has_function_privilege(
    'anon',
    'update_task_status(text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon task status update unexpectedly succeeded';
  end if;
end;
$$;

do $$
begin
  if has_function_privilege(
    'anon',
    'assign_task(text, text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon task assignment unexpectedly succeeded';
  end if;
end;
$$;

do $$
begin
  if has_function_privilege(
    'anon',
    'add_task_note(text, text, text, text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon task note unexpectedly succeeded';
  end if;
end;
$$;

do $$
begin
  if has_function_privilege(
    'anon',
    'list_active_tenant_members(text)'::regprocedure,
    'execute'
  ) then
    raise exception 'anon active tenant member list unexpectedly succeeded';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);

do $$
begin
  perform edit_answer_bank_draft(
    'tenant_crossfit_north',
    'answer_north_hours',
    'hours',
    'Cross tenant question',
    'This should fail.',
    'Cross-tenant denial verification.'
  );

  raise exception 'cross-tenant RPC edit unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform approve_answer_bank_entry(
    'tenant_crossfit_north',
    'answer_north_hours',
    'Cross-tenant approval denial verification.'
  );

  raise exception 'cross-tenant RPC approval unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform retire_answer_bank_entry(
    'tenant_crossfit_north',
    'answer_north_hours',
    'Cross-tenant retirement denial verification.'
  );

  raise exception 'cross-tenant RPC retirement unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

reset role;

create temp table answer_proposal_cross_tenant_failure_counts as
select
  (select count(*) from answer_bank_entries) as answer_entries_before,
  (select count(*) from answer_bank_revisions) as answer_revisions_before,
  (select count(*) from source_facts) as source_facts_before,
  (select count(*) from audit_events) as audit_events_before;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);

do $$
begin
  perform propose_answers_from_manual_source(
    'tenant_crossfit_north',
    'source_north_owner_notes',
    'Cross-tenant answer proposal denial verification.'
  );

  raise exception 'cross-tenant answer proposal unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

reset role;

do $$
declare
  failed_answer_entries_after integer;
  failed_answer_entries_before integer;
  failed_answer_revisions_after integer;
  failed_answer_revisions_before integer;
  failed_audit_events_after integer;
  failed_audit_events_before integer;
  failed_source_facts_after integer;
  failed_source_facts_before integer;
begin
  select
    answer_entries_before,
    answer_revisions_before,
    source_facts_before,
    audit_events_before
  into
    failed_answer_entries_before,
    failed_answer_revisions_before,
    failed_source_facts_before,
    failed_audit_events_before
  from answer_proposal_cross_tenant_failure_counts;

  select count(*) into failed_answer_entries_after from answer_bank_entries;
  select count(*) into failed_answer_revisions_after from answer_bank_revisions;
  select count(*) into failed_source_facts_after from source_facts;
  select count(*) into failed_audit_events_after from audit_events;

  if failed_answer_entries_after <> failed_answer_entries_before then
    raise exception 'cross-tenant answer proposal failure changed answer count';
  end if;
  if failed_answer_revisions_after <> failed_answer_revisions_before then
    raise exception 'cross-tenant answer proposal failure changed revision count';
  end if;
  if failed_source_facts_after <> failed_source_facts_before then
    raise exception 'cross-tenant answer proposal failure changed source fact count';
  end if;
  if failed_audit_events_after <> failed_audit_events_before then
    raise exception 'cross-tenant answer proposal failure changed audit event count';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

do $$
declare
  failed_answer_entries_after integer;
  failed_answer_entries_before integer;
  failed_answer_revisions_after integer;
  failed_answer_revisions_before integer;
  failed_audit_events_after integer;
  failed_audit_events_before integer;
  failed_source_facts_after integer;
  failed_source_facts_before integer;
begin
  select count(*) into failed_answer_entries_before from answer_bank_entries;
  select count(*) into failed_answer_revisions_before from answer_bank_revisions;
  select count(*) into failed_source_facts_before from source_facts;
  select count(*) into failed_audit_events_before from audit_events;

  perform propose_answers_from_manual_source(
    'tenant_acme_fitness',
    'source_acme_owner_notes',
    'No eligible source facts rollback verification.'
  );

  raise exception 'empty answer proposal unexpectedly succeeded';
exception
  when no_data_found then
    select count(*) into failed_answer_entries_after from answer_bank_entries;
    select count(*) into failed_answer_revisions_after from answer_bank_revisions;
    select count(*) into failed_source_facts_after from source_facts;
    select count(*) into failed_audit_events_after from audit_events;

    if failed_answer_entries_after <> failed_answer_entries_before then
      raise exception 'invalid answer proposal failure changed answer count';
    end if;
    if failed_answer_revisions_after <> failed_answer_revisions_before then
      raise exception 'invalid answer proposal failure changed revision count';
    end if;
    if failed_source_facts_after <> failed_source_facts_before then
      raise exception 'invalid answer proposal failure changed source fact count';
    end if;
    if failed_audit_events_after <> failed_audit_events_before then
      raise exception 'invalid answer proposal failure changed audit event count';
    end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);

do $$
begin
  perform update_location_profile(
    'tenant_crossfit_north',
    'loc_north_main',
    'cross tenant location',
    'cross tenant address',
    '(555) 010-3333',
    '(555) 010-4444',
    'America/Chicago',
    'active',
    'Cross-tenant location denial verification.'
  );

  raise exception 'cross-tenant RPC location update unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform update_handoff_rule(
    'tenant_crossfit_north',
    'rule_north_cancellation',
    'always_human',
    'cross tenant cancellation',
    'create_task',
    'front desk queue',
    'always',
    10,
    'active',
    'Cross-tenant handoff-rule denial verification.'
  );

  raise exception 'cross-tenant RPC handoff-rule update unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
begin
  perform update_notification_destination(
    'tenant_crossfit_north',
    'dest_north_queue',
    'task_queue',
    'cross tenant destination',
    'cross tenant workboard',
    'ready',
    'Cross-tenant notification destination denial verification.'
  );

  raise exception 'cross-tenant RPC notification-destination update unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

reset role;

create temp table manual_source_cross_tenant_failure_counts as
select
  (select count(*) from source_documents) as source_documents_before,
  (select count(*) from source_facts) as source_facts_before,
  (select count(*) from audit_events) as audit_events_before;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);

do $$
begin

  perform upsert_manual_source_document(
    'tenant_crossfit_north',
    'loc_north_main',
    'source_acme_owner_notes',
    'Cross tenant manual source',
    jsonb_build_array(
      jsonb_build_object(
        'topic', 'cross tenant',
        'value', 'Cross-tenant manual source intake should fail.',
        'confidence', 0.9
      )
    )
  );

  raise exception 'cross-tenant RPC manual source intake unexpectedly succeeded';
exception
  when insufficient_privilege or no_data_found then
    null;
end;
$$;

reset role;

do $$
declare
  failed_source_audit_events_after integer;
  failed_source_audit_events_before integer;
  failed_source_documents_after integer;
  failed_source_documents_before integer;
  failed_source_facts_after integer;
  failed_source_facts_before integer;
begin
  select
    source_documents_before,
    source_facts_before,
    audit_events_before
  into
    failed_source_documents_before,
    failed_source_facts_before,
    failed_source_audit_events_before
  from manual_source_cross_tenant_failure_counts;

  select count(*) into failed_source_documents_after from source_documents;
  select count(*) into failed_source_facts_after from source_facts;
  select count(*) into failed_source_audit_events_after from audit_events;

  if failed_source_documents_after <> failed_source_documents_before then
    raise exception 'cross-tenant manual source failure changed source document count';
  end if;
  if failed_source_facts_after <> failed_source_facts_before then
    raise exception 'cross-tenant manual source failure changed source fact count';
  end if;
  if failed_source_audit_events_after <> failed_source_audit_events_before then
    raise exception 'cross-tenant manual source failure changed audit event count';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);

do $$
declare
  failed_invalid_fact_audit_events_after integer;
  failed_invalid_fact_audit_events_before integer;
  failed_invalid_fact_documents_after integer;
  failed_invalid_fact_documents_before integer;
  failed_invalid_fact_facts_after integer;
  failed_invalid_fact_facts_before integer;
begin
  select count(*) into failed_invalid_fact_documents_before from source_documents;
  select count(*) into failed_invalid_fact_facts_before from source_facts;
  select count(*) into failed_invalid_fact_audit_events_before from audit_events;

  perform upsert_manual_source_document(
    'tenant_acme_fitness',
    'loc_acme_main',
    'source_manual_invalid_fact_probe',
    'Invalid fact rollback probe',
    jsonb_build_array(
      jsonb_build_object(
        'topic', 'invalid confidence',
        'value', 'This should not persist.',
        'confidence', 1.4
      )
    )
  );

  raise exception 'invalid manual source fact unexpectedly succeeded';
exception
  when invalid_parameter_value then
    select count(*) into failed_invalid_fact_documents_after from source_documents;
    select count(*) into failed_invalid_fact_facts_after from source_facts;
    select count(*) into failed_invalid_fact_audit_events_after from audit_events;

    if failed_invalid_fact_documents_after <> failed_invalid_fact_documents_before then
      raise exception 'invalid manual source fact failure changed source document count';
    end if;
    if failed_invalid_fact_facts_after <> failed_invalid_fact_facts_before then
      raise exception 'invalid manual source fact failure changed source fact count';
    end if;
    if failed_invalid_fact_audit_events_after <> failed_invalid_fact_audit_events_before then
      raise exception 'invalid manual source fact failure changed audit event count';
    end if;
end;
$$;

do $$
declare
  failed_manual_audit_events_after integer;
  failed_manual_audit_events_before integer;
  failed_manual_task_events_after integer;
  failed_manual_task_events_before integer;
  failed_manual_tasks_after integer;
  failed_manual_tasks_before integer;
  failed_manual_usage_events_after integer;
  failed_manual_usage_events_before integer;
begin
  select count(*) into failed_manual_tasks_before from tasks;
  select count(*) into failed_manual_task_events_before from task_events;
  select count(*) into failed_manual_usage_events_before from usage_events;
  select count(*) into failed_manual_audit_events_before from audit_events;

  perform create_manual_task(
    'tenant_crossfit_north',
    'loc_north_main',
    'Cross Tenant',
    'cross@example.com',
    'cross tenant',
    'Cross-tenant manual task creation should fail.',
    'Deny this write.',
    0.9
  );

  raise exception 'cross-tenant RPC manual task creation unexpectedly succeeded';
exception
  when insufficient_privilege then
    select count(*) into failed_manual_tasks_after from tasks;
    select count(*) into failed_manual_task_events_after from task_events;
    select count(*) into failed_manual_usage_events_after from usage_events;
    select count(*) into failed_manual_audit_events_after from audit_events;

    if failed_manual_tasks_after <> failed_manual_tasks_before then
      raise exception 'cross-tenant manual task failure changed task count';
    end if;
    if failed_manual_task_events_after <> failed_manual_task_events_before then
      raise exception 'cross-tenant manual task failure changed task event count';
    end if;
    if failed_manual_usage_events_after <> failed_manual_usage_events_before then
      raise exception 'cross-tenant manual task failure changed usage event count';
    end if;
    if failed_manual_audit_events_after <> failed_manual_audit_events_before then
      raise exception 'cross-tenant manual task failure changed audit event count';
    end if;
end;
$$;

do $$
declare
  failed_answer_task_audit_events_after integer;
  failed_answer_task_audit_events_before integer;
  failed_answer_task_events_after integer;
  failed_answer_task_events_before integer;
  failed_answer_tasks_after integer;
  failed_answer_tasks_before integer;
  failed_answer_usage_events_after integer;
  failed_answer_usage_events_before integer;
begin
  select count(*) into failed_answer_tasks_before from tasks;
  select count(*) into failed_answer_task_events_before from task_events;
  select count(*) into failed_answer_usage_events_before from usage_events;
  select count(*) into failed_answer_task_audit_events_before from audit_events;

  perform create_task_from_answer_bank_entry(
    'tenant_crossfit_north',
    'answer_north_hours'
  );

  raise exception 'cross-tenant RPC answer task creation unexpectedly succeeded';
exception
  when insufficient_privilege then
    select count(*) into failed_answer_tasks_after from tasks;
    select count(*) into failed_answer_task_events_after from task_events;
    select count(*) into failed_answer_usage_events_after from usage_events;
    select count(*) into failed_answer_task_audit_events_after from audit_events;

    if failed_answer_tasks_after <> failed_answer_tasks_before then
      raise exception 'cross-tenant answer task failure changed task count';
    end if;
    if failed_answer_task_events_after <> failed_answer_task_events_before then
      raise exception 'cross-tenant answer task failure changed task event count';
    end if;
    if failed_answer_usage_events_after <> failed_answer_usage_events_before then
      raise exception 'cross-tenant answer task failure changed usage event count';
    end if;
    if failed_answer_task_audit_events_after <> failed_answer_task_audit_events_before then
      raise exception 'cross-tenant answer task failure changed audit event count';
    end if;
end;
$$;

do $$
declare
  failed_approved_answer_task_audit_events_after integer;
  failed_approved_answer_task_audit_events_before integer;
  failed_approved_answer_task_events_after integer;
  failed_approved_answer_task_events_before integer;
  failed_approved_answer_tasks_after integer;
  failed_approved_answer_tasks_before integer;
  failed_approved_answer_usage_events_after integer;
  failed_approved_answer_usage_events_before integer;
begin
  select count(*) into failed_approved_answer_tasks_before from tasks;
  select count(*) into failed_approved_answer_task_events_before from task_events;
  select count(*) into failed_approved_answer_usage_events_before from usage_events;
  select count(*) into failed_approved_answer_task_audit_events_before from audit_events;

  perform create_task_from_answer_bank_entry(
    'tenant_acme_fitness',
    'answer_hours'
  );

  raise exception 'approved answer task creation unexpectedly succeeded';
exception
  when invalid_parameter_value then
    select count(*) into failed_approved_answer_tasks_after from tasks;
    select count(*) into failed_approved_answer_task_events_after from task_events;
    select count(*) into failed_approved_answer_usage_events_after from usage_events;
    select count(*) into failed_approved_answer_task_audit_events_after from audit_events;

    if failed_approved_answer_tasks_after <> failed_approved_answer_tasks_before then
      raise exception 'approved answer task failure changed task count';
    end if;
    if failed_approved_answer_task_events_after <> failed_approved_answer_task_events_before then
      raise exception 'approved answer task failure changed task event count';
    end if;
    if failed_approved_answer_usage_events_after <> failed_approved_answer_usage_events_before then
      raise exception 'approved answer task failure changed usage event count';
    end if;
    if failed_approved_answer_task_audit_events_after <> failed_approved_answer_task_audit_events_before then
      raise exception 'approved answer task failure changed audit event count';
    end if;
end;
$$;

do $$
declare
  failed_location_audit_events_after integer;
  failed_location_audit_events_before integer;
  failed_location_task_events_after integer;
  failed_location_task_events_before integer;
  failed_location_tasks_after integer;
  failed_location_tasks_before integer;
  failed_location_usage_events_after integer;
  failed_location_usage_events_before integer;
begin
  select count(*) into failed_location_tasks_before from tasks;
  select count(*) into failed_location_task_events_before from task_events;
  select count(*) into failed_location_usage_events_before from usage_events;
  select count(*) into failed_location_audit_events_before from audit_events;

  perform create_manual_task(
    'tenant_acme_fitness',
    'loc_missing',
    'Missing Location',
    'missing@example.com',
    'missing location',
    'Invalid location manual task creation should fail.',
    'Deny this write.',
    0.9
  );

  raise exception 'invalid-location manual task creation unexpectedly succeeded';
exception
  when no_data_found then
    select count(*) into failed_location_tasks_after from tasks;
    select count(*) into failed_location_task_events_after from task_events;
    select count(*) into failed_location_usage_events_after from usage_events;
    select count(*) into failed_location_audit_events_after from audit_events;

    if failed_location_tasks_after <> failed_location_tasks_before then
      raise exception 'invalid-location manual task failure changed task count';
    end if;
    if failed_location_task_events_after <> failed_location_task_events_before then
      raise exception 'invalid-location manual task failure changed task event count';
    end if;
    if failed_location_usage_events_after <> failed_location_usage_events_before then
      raise exception 'invalid-location manual task failure changed usage event count';
    end if;
    if failed_location_audit_events_after <> failed_location_audit_events_before then
      raise exception 'invalid-location manual task failure changed audit event count';
    end if;
end;
$$;

do $$
begin
  perform update_task_status(
    'tenant_crossfit_north',
    'loc_north_main',
    'task_north_tour',
    'in_progress'
  );

  raise exception 'cross-tenant RPC task status update unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

do $$
declare
  failed_assignment_audit_events_after integer;
  failed_assignment_audit_events_before integer;
  failed_assignment_task_events_after integer;
  failed_assignment_task_events_before integer;
  failed_assignment_tasks_after integer;
  failed_assignment_tasks_before integer;
begin
  select count(*) into failed_assignment_tasks_before from tasks;
  select count(*) into failed_assignment_task_events_before from task_events;
  select count(*) into failed_assignment_audit_events_before from audit_events;

  perform assign_task(
    'tenant_crossfit_north',
    'loc_north_main',
    'task_north_tour',
    'user_owner_north',
    'Cross-tenant assignment should fail.'
  );

  raise exception 'cross-tenant RPC task assignment unexpectedly succeeded';
exception
  when insufficient_privilege then
    select count(*) into failed_assignment_tasks_after from tasks;
    select count(*) into failed_assignment_task_events_after from task_events;
    select count(*) into failed_assignment_audit_events_after from audit_events;

    if failed_assignment_tasks_after <> failed_assignment_tasks_before then
      raise exception 'cross-tenant task assignment failure changed task count';
    end if;
    if failed_assignment_task_events_after <> failed_assignment_task_events_before then
      raise exception 'cross-tenant task assignment failure changed task event count';
    end if;
    if failed_assignment_audit_events_after <> failed_assignment_audit_events_before then
      raise exception 'cross-tenant task assignment failure changed audit event count';
    end if;
end;
$$;

do $$
declare
  failed_note_audit_events_after integer;
  failed_note_audit_events_before integer;
  failed_note_task_events_after integer;
  failed_note_task_events_before integer;
  failed_note_tasks_after integer;
  failed_note_tasks_before integer;
begin
  select count(*) into failed_note_tasks_before from tasks;
  select count(*) into failed_note_task_events_before from task_events;
  select count(*) into failed_note_audit_events_before from audit_events;

  perform add_task_note(
    'tenant_crossfit_north',
    'loc_north_main',
    'task_north_tour',
    'Cross-tenant note should fail.'
  );

  raise exception 'cross-tenant RPC task note unexpectedly succeeded';
exception
  when insufficient_privilege then
    select count(*) into failed_note_tasks_after from tasks;
    select count(*) into failed_note_task_events_after from task_events;
    select count(*) into failed_note_audit_events_after from audit_events;

    if failed_note_tasks_after <> failed_note_tasks_before then
      raise exception 'cross-tenant task note failure changed task count';
    end if;
    if failed_note_task_events_after <> failed_note_task_events_before then
      raise exception 'cross-tenant task note failure changed task event count';
    end if;
    if failed_note_audit_events_after <> failed_note_audit_events_before then
      raise exception 'cross-tenant task note failure changed audit event count';
    end if;
end;
$$;

do $$
declare
  failed_assignee_audit_events_after integer;
  failed_assignee_audit_events_before integer;
  failed_assignee_task_events_after integer;
  failed_assignee_task_events_before integer;
  failed_assignee_tasks_after integer;
  failed_assignee_tasks_before integer;
begin
  select count(*) into failed_assignee_tasks_before from tasks;
  select count(*) into failed_assignee_task_events_before from task_events;
  select count(*) into failed_assignee_audit_events_before from audit_events;

  perform assign_task(
    'tenant_acme_fitness',
    'loc_acme_main',
    'task_new_tour',
    'user_owner_north',
    'Invalid assignee should fail.'
  );

  raise exception 'invalid assignee task assignment unexpectedly succeeded';
exception
  when insufficient_privilege then
    select count(*) into failed_assignee_tasks_after from tasks;
    select count(*) into failed_assignee_task_events_after from task_events;
    select count(*) into failed_assignee_audit_events_after from audit_events;

    if failed_assignee_tasks_after <> failed_assignee_tasks_before then
      raise exception 'invalid assignee assignment failure changed task count';
    end if;
    if failed_assignee_task_events_after <> failed_assignee_task_events_before then
      raise exception 'invalid assignee assignment failure changed task event count';
    end if;
    if failed_assignee_audit_events_after <> failed_assignee_audit_events_before then
      raise exception 'invalid assignee assignment failure changed audit event count';
    end if;
end;
$$;

do $$
declare
  failed_staff_access_audit_events_after integer;
  failed_staff_access_audit_events_before integer;
  failed_staff_access_memberships_after integer;
  failed_staff_access_memberships_before integer;
  failed_staff_access_users_after integer;
  failed_staff_access_users_before integer;
begin
  select count(*) into failed_staff_access_users_before from users;
  select count(*) into failed_staff_access_memberships_before from tenant_memberships;
  select count(*) into failed_staff_access_audit_events_before from audit_events;

  perform upsert_tenant_staff_member(
    'tenant_crossfit_north',
    'cross-tenant-staff@example.com',
    'Cross Tenant Staff'
  );

  raise exception 'cross-tenant staff access unexpectedly succeeded';
exception
  when insufficient_privilege then
    select count(*) into failed_staff_access_users_after from users;
    select count(*) into failed_staff_access_memberships_after from tenant_memberships;
    select count(*) into failed_staff_access_audit_events_after from audit_events;

    if failed_staff_access_users_after <> failed_staff_access_users_before then
      raise exception 'cross-tenant staff access failure changed user count';
    end if;
    if failed_staff_access_memberships_after <> failed_staff_access_memberships_before then
      raise exception 'cross-tenant staff access failure changed membership count';
    end if;
    if failed_staff_access_audit_events_after <> failed_staff_access_audit_events_before then
      raise exception 'cross-tenant staff access failure changed audit event count';
    end if;
end;
$$;

do $$
declare
  failed_staff_access_audit_events_after integer;
  failed_staff_access_audit_events_before integer;
  failed_staff_access_memberships_after integer;
  failed_staff_access_memberships_before integer;
begin
  select count(*) into failed_staff_access_memberships_before from tenant_memberships;
  select count(*) into failed_staff_access_audit_events_before from audit_events;

  perform disable_tenant_staff_member(
    'tenant_crossfit_north',
    'member_owner_north'
  );

  raise exception 'cross-tenant staff access disable unexpectedly succeeded';
exception
  when insufficient_privilege then
    select count(*) into failed_staff_access_memberships_after from tenant_memberships;
    select count(*) into failed_staff_access_audit_events_after from audit_events;

    if failed_staff_access_memberships_after <> failed_staff_access_memberships_before then
      raise exception 'cross-tenant staff access disable changed membership count';
    end if;
    if failed_staff_access_audit_events_after <> failed_staff_access_audit_events_before then
      raise exception 'cross-tenant staff access disable changed audit event count';
    end if;
end;
$$;

do $$
begin
  perform list_active_tenant_members('tenant_crossfit_north');

  raise exception 'cross-tenant active tenant member list unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);

do $$
begin
  perform list_tenant_staff_access_members('tenant_acme_fitness');

  raise exception 'staff access projection unexpectedly allowed staff caller';
exception
  when insufficient_privilege then
    null;
end;
$$;

reset role;

create or replace function pg_temp.fail_staff_access_membership_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'injected staff access membership failure'
    using errcode = 'P0001';
end;
$$;

create trigger fail_staff_access_membership_insert
  before insert on tenant_memberships
  for each row execute function pg_temp.fail_staff_access_membership_insert();

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

do $$
declare
  failed_staff_access_audit_events_after integer;
  failed_staff_access_audit_events_before integer;
  failed_staff_access_memberships_after integer;
  failed_staff_access_memberships_before integer;
  failed_staff_access_users_after integer;
  failed_staff_access_users_before integer;
begin
  select count(*) into failed_staff_access_users_before
  from users
  where email = 'rollback-staff-access@example.com';

  select count(*) into failed_staff_access_memberships_before
  from tenant_memberships;

  select count(*) into failed_staff_access_audit_events_before
  from audit_events
  where action = 'tenant_membership.staff_upserted';

  perform upsert_tenant_staff_member(
    'tenant_acme_fitness',
    'rollback-staff-access@example.com',
    'Rollback Staff'
  );

  raise exception 'staff access rollback trigger unexpectedly allowed write';
exception
  when raise_exception then
    select count(*) into failed_staff_access_users_after
    from users
    where email = 'rollback-staff-access@example.com';

    select count(*) into failed_staff_access_memberships_after
    from tenant_memberships;

    select count(*) into failed_staff_access_audit_events_after
    from audit_events
    where action = 'tenant_membership.staff_upserted';

    if failed_staff_access_users_after <> failed_staff_access_users_before then
      raise exception 'staff access rollback left user row behind';
    end if;
    if failed_staff_access_memberships_after <> failed_staff_access_memberships_before then
      raise exception 'staff access rollback changed membership count';
    end if;
    if failed_staff_access_audit_events_after <> failed_staff_access_audit_events_before then
      raise exception 'staff access rollback wrote audit event';
    end if;
end;
$$;

reset role;
drop trigger fail_staff_access_membership_insert on tenant_memberships;

create temporary table staff_access_existing_user_probe (
  name_before text not null
) on commit drop;

insert into staff_access_existing_user_probe (name_before)
select name
from users
where id = 'user_owner_north';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select *
from upsert_tenant_staff_member(
  'tenant_acme_fitness',
  'owner-north@example.com',
  'Renamed Peak CrossFit Owner'
);

reset role;

do $$
declare
  existing_outside_memberships integer;
  name_after text;
  name_before text;
begin
  select staff_access_existing_user_probe.name_before into strict name_before
  from staff_access_existing_user_probe;

  select users.name into strict name_after
  from users
  where id = 'user_owner_north';

  if name_after <> name_before then
    raise exception 'staff access renamed an existing outside user';
  end if;

  select count(*) into existing_outside_memberships
  from tenant_memberships
  where tenant_id = 'tenant_acme_fitness'
    and user_id = 'user_owner_north'
    and role = 'staff'
    and invite_status = 'active';

  if existing_outside_memberships <> 1 then
    raise exception 'staff access did not add existing outside user as staff';
  end if;
end;
$$;

reset role;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000505',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'claim-staff@example.com',
    crypt('outpost-local-password', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000606',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'not-rostered@example.com',
    crypt('outpost-local-password', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000515',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'disabled-claim@example.com',
    crypt('outpost-local-password', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000707',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'already-linked-claim@example.com',
    crypt('outpost-local-password', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000777',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'prelinked-claim@example.com',
    crypt('outpost-local-password', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000808',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'claim-rollback@example.com',
    crypt('outpost-local-password', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000909',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'unconfirmed-claim@example.com',
    crypt('outpost-local-password', gen_salt('bf')),
    null,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  )
on conflict (id) do nothing;

insert into users (id, email, name) values
  ('user_claim_staff', 'claim-staff@example.com', 'Claim Staff'),
  ('user_claim_disabled', 'disabled-claim@example.com', 'Disabled Claim'),
  ('user_claim_rollback', 'claim-rollback@example.com', 'Claim Rollback'),
  (
    'user_claim_already_linked',
    'already-linked-claim@example.com',
    'Already Linked Claim'
  ),
  ('user_claim_unconfirmed', 'unconfirmed-claim@example.com', 'Unconfirmed Claim')
on conflict (id) do nothing;

update users
   set external_auth_id = '00000000-0000-0000-0000-000000000777'
 where id = 'user_claim_already_linked';

insert into tenant_memberships (id, tenant_id, user_id, role, invite_status) values
  ('member_claim_staff_acme', 'tenant_acme_fitness', 'user_claim_staff', 'staff', 'active'),
  (
    'member_claim_disabled_acme',
    'tenant_acme_fitness',
    'user_claim_disabled',
    'staff',
    'disabled'
  ),
  ('member_claim_rollback_acme', 'tenant_acme_fitness', 'user_claim_rollback', 'staff', 'active'),
  (
    'member_claim_already_linked_acme',
    'tenant_acme_fitness',
    'user_claim_already_linked',
    'staff',
    'active'
  ),
  (
    'member_claim_unconfirmed_acme',
    'tenant_acme_fitness',
    'user_claim_unconfirmed',
    'staff',
    'active'
  )
on conflict (tenant_id, user_id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000505', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000505","email":"claim-staff@example.com","role":"authenticated"}',
  true
);

do $$
declare
  staff_claim_audit_events_after integer;
  staff_claim_audit_events_before integer;
  staff_claim_result record;
  staff_claim_cross_tenant_tasks integer;
  staff_claim_visible_tasks integer;
begin
  select count(*) into staff_claim_audit_events_before
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and action = 'tenant_membership.staff_claimed';

  select * into staff_claim_result
  from claim_staff_roster_membership();

  if staff_claim_result.tenant_id <> 'tenant_acme_fitness' then
    raise exception 'staff claim returned wrong tenant';
  end if;

  if staff_claim_result.membership_id <> 'member_claim_staff_acme' then
    raise exception 'staff claim returned wrong membership';
  end if;

  if not exists (
    select 1
    from users
    where id = 'user_claim_staff'
      and external_auth_id = '00000000-0000-0000-0000-000000000505'
  ) then
    raise exception 'staff claim did not link auth user';
  end if;

  select count(*) into staff_claim_audit_events_after
  from audit_events
  where tenant_id = 'tenant_acme_fitness'
    and actor_user_id = 'user_claim_staff'
    and subject_type = 'tenant_membership'
    and subject_id = 'member_claim_staff_acme'
    and action = 'tenant_membership.staff_claimed';

  if staff_claim_audit_events_after <> staff_claim_audit_events_before + 1 then
    raise exception 'staff claim audit event missing';
  end if;

  select count(*) into staff_claim_visible_tasks
  from tasks
  where tenant_id = 'tenant_acme_fitness';

  if staff_claim_visible_tasks = 0 then
    raise exception 'staff claim did not grant own-tenant task visibility';
  end if;

  select count(*) into staff_claim_cross_tenant_tasks
  from tasks
  where tenant_id = 'tenant_crossfit_north';

  if staff_claim_cross_tenant_tasks <> 0 then
    raise exception 'staff claim leaked cross-tenant task visibility';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner-acme@example.com","role":"authenticated"}',
  true
);

select *
from disable_tenant_staff_member(
  'tenant_acme_fitness',
  'member_claim_staff_acme'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000505', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000505","email":"claim-staff@example.com","role":"authenticated"}',
  true
);

do $$
declare
  disabled_claim_visible_tasks integer;
begin
  select count(*) into disabled_claim_visible_tasks
  from tasks
  where tenant_id = 'tenant_acme_fitness';

  if disabled_claim_visible_tasks <> 0 then
    raise exception 'disabled claimed staff retained task visibility';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000606', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000606","email":"not-rostered@example.com","role":"authenticated"}',
  true
);

do $$
begin
  perform claim_staff_roster_membership();
  raise exception 'non-rostered staff claim unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000515', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000515","email":"disabled-claim@example.com","role":"authenticated"}',
  true
);

do $$
begin
  perform claim_staff_roster_membership();
  raise exception 'disabled staff claim unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","email":"owner-acme@example.com","role":"authenticated"}',
  true
);

do $$
begin
  perform claim_staff_roster_membership();
  raise exception 'owner-only staff claim unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000909', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000909","email":"unconfirmed-claim@example.com","role":"authenticated"}',
  true
);

do $$
begin
  perform claim_staff_roster_membership();
  raise exception 'unconfirmed staff claim unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000707', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000707","email":"already-linked-claim@example.com","role":"authenticated"}',
  true
);

do $$
begin
  perform claim_staff_roster_membership();
  raise exception 'already-linked staff claim unexpectedly succeeded';
exception
  when insufficient_privilege then
    null;
end;
$$;

reset role;

create or replace function pg_temp.fail_staff_claim_audit_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'injected staff claim audit failure'
    using errcode = 'P0001';
end;
$$;

create trigger fail_staff_claim_audit_insert
  before insert on audit_events
  for each row
  when (new.action = 'tenant_membership.staff_claimed')
  execute function pg_temp.fail_staff_claim_audit_insert();

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000808', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000808","email":"claim-rollback@example.com","role":"authenticated"}',
  true
);

do $$
declare
  failed_staff_claim_audit_events_after integer;
  failed_staff_claim_audit_events_before integer;
begin
  select count(*) into failed_staff_claim_audit_events_before
  from audit_events
  where action = 'tenant_membership.staff_claimed';

  perform claim_staff_roster_membership();

  raise exception 'staff claim rollback trigger unexpectedly allowed write';
exception
  when raise_exception then
    if exists (
      select 1
      from users
      where id = 'user_claim_rollback'
        and external_auth_id is not null
    ) then
      raise exception 'staff claim rollback left auth link behind';
    end if;

    select count(*) into failed_staff_claim_audit_events_after
    from audit_events
    where action = 'tenant_membership.staff_claimed';

    if failed_staff_claim_audit_events_after <> failed_staff_claim_audit_events_before then
      raise exception 'staff claim rollback wrote audit event';
    end if;
end;
$$;

reset role;
drop trigger fail_staff_claim_audit_insert on audit_events;

-- Runtime-policy candidate authority has a dedicated transactional contract in
-- tests/sql/runtime-policy-candidate-authority.sql. Keeping that capability
-- test separate prevents this broad RLS fixture from needing privileged role
-- membership or duplicating the bounded intent lifecycle.

rollback;
