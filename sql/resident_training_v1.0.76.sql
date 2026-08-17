-- Resident Training v1.0.76
-- 1) Case details for manual interventions are optional again.
-- 2) Manual interventions that bypass senior review may store no legacy supervisor_id.

alter table public.resident_logbook_entries
  alter column supervisor_id drop not null;

create or replace function public.enforce_recent_resident_logbook_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_today date;
  v_min_date date;
  v_case_count integer;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true;

  if v_role = 'resident' then
    v_today := (now() at time zone 'Africa/Cairo')::date;

    if new.activity_date is null then
      raise exception 'Activity date is required';
    end if;

    if new.activity_date > v_today then
      raise exception 'Activity date cannot be in the future';
    end if;

    if coalesce(new.activity_category,'') = 'conference' then
      v_min_date := v_today - 7;
      if new.activity_date < v_min_date then
        raise exception 'Conference activities must be recorded within 7 days of the conference';
      end if;
    else
      v_min_date := v_today - 2;
      if new.activity_date < v_min_date then
        raise exception 'New intervention activities must be recorded within 48 hours of the activity';
      end if;
    end if;

    if coalesce(new.activity_category,'') = 'manual_intervention' then
      v_case_count := greatest(1, coalesce(new.case_count, 1));

      -- Details are optional. Keep an empty array when nothing is supplied.
      if new.case_details is null then
        new.case_details := '[]'::jsonb;
      end if;

      if jsonb_typeof(new.case_details) <> 'array' then
        raise exception 'Case details must be an array';
      end if;

      if jsonb_array_length(new.case_details) > v_case_count then
        raise exception 'Case details cannot exceed the total number of cases';
      end if;

      -- Blank items are allowed. Only validate text that the resident actually entered.
      if exists (
        select 1
        from jsonb_array_elements_text(new.case_details) as item(detail)
        where trim(coalesce(detail,'')) <> ''
          and char_length(trim(detail)) < 3
      ) then
        raise exception 'If provided, each case detail must contain at least 3 characters';
      end if;
    end if;
  end if;

  return new;
end;
$function$;
