-- Optional link from customer-observed handoff gate records to the reviewed
-- Admin handoff readiness packet digest. This stores metadata only.

alter table customer_handoff_gate_records
  add column admin_handoff_packet_sha256 text
    references admin_handoff_packet_records(packet_sha256);

alter table customer_handoff_gate_records
  add constraint customer_handoff_gate_records_admin_packet_sha_shape
  check (
    admin_handoff_packet_sha256 is null
    or admin_handoff_packet_sha256 ~ '^[a-f0-9]{64}$'
  );

create or replace function list_founder_admin_customer_handoff_gate_records()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_app_admin_id text;
begin
  if auth.uid() is null then
    return jsonb_build_object(
      'authorized', false,
      'generated_at', now(),
      'rows', '[]'::jsonb
    );
  end if;

  select app_admins.id
    into v_app_admin_id
  from app_admins
  join users
    on users.id = app_admins.user_id
  where users.external_auth_id = auth.uid()
    and app_admins.status = 'active'
    and exists (
      select 1
      from tenant_memberships memberships
      where memberships.user_id = users.id
        and memberships.role = 'founder_admin'
        and memberships.invite_status = 'active'
    )
  limit 1;

  if v_app_admin_id is null then
    return jsonb_build_object(
      'authorized', false,
      'generated_at', now(),
      'rows', '[]'::jsonb
    );
  end if;

  return (
    select jsonb_build_object(
      'authorized', true,
      'generated_at', now(),
      'rows', coalesce(jsonb_agg(jsonb_build_object(
        'id', recent_records.id,
        'status', recent_records.status,
        'gym_name', recent_records.gym_name,
        'beta_owner_label', recent_records.beta_owner_label,
        'participant_label', recent_records.participant_label,
        'observer_label', recent_records.observer_label,
        'app_origin', recent_records.app_origin,
        'neon_branch_name', recent_records.neon_branch_name,
        'session_at', recent_records.session_at,
        'gate_generated_at', recent_records.gate_generated_at,
        'recorded_at', recent_records.recorded_at,
        'source_artifact_sha256', recent_records.source_artifact_sha256,
        'admin_handoff_packet_sha256', recent_records.admin_handoff_packet_sha256,
        'summary', recent_records.summary
      ) order by recent_records.recorded_at desc, recent_records.id desc), '[]'::jsonb)
    )
    from (
      select *
      from customer_handoff_gate_records
      order by recorded_at desc, id desc
      limit 20
    ) recent_records
  );
end;
$$;

revoke execute on function list_founder_admin_customer_handoff_gate_records() from public, anonymous;
grant execute on function list_founder_admin_customer_handoff_gate_records() to authenticated;
