-- Resident Training & Assessment Portal — v1.0.62
-- Review conversation threading support.
-- Links review reconsideration notifications to the same review topic so the
-- Inbox can render the original review, reconsideration and later changes as
-- one conversation thread.

begin;

create or replace function public.resident_request_review_reconsideration(
  p_review_id text,
  p_justification text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.observer_reviews%rowtype;
  v_resident_name text;
  v_owner_id uuid;
  v_reviewer_name text;
  v_resident_year smallint;
  v_message_id bigint;
begin
  select p.display_name, p.residency_year
    into v_resident_name, v_resident_year
  from public.profiles p
  where p.id = auth.uid() and p.role::text = 'resident' and p.is_active = true;
  if v_resident_name is null then raise exception 'Resident access required'; end if;
  if char_length(trim(coalesce(p_justification,''))) < 1 then
    raise exception 'Please write a reason for reconsideration';
  end if;

  select * into v_review
  from public.observer_reviews r
  where r.id::text = p_review_id and r.resident_id = auth.uid()
  for update;
  if not found then raise exception 'Review not found'; end if;
  if coalesce(v_review.reconsideration_status,'none') <> 'none' then
    raise exception 'A reconsideration workflow already exists for this review';
  end if;

  update public.observer_reviews
  set reconsideration_status = 'requested',
      reconsideration_text = trim(p_justification),
      reconsideration_requested_at = now(),
      reconsideration_resolved_at = null,
      reconsideration_note = null,
      updated_at = now()
  where id::text = p_review_id;

  select p.display_name into v_reviewer_name
  from public.profiles p where p.id = v_review.observer_id;

  select p.id into v_owner_id
  from public.profiles p
  where p.role::text='owner' and p.is_active=true
  order by p.created_at nulls last limit 1;

  -- Original reviewer: actionable reconsideration message.
  insert into public.private_messages(sender_id, receiver_id, subject, body)
  values (
    auth.uid(), v_review.observer_id,
    'Review reconsideration requested',
    'Resident: ' || v_resident_name || E'\n' ||
      'Review: ' || initcap(v_review.category) || E'\n' ||
      E'Reason:\n' || trim(p_justification) || E'\n\n' ||
      'Choose Accept & modify review or Keep original.'
  )
  returning id into v_message_id;

  insert into public.review_reconsideration_message_links(message_id, review_id)
  values (v_message_id::text, p_review_id)
  on conflict (message_id) do update set review_id = excluded.review_id;

  insert into public.review_message_links_v1051(message_id, review_id, recipient_id, purpose)
  values (v_message_id, p_review_id, v_review.observer_id, 'reconsideration_requested')
  on conflict (message_id) do update
    set review_id = excluded.review_id,
        recipient_id = excluded.recipient_id,
        purpose = excluded.purpose;

  -- Program Owner: same review conversation/topic.
  with inserted as (
    insert into public.private_messages(sender_id, receiver_id, subject, body)
    select auth.uid(), op.id,
      'Review reconsideration requested',
      v_resident_name || ' requested reconsideration of a review written by ' ||
        coalesce(v_reviewer_name,'Reviewer') || '. Reason: ' || trim(p_justification) || '.'
    from public.profiles op
    where op.role::text='owner' and op.is_active=true
    returning id, receiver_id
  )
  insert into public.review_message_links_v1051(message_id, review_id, recipient_id, purpose)
  select id, p_review_id, receiver_id, 'reconsideration_owner_update'
  from inserted
  on conflict (message_id) do update
    set review_id = excluded.review_id,
        recipient_id = excluded.recipient_id,
        purpose = excluded.purpose;

  -- Assigned assessors: same review conversation/topic. Anonymous identity is
  -- still masked by the review-reading RPC for non-owner users.
  with inserted as (
    insert into public.private_messages(sender_id, receiver_id, subject, body)
    select auth.uid(), aya.assessor_id,
      'Resident review reconsideration',
      v_resident_name || ' requested reconsideration of ' ||
        case when coalesce(v_review.is_anonymous,false) then 'an anonymous' else 'a named' end ||
        ' clinical review. Open Reviews to follow the outcome.'
    from public.assessor_year_assignments aya
    join public.profiles ap on ap.id=aya.assessor_id
    where aya.residency_year=v_resident_year
      and aya.is_active=true
      and ap.is_active=true
      and aya.assessor_id <> v_review.observer_id
    returning id, receiver_id
  )
  insert into public.review_message_links_v1051(message_id, review_id, recipient_id, purpose)
  select id, p_review_id, receiver_id, 'reconsideration_assessor_update'
  from inserted
  on conflict (message_id) do update
    set review_id = excluded.review_id,
        recipient_id = excluded.recipient_id,
        purpose = excluded.purpose;
end;
$$;

revoke all on function public.resident_request_review_reconsideration(text,text) from public, anon;
grant execute on function public.resident_request_review_reconsideration(text,text) to authenticated;

-- Backfill the directly-linked historical reconsideration messages.
insert into public.review_message_links_v1051(message_id, review_id, recipient_id, purpose)
select pm.id, l.review_id, pm.receiver_id, 'reconsideration_requested'
from public.review_reconsideration_message_links l
join public.private_messages pm on pm.id::text = l.message_id::text
join public.observer_reviews r on r.id::text = l.review_id
where pm.receiver_id is not null
on conflict (message_id) do update
set review_id = excluded.review_id,
    recipient_id = excluded.recipient_id,
    purpose = excluded.purpose;

-- Backfill owner/assigned-assessor reconsideration notifications created by
-- older versions. They were created in the same transaction as
-- reconsideration_requested_at, so a tight timestamp + resident-name match
-- safely associates them with the same review topic.
insert into public.review_message_links_v1051(message_id, review_id, recipient_id, purpose)
select pm.id,
       r.id::text,
       pm.receiver_id,
       case
         when p.role::text = 'owner' then 'reconsideration_owner_update'
         else 'reconsideration_assessor_update'
       end
from public.observer_reviews r
join public.profiles rp on rp.id = r.resident_id
join public.private_messages pm
  on pm.created_at between r.reconsideration_requested_at - interval '10 seconds'
                       and r.reconsideration_requested_at + interval '30 seconds'
 and pm.subject in ('Resident review reconsideration','Review reconsideration requested')
 and position(lower(rp.display_name) in lower(coalesce(pm.body,''))) > 0
join public.profiles p on p.id = pm.receiver_id
where r.reconsideration_requested_at is not null
  and pm.receiver_id is not null
on conflict (message_id) do nothing;

commit;
