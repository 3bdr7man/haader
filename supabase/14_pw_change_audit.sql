-- =====================================================================
-- منصة حاضر: تسجيل تغيير كلمة مرور حسابات المنصة (المدرب ورئيس القسم والمسؤول) في سجل الخادم
-- - زناد قبل doc_guard (الذي يحوّل البصمة إلى كلمة دخول ويحذفها من الوثيقة): كل تحديث لحساب فيه بصمة جديدة
--   يُسجَّل في audit بهوية المنفّذ ووقته. تغييره لكلمة مروره: pw-change، وتعيين المسؤول لكلمة مرور غيره: pw-set.
-- - لا تُسجَّل كلمة المرور ولا بصمتها. ومسار «نسيت كلمة المرور» (بلا جلسة) يسجل نفسه في 11 (pw-reset-done).
-- - وقت آخر تغيير يُحفظ في الحساب: pwAt.
-- =====================================================================
create or replace function pw_change_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); nm text; mine boolean;
begin
  if new.col <> 'accounts' or tg_op <> 'UPDATE' or me is null then return new; end if;
  if coalesce(new.data->>'hash', '') = '' then return new; end if;
  select name into nm from app_user where id = me;
  mine := exists (select 1 from app_user where id = me and legacy_id = new.id);
  new.data := new.data || jsonb_build_object('pwAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  insert into audit (by_id, by_name, act, det)
  values (me, nm, case when mine then 'pw-change' else 'pw-set' end,
          case when mine then 'غيّر كلمة مرور حسابه (' || coalesce(new.data->>'username', new.id) || ')'
               else 'عيّن كلمة مرور جديدة لحساب ' || coalesce(new.data->>'name', '') || ' (' || coalesce(new.data->>'username', new.id) || ')' end);
  return new;
end $$;
drop trigger if exists a1_pw_change_audit on doc;
create trigger a1_pw_change_audit before update on doc for each row when (new.col = 'accounts') execute function pw_change_audit();
revoke all on function pw_change_audit() from public, anon, authenticated;

-- سجل تغييرات كلمة المرور للعرض: المسؤول يرى الكل، وغيره يرى ما يخصه
create or replace function pw_change_log(p_limit int default 200) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'by', a.by_name, 'act', a.act, 'det', a.det) order by a.at desc), '[]'::jsonb)
  from (select * from audit where act in ('pw-change', 'pw-set', 'pw-reset-done', 'pw-reset-link')
          and (me_role() = 'admin' or by_id = auth.uid())
        order by at desc limit least(greatest(coalesce(p_limit, 200), 1), 500)) a
$$;
revoke all on function pw_change_log(int) from public, anon;
grant execute on function pw_change_log(int) to authenticated;
