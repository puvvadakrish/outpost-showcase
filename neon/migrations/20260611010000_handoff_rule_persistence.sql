-- Owner handoff-rule persistence.
-- Keeps rule edits as one PostgreSQL RPC transaction: current rule row,
-- revision evidence, and audit event are written together.

alter table handoff_rules
  add constraint handoff_rules_tenant_id_id_key unique (tenant_id, id);

create table handoff_rule_revisions (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  handoff_rule_id text not null,
  actor_user_id text,
  previous_trigger handoff_trigger not null,
  next_trigger handoff_trigger not null,
  previous_topic text not null,
  next_topic text not null,
  previous_action handoff_action not null,
  next_action handoff_action not null,
  previous_destination text not null,
  next_destination text not null,
  previous_active_window text not null,
  next_active_window text not null,
  previous_status handoff_rule_status not null,
  next_status handoff_rule_status not null,
  previous_priority integer not null,
  next_priority integer not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, handoff_rule_id) references handoff_rules(tenant_id, id),
  foreign key (tenant_id, actor_user_id) references tenant_memberships(tenant_id, user_id)
);

create index handoff_rule_revisions_rule_created_idx
  on handoff_rule_revisions (tenant_id, handoff_rule_id, created_at desc);

alter table handoff_rule_revisions enable row level security;

create policy "members read handoff rule revisions" on handoff_rule_revisions
  for select using (is_active_tenant_member(tenant_id));

grant select on handoff_rule_revisions to authenticated;

create or replace function update_handoff_rule(
  p_tenant_id text,
  p_handoff_rule_id text,
  p_trigger text,
  p_topic text,
  p_action text,
  p_destination text,
  p_active_window text,
  p_priority integer,
  p_status text,
  p_note text default 'Owner updated handoff rule through Outpost.'
)
returns handoff_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_existing handoff_rules;
  v_next_action handoff_action;
  v_next_status handoff_rule_status;
  v_next_trigger handoff_trigger;
  v_revision_id text := gen_random_uuid()::text;
  v_updated handoff_rules;
begin
  p_tenant_id := btrim(p_tenant_id);
  p_handoff_rule_id := btrim(p_handoff_rule_id);
  p_trigger := btrim(p_trigger);
  p_topic := btrim(p_topic);
  p_action := btrim(p_action);
  p_destination := btrim(p_destination);
  p_active_window := btrim(p_active_window);
  p_status := btrim(p_status);
  p_note := coalesce(nullif(btrim(p_note), ''), 'Owner updated handoff rule through Outpost.');

  if nullif(p_tenant_id, '') is null then
    raise exception 'tenant identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_handoff_rule_id, '') is null then
    raise exception 'handoff rule identifier is required'
      using errcode = '22023';
  end if;

  if nullif(p_topic, '') is null then
    raise exception 'handoff rule topic is required'
      using errcode = '22023';
  end if;

  if nullif(p_destination, '') is null then
    raise exception 'handoff rule destination is required'
      using errcode = '22023';
  end if;

  if nullif(p_active_window, '') is null then
    raise exception 'handoff rule active window is required'
      using errcode = '22023';
  end if;

  if length(p_topic) > 160 then
    raise exception 'handoff rule topic must be 160 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_destination) > 240 then
    raise exception 'handoff rule destination must be 240 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_active_window) > 120 then
    raise exception 'handoff rule active window must be 120 characters or fewer'
      using errcode = '22023';
  end if;

  if p_priority is null or p_priority < 1 or p_priority > 1000 then
    raise exception 'handoff rule priority must be a whole number from 1 to 1000'
      using errcode = '22023';
  end if;

  if not is_active_tenant_owner(p_tenant_id) then
    raise exception 'owner membership required for tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  v_next_trigger := p_trigger::handoff_trigger;
  v_next_action := p_action::handoff_action;
  v_next_status := p_status::handoff_rule_status;

  select current_app_user_id() into v_actor_user_id;

  if v_actor_user_id is null then
    raise exception 'active application user is required'
      using errcode = '42501';
  end if;

  select *
    into v_existing
    from handoff_rules
    where tenant_id = p_tenant_id
      and id = p_handoff_rule_id
    for update;

  if not found then
    raise exception 'handoff rule not found'
      using errcode = 'P0002';
  end if;

  update handoff_rules
     set trigger = v_next_trigger,
         topic = p_topic,
         action = v_next_action,
         destination = p_destination,
         active_window = p_active_window,
         priority = p_priority,
         status = v_next_status,
         updated_at = now()
   where tenant_id = p_tenant_id
     and id = p_handoff_rule_id
   returning * into v_updated;

  insert into handoff_rule_revisions (
    id,
    tenant_id,
    location_id,
    handoff_rule_id,
    actor_user_id,
    previous_trigger,
    next_trigger,
    previous_topic,
    next_topic,
    previous_action,
    next_action,
    previous_destination,
    next_destination,
    previous_active_window,
    next_active_window,
    previous_status,
    next_status,
    previous_priority,
    next_priority,
    note
  ) values (
    v_revision_id,
    p_tenant_id,
    v_updated.location_id,
    v_updated.id,
    v_actor_user_id,
    v_existing.trigger,
    v_updated.trigger,
    v_existing.topic,
    v_updated.topic,
    v_existing.action,
    v_updated.action,
    v_existing.destination,
    v_updated.destination,
    v_existing.active_window,
    v_updated.active_window,
    v_existing.status,
    v_updated.status,
    v_existing.priority,
    v_updated.priority,
    p_note
  );

  insert into audit_events (
    id,
    tenant_id,
    actor_user_id,
    subject_type,
    subject_id,
    action,
    metadata
  ) values (
    v_audit_event_id,
    p_tenant_id,
    v_actor_user_id,
    'handoff_rule',
    v_updated.id,
    'handoff_rule.updated',
    jsonb_build_object(
      'previous_trigger', v_existing.trigger,
      'next_trigger', v_updated.trigger,
      'previous_topic', v_existing.topic,
      'next_topic', v_updated.topic,
      'previous_action', v_existing.action,
      'next_action', v_updated.action,
      'previous_destination', v_existing.destination,
      'next_destination', v_updated.destination,
      'previous_active_window', v_existing.active_window,
      'next_active_window', v_updated.active_window,
      'previous_status', v_existing.status,
      'next_status', v_updated.status,
      'previous_priority', v_existing.priority,
      'next_priority', v_updated.priority,
      'revision_id', v_revision_id
    )
  );

  return v_updated;
end;
$$;

revoke execute on function update_handoff_rule(text, text, text, text, text, text, text, integer, text, text)
  from public, anonymous;
grant execute on function update_handoff_rule(text, text, text, text, text, text, text, integer, text, text)
  to authenticated;
