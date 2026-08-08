-- Resident Training & Assessment v1.0.61
-- Fixes the v1.0.52 message-read triggers to use private_messages.read_at
-- (the real schema) instead of a nonexistent private_messages.is_read column.
-- Also improves review-reconsideration notifications and links them to review content.
-- Safe incremental migration after v1.0.60 / v1.0.59 hotfix.

begin;

-- ============================================================
-- 1) FIX ACTION -> MESSAGE READ STATE
-- private_messages exposes is_read through RPC as (read_at is not null).
-- The physical table column is read_at, NOT is_read.
-- ============================================================

create or replace function public.mark_logbook_request_read_on_decision_v1052()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.senior_status is distinct from new.senior_status
     and new.senior_status in ('approved','rejected')
     and new.senior_resident_id is not null then
    update public.private_messages
       set read_at = coalesce(read_at, now())
     where logbook_entry_id = new.id
       and receiver_id = new.senior_resident_id
       and read_at is null
       and subject like 'Logbook approval request%';
  end if;

  if old.assessor_status is distinct from new.assessor_status
     and new.assessor_status in ('approved','rejected')
     and new.assessor_id is not null then
    update public.private_messages
       set read_at = coalesce(read_at, now())
     where logbook_entry_id = new.id
       and receiver_id = new.assessor_id
       and read_at is null
       and subject like 'Logbook approval request%';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mark_logbook_request_read_v1052 on public.resident_logbook_entries;
create trigger trg_mark_logbook_request_read_v1052
after update of senior_status, assessor_status on public.resident_logbook_entries
for each row execute function public.mark_logbook_request_read_on_decision_v1052();

create or replace function public.mark_logbook_reconsideration_message_read_v1052()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
     and old.status = 'requested'
     and new.status in ('approved','rejected')
     and new.request_message_id is not null then
    update public.private_messages
       set read_at = coalesce(read_at, now())
     where id = new.request_message_id
       and read_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mark_logbook_reconsideration_message_read_v1052 on public.logbook_reconsiderations;
create trigger trg_mark_logbook_reconsideration_message_read_v1052
after update of status on public.logbook_reconsiderations
for each row execute function public.mark_logbook_reconsideration_message_read_v1052();

create or replace function public.mark_review_reconsideration_message_read_v1052()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.reconsideration_status is distinct from new.reconsideration_status
     and old.reconsideration_status = 'requested'
     and new.reconsideration_status in ('accepted','upheld') then
    update public.private_messages pm
       set read_at = coalesce(pm.read_at, now())
     where pm.id::text in (
       select l.message_id
       from public.review_reconsideration_message_links l
       where l.review_id = new.id::text
     )
       and pm.receiver_id = new.observer_id
       and pm.read_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mark_review_reconsideration_message_read_v1052 on public.observer_reviews;
create trigger trg_mark_review_reconsideration_message_read_v1052
after update of reconsideration_status on public.observer_reviews
for each row execute function public.mark_review_reconsideration_message_read_v1052();

-- ============================================================
-- 2) KEEP ORIGINAL REVIEW WHEN A RECONSIDERATION MODIFIES IT
-- ============================================================

alter table public.observer_reviews
  add column if not exists pre_reconsideration_comment text,
  add column if not exists pre_reconsideration_sentiment text;

-- ============================================================
-- 3) REVIEW RESOLUTION: CLEAR WORDING + OWNER SEES CONTENT
-- ============================================================

create or replace function public.reviewer_resolve_review_reconsideration(
  p_review_id text,
  p_decision text,
  p_comment text default null,
  p_sentiment text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.observer_reviews%rowtype;
  v_reviewer_name text;
  v_resident_name text;
  v_resident_year smallint;
  v_owner_id uuid;
  v_sender uuid;
  v_visible_author text;
  v_final_comment text;
  v_final_sentiment text;
  v_response_note text;
  v_message_id bigint;
  v_domain text;
  v_category_label text;
begin
  if p_decision not in ('accepted','upheld') then
    raise exception 'Decision must be accepted or upheld';
  end if;

  select p.display_name into v_reviewer_name
  from public.profiles p
  where p.id=auth.uid() and p.is_active=true and p.role::text in ('observer','assessor');
  if v_reviewer_name is null then raise exception 'Reviewer access required'; end if;

  select * into v_review
  from public.observer_reviews r
  where r.id::text=p_review_id and r.observer_id=auth.uid()
  for update;
  if not found then raise exception 'Review not found or you are not its author'; end if;
  if coalesce(v_review.reconsideration_status,'none') <> 'requested' then
    raise exception 'There is no open reconsideration request';
  end if;

  v_final_comment := v_review.comment;
  v_final_sentiment := coalesce(v_review.sentiment,'positive');
  v_response_note := nullif(trim(coalesce(p_note,'')), '');

  if p_decision='accepted' then
    if char_length(trim(coalesce(p_comment,''))) < 10 then
      raise exception 'Updated comment must contain at least 10 characters';
    end if;
    if p_sentiment not in ('positive','negative') then
      raise exception 'Choose positive or negative feedback';
    end if;
    v_final_comment := trim(p_comment);
    v_final_sentiment := p_sentiment;
    v_response_note := null;

    update public.observer_reviews
       set pre_reconsideration_comment = coalesce(pre_reconsideration_comment, comment),
           pre_reconsideration_sentiment = coalesce(pre_reconsideration_sentiment, sentiment)
     where id::text=p_review_id;
  else
    if char_length(trim(coalesce(p_note,''))) < 2 then
      raise exception 'Write a response note explaining why the original review remains appropriate';
    end if;
  end if;

  update public.observer_reviews
  set comment=v_final_comment,
      sentiment=v_final_sentiment,
      reconsideration_status=p_decision,
      reconsideration_resolved_at=now(),
      reconsideration_note=v_response_note,
      updated_at=now()
  where id::text=p_review_id;

  select p.display_name, p.residency_year
    into v_resident_name, v_resident_year
  from public.profiles p where p.id=v_review.resident_id;

  select p.id into v_owner_id
  from public.profiles p
  where p.role::text='owner' and p.is_active=true
  order by p.created_at nulls last limit 1;
  if v_owner_id is null then raise exception 'Active Program Owner required'; end if;

  v_visible_author := case when coalesce(v_review.is_anonymous,false) then 'Anonymous reviewer' else v_reviewer_name end;
  v_sender := case when coalesce(v_review.is_anonymous,false) then v_owner_id else auth.uid() end;
  v_domain := case when v_review.category='attitude' then 'behavioural' else 'clinical' end;
  v_category_label := case when v_review.category='attitude' then 'behaviour' else v_review.category end;

  -- Resident outcome message, linked to the actual review.
  insert into public.private_messages(sender_id, receiver_id, subject, body)
  values (
    v_sender,
    v_review.resident_id,
    case when p_decision='accepted' then 'Review modified after reconsideration 💡' else 'Review reconsideration outcome' end,
    case when p_decision='accepted' then
      v_visible_author || ' accepted your reconsideration and modified the ' || v_domain || ' review.' ||
      E'\nUpdated review: ' || v_final_comment
    else
      v_visible_author || ' kept the original ' || v_domain || ' review.' || E'\nReason: ' || v_response_note
    end
  ) returning id into v_message_id;

  insert into public.review_message_links_v1051(message_id,review_id,recipient_id,purpose)
  values (v_message_id,p_review_id,v_review.resident_id,'resident_resolution')
  on conflict (message_id) do nothing;

  -- Owner always sees the real author AND the review content.
  insert into public.private_messages(sender_id, receiver_id, subject, body)
  values (
    auth.uid(),
    v_owner_id,
    case when p_decision='accepted' then 'Review modified after reconsideration 💡' else 'Review reconsideration upheld' end,
    case when p_decision='accepted' then
      v_reviewer_name || ' modified ' || v_resident_name || '''s ' || v_domain || ' / ' || v_category_label || ' review after reconsideration.' ||
      E'\nOriginal review: ' || coalesce(v_review.comment,'—') ||
      E'\nUpdated review: ' || v_final_comment ||
      E'\nType: ' || v_final_sentiment ||
      E'\nPlace: ' || coalesce(v_review.place,'—') ||
      E'\nDate: ' || to_char(v_review.observed_on,'DD/MM/YYYY')
    else
      v_reviewer_name || ' kept the original review for ' || v_resident_name || '.' ||
      E'\nReview: ' || coalesce(v_review.comment,'—') ||
      E'\nReason: ' || v_response_note
    end
  ) returning id into v_message_id;

  insert into public.review_message_links_v1051(message_id,review_id,recipient_id,purpose)
  values (v_message_id,p_review_id,v_owner_id,'owner_resolution')
  on conflict (message_id) do nothing;

  -- Other assigned assessors receive a linked notification, preserving anonymity.
  with inserted as (
    insert into public.private_messages(sender_id, receiver_id, subject, body)
    select
      case when coalesce(v_review.is_anonymous,false) then v_owner_id else auth.uid() end,
      aya.assessor_id,
      case when p_decision='accepted' then 'Resident review modified 💡' else 'Review reconsideration outcome' end,
      case when p_decision='accepted' then
        'The ' || v_domain || ' review for ' || v_resident_name || ' was modified after reconsideration. Open Reviews for the updated content.'
      else
        'The original ' || v_domain || ' review for ' || v_resident_name || ' was upheld. Open Reviews for the full record.'
      end
    from public.assessor_year_assignments aya
    join public.profiles ap on ap.id=aya.assessor_id
    where aya.residency_year=v_resident_year and aya.is_active=true and ap.is_active=true
      and aya.assessor_id <> auth.uid()
    returning id, receiver_id
  )
  insert into public.review_message_links_v1051(message_id,review_id,recipient_id,purpose)
  select id,p_review_id,receiver_id,'assessor_resolution' from inserted
  on conflict (message_id) do nothing;
end;
$$;

revoke all on function public.reviewer_resolve_review_reconsideration(text,text,text,text,text) from public, anon;
grant execute on function public.reviewer_resolve_review_reconsideration(text,text,text,text,text) to authenticated;

-- ============================================================
-- 4) REVIEW-ACTION PAYLOAD: include preserved pre-modification content
-- ============================================================

create or replace function public.get_my_review_message_actions_v1051()
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true;
  if v_role is null then raise exception 'Active account required'; end if;

  return query
  select jsonb_build_object(
    'message_id', l.message_id,
    'review_id', r.id::text,
    'resident_id', r.resident_id,
    'resident_name', rp.display_name,
    'category', r.category,
    'observed_on', r.observed_on,
    'place', r.place,
    'comment', r.comment,
    'pre_reconsideration_comment', r.pre_reconsideration_comment,
    'pre_reconsideration_sentiment', r.pre_reconsideration_sentiment,
    'sentiment', coalesce(r.sentiment,'positive'),
    'is_anonymous', coalesce(r.is_anonymous,false),
    'observer_signature',
      case
        when coalesce(r.is_anonymous,false) and v_role <> 'owner' and r.observer_id <> auth.uid()
          then 'Anonymous reviewer'
        else coalesce(op.display_name, r.observer_signature, 'Reviewer')
      end,
    'display_observer',
      case
        when coalesce(r.is_anonymous,false) and v_role <> 'owner' and r.observer_id <> auth.uid()
          then 'Anonymous reviewer'
        else coalesce(op.display_name, r.observer_signature, 'Reviewer')
      end,
    'reconsideration_status', coalesce(r.reconsideration_status,'none'),
    'reconsideration_text', r.reconsideration_text,
    'reconsideration_note', r.reconsideration_note,
    'updated_at', r.updated_at,
    'purpose', l.purpose
  )
  from public.review_message_links_v1051 l
  join public.private_messages m on m.id = l.message_id
  join public.observer_reviews r on r.id::text = l.review_id
  join public.profiles rp on rp.id = r.resident_id
  left join public.profiles op on op.id = r.observer_id
  where l.recipient_id = auth.uid()
    and m.receiver_id = auth.uid();
end;
$$;

revoke all on function public.get_my_review_message_actions_v1051() from public, anon;
grant execute on function public.get_my_review_message_actions_v1051() to authenticated;

commit;
