select submit_owner_beta_access_request(
  'owner@example.com',
  'Original Owner',
  'Original Gym',
  'Chicago',
  'Original note',
  ''
);

select submit_owner_beta_access_request(
  'OWNER@example.com',
  'Replacement Owner',
  'Replacement Gym',
  'Dallas',
  'Replacement note',
  ''
);

do $$
declare
  v_row owner_beta_access_requests%rowtype;
begin
  select * into strict v_row
    from owner_beta_access_requests
    where email = 'owner@example.com';

  if v_row.request_count <> 1
    or v_row.owner_name <> 'Original Owner'
    or v_row.gym_name <> 'Original Gym'
    or v_row.location_hint <> 'Chicago'
    or v_row.note <> 'Original note'
  then
    raise exception 'immediate repeat changed the protected request: %', row_to_json(v_row);
  end if;
end;
$$;

update owner_beta_access_requests
  set last_requested_at = now() - interval '16 minutes'
  where email = 'owner@example.com';

select submit_owner_beta_access_request(
  'owner@example.com',
  'Later Replacement Owner',
  'Later Replacement Gym',
  'Austin',
  'Later replacement note',
  ''
);

do $$
declare
  v_row owner_beta_access_requests%rowtype;
begin
  select * into strict v_row
    from owner_beta_access_requests
    where email = 'owner@example.com';

  if v_row.request_count <> 2
    or v_row.owner_name <> 'Original Owner'
    or v_row.gym_name <> 'Original Gym'
    or v_row.location_hint <> 'Chicago'
    or v_row.note <> 'Original note'
    or v_row.last_requested_at < now() - interval '1 minute'
  then
    raise exception 'eligible repeat violated cooldown semantics: %', row_to_json(v_row);
  end if;
end;
$$;
