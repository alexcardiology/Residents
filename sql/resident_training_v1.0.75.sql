-- Resident Training v1.0.75
-- Normal E-logbook senior selection improvements.
-- 1) The frontend now uses an instant searchable senior list.
-- 2) Residents in Year 4 or Year 5 may omit the senior-resident stage and route
--    a manual intervention directly to the selected assessor.
-- Years 1–3 still require an active Year 2–5 senior resident.

begin;

create or replace function public.submit_logbook_entry_v1073(
  p_activity_category text,
  p_activity_date date,
  p_conference_participation text default null,
  p_conference_name text default null,
  p_procedure_name text default null,
  p_participation_mode text default null,
  p_hospital text default null,
  p_senior_resident_id uuid default null,
  p_assessor_id uuid default null,
  p_description text default null,
  p_case_count integer default 1,
  p_case_details jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_resident_name text;
  v_residency_year integer;
  v_title text;
  v_activity_type text;
  v_participation_label text;
  v_case_count integer := greatest(1, least(100, coalesce(p_case_count,1)));
  v_case_details jsonb := coalesce(p_case_details, '[]'::jsonb);
  v_case_label text;
  v_skip_senior boolean := false;
begin
  select p.display_name, p.residency_year::integer
    into v_resident_name, v_residency_year
  from public.profiles p
  where p.id = auth.uid()
    and p.role::text = 'resident'
    and p.is_active = true;

  if v_resident_name is null then
    raise exception 'Resident access required';
  end if;
  if p_activity_date is null or p_activity_date > current_date then
    raise exception 'Activity date must be today or earlier';
  end if;

  if jsonb_typeof(v_case_details) <> 'array' then
    raise exception 'Case details must be an array';
  end if;

  if p_activity_category = 'conference' then
    if p_conference_participation not in ('attended','gave_speech') then
      raise exception 'Choose attended the conference or gave a speech';
    end if;
    if char_length(trim(coalesce(p_conference_name,''))) < 3 then
      raise exception 'Conference name is required';
    end if;
    if not exists (
      select 1
      from public.profiles p
      where p.id = p_assessor_id
        and p.role::text = 'assessor'
        and p.is_active = true
        and p.id <> auth.uid()
    ) then
      raise exception 'Choose an active assessor';
    end if;

    v_title := trim(p_conference_name);
    v_activity_type := case when p_conference_participation = 'attended'
      then 'conference_attendance' else 'conference_lecture' end;

    insert into public.resident_logbook_entries (
      resident_id, activity_type, title, activity_date, institution_or_event,
      description, supervisor_id, activity_category, conference_participation,
      assessor_id, assessor_status, status, case_count, case_details
    ) values (
      auth.uid(), v_activity_type, v_title, p_activity_date, v_title,
      nullif(trim(p_description),''), p_assessor_id, 'conference',
      p_conference_participation, p_assessor_id, 'pending', 'pending', 1, '[]'::jsonb
    ) returning id into v_id;

    insert into public.private_messages(sender_id, receiver_id, subject, body, logbook_entry_id)
    values (
      auth.uid(), p_assessor_id, 'Logbook approval request · Conference',
      v_resident_name || ' submitted conference activity "' || v_title ||
      '" for your approval. Open Logbook requests to review it.', v_id
    );

  elsif p_activity_category = 'manual_intervention' then
    if p_procedure_name not in (
      'CVP','Intubation','Temporary pacemaker','Permanent pacemaker implantation',
      'Pacemaker programming','ICD implantation','CRT implantation',
      'Pericardiocentesis','TEE','DSE','Coronary angiography','Elective PCI','Primary PCI','PCI','IVUS',
      'Rotablation','TAVI','ASD closure','Mitral balloon valvotomy',
      'Exercise stress ECG','Tilting table','Nuclear imaging','CT CA','CMR','CPR'
    ) then
      raise exception 'Choose a valid manual intervention';
    end if;

    if p_participation_mode not in ('attended','failed_trial','assisted','solo_guided','solo_unguided') then
      raise exception 'Choose a valid participation level';
    end if;
    if p_hospital not in ('Miri','Smouha') then
      raise exception 'Choose Miri or Smouha hospital';
    end if;
    if p_case_count is null or p_case_count < 1 or p_case_count > 100 then
      raise exception 'Total number of cases must be between 1 and 100';
    end if;
    if jsonb_array_length(v_case_details) > v_case_count then
      raise exception 'Case details cannot exceed the total number of cases';
    end if;
    if not exists (
      select 1
      from public.profiles p
      where p.id = p_assessor_id
        and p.role::text = 'assessor'
        and p.is_active = true
        and p.id <> auth.uid()
    ) then
      raise exception 'Choose an active assessor';
    end if;

    v_skip_senior := p_senior_resident_id is null;

    if v_skip_senior then
      if coalesce(v_residency_year, 0) not in (4,5) then
        raise exception 'A senior resident is required for Year 1–3 residents';
      end if;
    else
      if not exists (
        select 1
        from public.profiles p
        where p.id = p_senior_resident_id
          and p.role::text = 'resident'
          and p.residency_year between 2 and 5
          and p.is_active = true
          and p.id <> auth.uid()
      ) then
        raise exception 'Choose an active senior resident';
      end if;
    end if;

    if p_procedure_name = 'PCI' then
      p_procedure_name := 'Elective PCI';
    end if;

    v_title := p_procedure_name;
    v_participation_label := case p_participation_mode
      when 'attended' then 'Attended'
      when 'failed_trial' then 'Failed trial'
      when 'assisted' then 'Performed with assistance'
      when 'solo_guided' then 'Performed solo under guidance'
      when 'solo_unguided' then 'Performed solo without guidance'
    end;
    v_case_label := v_case_count::text || case when v_case_count = 1 then ' case' else ' cases' end;

    insert into public.resident_logbook_entries (
      resident_id, activity_type, title, activity_date, institution_or_event,
      location, description, resident_role, supervisor_id,
      activity_category, procedure_name, participation_mode, hospital,
      senior_resident_id, assessor_id, senior_status, assessor_status, status,
      case_count, case_details
    ) values (
      auth.uid(), 'procedure', v_title, p_activity_date, p_hospital,
      p_hospital, nullif(trim(p_description),''), p_participation_mode,
      p_senior_resident_id, 'manual_intervention', p_procedure_name,
      p_participation_mode, p_hospital, p_senior_resident_id, p_assessor_id,
      case when v_skip_senior then 'approved' else 'pending' end,
      'pending', 'pending', v_case_count, v_case_details
    ) returning id into v_id;

    if v_skip_senior then
      insert into public.private_messages(sender_id, receiver_id, subject, body, logbook_entry_id)
      values (
        auth.uid(), p_assessor_id, 'Logbook approval request · Assessor',
        v_resident_name || ' submitted ' || v_title || ' · ' || v_case_label || ' · ' ||
        v_participation_label || ' at ' || p_hospital ||
        '. Senior-resident verification is not required for this Year ' || v_residency_year ||
        ' submission. Please provide the assessor decision.',
        v_id
      );
    else
      insert into public.private_messages(sender_id, receiver_id, subject, body, logbook_entry_id)
      values (
        auth.uid(), p_senior_resident_id, 'Logbook approval request · Senior',
        v_resident_name || ' submitted ' || v_title || ' · ' || v_case_label || ' · ' ||
        v_participation_label || ' at ' || p_hospital ||
        '. Please review this batch first. The assessor will receive it only after your approval.',
        v_id
      );
    end if;
  else
    raise exception 'Choose manual intervention or conference';
  end if;

  return v_id;
end;
$$;

revoke all on function public.submit_logbook_entry_v1073(text,date,text,text,text,text,text,uuid,uuid,text,integer,jsonb) from public, anon;
grant execute on function public.submit_logbook_entry_v1073(text,date,text,text,text,text,text,uuid,uuid,text,integer,jsonb) to authenticated;

commit;
