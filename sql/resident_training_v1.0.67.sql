-- Resident Training & Assessment v1.0.67
-- Owner can edit profile display names while preserving username/email/history.
-- Non-owner role/year management remains supported in the same atomic RPC.

begin;

create or replace function public.owner_manage_account_v1067(
  p_user_id uuid,
  p_display_name text,
  p_role text default null,
  p_residency_year smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles%rowtype;
  v_old_role text;
  v_old_year smallint;
  v_name text;
  v_new_role text;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
      and p.is_active = true
  ) then
    raise exception 'Owner access required';
  end if;

  v_name := btrim(coalesce(p_display_name, ''));
  if v_name = '' then
    raise exception 'Display name is required';
  end if;
  if char_length(v_name) > 120 then
    raise exception 'Display name is too long';
  end if;

  select * into v_target
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'Account not found';
  end if;

  v_old_role := v_target.role::text;
  v_old_year := v_target.residency_year;

  -- Owner account can be renamed, but its role cannot be changed here.
  if v_old_role = 'owner' then
    if p_role is not null and p_role <> 'owner' then
      raise exception 'The Program Owner role cannot be changed here';
    end if;
    update public.profiles
       set display_name = v_name
     where id = p_user_id;

    return jsonb_build_object(
      'user_id', p_user_id,
      'display_name', v_name,
      'old_role', v_old_role,
      'new_role', v_old_role,
      'old_year', v_old_year,
      'new_year', v_old_year
    );
  end if;

  v_new_role := coalesce(nullif(btrim(p_role), ''), v_old_role);
  if v_new_role not in ('resident', 'observer', 'assessor') then
    raise exception 'Role must be resident, observer or assessor';
  end if;

  if v_new_role = 'resident' and (p_residency_year is null or p_residency_year not between 1 and 5) then
    raise exception 'Choose resident Year 1 to Year 5';
  end if;

  update public.profiles
     set display_name = v_name
   where id = p_user_id;

  execute format(
    'update public.profiles set role = %L, residency_year = $1 where id = $2',
    v_new_role
  )
  using case when v_new_role = 'resident' then p_residency_year else null end, p_user_id;

  if v_new_role = 'resident' and (v_old_role <> 'resident' or v_old_year is distinct from p_residency_year) then
    update public.profiles
       set progression_status = default,
           reassessment_due = null
     where id = p_user_id;
  end if;

  if v_new_role <> 'assessor' then
    update public.assessor_year_assignments
       set is_active = false
     where assessor_id = p_user_id
       and is_active = true;

    if to_regclass('public.assessor_assignments') is not null then
      execute 'update public.assessor_assignments set is_active = false where assessor_id = $1 and is_active = true'
        using p_user_id;
    end if;
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'display_name', v_name,
    'old_role', v_old_role,
    'new_role', v_new_role,
    'old_year', v_old_year,
    'new_year', case when v_new_role = 'resident' then p_residency_year else null end
  );
end;
$$;

revoke all on function public.owner_manage_account_v1067(uuid, text, text, smallint)
  from public, anon;
grant execute on function public.owner_manage_account_v1067(uuid, text, text, smallint)
  to authenticated;

commit;
