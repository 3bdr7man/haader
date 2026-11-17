-- =====================================================================
-- منصة حاضر: الاستعلام عن المرشد التدريبي برقم المتدرب التدريبي
-- advisor_lookup(p_id): للمتدرب والمدرب ورئيس القسم ومسؤول المنصة (لا لحساب الاطلاع)
-- يعيد حالة الاستعلام واسم المرشد وحده — لا شيء آخر عن المتدرب:
--   empty | invalid | not_found | no_advisor | ok (+ name)
-- المصدر: بيانات الإرشاد في قاعدة البيانات (bosla/t<آخر رقم> ← bosla/adv)، والمتدرب
-- الموجود في كشوف الشعب دون مرشد مسجل يُعاد no_advisor.
-- =====================================================================
create or replace function advisor_lookup(p_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  role text := me_role();
  t text := translate(regexp_replace(coalesce(p_id, ''), '\s', '', 'g'), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  r jsonb; a jsonb; nm text;
begin
  if role is null and my_trainee() is null then raise exception 'سجّل الدخول أولاً.' using errcode = '42501'; end if;
  if role = 'viewer' then raise exception 'الاستعلام عن المرشد للمتدرب والمدرب ورئيس القسم.' using errcode = '42501'; end if;
  if t = '' then return jsonb_build_object('st', 'empty'); end if;
  if t !~ '^[0-9]{9}$' then return jsonb_build_object('st', 'invalid'); end if;
  select d.data->'rows'->t into r from doc d where d.col = 'bosla' and d.id = 't' || right(t, 1);
  if r is null or jsonb_typeof(r) <> 'object' then
    if exists (select 1 from doc d where d.col in ('sections', 'gsec') and d.data->'rows' @> jsonb_build_array(jsonb_build_object('id', t))) then
      return jsonb_build_object('st', 'no_advisor');
    end if;
    return jsonb_build_object('st', 'not_found');
  end if;
  if coalesce(btrim(r->>'adv'), '') = '' then return jsonb_build_object('st', 'no_advisor'); end if;
  select d.data->'rows'->(r->>'adv') into a from doc d where d.col = 'bosla' and d.id = 'adv';
  if a is null then return jsonb_build_object('st', 'no_advisor'); end if;
  nm := coalesce(nullif(btrim((select x.data->>'name' from doc x where x.col = 'accounts' and x.id = nullif(a->>'acct', ''))), ''), nullif(btrim(a->>'n'), ''));
  if nm is null then return jsonb_build_object('st', 'no_advisor'); end if;
  return jsonb_build_object('st', 'ok', 'name', nm);
end $$;
revoke all on function advisor_lookup(text) from public, anon;
grant execute on function advisor_lookup(text) to authenticated;
