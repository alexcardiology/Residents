-- ============================================================
-- Resident Training & Assessment Portal — v1.0.58
-- Owner-only end-of-test-period reset controls.
--
-- This migration does NOT delete:
--   * profiles/accounts
--   * curriculum definitions (chapters, knowledge_items, skills)
--   * formal assessments or schedules
--   * resident e-logbook entries
--
-- It can delete:
--   * all observer/assessor reviews + review reconsideration data/messages
--   * all resident knowledge_progress, skill_levels and skill_logs
-- ============================================================

begin;

create or replace function public.owner_test_period_reset_preview_v1058()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_reviews bigint := 0;
  v_knowledge bigint := 0;
  v_skill_levels bigint := 0;
  v_skill_logs bigint := 0;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true;

  if v_role is distinct from 'owner' then
    raise exception 'Program Owner access required';
  end if;

  select count(*) into v_reviews from public.observer_reviews;
  select count(*) into v_knowledge from public.knowledge_progress;
  select count(*) into v_skill_levels from public.skill_levels;
  select count(*) into v_skill_logs from public.skill_logs;

  return jsonb_build_object(
    'reviews', v_reviews,
    'knowledge_progress', v_knowledge,
    'skill_levels', v_skill_levels,
    'skill_logs', v_skill_logs
  );
end;
$$;

create or replace function public.owner_reset_test_period_v1058(
  p_scope text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_scope text := lower(trim(coalesce(p_scope,'')));
  v_expected text;
  v_reviews_deleted bigint := 0;
  v_knowledge_deleted bigint := 0;
  v_skill_levels_deleted bigint := 0;
  v_skill_logs_deleted bigint := 0;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true;

  if v_role is distinct from 'owner' then
    raise exception 'Program Owner access required';
  end if;

  if v_scope not in ('reviews','learning','all') then
    raise exception 'Invalid reset scope';
  end if;

  v_expected := case v_scope
    when 'reviews' then 'RESET REVIEWS'
    when 'learning' then 'RESET LEARNING'
    else 'RESET TEST DATA'
  end;

  if upper(trim(coalesce(p_confirmation,''))) <> v_expected then
    raise exception 'Confirmation phrase does not match. Type % exactly.', v_expected;
  end if;

  if v_scope in ('reviews','all') then
    select count(*) into v_reviews_deleted from public.observer_reviews;

    -- Remove messages that are explicitly linked to reviews/reconsiderations.
    if to_regclass('public.review_message_links_v1051') is not null then
      execute $q$
        delete from public.private_messages pm
        using public.review_message_links_v1051 l
        where pm.id = l.message_id
      $q$;
      execute 'delete from public.review_message_links_v1051';
    end if;

    if to_regclass('public.review_reconsideration_message_links') is not null then
      execute $q$
        delete from public.private_messages pm
        using public.review_reconsideration_message_links l
        where pm.id::text = l.message_id
      $q$;
      execute 'delete from public.review_reconsideration_message_links';
    end if;

    -- Clean older review notifications that predate the link tables.
    delete from public.private_messages
    where subject ilike 'Review alert %'
       or subject ilike 'Clinical review alert %'
       or subject ilike 'Resident review %'
       or subject ilike 'Resident clinical review %'
       or subject ilike 'New review %'
       or subject ilike 'New clinical review %'
       or subject = 'Review reconsideration requested'
       or subject = 'Resident review reconsideration'
       or subject = 'Review reconsideration accepted'
       or subject = 'Review reconsideration outcome'
       or subject = 'Review reconsideration resolved';

    delete from public.observer_reviews;
  end if;

  if v_scope in ('learning','all') then
    select count(*) into v_knowledge_deleted from public.knowledge_progress;
    select count(*) into v_skill_levels_deleted from public.skill_levels;
    select count(*) into v_skill_logs_deleted from public.skill_logs;

    delete from public.knowledge_progress;
    delete from public.skill_levels;
    delete from public.skill_logs;
  end if;

  return jsonb_build_object(
    'scope', v_scope,
    'reviews_deleted', v_reviews_deleted,
    'knowledge_progress_deleted', v_knowledge_deleted,
    'skill_levels_deleted', v_skill_levels_deleted,
    'skill_logs_deleted', v_skill_logs_deleted,
    'learning_rows_deleted', v_knowledge_deleted + v_skill_levels_deleted + v_skill_logs_deleted
  );
end;
$$;

revoke all on function public.owner_test_period_reset_preview_v1058() from public, anon;
revoke all on function public.owner_reset_test_period_v1058(text,text) from public, anon;
grant execute on function public.owner_test_period_reset_preview_v1058() to authenticated;
grant execute on function public.owner_reset_test_period_v1058(text,text) to authenticated;

commit;
