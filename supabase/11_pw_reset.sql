-- =====================================================================
-- منصة حاضر: «نسيت كلمة المرور؟»
-- 1) pw_reset_request(login): من صفحة الدخول (دون تسجيل دخول). يقبل اسم المستخدم أو الرقم التدريبي
--    أو البريد المرتبط بالحساب. الرد واحد دائماً فلا يكشف هل الحساب موجود. إن وُجد الحساب يُسجَّل
--    طلب لمسؤول المنصة (مع حد للتكرار). لا يُخزَّن ما كُتب إن لم يطابق حساباً.
-- 2) لمسؤول المنصة وحده: pw_reset_list، pw_reset_link (رابط إعادة تعيين لمرة واحدة محدود المدة،
--    تُحفظ بصمته SHA-256 فقط)، pw_reset_close (إغلاق الطلب بالإجراء المتخذ). كل إجراء بوقته ومنفّذه.
-- 3) pw_reset_check / pw_reset_finish: صاحب الرابط يعيّن كلمة مرور جديدة بنفسه. تصل بصمة PBKDF2
--    من المتصفح (لا كلمة مرور نصية)، وتمر بزناد الحسابات المعتاد (haader_provision) فتصير كلمة الدخول.
-- لا تُرسل كلمة مرور في أي إشعار أو رسالة، ولا تُخزَّن نصاً مكشوفاً.
-- =====================================================================
create table if not exists pw_reset (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('staff', 'trainee')),
  ref text not null,                 -- معرّف الحساب: accounts/<ref> أو tacc/<ref>
  via text not null,                 -- بماذا طُلب: username | trainee_id | email
  status text not null default 'new' check (status in ('new', 'link', 'done', 'closed')),
  action text,
  action_at timestamptz,
  action_by uuid,
  action_by_name text,
  token_hash text,
  token_exp timestamptz,
  used_at timestamptz
);
create index if not exists pw_reset_ref_idx on pw_reset (kind, ref, at desc);
alter table pw_reset enable row level security;
revoke all on pw_reset from public, anon, authenticated;

-- الحساب المطابق لما كتبه المستخدم (أو لا شيء)
create or replace function pw_reset_match(p_login text, out kind text, out ref text, out via text)
language plpgsql stable security definer set search_path = public as $$
declare lg text := lower(btrim(translate(coalesce(p_login, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')));
begin
  kind := null; ref := null; via := null;
  if lg = '' or length(lg) > 200 then return; end if;
  if position('@' in lg) > 0 then
    select 'staff', d.id, 'email' into kind, ref, via from doc d
      where d.col = 'accounts' and lower(btrim(coalesce(d.data->>'email', ''))) = lg and coalesce((d.data->>'active')::boolean, true) limit 1;
    if kind is null and lg ~ '^[0-9]{9}@tvtc\.edu\.sa$' then
      select 'trainee', d.id, 'email' into kind, ref, via from doc d where d.col = 'tacc' and d.id = split_part(lg, '@', 1) and coalesce(d.data->>'st', '') <> 'disabled';
    end if;
    return;
  end if;
  select 'staff', d.id, 'username' into kind, ref, via from doc d
    where d.col = 'accounts' and lower(d.data->>'username') = lg and coalesce((d.data->>'active')::boolean, true) limit 1;
  if kind is null and lg ~ '^[0-9]{9}$' then
    select 'trainee', d.id, 'trainee_id' into kind, ref, via from doc d where d.col = 'tacc' and d.id = lg and coalesce(d.data->>'st', '') <> 'disabled';
  end if;
end $$;

create or replace function pw_reset_request(p_login text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select * into m from pw_reset_match(p_login);
  -- حد عام للحماية من الإغراق، وحد لكل حساب: طلب مفتوح واحد، وثلاثة في اليوم
  if m.kind is not null
     and (select count(*) from pw_reset where at > now() - interval '1 hour') < 60
     and not exists (select 1 from pw_reset where kind = m.kind and ref = m.ref and status = 'new')
     and (select count(*) from pw_reset where kind = m.kind and ref = m.ref and at > now() - interval '1 day') < 3 then
    insert into pw_reset (kind, ref, via) values (m.kind, m.ref, m.via);
  end if;
  return jsonb_build_object('ok', true);   -- الرد نفسه دائماً
end $$;

create or replace function pw_reset_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(me_role(), '') <> 'admin' then raise exception 'طلبات استعادة كلمة المرور لمسؤول المنصة وحده.' using errcode = '42501'; end if;
end $$;

-- بيانات تعريف الحساب اللازمة للمراجعة: الاسم، اسم المستخدم أو الرقم التدريبي، الدور، البريد المسجل
create or replace function pw_reset_who(p_kind text, p_ref text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when p_kind = 'staff' then
    (select jsonb_build_object('name', d.data->>'name', 'login', d.data->>'username', 'role', coalesce(d.data->>'role', 'trainer'),
       'email', nullif(btrim(coalesce(d.data->>'email', '')), ''), 'active', coalesce((d.data->>'active')::boolean, true))
     from doc d where d.col = 'accounts' and d.id = p_ref)
  else
    (select jsonb_build_object('name', coalesce(d.data->>'name', (select name from trainee where id = p_ref)), 'login', p_ref, 'role', 'trainee',
       'email', p_ref || '@tvtc.edu.sa', 'active', coalesce(d.data->>'st', '') <> 'disabled')
     from doc d where d.col = 'tacc' and d.id = p_ref)
  end
$$;

create or replace function pw_reset_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pw_reset_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'at', r.at, 'kind', r.kind, 'ref', r.ref, 'via', r.via, 'status', r.status,
      'action', r.action, 'action_at', r.action_at, 'action_by_name', r.action_by_name,
      'token_exp', r.token_exp, 'used_at', r.used_at, 'who', pw_reset_who(r.kind, r.ref)) order by r.at desc)
    from (select * from pw_reset order by at desc limit 300) r), '[]'::jsonb);
end $$;

create or replace function pw_reset_link(p_id bigint, p_hours int default 24) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r pw_reset%rowtype; tok text; h int := least(greatest(coalesce(p_hours, 24), 1), 72); nm text;
begin
  perform pw_reset_admin();
  select * into r from pw_reset where id = p_id for update;
  if not found then raise exception 'الطلب غير موجود.' using errcode = 'P0002'; end if;
  if r.status in ('done', 'closed') then raise exception 'الطلب مغلق.' using errcode = 'P0001'; end if;
  tok := encode(gen_random_bytes(32), 'hex');
  nm := (select name from app_user where id = auth.uid());
  -- رابط واحد صالح للحساب: تُلغى الروابط السابقة غير المستخدمة
  update pw_reset set token_hash = null, token_exp = null where kind = r.kind and ref = r.ref and id <> r.id and used_at is null and token_hash is not null;
  update pw_reset set status = 'link', token_hash = encode(digest(tok, 'sha256'), 'hex'), token_exp = now() + make_interval(hours => h),
    action = 'أُنشئ رابط إعادة تعيين لمرة واحدة صالح ' || h || ' ساعة', action_at = now(), action_by = auth.uid(), action_by_name = nm
    where id = r.id;
  insert into audit (by_id, by_name, act, trainee_id, det) values (auth.uid(), nm, 'pw-reset-link', case when r.kind = 'trainee' then r.ref end,
    'رابط إعادة تعيين كلمة المرور للحساب ' || coalesce(pw_reset_who(r.kind, r.ref)->>'login', r.ref));
  return jsonb_build_object('token', tok, 'exp', now() + make_interval(hours => h), 'who', pw_reset_who(r.kind, r.ref));
end $$;

create or replace function pw_reset_close(p_id bigint, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare a text := left(btrim(coalesce(p_action, '')), 300); nm text := (select name from app_user where id = auth.uid());
begin
  perform pw_reset_admin();
  if a = '' then raise exception 'اكتب الإجراء المتخذ.' using errcode = '22023'; end if;
  update pw_reset set status = 'closed', action = a, action_at = now(), action_by = auth.uid(), action_by_name = nm,
    token_hash = null, token_exp = null where id = p_id and status <> 'done';
  if not found then raise exception 'الطلب غير موجود أو اكتمل.' using errcode = 'P0002'; end if;
  insert into audit (by_id, by_name, act, det) values (auth.uid(), nm, 'pw-reset-close', 'إغلاق طلب استعادة كلمة المرور رقم ' || p_id || ': ' || a);
end $$;

-- صاحب الرابط
create or replace function pw_reset_check(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare r pw_reset%rowtype;
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'why', 'invalid'); end if;
  select * into r from pw_reset where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if not found then return jsonb_build_object('ok', false, 'why', 'invalid'); end if;
  if r.used_at is not null then return jsonb_build_object('ok', false, 'why', 'used'); end if;
  if r.token_exp < now() then return jsonb_build_object('ok', false, 'why', 'expired'); end if;
  return jsonb_build_object('ok', true, 'login', pw_reset_who(r.kind, r.ref)->>'login', 'exp', r.token_exp);
end $$;

create or replace function pw_reset_finish(p_token text, p_salt text, p_iter int, p_hash text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r pw_reset%rowtype; iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then raise exception 'الرابط غير صالح.' using errcode = '22023'; end if;
  if p_hash !~ '^[0-9a-f]{64}$' or p_salt !~ '^[0-9a-f]{32}$' or coalesce(p_iter, 0) < 100000 then raise exception 'بيانات غير صالحة.' using errcode = '22023'; end if;
  select * into r from pw_reset where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if not found then raise exception 'الرابط غير صالح.' using errcode = '22023'; end if;
  if r.used_at is not null then raise exception 'استُخدم هذا الرابط من قبل. اطلب رابطاً جديداً.' using errcode = '22023'; end if;
  if r.token_exp < now() then raise exception 'انتهت صلاحية الرابط. اطلب رابطاً جديداً.' using errcode = '22023'; end if;
  perform set_config('haader.sys', '1', true);
  if r.kind = 'staff' then
    update doc set data = data || jsonb_build_object('salt', p_salt, 'iter', p_iter, 'hash', p_hash, 'mustChange', false, 'pwAt', iso)
      where col = 'accounts' and id = r.ref;
    if not found then raise exception 'الحساب غير موجود.' using errcode = 'P0002'; end if;
  else
    update doc set data = data || jsonb_build_object('salt', p_salt, 'iter', p_iter, 'hash', p_hash, 'temp', false,
        'pwAt', iso, 'pwBy', r.ref, 'pwByName', 'المتدرب (رابط إعادة التعيين)')
      where col = 'tacc' and id = r.ref;
    if not found then raise exception 'الحساب غير موجود.' using errcode = 'P0002'; end if;
    update trainee_account set temp = false where trainee_id = r.ref;
  end if;
  perform set_config('haader.sys', '', true);
  update pw_reset set status = 'done', used_at = now(),
    action = coalesce(action, '') || ' • عيّن صاحب الحساب كلمة مرور جديدة عبر الرابط', action_at = now() where id = r.id;
  update pw_reset set status = 'done', action = coalesce(action, '') || ' • اكتمل بطلب آخر', action_at = now()
    where kind = r.kind and ref = r.ref and status = 'new';
  insert into audit (by_name, act, trainee_id, det) values (coalesce(pw_reset_who(r.kind, r.ref)->>'name', r.ref), 'pw-reset-done',
    case when r.kind = 'trainee' then r.ref end, 'عُيّنت كلمة مرور جديدة عبر رابط إعادة التعيين');
  return jsonb_build_object('ok', true, 'login', pw_reset_who(r.kind, r.ref)->>'login');
end $$;

revoke all on function pw_reset_match(text), pw_reset_admin(), pw_reset_who(text, text) from public, anon, authenticated;
revoke all on function pw_reset_request(text), pw_reset_list(), pw_reset_link(bigint, int), pw_reset_close(bigint, text),
  pw_reset_check(text), pw_reset_finish(text, text, int, text) from public;
revoke all on function pw_reset_list(), pw_reset_link(bigint, int), pw_reset_close(bigint, text) from anon;
grant execute on function pw_reset_request(text), pw_reset_check(text), pw_reset_finish(text, text, int, text) to anon, authenticated;
grant execute on function pw_reset_list(), pw_reset_link(bigint, int), pw_reset_close(bigint, text) to authenticated;
