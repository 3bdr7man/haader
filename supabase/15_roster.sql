-- =====================================================================
-- منصة حاضر: إدارة الشعب والمتدربين (الإدراج اليدوي واستيراد Excel وPDF) مع مزامنة واحدة لكل المنصة
-- - البيانات الأساسية للمتدرب مرة واحدة في جدول trainee (الرقم، الاسم، البريد، الجوال)،
--   وتسجيله في الشعبة في وثيقة الشعبة (sections/<crn>.rows) كما تعمل عليه المنصة كلها.
-- - roster_apply: يُنشئ الشعبة الجديدة للمدرب نفسه، ويضيف المتدربين إلى شعبه وحدها، ويزامنهم آلياً
--   إلى قائمة رصد الدرجات (gsec) للشعبة نفسها أو للنظرية المقابلة لها، فيظهرون في التحضير والدرجات
--   وظهور الدرجات والتقارير ولوحات المعلومات دون إعادة إدخال.
-- - لا حذف ولا استبدال: المتدرب الموجود يبقى كما هو، واسمه المحفوظ لا يتغير (يُبلَّغ عن الاختلاف).
-- - كل عملية تُسجَّل في roster_import وفي audit.
-- =====================================================================
alter table trainee add column if not exists email text;
alter table trainee add column if not exists mobile text;
alter table trainee add column if not exists updated_at timestamptz default now();

create table if not exists roster_import (
  id text primary key,
  at timestamptz not null default now(),
  by_id uuid, by_name text,
  file text, kind text,
  n_secs int not null default 0, n_new_secs int not null default 0,
  n_rows int not null default 0, n_added int not null default 0, n_existing int not null default 0, n_bad int not null default 0,
  secs jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb
);
alter table roster_import enable row level security;

create or replace function roster_mobile(p text) returns text
language sql immutable set search_path = public as $$
  select case
    when v ~ '^05[0-9]{8}$' then v
    when v ~ '^5[0-9]{8}$' then '0' || v
    when v ~ '^9665[0-9]{8}$' then '0' || substr(v, 4)
    when v ~ '^009665[0-9]{8}$' then '0' || substr(v, 6)
    else null end
  from (select regexp_replace(translate(coalesce(p, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g') as v) x
$$;

create or replace function roster_apply(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  role text := me_role(); me text := my_legacy(); nm text;
  s jsonb; r jsonb; v_crn text; d jsonb; owner text; ok_secs jsonb := '{}'::jsonb; sec_res jsonb := '[]'::jsonb; bad jsonb := '[]'::jsonb;
  tid text; tname text; em text; mob text; eb text; cur text; g record; n_new int := 0; n_added int := 0; n_exist int := 0; n_rows int := 0;
  iid text := 'RI' || to_char(now() at time zone 'utc', 'YYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4);
  org jsonb := coalesce((select data from doc where col = 'meta' and id = 'org'), '{}'::jsonb); ord int;
begin
  if role is null or role not in ('admin', 'trainer') then raise exception 'إدارة الشعب والمتدربين للمدرب ومسؤول المنصة.' using errcode = '42501'; end if;
  select name into nm from app_user where id = auth.uid();
  perform set_config('haader.sys', '1', true);

  -- 1) الشعب: تُنشأ الجديدة باسم المدرب، والقائمة يُشترط أن تكون له (أو للمسؤول)
  for s in select x from jsonb_array_elements(coalesce(p->'secs', '[]'::jsonb)) x loop
    v_crn := btrim(coalesce(s->>'crn', ''));
    if v_crn !~ '^[0-9]{5}$' then bad := bad || jsonb_build_object('crn', v_crn, 'msg', 'رقم الشعبة 5 أرقام.'); continue; end if;
    select data into d from doc where col = 'sections' and id = v_crn;
    if d is not null then
      owner := d->>'trainer';
      if role <> 'admin' and coalesce(owner, '') <> me then
        bad := bad || jsonb_build_object('crn', v_crn, 'msg', format('الشعبة %s مسندة إلى مدرب آخر، فلا تُعدَّل من حسابك.', v_crn));
        sec_res := sec_res || jsonb_build_object('crn', v_crn, 'st', 'denied'); continue;
      end if;
      -- لا يُستبدل ما هو محفوظ: تُكمَّل الحقول الفارغة فقط
      update doc set data = data
        || case when coalesce(data->>'code', '') = '' and coalesce(s->>'code', '') <> '' then jsonb_build_object('code', s->>'code') else '{}'::jsonb end
        || case when coalesce(data->>'term', '') = '' and coalesce(s->>'term', '') <> '' then jsonb_build_object('term', s->>'term') else '{}'::jsonb end
        || case when coalesce(data->>'year', '') = '' and coalesce(s->>'year', '') <> '' then jsonb_build_object('year', s->>'year') else '{}'::jsonb end
      where col = 'sections' and id = v_crn;
      ok_secs := ok_secs || jsonb_build_object(v_crn, true);
      sec_res := sec_res || jsonb_build_object('crn', v_crn, 'st', 'existing');
    else
      if coalesce(btrim(s->>'course'), '') = '' then bad := bad || jsonb_build_object('crn', v_crn, 'msg', format('الشعبة %s: اسم المقرر مطلوب لإنشائها.', v_crn)); continue; end if;
      select coalesce(max((data->>'order')::int), 0) + 1 into ord from doc where col = 'sections';
      insert into doc (col, id, data) values ('sections', v_crn, jsonb_strip_nulls(jsonb_build_object(
        'crn', v_crn, 'order', ord, 'course', btrim(s->>'course'), 'code', nullif(btrim(coalesce(s->>'code', '')), ''),
        'kind', case when s->>'kind' in ('نظري', 'عملي') then s->>'kind' else 'نظري' end,
        'term', nullif(s->>'term', ''), 'year', nullif(s->>'year', ''),
        'sheet', btrim(s->>'course') || ' ' || v_crn,
        'title', coalesce(nullif(left(btrim(coalesce(s->>'title', '')), 300), ''), btrim(s->>'course') || ' — شعبة ' || case when s->>'kind' = 'عملي' then 'عملي' else 'نظري' end || ' رقم ' || v_crn),
        'meets', coalesce(s->'meets', '[]'::jsonb), 'dates', coalesce(s->'dates', '[]'::jsonb), 'rows', '[]'::jsonb,
        'trainer', case when role = 'admin' then coalesce(nullif(s->>'trainer', ''), me) else me end,
        'spec', coalesce(nullif(s->>'spec', ''), org->>'defaultSpec'), 'dept', org->>'dept',
        'pair', nullif(s->>'pair', ''), 'src', jsonb_build_object('import', iid, 'kind', p->>'kind', 'file', p->>'file'))));
      insert into doc (col, id, data) values ('marks', v_crn, '{"m":{}}'::jsonb) on conflict (col, id) do nothing;
      insert into doc (col, id, data) values ('notes', v_crn, '{"n":{}}'::jsonb) on conflict (col, id) do nothing;
      n_new := n_new + 1; ok_secs := ok_secs || jsonb_build_object(v_crn, true);
      sec_res := sec_res || jsonb_build_object('crn', v_crn, 'st', 'created');
    end if;
  end loop;

  -- 2) المتدربون: البيانات الأساسية مرة واحدة، والتسجيل في الشعبة ثم المزامنة إلى قوائم الدرجات
  for r in select x from jsonb_array_elements(coalesce(p->'rows', '[]'::jsonb)) x loop
    n_rows := n_rows + 1;
    v_crn := btrim(coalesce(r->>'crn', ''));
    tid := translate(btrim(coalesce(r->>'id', '')), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
    tname := regexp_replace(btrim(coalesce(r->>'name', '')), '\s+', ' ', 'g');
    if not (ok_secs ? v_crn) then
      if not exists (select 1 from doc where col = 'sections' and id = v_crn and (role = 'admin' or data->>'trainer' = me)) then
        bad := bad || jsonb_build_object('crn', v_crn, 'id', tid, 'msg', format('الشعبة %s غير موجودة أو غير مسندة إليك.', v_crn)); continue;
      end if;
      ok_secs := ok_secs || jsonb_build_object(v_crn, true);
    end if;
    if tid !~ '^[0-9]{9}$' then bad := bad || jsonb_build_object('crn', v_crn, 'id', tid, 'name', tname, 'msg', 'الرقم التدريبي 9 أرقام.'); continue; end if;
    if length(tname) < 5 or tname ~ '[0-9]' then bad := bad || jsonb_build_object('crn', v_crn, 'id', tid, 'name', tname, 'msg', 'اسم المتدرب ناقص أو غير صحيح.'); continue; end if;
    em := lower(btrim(coalesce(r->>'email', ''))); eb := email_blocked(em);
    if em <> '' and eb is not null then
      bad := bad || jsonb_build_object('crn', v_crn, 'id', tid, 'name', tname, 'warn', true, 'msg', case eb when 'gov' then 'البريد الرسمي tvtc.gov.sa لا يُحفظ؛ أُدرج المتدرب دون بريد.' when 'owner' then 'هذا البريد مستبعد؛ أُدرج المتدرب دون بريد.' else 'البريد غير صحيح؛ أُدرج المتدرب دون بريد.' end);
      em := '';
    end if;
    mob := roster_mobile(r->>'mobile');
    if coalesce(btrim(r->>'mobile'), '') <> '' and mob is null then
      bad := bad || jsonb_build_object('crn', v_crn, 'id', tid, 'name', tname, 'warn', true, 'msg', 'رقم الجوال غير صحيح (05xxxxxxxx)؛ أُدرج المتدرب دونه.');
    end if;
    select name into cur from trainee where id = tid;
    insert into trainee (id, name, email, mobile, updated_at) values (tid, tname, nullif(em, ''), mob, now())
      on conflict (id) do update set email = coalesce(excluded.email, trainee.email), mobile = coalesce(excluded.mobile, trainee.mobile), updated_at = now();
    if cur is not null and cur <> tname then
      bad := bad || jsonb_build_object('crn', v_crn, 'id', tid, 'name', tname, 'warn', true, 'msg', format('الاسم المحفوظ «%s» يختلف عن «%s»؛ بقي المحفوظ.', cur, tname));
    end if;
    -- التسجيل في الشعبة (لا يتكرر)
    if exists (select 1 from doc where col = 'sections' and id = v_crn and data->'rows' @> jsonb_build_array(jsonb_build_object('id', tid))) then
      n_exist := n_exist + 1;
    else
      update doc set data = jsonb_set(data, '{rows}', coalesce(data->'rows', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', tid, 'name', coalesce(cur, tname))))
        where col = 'sections' and id = v_crn;
      n_added := n_added + 1;
    end if;
    -- المزامنة إلى قوائم رصد الدرجات: شعبة الرصد نفسها أو النظرية المقابلة للعملية
    for g in select id from doc where col = 'gsec' and (id = v_crn or data->>'pair' = v_crn) loop
      update doc set data = jsonb_set(data, '{rows}', coalesce(data->'rows', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', tid, 'name', coalesce(cur, tname), 'el', true, 'st', 'مسجل', 'hrs', null, 'last', '')))
        where col = 'gsec' and id = g.id and not (data->'rows' @> jsonb_build_array(jsonb_build_object('id', tid)));
    end loop;
  end loop;

  perform set_config('haader.sys', '', true);
  insert into roster_import (id, by_id, by_name, file, kind, n_secs, n_new_secs, n_rows, n_added, n_existing, n_bad, secs, errors)
  values (iid, auth.uid(), nm, left(coalesce(p->>'file', ''), 200), coalesce(p->>'kind', 'manual'),
          jsonb_array_length(sec_res), n_new, n_rows, n_added, n_exist,
          (select count(*) from jsonb_array_elements(bad) b where not coalesce((b->>'warn')::boolean, false)), sec_res, bad);
  insert into audit (by_id, by_name, act, det)
  values (auth.uid(), nm, 'roster', format('%s %s: شعب جديدة %s، متدربون أُضيفوا %s، موجودون %s، أخطاء %s', iid, coalesce(p->>'kind', 'manual'), n_new, n_added, n_exist, jsonb_array_length(bad)));
  return jsonb_build_object('id', iid, 'secs', sec_res, 'added', n_added, 'existing', n_exist, 'new_secs', n_new, 'rows', n_rows, 'bad', bad);
end $$;
revoke all on function roster_apply(jsonb) from public, anon;
grant execute on function roster_apply(jsonb) to authenticated;

create or replace function roster_imports(p_limit int default 50) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) - 'by_id' order by x.at desc), '[]'::jsonb)
  from (select * from roster_import where me_role() = 'admin' or by_id = auth.uid() order by at desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) x
$$;
revoke all on function roster_imports(int) from public, anon;
grant execute on function roster_imports(int) to authenticated;

-- بيانات الاتصال للمتدربين في شعب المدرب (للنموذج والمراجعة): البريد والجوال من السجل الأساسي
create or replace function roster_contacts() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(t.id, jsonb_build_object('email', t.email, 'mobile', t.mobile)), '{}'::jsonb)
  from trainee t
  where (t.email is not null or t.mobile is not null)
    and (me_role() in ('admin', 'head') or exists (select 1 from doc d where d.col = 'sections' and d.data->>'trainer' = my_legacy()
                                                   and d.data->'rows' @> jsonb_build_array(jsonb_build_object('id', t.id))))
$$;
revoke all on function roster_contacts() from public, anon;
grant execute on function roster_contacts() to authenticated;
revoke all on function roster_mobile(text) from public, anon;

-- نموذج البيانات كما يطلبه المواصفة، دون تكرار للبيانات: عروض على المصدر الوحيد (وثيقة الشعبة وسجل المتدرب)،
-- تخضع لصلاحيات القراءة نفسها (security_invoker)
create or replace view roster_section with (security_invoker = true) as
  select d.id as section_id, d.id as section_number, d.data->>'course' as course_name, d.data->>'code' as course_code,
         d.data->>'trainer' as trainer_id, d.data->>'term' as semester, d.data->>'year' as academic_year
  from doc d where d.col = 'sections';
create or replace view roster_enrollment with (security_invoker = true) as
  select d.id || ':' || (r->>'id') as enrollment_id, d.id as section_id, r->>'id' as trainee_id,
         coalesce((select gr->>'st' from doc g, jsonb_array_elements(g.data->'rows') gr
                   where g.col = 'gsec' and (g.id = d.id or g.data->>'pair' = d.id) and gr->>'id' = r->>'id' limit 1), 'مسجل') as enrollment_status
  from doc d, jsonb_array_elements(coalesce(d.data->'rows', '[]'::jsonb)) r where d.col = 'sections';
revoke all on roster_section, roster_enrollment from anon;
grant select on roster_section, roster_enrollment to authenticated;
