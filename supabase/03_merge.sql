-- دمج عميق للبيانات كما تفعل المنصة تماماً (update الجزئي لا يمسح بقية الحقول)
create or replace function jsonb_deep_merge(a jsonb, b jsonb) returns jsonb
language sql immutable as $$
  select case
    when a is null then b
    when b is null then a
    when jsonb_typeof(a) <> 'object' or jsonb_typeof(b) <> 'object' then b
    else (
      select coalesce(jsonb_object_agg(k, case
          when (a ? k) and (b ? k) then jsonb_deep_merge(a->k, b->k)
          when (b ? k) then b->k
          else a->k end), '{}'::jsonb)
      from (select jsonb_object_keys(a) as k union select jsonb_object_keys(b) as k) s
    ) end
$$;

create or replace function doc_merge(p_col text, p_id text, p_patch jsonb, p_crn text default null)
returns void language plpgsql security invoker set search_path = public as $$
begin
  insert into doc (col, id, data, crn, updated_at, updated_by)
  values (p_col, p_id, p_patch, p_crn, now(), auth.uid())
  on conflict (col, id) do update
    set data = jsonb_deep_merge(doc.data, excluded.data),
        crn = coalesce(excluded.crn, doc.crn),
        updated_at = now(),
        updated_by = auth.uid();
end $$;

-- البث اللحظي لتغيّرات الوثائق
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='doc') then
    alter publication supabase_realtime add table doc;
  end if;
end $$;
