-- منصة حاضر — 05: تشديد بعد مراجعة مستشار الأمان في Supabase
-- الدوال المساعدة لا تُستدعى دون دخول، ودوال الزناد لا تُستدعى مباشرة، ومسار البحث ثابت.
revoke execute on function doc_log_mine(text), doc_may_edit(text, text), doc_may_see(text, text), doc_trainer(text),
  is_admin(), is_staff_read(), may_edit(text), may_see(text), me_role(), my_legacy(), owns_section(text) from public, anon;
grant execute on function doc_log_mine(text), doc_may_edit(text, text), doc_may_see(text, text), doc_trainer(text),
  is_admin(), is_staff_read(), may_edit(text), may_see(text), me_role(), my_legacy(), owns_section(text) to authenticated;
revoke execute on function doc_guard(), auth_block_signup() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
alter function jsonb_deep_merge(jsonb, jsonb) set search_path = public;
alter function doc_global(text) set search_path = public;
alter function haader_email(text, text) set search_path = public;
