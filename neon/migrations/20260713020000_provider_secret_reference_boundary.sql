alter table provider_connections
  add column credential_reference_configured boolean
  generated always as (secret_ref is not null) stored;

alter table provider_connections
  add constraint provider_connections_secret_ref_shape check (
    secret_ref is null
    or secret_ref ~ '^outpost-secret://provider/[A-Za-z0-9][A-Za-z0-9._:-]{7,127}/(webhook-signing|api)/v[1-9][0-9]*$'
  );

revoke select on provider_connections from authenticated;
grant select (
  id,
  tenant_id,
  location_id,
  channel,
  provider_key,
  status,
  external_account_label,
  credential_reference_configured,
  disabled_reason,
  created_at,
  updated_at
) on provider_connections to authenticated;
