-- Keep the anonymous beta-request endpoint generic while preventing repeated
-- submissions from replacing the original customer-entered request details.

create or replace function submit_owner_beta_access_request(
  p_owner_email text,
  p_owner_name text,
  p_gym_name text,
  p_location_hint text default '',
  p_note text default '',
  p_company_website text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_owner_email, '')));
  v_gym_name text := btrim(coalesce(p_gym_name, ''));
  v_location_hint text := btrim(coalesce(p_location_hint, ''));
  v_note text := btrim(coalesce(p_note, ''));
  v_owner_name text := btrim(coalesce(p_owner_name, ''));
  v_request_id text;
begin
  if nullif(btrim(coalesce(p_company_website, '')), '') is not null then
    return jsonb_build_object('ok', true, 'status', 'received');
  end if;

  if nullif(v_email, '') is null then
    raise exception 'owner email is required' using errcode = '22023';
  end if;

  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'owner email must be valid' using errcode = '22023';
  end if;

  if nullif(v_owner_name, '') is null then
    raise exception 'owner name is required' using errcode = '22023';
  end if;

  if nullif(v_gym_name, '') is null then
    raise exception 'gym name is required' using errcode = '22023';
  end if;

  if length(v_email) > 254 then
    raise exception 'owner email must be 254 characters or fewer' using errcode = '22023';
  end if;

  if length(v_owner_name) > 120 then
    raise exception 'owner name must be 120 characters or fewer' using errcode = '22023';
  end if;

  if length(v_gym_name) > 140 then
    raise exception 'gym name must be 140 characters or fewer' using errcode = '22023';
  end if;

  if length(v_location_hint) > 160 then
    raise exception 'location must be 160 characters or fewer' using errcode = '22023';
  end if;

  if length(v_note) > 500 then
    raise exception 'note must be 500 characters or fewer' using errcode = '22023';
  end if;

  if (v_owner_name || ' ' || v_gym_name || ' ' || v_location_hint || ' ' || v_note) ~*
    '(napi_[a-z0-9]{20,}|NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|password\s*[:=]|secret\s*[:=]|token\s*[:=])'
  then
    raise exception 'request cannot include secrets or credentials' using errcode = '22023';
  end if;

  v_request_id := 'owner_beta_request_' || encode(digest(v_email, 'sha256'), 'hex');

  insert into owner_beta_access_requests (
    id,
    email,
    owner_name,
    gym_name,
    location_hint,
    note,
    status
  ) values (
    v_request_id,
    v_email::citext,
    v_owner_name,
    v_gym_name,
    v_location_hint,
    v_note,
    'new'
  )
  on conflict (email) do update
    set request_count = owner_beta_access_requests.request_count + 1,
        updated_at = now(),
        last_requested_at = now()
    where owner_beta_access_requests.last_requested_at <= now() - interval '15 minutes';

  return jsonb_build_object('ok', true, 'status', 'received');
end;
$$;

revoke execute on function submit_owner_beta_access_request(text, text, text, text, text, text) from public;
grant execute on function submit_owner_beta_access_request(text, text, text, text, text, text) to anonymous, authenticated;
