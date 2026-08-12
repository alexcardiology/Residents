-- Resident Training v1.0.73
-- 1) Normal e-logbook senior picker: all active Year 2–5 residents.
-- 2) Batched intervention entries: total case count + optional detail per case.
-- 3) Owner intervention audit/PDF-ready data count actual cases, not only database rows.

begin;

alter table public.resident_logbook_entries
  add column if not exists case_count integer not null default 1,
  add column if not exists case_details jsonb not null default '[]'::jsonb;

update public.resident_logbook_entries
set case_count = 1
where case_count is null or case_count < 1;

update public.resident_logbook_entries
set case_details = '[]'::jsonb
where case_details is null;

alter table public.resident_logbook_entries
  drop constraint if exists resident_logbook_entries_case_count_check;

alter table public.resident_logbook_entries
  add constraint resident_logbook_entries_case_count_check
  check (case_count between 1 and 100);

-- Dedicated approver list for the current e-logbook.
-- Unlike Prior Experience, the normal e-logbook deliberately allows any active Year 2–5 resident as senior verifier.
create or replace function public.logbook_approvers_v1073()
returns table(
  id uuid,
  display_name text,
  residency_year integer,
  approver_group text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'resident' and p.is_active = true
  ) then
    raise exception 'Resident access required';
  end if;

  return query
  select p.id, p.display_name, p.residency_year::integer, 'senior_resident'::text
  from public.profiles p
  where p.role::text = 'resident'
    and p.is_active = true
    and p.residency_year between 2 and 5
    and p.id <> auth.uid()

  union all

  select p.id, p.display_name, p.residency_year::integer, 'assessor'::text
  from public.profiles p
  where p.role::text = 'assessor'
    and p.is_active = true
    and p.id <> auth.uid()

  order by 4, 2;
end;
$$;

revoke all on function public.logbook_approvers_v1073() from public, anon;
grant execute on function public.logbook_approvers_v1073() to authenticated;

-- Read wrapper: preserve all existing role-scoped visibility rules from get_logbook_entries_v2,
-- while appending the two new batch-case fields.
create or replace function public.get_logbook_entries_v1073(
  p_resident_id uuid default null,
  p_status text default null,
  p_activity_category text default null
)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(x)
         || jsonb_build_object(
              'case_count', coalesce(le.case_count, 1),
              'case_details', coalesce(le.case_details, '[]'::jsonb)
            )
  from public.get_logbook_entries_v2(p_resident_id, p_status, p_activity_category) as x
  left join public.resident_logbook_entries le on le.id = x.id;
$$;

revoke all on function public.get_logbook_entries_v1073(uuid,text,text) from public, anon;
grant execute on function public.get_logbook_entries_v1073(uuid,text,text) to authenticated;

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
  v_title text;
  v_activity_type text;
  v_participation_label text;
  v_case_count integer := greatest(1, least(100, coalesce(p_case_count,1)));
  v_case_details jsonb := coalesce(p_case_details, '[]'::jsonb);
  v_case_label text;
begin
  select p.display_name into v_resident_name
  from public.profiles p
  where p.id = auth.uid() and p.role::text = 'resident' and p.is_active = true;
  if v_resident_name is null then raise exception 'Resident access required'; end if;
  if p_activity_date is null or p_activity_date > current_date then raise exception 'Activity date must be today or earlier'; end if;

  if jsonb_typeof(v_case_details) <> 'array' then
    raise exception 'Case details must be an array';
  end if;

  if p_activity_category = 'conference' then
    if p_conference_participation not in ('attended','gave_speech') then raise exception 'Choose attended the conference or gave a speech'; end if;
    if char_length(trim(coalesce(p_conference_name,''))) < 3 then raise exception 'Conference name is required'; end if;
    if not exists (
      select 1 from public.profiles p where p.id = p_assessor_id
        and p.role::text = 'assessor' and p.is_active = true and p.id <> auth.uid()
    ) then raise exception 'Choose an active assessor'; end if;

    v_title := trim(p_conference_name);
    v_activity_type := case when p_conference_participation = 'attended' then 'conference_attendance' else 'conference_lecture' end;

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
    values (auth.uid(), p_assessor_id, 'Logbook approval request · Conference',
      v_resident_name || ' submitted conference activity "' || v_title ||
      '" for your approval. Open Logbook requests to review it.', v_id);

  elsif p_activity_category = 'manual_intervention' then
    if p_procedure_name not in (
      'CVP','Intubation','Temporary pacemaker','Permanent pacemaker implantation',
      'Pacemaker programming','ICD implantation','CRT implantation',
      'Pericardiocentesis','TEE','DSE','Coronary angiography','Elective PCI','Primary PCI','PCI','IVUS',
      'Rotablation','TAVI','ASD closure','Mitral balloon valvotomy',
      'Exercise stress ECG','Tilting table','Nuclear imaging','CT CA','CMR','CPR'
    ) then raise exception 'Choose a valid manual intervention'; end if;

    if p_participation_mode not in ('attended','failed_trial','assisted','solo_guided','solo_unguided') then
      raise exception 'Choose a valid participation level';
    end if;
    if p_hospital not in ('Miri','Smouha') then raise exception 'Choose Miri or Smouha hospital'; end if;
    if p_case_count is null or p_case_count < 1 or p_case_count > 100 then
      raise exception 'Total number of cases must be between 1 and 100';
    end if;
    if jsonb_array_length(v_case_details) > v_case_count then
      raise exception 'Case details cannot exceed the total number of cases';
    end if;
    if not exists (
      select 1 from public.profiles p where p.id = p_senior_resident_id
        and p.role::text = 'resident' and p.residency_year between 2 and 5
        and p.is_active = true and p.id <> auth.uid()
    ) then raise exception 'Choose an active Year 2–5 senior resident'; end if;
    if not exists (
      select 1 from public.profiles p where p.id = p_assessor_id
        and p.role::text = 'assessor' and p.is_active = true and p.id <> auth.uid()
    ) then raise exception 'Choose an active assessor'; end if;

    if p_procedure_name = 'PCI' then p_procedure_name := 'Elective PCI'; end if;

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
      'pending', 'pending', 'pending', v_case_count, v_case_details
    ) returning id into v_id;

    insert into public.private_messages(sender_id, receiver_id, subject, body, logbook_entry_id)
    values (
      auth.uid(), p_senior_resident_id, 'Logbook approval request · Senior',
      v_resident_name || ' submitted ' || v_title || ' · ' || v_case_label || ' · ' ||
      v_participation_label || ' at ' || p_hospital ||
      '. Please review this batch first. The assessor will receive it only after your approval.',
      v_id
    );
  else
    raise exception 'Choose manual intervention or conference';
  end if;

  return v_id;
end;
$$;

revoke all on function public.submit_logbook_entry_v1073(text,date,text,text,text,text,text,uuid,uuid,text,integer,jsonb) from public, anon;
grant execute on function public.submit_logbook_entry_v1073(text,date,text,text,text,text,text,uuid,uuid,text,integer,jsonb) to authenticated;

-- Backward compatibility: older cached clients still submit a single case through v2.
create or replace function public.submit_logbook_entry_v2(
  p_activity_category text,
  p_activity_date date,
  p_conference_participation text default null,
  p_conference_name text default null,
  p_procedure_name text default null,
  p_participation_mode text default null,
  p_hospital text default null,
  p_senior_resident_id uuid default null,
  p_assessor_id uuid default null,
  p_description text default null
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.submit_logbook_entry_v1073(
    p_activity_category, p_activity_date, p_conference_participation, p_conference_name,
    p_procedure_name, p_participation_mode, p_hospital, p_senior_resident_id,
    p_assessor_id, p_description, 1, '[]'::jsonb
  );
$$;

revoke all on function public.submit_logbook_entry_v2(text,date,text,text,text,text,text,uuid,uuid,text) from public, anon;
grant execute on function public.submit_logbook_entry_v2(text,date,text,text,text,text,text,uuid,uuid,text) to authenticated;

-- Fairness audit now counts individual cases inside approved batches.
create or replace function public.owner_intervention_audit_v1051()
returns table(
  resident_id uuid,
  resident_name text,
  residency_year integer,
  procedure_name text,
  procedure_order integer,
  attended_count bigint,
  trial_count bigint,
  success_count bigint,
  failed_count bigint,
  total_exposure bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id=auth.uid() and p.role::text='owner' and p.is_active=true
  ) then raise exception 'Program Owner access required'; end if;

  return query
  with procedures(name,ord) as (values
    ('CVP',1),('Intubation',2),('Temporary pacemaker',3),('Permanent pacemaker implantation',4),
    ('Pacemaker programming',5),('ICD implantation',6),('CRT implantation',7),('Pericardiocentesis',8),
    ('TEE',9),('DSE',10),('Coronary angiography',11),('Elective PCI',12),('Primary PCI',13),('IVUS',14),('Rotablation',15),
    ('TAVI',16),('ASD closure',17),('Mitral balloon valvotomy',18),
    ('Exercise stress ECG',19),('Tilting table',20),('Nuclear imaging',21),('CT CA',22),('CMR',23),('CPR',24)
  ), residents as (
    select p.id,p.display_name,p.residency_year::integer
    from public.profiles p
    where p.role::text='resident' and p.is_active=true
  ), agg as (
    select le.resident_id,
           coalesce(le.procedure_name,le.title) as procedure_name,
           coalesce(sum(case when le.status='approved' and le.participation_mode='attended' then greatest(coalesce(le.case_count,1),1) else 0 end),0)::bigint as attended_count,
           coalesce(sum(case when le.status='approved' and le.participation_mode in ('failed_trial','assisted','solo','solo_guided','solo_unguided') then greatest(coalesce(le.case_count,1),1) else 0 end),0)::bigint as trial_count,
           coalesce(sum(case when le.status='approved' and le.participation_mode in ('assisted','solo','solo_guided','solo_unguided') then greatest(coalesce(le.case_count,1),1) else 0 end),0)::bigint as success_count,
           coalesce(sum(case when le.status='approved' and le.participation_mode='failed_trial' then greatest(coalesce(le.case_count,1),1) else 0 end),0)::bigint as failed_count,
           coalesce(sum(case when le.status='approved' then greatest(coalesce(le.case_count,1),1) else 0 end),0)::bigint as total_exposure
    from public.resident_logbook_entries le
    where le.activity_category='manual_intervention'
    group by le.resident_id,coalesce(le.procedure_name,le.title)
  )
  select r.id,r.display_name,r.residency_year,p.name,p.ord,
         coalesce(a.attended_count,0),coalesce(a.trial_count,0),coalesce(a.success_count,0),coalesce(a.failed_count,0),coalesce(a.total_exposure,0)
  from residents r
  cross join procedures p
  left join agg a on a.resident_id=r.id and a.procedure_name=p.name
  order by r.residency_year,r.display_name,p.ord;
end;
$$;

revoke all on function public.owner_intervention_audit_v1051() from public, anon;
grant execute on function public.owner_intervention_audit_v1051() to authenticated;

commit;
