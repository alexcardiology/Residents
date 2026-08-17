-- Allow Year 3 residents to bypass senior-resident verification when submitting
-- a manual logbook intervention, matching the existing Year 4-5 workflow.
-- Applied to production Supabase on 2026-08-17.

do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'submit_logbook_entry_v1073'
  limit 1;

  if v_definition is null then
    raise exception 'submit_logbook_entry_v1073 was not found';
  end if;

  if position('not in (4,5)' in v_definition) = 0 then
    raise exception 'Expected senior-skip gate was not found';
  end if;

  v_definition := replace(v_definition, 'not in (4,5)', 'not in (3,4,5)');
  v_definition := replace(v_definition, 'Year 1–3 residents', 'Year 1–2 residents');
  execute v_definition;
end
$migration$;
