\set ON_ERROR_STOP on

begin;

grant outpost_provider_ingress to current_user;

insert into plans (
  id, name, included_locations, included_voice_minutes, included_emails,
  included_users, overage_voice_minute_cents
) values ('plan_ingress_contract', 'Ingress contract', 1, 0, 1, 1, 0);

insert into tenants (
  id, name, slug, status, plan_id, billing_mode, support_tier
) values (
  'tenant_ingress_contract', 'Ingress Contract', 'ingress-contract', 'active',
  'plan_ingress_contract', 'pilot', 'concierge'
);

insert into locations (
  id, tenant_id, name, address, timezone, status
) values (
  'location_ingress_contract', 'tenant_ingress_contract', 'Ingress Location',
  '123 Contract Street', 'America/Chicago', 'active'
);

insert into provider_connections (
  id, tenant_id, location_id, channel, provider_key, status, secret_ref,
  disabled_reason, ingress_key
) values (
  'provider_ingress_contract', 'tenant_ingress_contract',
  'location_ingress_contract', 'email', 'resend', 'disabled',
  'outpost-secret://provider/provider_ingress_contract/webhook-signing/v1',
  'protected fixture only', 'd4ac846d-1886-4ea6-a842-2d2f727d10d8'
);

do $$
begin
  if (select processing_state from tenant_runtime_controls
      where tenant_id = 'tenant_ingress_contract') <> 'stopped' then
    raise exception 'new tenant did not default stopped';
  end if;
  if (select provider_ingress_mode from provider_connections
      where id = 'provider_ingress_contract') <> 'blocked' then
    raise exception 'provider ingress did not default blocked';
  end if;
  if not has_function_privilege(
    'outpost_provider_ingress',
    'resolve_provider_ingress_connection(text,text)',
    'execute'
  ) or not has_function_privilege(
    'outpost_provider_ingress',
    'accept_provider_ingress_event(text,text,text,text,text,jsonb,timestamp with time zone)',
    'execute'
  ) then
    raise exception 'ingress capability lacks its exact functions';
  end if;
  if has_function_privilege(
    'outpost_provider_ingress',
    'enqueue_job(text,jsonb,integer,text,text,timestamp with time zone,integer)',
    'execute'
  ) or has_function_privilege('outpost_provider_ingress', 'claim_jobs(integer,text)', 'execute')
     or has_function_privilege(
       'outpost_provider_ingress',
       'persist_normalized_provider_event(jsonb,text,text)',
       'execute'
     ) then
    raise exception 'ingress capability crossed into enqueue or runtime authority';
  end if;
  if has_table_privilege('outpost_provider_ingress', 'provider_connections', 'select')
     or has_any_column_privilege(
       'outpost_provider_ingress', 'provider_connections', 'select,insert,update,references'
     )
     or has_table_privilege('outpost_provider_ingress', 'provider_ingress_receipts', 'insert')
     or has_table_privilege('outpost_provider_ingress', 'jobs', 'insert') then
    raise exception 'ingress capability has direct application-table authority';
  end if;
  if has_column_privilege('authenticated', 'provider_connections', 'ingress_key', 'select')
     or has_column_privilege(
       'authenticated', 'provider_connections', 'provider_ingress_mode', 'select'
     ) then
    raise exception 'authenticated can inspect hidden ingress configuration';
  end if;
  if (
    select count(*)
      from pg_proc function
     where function.oid in (
       'prevent_provider_ingress_receipt_mutation()'::regprocedure,
       'resolve_provider_ingress_connection(text,text)'::regprocedure,
       'accept_provider_ingress_event(text,text,text,text,text,jsonb,timestamp with time zone)'::regprocedure
     )
       and coalesce(function.proconfig, '{}'::text[])
           @> array['search_path=pg_catalog, pg_temp']
  ) <> 3 then
    raise exception 'provider ingress SECURITY DEFINER search path is not hardened';
  end if;

  begin
    update provider_connections
       set provider_ingress_mode = 'live'
     where id = 'provider_ingress_contract';
    raise exception 'live provider ingress mode unexpectedly exists';
  exception when check_violation then null;
  end;
end;
$$;

set local role outpost_provider_ingress;

do $$
begin
  begin
    perform resolve_provider_ingress_connection(
      'd4ac846d-1886-4ea6-a842-2d2f727d10d8', 'resend'
    );
    raise exception 'blocked provider connection unexpectedly resolved';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;

reset role;

update provider_connections
   set provider_ingress_mode = 'rehearsal'
 where id = 'provider_ingress_contract';

set local role outpost_provider_ingress;

do $$
declare
  v_connection jsonb;
begin
  v_connection := resolve_provider_ingress_connection(
    'd4ac846d-1886-4ea6-a842-2d2f727d10d8', 'resend'
  );
  if v_connection ->> 'tenantId' <> 'tenant_ingress_contract'
     or v_connection ->> 'locationId' <> 'location_ingress_contract'
     or v_connection ->> 'providerConnectionId' <> 'provider_ingress_contract'
     or v_connection ->> 'secretRef' is null then
    raise exception 'resolved connection lost server-derived provenance';
  end if;

  begin
    perform accept_provider_ingress_event(
      'd4ac846d-1886-4ea6-a842-2d2f727d10d8', 'resend', 'delivery_001',
      'email.received', repeat('a', 64),
      '{"event":"email.received","message_id":"email_001","body_available":false}'::jsonb,
      now()
    );
    raise exception 'stopped tenant unexpectedly accepted ingress';
  exception when sqlstate 'OP001' then null;
  end;
end;
$$;

reset role;

update tenant_runtime_controls
   set processing_state = 'enabled'
 where tenant_id = 'tenant_ingress_contract';

set local role outpost_provider_ingress;

do $$
declare
  v_first jsonb;
  v_replay jsonb;
begin
  v_first := accept_provider_ingress_event(
    'd4ac846d-1886-4ea6-a842-2d2f727d10d8', 'resend', 'delivery_001',
    'email.received', repeat('a', 64),
    '{"event":"email.received","message_id":"email_001","from_email":"member@example.com","subject":"Freeze request","body_available":false}'::jsonb,
    now()
  );
  if (v_first ->> 'replayed')::boolean
     or nullif(v_first ->> 'receiptId', '') is null
     or nullif(v_first ->> 'jobId', '') is null
     or (v_first ->> 'pauseGeneration')::bigint <> 0 then
    raise exception 'first ingress receipt has invalid result shape';
  end if;

  v_replay := accept_provider_ingress_event(
    'd4ac846d-1886-4ea6-a842-2d2f727d10d8', 'resend', 'delivery_001',
    'email.received', repeat('a', 64),
    '{"event":"email.received","message_id":"email_001","from_email":"member@example.com","subject":"Freeze request","body_available":false}'::jsonb,
    now()
  );
  if not (v_replay ->> 'replayed')::boolean
     or v_replay ->> 'receiptId' <> v_first ->> 'receiptId'
     or v_replay ->> 'jobId' <> v_first ->> 'jobId' then
    raise exception 'exact provider replay was not idempotent';
  end if;

  begin
    perform accept_provider_ingress_event(
      'd4ac846d-1886-4ea6-a842-2d2f727d10d8', 'resend', 'delivery_001',
      'email.received', repeat('b', 64),
      '{"event":"email.received","message_id":"email_001","from_email":"member@example.com","subject":"Freeze request","body_available":false}'::jsonb,
      now()
    );
    raise exception 'conflicting provider replay unexpectedly succeeded';
  exception when unique_violation then null;
  end;

  begin
    perform accept_provider_ingress_event(
      'd4ac846d-1886-4ea6-a842-2d2f727d10d8', 'resend', 'delivery_raw',
      'email.received', repeat('c', 64),
      '{"event":"email.received","message_id":"email_raw","body_available":true,"html_body":"raw customer body"}'::jsonb,
      now()
    );
    raise exception 'raw email body unexpectedly entered ingress';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform accept_provider_ingress_event(
      'd4ac846d-1886-4ea6-a842-2d2f727d10d8', 'resend', 'delivery_nested',
      'email.received', repeat('d', 64),
      '{"event":"email.received","message_id":"email_nested","body_available":false,"subject":{"raw":"nested"}}'::jsonb,
      now()
    );
    raise exception 'nested provider object unexpectedly entered ingress';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform accept_provider_ingress_event(
      'd4ac846d-1886-4ea6-a842-2d2f727d10d8', 'resend', 'delivery_body_flag',
      'email.received', repeat('e', 64),
      '{"event":"email.received","message_id":"email_body_flag","body_available":"raw customer body"}'::jsonb,
      now()
    );
    raise exception 'non-boolean body metadata unexpectedly entered ingress';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

reset role;

do $$
declare
  v_job jobs;
begin
  if (select count(*) from provider_ingress_receipts
      where provider_connection_id = 'provider_ingress_contract') <> 1 then
    raise exception 'ingress replay duplicated its immutable receipt';
  end if;

  select jobs.* into v_job
    from jobs
    join provider_ingress_receipts receipt on receipt.job_id = jobs.id
   where receipt.provider_connection_id = 'provider_ingress_contract';

  if v_job.tenant_id <> 'tenant_ingress_contract'
     or v_job.kind <> 'provider.resend.email_received.normalize'
     or v_job.payload -> 'context' ->> 'tenant_id' <> 'tenant_ingress_contract'
     or v_job.payload -> 'context' ->> 'location_id' <> 'location_ingress_contract'
     or v_job.payload -> 'context' ->> 'provider_connection_id' <> 'provider_ingress_contract'
     or v_job.payload::text ~* '(html_body|text_body|raw customer body)' then
    raise exception 'ingress job lost provenance or persisted raw provider content';
  end if;

  begin
    update provider_ingress_receipts set payload_digest = repeat('f', 64);
    raise exception 'provider ingress receipt mutation unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;

rollback;
