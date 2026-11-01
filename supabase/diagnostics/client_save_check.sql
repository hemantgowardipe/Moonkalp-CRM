-- Replace the email below with the email used by the signed-in admin.
with matching_profile as (
  select id, auth_id, email, role, client_id
  from public.users
  where lower(email) = lower('admin@example.com')
  limit 1
),
client_policies as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', policyname,
        'command', cmd,
        'roles', roles,
        'using', qual,
        'with_check', with_check
      )
      order by policyname
    ),
    '[]'::jsonb
  ) as policies
  from pg_policies
  where schemaname = 'public'
    and tablename = 'clients'
)
select
  (
    select jsonb_build_object(
      'id', id,
      'auth_id', auth_id,
      'email', email,
      'role', role,
      'client_id', client_id
    )
    from matching_profile
  ) as matching_profile,
  has_table_privilege('authenticated', 'public.clients', 'INSERT')
    as authenticated_can_insert_clients,
  has_table_privilege('authenticated', 'public.clients', 'SELECT')
    as authenticated_can_select_clients,
  relation.relrowsecurity as clients_rls_enabled,
  client_policies.policies
from pg_class as relation
cross join client_policies
where relation.oid = 'public.clients'::regclass;
