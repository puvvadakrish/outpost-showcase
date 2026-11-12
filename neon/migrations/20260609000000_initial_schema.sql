-- Outpost backend persistence spine.
-- Generated from db/schema.sql and extended with RLS policies plus the
-- transactional answer-bank tracer-bullet RPC.

create extension if not exists citext;
create extension if not exists pgcrypto;

create type tenant_status as enum ('setup', 'active', 'paused', 'disabled');
create type billing_mode as enum ('pilot', 'self_serve', 'contract');
create type support_tier as enum ('standard', 'concierge');
create type membership_role as enum ('owner', 'staff', 'founder_admin');
create type app_admin_status as enum ('active', 'disabled');
create type support_access_status as enum ('requested', 'active', 'expired', 'revoked');
create type invite_status as enum ('invited', 'active', 'disabled');
create type location_status as enum ('draft', 'active', 'paused');
create type channel as enum ('phone', 'email', 'manual', 'social');
create type task_channel as enum ('phone', 'email', 'manual');
create type answer_approval_status as enum ('draft', 'approved', 'conflict', 'routed', 'retired');
create type answer_owner_action as enum ('approve', 'edit', 'keep_routed', 'retire');
create type answer_runtime_behavior as enum ('answer_live', 'needs_owner_review', 'create_staff_task', 'blocked_until_resolved');
create type answer_revision_intent as enum ('import_proposal', 'edit', 'approval', 'route', 'retirement', 'conflict_resolution');
create type handoff_trigger as enum ('topic', 'low_confidence', 'always_human', 'explicit_human_request', 'missing_fact', 'conflict');
create type handoff_action as enum ('create_task', 'notify_staff', 'transfer_when_live', 'block_automation');
create type handoff_rule_status as enum ('active', 'draft', 'disabled');
create type source_document_type as enum ('website', 'google_profile', 'manual');
create type source_document_status as enum ('ready', 'needs_review', 'conflict', 'missing');
create type source_fact_status as enum ('proposed', 'needs_review', 'approved', 'conflict', 'rejected');
create type notification_destination_type as enum ('task_queue', 'staff_email', 'owner_email');
create type notification_destination_status as enum ('ready', 'draft', 'disabled');
create type task_status as enum ('new', 'needs_human', 'in_progress', 'done', 'ignored');
create type provider_connection_status as enum ('not_configured', 'disabled', 'pending_review');
create type conversation_status as enum ('open', 'resolved', 'needs_human', 'archived');
create type channel_event_processing_status as enum ('received', 'normalized', 'ignored', 'failed');
create type usage_meter as enum (
  'voice_seconds',
  'call_started',
  'call_completed',
  'call_transferred',
  'email_received',
  'email_classified',
  'email_replied',
  'task_created',
  'notification_attempted',
  'notification_delivered',
  'social_message_processed'
);

create table plans (
  id text primary key,
  name text not null,
  is_public boolean not null default true,
  included_locations integer not null default 1 check (included_locations >= 0),
  included_voice_minutes integer not null default 0 check (included_voice_minutes >= 0),
  included_emails integer not null default 0 check (included_emails >= 0),
  included_users integer not null default 0 check (included_users >= 0),
  overage_voice_minute_cents integer not null default 0 check (overage_voice_minute_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plan_entitlements (
  id text primary key,
  plan_id text not null references plans(id),
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  unique (plan_id, key)
);

create table tenants (
  id text primary key,
  name text not null,
  slug text not null unique,
  status tenant_status not null default 'setup',
  plan_id text not null references plans(id),
  billing_mode billing_mode not null default 'pilot',
  support_tier support_tier not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id text primary key,
  external_auth_id uuid unique references neon_auth."user"(id) on delete set null,
  email citext not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tenant_memberships (
  id text primary key,
  tenant_id text not null references tenants(id),
  user_id text not null references users(id),
  role membership_role not null,
  invite_status invite_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table app_admins (
  id text primary key,
  user_id text not null unique references users(id),
  status app_admin_status not null default 'active',
  created_at timestamptz not null default now()
);

create table locations (
  id text primary key,
  tenant_id text not null references tenants(id),
  name text not null,
  address text not null,
  public_phone text,
  routing_phone text,
  timezone text not null,
  status location_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table source_documents (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  source_type source_document_type not null,
  label text not null,
  url text,
  status source_document_status not null default 'needs_review',
  facts_found integer not null default 0 check (facts_found >= 0),
  conflicts_found integer not null default 0 check (conflicts_found >= 0),
  digest text,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, location_id) references locations(tenant_id, id)
);

create table answer_bank_entries (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  topic text not null,
  question text not null,
  answer text not null,
  approval_status answer_approval_status not null default 'draft',
  source_document_id text,
  source_label text,
  approved_by_user_id text,
  approved_at timestamptz,
  retired_at timestamptz,
  owner_action answer_owner_action not null default 'edit',
  runtime_behavior answer_runtime_behavior not null default 'needs_owner_review',
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (source_document_id is not null or source_label is not null),
  check (approval_status <> 'approved' or approved_at is not null),
  check (approval_status <> 'retired' or retired_at is not null),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, source_document_id) references source_documents(tenant_id, id),
  foreign key (tenant_id, approved_by_user_id) references tenant_memberships(tenant_id, user_id)
);

create table answer_bank_revisions (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  answer_bank_entry_id text not null,
  actor_user_id text,
  revision_intent answer_revision_intent not null,
  previous_status answer_approval_status,
  next_status answer_approval_status not null,
  source_document_id text,
  source_label text,
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, answer_bank_entry_id) references answer_bank_entries(tenant_id, id),
  foreign key (tenant_id, source_document_id) references source_documents(tenant_id, id),
  foreign key (tenant_id, actor_user_id) references tenant_memberships(tenant_id, user_id)
);

create table source_facts (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  source_document_id text not null,
  topic text not null,
  value text not null,
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  conflict_group text,
  proposed_answer_entry_id text,
  review_status source_fact_status not null default 'proposed',
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, source_document_id) references source_documents(tenant_id, id),
  foreign key (tenant_id, proposed_answer_entry_id) references answer_bank_entries(tenant_id, id)
);

create table handoff_rules (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  trigger handoff_trigger not null,
  topic text not null,
  action handoff_action not null,
  destination text not null,
  active_window text not null default 'always',
  priority integer not null default 100,
  status handoff_rule_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references locations(tenant_id, id)
);

create table notification_destinations (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  destination_type notification_destination_type not null,
  label text not null,
  destination text not null,
  status notification_destination_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references locations(tenant_id, id)
);

create table provider_connections (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  channel channel not null,
  provider_key text not null,
  status provider_connection_status not null default 'not_configured',
  external_account_label text,
  secret_ref text,
  disabled_reason text not null default 'not configured',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, channel, provider_key, location_id),
  unique (tenant_id, id),
  check (status <> 'pending_review' or secret_ref is null),
  foreign key (tenant_id, location_id) references locations(tenant_id, id)
);

create table conversations (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  provider_connection_id text,
  channel channel not null,
  external_conversation_id text,
  requester_label text not null,
  status conversation_status not null default 'open',
  started_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, provider_connection_id) references provider_connections(tenant_id, id)
);

create table channel_events (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  provider_connection_id text,
  conversation_id text,
  channel channel not null,
  provider_event_id text,
  event_type text not null,
  payload_digest text,
  payload_ref text,
  processing_status channel_event_processing_status not null default 'received',
  received_at timestamptz not null default now(),
  unique (tenant_id, channel, provider_event_id),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, provider_connection_id) references provider_connections(tenant_id, id),
  foreign key (tenant_id, conversation_id) references conversations(tenant_id, id)
);

create table tasks (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text not null,
  channel task_channel not null,
  requester_name text not null,
  requester_contact text not null,
  intent text not null,
  summary text not null,
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  suggested_next_step text not null,
  assignee_user_id text,
  status task_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, location_id, id),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, assignee_user_id) references tenant_memberships(tenant_id, user_id)
);

create table task_events (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text not null,
  task_id text not null,
  actor_user_id text,
  event_type text not null,
  from_status task_status,
  to_status task_status,
  note text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, location_id, task_id) references tasks(tenant_id, location_id, id),
  foreign key (tenant_id, actor_user_id) references tenant_memberships(tenant_id, user_id)
);

create table domain_events (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  actor_user_id text,
  subject_type text not null,
  subject_id text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references locations(tenant_id, id),
  foreign key (tenant_id, actor_user_id) references tenant_memberships(tenant_id, user_id)
);

create table audit_events (
  id text primary key,
  tenant_id text not null references tenants(id),
  actor_user_id text,
  founder_admin_id text references app_admins(id),
  support_access_grant_id text,
  subject_type text not null,
  subject_id text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, actor_user_id) references tenant_memberships(tenant_id, user_id)
);

create table support_access_grants (
  id text primary key,
  tenant_id text not null references tenants(id),
  founder_admin_id text not null references app_admins(id),
  reason text not null,
  status support_access_status not null default 'requested',
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  approved_by_user_id text,
  audit_event_id text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (expires_at > starts_at),
  foreign key (tenant_id, approved_by_user_id) references tenant_memberships(tenant_id, user_id),
  foreign key (tenant_id, audit_event_id) references audit_events(tenant_id, id)
);

alter table audit_events
  add constraint audit_events_support_access_grant_fk
  foreign key (tenant_id, support_access_grant_id) references support_access_grants(tenant_id, id);

create table usage_events (
  id text primary key,
  tenant_id text not null references tenants(id),
  location_id text,
  meter usage_meter not null,
  quantity numeric(12, 3) not null check (quantity >= 0),
  source_type text not null,
  source_id text not null,
  period_key text not null,
  occurred_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references locations(tenant_id, id)
);

create index tenants_status_idx on tenants (status);
create index tenant_memberships_tenant_role_idx on tenant_memberships (tenant_id, role);
create index locations_tenant_status_idx on locations (tenant_id, status);
create index source_documents_tenant_status_idx on source_documents (tenant_id, status);
create index source_facts_tenant_review_status_idx on source_facts (tenant_id, review_status);
create index answer_bank_entries_tenant_status_idx on answer_bank_entries (tenant_id, approval_status);
create index answer_bank_revisions_entry_created_idx on answer_bank_revisions (tenant_id, answer_bank_entry_id, created_at desc);
create index handoff_rules_tenant_status_idx on handoff_rules (tenant_id, status, priority);
create index notification_destinations_tenant_status_idx on notification_destinations (tenant_id, status);
create index provider_connections_tenant_channel_status_idx on provider_connections (tenant_id, channel, status);
create index conversations_tenant_channel_status_idx on conversations (tenant_id, channel, status, last_event_at desc);
create index channel_events_tenant_received_idx on channel_events (tenant_id, received_at desc);
create index tasks_tenant_status_created_idx on tasks (tenant_id, status, created_at desc);
create index tasks_location_status_created_idx on tasks (tenant_id, location_id, status, created_at desc);
create index task_events_task_created_idx on task_events (tenant_id, location_id, task_id, created_at desc);
create index domain_events_subject_idx on domain_events (tenant_id, subject_type, subject_id, occurred_at desc);
create index audit_events_subject_idx on audit_events (tenant_id, subject_type, subject_id, occurred_at desc);
create index support_access_grants_tenant_status_idx on support_access_grants (tenant_id, status, expires_at);
create index usage_events_tenant_period_meter_idx on usage_events (tenant_id, period_key, meter, occurred_at desc);

create or replace function current_app_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select users.id
  from users
  where users.external_auth_id = auth.uid()
  limit 1
$$;

create or replace function is_active_tenant_member(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tenant_memberships memberships
    join users app_users on app_users.id = memberships.user_id
    where memberships.tenant_id = p_tenant_id
      and memberships.invite_status = 'active'
      and app_users.external_auth_id = auth.uid()
  )
$$;

create or replace function is_active_tenant_owner(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tenant_memberships memberships
    join users app_users on app_users.id = memberships.user_id
    where memberships.tenant_id = p_tenant_id
      and memberships.role = 'owner'
      and memberships.invite_status = 'active'
      and app_users.external_auth_id = auth.uid()
  )
$$;

alter table plans enable row level security;
alter table plan_entitlements enable row level security;
alter table tenants enable row level security;
alter table users enable row level security;
alter table tenant_memberships enable row level security;
alter table app_admins enable row level security;
alter table locations enable row level security;
alter table source_documents enable row level security;
alter table answer_bank_entries enable row level security;
alter table answer_bank_revisions enable row level security;
alter table source_facts enable row level security;
alter table handoff_rules enable row level security;
alter table notification_destinations enable row level security;
alter table provider_connections enable row level security;
alter table conversations enable row level security;
alter table channel_events enable row level security;
alter table tasks enable row level security;
alter table task_events enable row level security;
alter table domain_events enable row level security;
alter table audit_events enable row level security;
alter table support_access_grants enable row level security;
alter table usage_events enable row level security;

create policy "members read tenant plans" on plans
  for select using (
    exists (
      select 1
      from tenants
      where tenants.plan_id = plans.id
        and is_active_tenant_member(tenants.id)
    )
  );

create policy "members read plan entitlements" on plan_entitlements
  for select using (
    exists (
      select 1
      from tenants
      where tenants.plan_id = plan_entitlements.plan_id
        and is_active_tenant_member(tenants.id)
    )
  );

create policy "members read own tenants" on tenants
  for select using (is_active_tenant_member(id));

create policy "users read own app user" on users
  for select using (external_auth_id = auth.uid());

create policy "members read tenant memberships" on tenant_memberships
  for select using (is_active_tenant_member(tenant_id));

create policy "members read locations" on locations
  for select using (is_active_tenant_member(tenant_id));

create policy "members read source documents" on source_documents
  for select using (is_active_tenant_member(tenant_id));

create policy "members read answer bank entries" on answer_bank_entries
  for select using (is_active_tenant_member(tenant_id));

create policy "members read answer bank revisions" on answer_bank_revisions
  for select using (is_active_tenant_member(tenant_id));

create policy "members read source facts" on source_facts
  for select using (is_active_tenant_member(tenant_id));

create policy "members read handoff rules" on handoff_rules
  for select using (is_active_tenant_member(tenant_id));

create policy "members read notification destinations" on notification_destinations
  for select using (is_active_tenant_member(tenant_id));

create policy "members read provider stubs" on provider_connections
  for select using (is_active_tenant_member(tenant_id));

create policy "members read conversations" on conversations
  for select using (is_active_tenant_member(tenant_id));

create policy "members read channel events" on channel_events
  for select using (is_active_tenant_member(tenant_id));

create policy "members read tasks" on tasks
  for select using (is_active_tenant_member(tenant_id));

create policy "members read task events" on task_events
  for select using (is_active_tenant_member(tenant_id));

create policy "members read domain events" on domain_events
  for select using (is_active_tenant_member(tenant_id));

create policy "members read audit events" on audit_events
  for select using (is_active_tenant_member(tenant_id));

create policy "members read support access grants" on support_access_grants
  for select using (is_active_tenant_member(tenant_id));

create policy "members read usage events" on usage_events
  for select using (is_active_tenant_member(tenant_id));

grant usage on schema public to anonymous, authenticated;
grant select on
  plans,
  plan_entitlements,
  tenants,
  users,
  tenant_memberships,
  app_admins,
  locations,
  source_documents,
  answer_bank_entries,
  answer_bank_revisions,
  source_facts,
  handoff_rules,
  notification_destinations,
  provider_connections,
  conversations,
  channel_events,
  tasks,
  task_events,
  domain_events,
  audit_events,
  support_access_grants,
  usage_events
to authenticated;

revoke execute on function current_app_user_id() from public, anonymous;
revoke execute on function is_active_tenant_member(text) from public, anonymous;
revoke execute on function is_active_tenant_owner(text) from public, anonymous;
grant execute on function current_app_user_id() to authenticated;
grant execute on function is_active_tenant_member(text) to authenticated;
grant execute on function is_active_tenant_owner(text) to authenticated;

create or replace function edit_answer_bank_draft(
  p_tenant_id text,
  p_answer_bank_entry_id text,
  p_topic text,
  p_question text,
  p_answer text,
  p_note text default 'Owner edited draft answer through Outpost.'
)
returns answer_bank_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id text;
  v_audit_event_id text := gen_random_uuid()::text;
  v_existing answer_bank_entries;
  v_revision_id text := gen_random_uuid()::text;
  v_updated answer_bank_entries;
begin
  p_topic := btrim(p_topic);
  p_question := btrim(p_question);
  p_answer := btrim(p_answer);

  if nullif(p_topic, '') is null then
    raise exception 'answer topic is required'
      using errcode = '22023';
  end if;

  if nullif(p_question, '') is null then
    raise exception 'answer question is required'
      using errcode = '22023';
  end if;

  if nullif(p_answer, '') is null then
    raise exception 'answer text is required'
      using errcode = '22023';
  end if;

  if length(p_topic) > 120 then
    raise exception 'answer topic must be 120 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_question) > 600 then
    raise exception 'answer question must be 600 characters or fewer'
      using errcode = '22023';
  end if;

  if length(p_answer) > 4000 then
    raise exception 'answer text must be 4000 characters or fewer'
      using errcode = '22023';
  end if;

  if not is_active_tenant_owner(p_tenant_id) then
    raise exception 'owner membership required for tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  select current_app_user_id() into v_actor_user_id;

  select *
    into v_existing
    from answer_bank_entries
    where tenant_id = p_tenant_id
      and id = p_answer_bank_entry_id
    for update;

  if not found then
    raise exception 'answer bank entry not found'
      using errcode = 'P0002';
  end if;

  if v_existing.approval_status <> 'draft' then
    raise exception 'only draft answers can be edited by this tracer bullet'
      using errcode = '22023';
  end if;

  update answer_bank_entries
     set topic = p_topic,
         question = p_question,
         answer = p_answer,
         approval_status = 'draft',
         approved_by_user_id = null,
         approved_at = null,
         retired_at = null,
         owner_action = 'edit',
         runtime_behavior = 'needs_owner_review',
         review_note = p_note,
         updated_at = now()
   where tenant_id = p_tenant_id
     and id = p_answer_bank_entry_id
   returning * into v_updated;

  insert into answer_bank_revisions (
    id,
    tenant_id,
    location_id,
    answer_bank_entry_id,
    actor_user_id,
    revision_intent,
    previous_status,
    next_status,
    source_document_id,
    source_label,
    note
  ) values (
    v_revision_id,
    p_tenant_id,
    v_updated.location_id,
    v_updated.id,
    v_actor_user_id,
    'edit',
    v_existing.approval_status,
    v_updated.approval_status,
    v_updated.source_document_id,
    v_updated.source_label,
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
    'answer_bank_entry',
    v_updated.id,
    'answer_bank_entry.draft_edited',
    jsonb_build_object(
      'previous_status', v_existing.approval_status,
      'next_status', v_updated.approval_status,
      'revision_id', v_revision_id
    )
  );

  return v_updated;
end;
$$;

revoke execute on function edit_answer_bank_draft(text, text, text, text, text, text) from public, anonymous;
grant execute on function edit_answer_bank_draft(text, text, text, text, text, text) to authenticated;
