-- منصة حاضر — 04: الدخول الموحد باسم المستخدم، والصلاحيات على مستوى القاعدة،
-- وبوابة المتدرب، والتحضير المباشر عبر QR.
--
-- الفكرة: المنصة تحفظ لكل حساب بصمة PBKDF2-SHA256 لكلمة مروره (مع ملح وعدد دورات).
-- هذه البصمة تصبح كلمة مرور الحساب في نظام المصادقة (Supabase Auth) بعد تشفيرها bcrypt،
-- ثم تُحذف من الوثيقة فلا يقرؤها أحد. الدخول: اسم المستخدم → الملح من الخادم → البصمة
-- تُحسب في المتصفح → تسجيل الدخول بها. فكل حساب تنشئه المنصة (مدرب، رئيس قسم، متدرب)
-- يصبح حساب دخول حقيقياً تلقائياً، دون أي مفتاح سري في الواجهة.

-- ---------- بيانات الدخول (لا تُقرأ من الواجهة إطلاقاً) ----------
create table if not exists credential (
  login      text primary key,                 -- اسم المستخدم بأحرف صغيرة، أو الرقم التدريبي
  kind       text not null check (kind in ('staff','trainee')),
  ref        text not null,                    -- معرّف حساب المنصة أو الرقم التدريبي
  user_id    uuid unique references auth.users(id) on delete cascade,
  salt       text not null,
  iter       int  not null,
  updated_at timestamptz not null default now(),
  unique (kind, ref)
);
alter table credential enable row level security;
revoke all on credential from anon, authenticated;

alter table trainee_account add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table trainee_account add column if not exists first_login timestamptz;

-- البريد الداخلي لكل حساب (لا يُستخدم للمراسلة)
create or replace function haader_email(p_kind text, p_login text) returns text
language sql immutable as $$ select lower(trim(p_login)) || '@' || p_kind || '.haader.local' $$;

-- ---------- إنشاء حساب الدخول أو تحديثه ----------
create or replace function haader_provision(p_kind text, p_ref text, p_login text, p_name text,
  p_salt text, p_iter int, p_hash text, p_active boolean, p_role text default null)
returns uuid language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  lg text := lower(trim(coalesce(p_login, '')));
  em text;
  uid uuid;
  c credential%rowtype;
begin
  if lg = '' then return null; end if;
  em := haader_email(p_kind, lg);
  select * into c from credential where kind = p_kind and ref = p_ref;
  uid := c.user_id;
  if uid is null and p_kind = 'staff' then select id into uid from app_user where legacy_id = p_ref; end if;
  if uid is null then select id into uid from auth.users where lower(email) = em; end if;
  if exists (select 1 from credential x where x.login = lg and not (x.kind = p_kind and x.ref = p_ref)) then
    raise exception 'اسم المستخدم «%» مستخدم لحساب آخر', lg using errcode = '23505';
  end if;

  if uid is null then
    if p_hash is null then return null; end if;   -- لا حساب دخول بلا كلمة مرور
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token, banned_until)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
      crypt(p_hash, gen_salt('bf', 10)), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'haader', p_kind),
      jsonb_build_object('name', p_name), now(), now(), '', '', '', '', '', '', '', '',
      case when p_active then null else '2999-12-31T00:00:00Z'::timestamptz end);
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now());
  else
    update auth.users set
      email = em,
      encrypted_password = case when p_hash is not null then crypt(p_hash, gen_salt('bf', 10)) else encrypted_password end,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      banned_until = case when p_active then null else '2999-12-31T00:00:00Z'::timestamptz end,
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('haader', p_kind),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', p_name),
      updated_at = now()
    where id = uid;
    update auth.identities set identity_data = identity_data || jsonb_build_object('email', em, 'email_verified', true), updated_at = now()
    where user_id = uid and provider = 'email';
    if not p_active then   -- التعطيل يُنهي الجلسات القائمة
      delete from auth.refresh_tokens where user_id::text = uid::text;
      delete from auth.sessions where user_id = uid;
    end if;
  end if;

  insert into credential (login, kind, ref, user_id, salt, iter, updated_at)
  values (lg, p_kind, p_ref, uid, coalesce(p_salt, ''), coalesce(p_iter, 150000), now())
  on conflict (kind, ref) do update set
    login = excluded.login, user_id = excluded.user_id,
    salt = case when p_hash is not null then excluded.salt else credential.salt end,
    iter = case when p_hash is not null then excluded.iter else credential.iter end,
    updated_at = now();

  if p_kind = 'staff' then
    insert into app_user (id, username, name, role, active, legacy_id)
    values (uid, lg, coalesce(nullif(p_name, ''), lg), coalesce(p_role, 'trainer'), p_active, p_ref)
    on conflict (id) do update set username = excluded.username, name = excluded.name,
      role = excluded.role, active = excluded.active, legacy_id = excluded.legacy_id;
  else
    insert into trainee (id, name) values (p_ref, coalesce(nullif(p_name, ''), p_ref))
    on conflict (id) do update set name = excluded.name;
    insert into trainee_account (trainee_id, username, temp, st, user_id)
    values (p_ref, lg, true, case when p_active then 'new' else 'disabled' end, uid)
    on conflict (trainee_id) do update set username = excluded.username, user_id = excluded.user_id,
      st = case when not p_active then 'disabled' when trainee_account.st = 'disabled' then 'new' else trainee_account.st end;
  end if;
  return uid;
end $$;
revoke all on function haader_provision(text, text, text, text, text, int, text, boolean, text) from public, anon, authenticated;

-- ---------- الدخول: الملح لاسم المستخدم (لا يكشف وجود الحساب) ----------
create or replace function login_salt(p_user text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare lg text := lower(trim(coalesce(p_user, ''))); c credential%rowtype;
begin
  select * into c from credential where login = lg order by (kind = 'staff') desc limit 1;
  if found then
    return jsonb_build_object('email', haader_email(c.kind, c.login), 'salt', c.salt, 'iter', c.iter);
  end if;
  -- اسم غير موجود: ملح ثابت مشتق منه، فلا يُعرف من الرد هل الحساب موجود
  return jsonb_build_object('email', haader_email('staff', lg),
    'salt', encode(substring(digest('haader-salt:' || lg, 'sha256') from 1 for 16), 'hex'), 'iter', 150000);
end $$;
revoke all on function login_salt(text) from public;
grant execute on function login_salt(text) to anon, authenticated;

-- ---------- هوية المستخدم الحالي ----------
create or replace function my_trainee() returns text
language sql stable security definer set search_path = public as $$
  select trainee_id from trainee_account where user_id = auth.uid() and st <> 'disabled'
$$;

create or replace function whoami() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u app_user%rowtype; t text;
begin
  select * into u from app_user where id = auth.uid();
  if found then
    return jsonb_build_object('kind', 'staff', 'id', u.legacy_id, 'role', u.role, 'active', u.active, 'name', u.name, 'username', u.username);
  end if;
  t := my_trainee();
  if t is not null then
    return jsonb_build_object('kind', 'trainee', 'id', t, 'name', (select name from trainee where id = t));
  end if;
  return jsonb_build_object('kind', 'none');
end $$;
grant execute on function whoami() to authenticated;

-- ---------- قواعد الكتابة والقراءة على الوثائق ----------
-- المتدرب في شعبة يدرّسها المستخدم الحالي (شعب التحضير أو شعب الدرجات)
create or replace function may_manage_trainee(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select me_role() = 'admin' or exists (
    select 1 from doc d where d.col in ('sections', 'gsec')
      and coalesce(d.data->>'trainer', (select s.data->>'trainer' from doc s where s.col = 'sections' and s.id = d.id)) = my_legacy()
      and d.data->'rows' @> jsonb_build_array(jsonb_build_object('id', p_id)))
$$;

create or replace function doc_owner_of(p_crn text) returns text
language sql stable security definer set search_path = public as $$
  select d.data->>'trainer' from doc d where d.col = 'sections' and d.id = p_crn
$$;

-- مرشد المتدرب في الإرشاد (حساب المنصة المربوط برقم المرشد)
create or replace function advisor_of(p_tid text) returns text
language sql stable security definer set search_path = public as $$
  select a.data->'rows'->(t.data->'rows'->p_tid->>'adv')->>'acct'
  from doc t, doc a
  where t.col = 'bosla' and t.id = 't' || right(p_tid, 1) and a.col = 'bosla' and a.id = 'adv'
$$;

create or replace function doc_may_see2(p_col text, p_id text, p_crn text, p_data jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when me_role() is null then false
    when me_role() in ('admin', 'head', 'viewer') then p_col <> 'logins' or me_role() = 'admin'
    -- المدرب
    when p_col = 'logins' then false
    when p_col in ('glog', 'glogs') then p_id = auth.uid()::text or p_id = 'acc-' || my_legacy()
    when p_col like 'glog/%' or p_col like 'glogs/%' then split_part(p_col, '/', 2) in (auth.uid()::text, 'acc-' || my_legacy())
    when p_col in ('bviol', 'bforms') then true                       -- سجل المخالفات الموحد
    when p_col = 'bcase' then p_data->>'by' = my_legacy() or advisor_of(p_data->>'id') = my_legacy()
    when p_col = 'tacc' then may_manage_trainee(p_id)
    when p_crn is null then true
    else doc_owner_of(p_crn) = my_legacy()
  end
$$;

create or replace function doc_may_write(p_col text, p_id text, p_crn text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when me_role() is null then false
    when me_role() = 'admin' then true
    when p_col = 'accounts' then p_id = my_legacy()                  -- حسابه هو فقط (الحقول المحمية في الزناد)
    when p_col = 'logins' then true                                   -- إضافة فقط (لا تعديل: انظر السياسات)
    when me_role() = 'viewer' then false
    -- مشترك بين المدرب ورئيس القسم
    when p_col in ('bviol', 'bcase', 'bforms') then true
    when p_col in ('glog', 'glogs') then p_id = auth.uid()::text or p_id = 'acc-' || my_legacy()
    when p_col like 'glog/%' or p_col like 'glogs/%' then split_part(p_col, '/', 2) in (auth.uid()::text, 'acc-' || my_legacy())
    when p_col = 'meta' then p_id in ('audit', 'lectures', 'mail', 'claudelog')
                              or (me_role() = 'trainer' and (p_id in ('excuses', 'rayat')
                                  or (p_id = 'qrkey' and not exists (select 1 from doc where col = 'meta' and id = 'qrkey'))))
    when p_col = 'bosla' then p_id ~ '^t[0-9]$'
    when me_role() = 'head' then false
    -- المدرب: شعبه وحدها
    when p_col = 'tacc' then may_manage_trainee(p_id)
    when p_col in ('sections', 'marks', 'notes', 'gsec', 'gmarks', 'gsnap', 'gops', 'qrs', 'warnlog') then
      p_crn is not null and doc_owner_of(p_crn) = my_legacy()
    else false
  end
$$;

drop policy if exists doc_read on doc;
create policy doc_read on doc for select to authenticated using (doc_may_see2(col, id, crn, data));
drop policy if exists doc_ins on doc;
create policy doc_ins on doc for insert to authenticated with check (doc_may_write(col, id, crn));
drop policy if exists doc_upd on doc;
create policy doc_upd on doc for update to authenticated
  using (doc_may_write(col, id, crn) and col <> 'logins')
  with check (doc_may_write(col, id, crn));
-- الحذف: لمسؤول المنصة وحده، ولا يُحذف أي سجل تدقيق أو مخالفة أو حالة أو إنذار أو دخول
drop policy if exists doc_del on doc;
create policy doc_del on doc for delete to authenticated using (
  me_role() = 'admin' and col not in ('bviol', 'bcase', 'warnlog', 'logins', 'glog', 'glogs') and col not like 'glog%');
revoke all on doc from anon;

-- ---------- الزناد: يحسب الشعبة على الخادم، ويحمي الحقول، ويُنشئ حساب الدخول ----------
create or replace function doc_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  r text := me_role();
  sys boolean := coalesce(current_setting('haader.sys', true), '') = '1';
  act boolean;
begin
  new.crn := case when new.col in ('sections', 'marks', 'notes', 'gsec', 'gmarks') then new.id
                  else nullif(coalesce(new.data->>'crn', new.data->>'sec'), '') end;
  new.updated_at := now();
  new.updated_by := case when exists (select 1 from app_user where id = auth.uid()) then auth.uid() else null end;

  -- إدراج سيتحول إلى تحديث (ON CONFLICT): يأخذ شعبة الوثيقة القائمة (فالرقعة الجزئية قد لا تحملها)
  -- ويُترك الباقي لزناد التحديث الذي يرى البيانات المدمجة
  if tg_op = 'INSERT' and exists (select 1 from doc where col = new.col and id = new.id) then
    if new.crn is null then select d.crn into new.crn from doc d where d.col = new.col and d.id = new.id; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.crn is null then new.crn := old.crn; end if;

  if not sys and coalesce(r, '') <> 'admin' then
    if new.col = 'sections' and tg_op = 'UPDATE' and (new.data->>'trainer') is distinct from (old.data->>'trainer') then
      raise exception 'لا يغيّر مدرب الشعبة إلا مسؤول المنصة' using errcode = '42501';
    end if;
    if new.col = 'accounts' and tg_op = 'UPDATE' and (
         (new.data->>'role') is distinct from (old.data->>'role')
      or (new.data->>'active') is distinct from (old.data->>'active')
      or (new.data->>'username') is distinct from (old.data->>'username')
      or (new.data->'perms') is distinct from (old.data->'perms')) then
      raise exception 'لا تُعدَّل صلاحيات الحساب أو اسم المستخدم إلا من مسؤول المنصة' using errcode = '42501';
    end if;
    if new.col = 'tacc' and tg_op = 'UPDATE' and (new.data->>'user') is distinct from (old.data->>'user') then
      raise exception 'اسم مستخدم المتدرب هو رقمه التدريبي ولا يُعدَّل' using errcode = '42501';
    end if;
  end if;

  if new.col = 'accounts' then
    act := coalesce((new.data->>'active')::boolean, true);
    perform haader_provision('staff', new.id, new.data->>'username', new.data->>'name',
      new.data->>'salt', (new.data->>'iter')::int, new.data->>'hash', act, coalesce(new.data->>'role', 'trainer'));
    new.data := new.data - 'hash';
  elsif new.col = 'tacc' then
    act := coalesce(new.data->>'st', 'new') <> 'disabled';
    perform haader_provision('trainee', new.id, coalesce(new.data->>'user', new.id), new.data->>'name',
      new.data->>'salt', (new.data->>'iter')::int, new.data->>'hash', act, null);
    new.data := new.data - 'hash';
  end if;
  return new;
end $$;
drop trigger if exists doc_guard on doc;
create trigger doc_guard before insert or update on doc for each row execute function doc_guard();

-- ---------- المتدرب: بياناته وحده ----------
create or replace function trainee_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t text := my_trainee();
  secs jsonb := '{}'::jsonb; mks jsonb := '{}'::jsonb; q record; meta jsonb := '{}'::jsonb;
begin
  if t is null then raise exception 'ليس حساب متدرب نشطاً' using errcode = '42501'; end if;
  for q in select d.id, d.data from doc d where d.col = 'sections' and d.data->'rows' @> jsonb_build_array(jsonb_build_object('id', t)) loop
    secs := secs || jsonb_build_object(q.id, (q.data - 'rows' - 'sheet') || jsonb_build_object('rows',
      (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(q.data->'rows') x where x->>'id' = t),
      'trainerName', (select a.data->>'name' from doc a where a.col = 'accounts' and a.id = q.data->>'trainer')));
    mks := mks || jsonb_build_object(q.id, jsonb_build_object('m', jsonb_build_object(t,
      coalesce((select m.data->'m'->t from doc m where m.col = 'marks' and m.id = q.id), '{}'::jsonb))));
  end loop;
  -- الأقسام المزدوجة (نظري/عملي) تحتاج شعبة القرين لحساب الانسحاب
  select jsonb_object_agg(d.id, case when d.id in ('calendar', 'settings') then d.data
      else jsonb_build_object('rows', (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(d.data->'rows') x where x::text like '%"' || t || '"%')) end)
    into meta from doc d where d.col = 'meta' and d.id in ('calendar', 'settings', 'excuses', 'reinstated');
  return jsonb_build_object(
    'id', t,
    'name', (select name from trainee where id = t),
    'sections', secs, 'marks', mks, 'meta', coalesce(meta, '{}'::jsonb),
    'warn', (select coalesce(jsonb_agg(jsonb_build_object('at', w.data->>'at', 'crn', w.data->>'crn', 'course', w.data->>'course', 'type', w.data->>'type', 'reason', w.data->>'reason') order by w.data->>'at' desc), '[]'::jsonb)
             from doc w where w.col = 'warnlog' and w.data->>'id' = t and coalesce(w.data->>'status', 'ok') = 'ok'),
    'acc', (select jsonb_build_object('temp', a.temp, 'st', a.st, 'first', a.first_login, 'last', a.last_login) from trainee_account a where a.trainee_id = t));
end $$;
revoke all on function trainee_me() from public, anon;
grant execute on function trainee_me() to authenticated;

-- أول دخول وآخر دخول للمتدرب، ويظهران في «حسابات المتدربين» عند المدرب
create or replace function trainee_touch() returns void
language plpgsql security definer set search_path = public as $$
declare t text := my_trainee(); iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if t is null then return; end if;
  update trainee_account set last_login = now(), first_login = coalesce(first_login, now()) where trainee_id = t;
  perform set_config('haader.sys', '1', true);
  update doc set data = jsonb_deep_merge(data, jsonb_build_object('last', jsonb_build_object('at', iso))
      || case when data->'first'->>'at' is null then jsonb_build_object('first', jsonb_build_object('at', iso)) else '{}'::jsonb end)
    where col = 'tacc' and id = t;
  insert into doc (col, id, data) values ('logins', 'x' || replace(gen_random_uuid()::text, '-', ''),
    jsonb_build_object('at', iso, 'username', t, 'ok', true, 'note', 'دخول متدرب', 'ua', 'منصة حاضر'));
  perform set_config('haader.sys', '', true);
end $$;
revoke all on function trainee_touch() from public, anon;
grant execute on function trainee_touch() to authenticated;

-- تغيير المتدرب كلمة مروره (البصمة الجديدة تُحسب في متصفحه)
create or replace function trainee_set_password(p_salt text, p_iter int, p_hash text) returns void
language plpgsql security definer set search_path = public as $$
declare t text := my_trainee();
begin
  if t is null then raise exception 'ليس حساب متدرب نشطاً' using errcode = '42501'; end if;
  if p_hash !~ '^[0-9a-f]{64}$' or p_salt !~ '^[0-9a-f]{32}$' or p_iter < 100000 then raise exception 'بيانات غير صالحة'; end if;
  perform set_config('haader.sys', '1', true);
  update doc set data = data || jsonb_build_object('salt', p_salt, 'iter', p_iter, 'hash', p_hash, 'temp', false,
      'pwAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'pwBy', t, 'pwByName', 'المتدرب')
    where col = 'tacc' and id = t;
  perform set_config('haader.sys', '', true);
  update trainee_account set temp = false where trainee_id = t;
  insert into audit (by_name, act, trainee_id, det) values ((select name from trainee where id = t), 'trainee-pw', t, 'غيّر المتدرب كلمة مروره');
end $$;
revoke all on function trainee_set_password(text, int, text) from public, anon;
grant execute on function trainee_set_password(text, int, text) to authenticated;

-- ---------- التحضير المباشر عبر QR ----------
create or replace function qr_sig(p_key text, p_msg text) returns text
language sql immutable set search_path = public, extensions as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(h, i) & 31) + 1, 1), '' order by i)
  from (select hmac(convert_to(p_msg, 'UTF8'), decode(p_key, 'base64'), 'sha256') h) s, generate_series(0, 7) i
$$;

create or replace function qr_checkin(p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  t text := my_trainee();
  m text[]; sid text; slot text; sig text;
  s jsonb; sec jsonb; k text; g int; ok boolean := false;
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  st_ms bigint; en_ms bigint; s0 bigint; rot int; grc int;
  dayname text; ls timestamptz; late int := 0; grace int; code text; prev text;
  dk text; nm text; iso text := to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  hhmm text := to_char(clock_timestamp() at time zone 'Asia/Riyadh', 'HH24:MI');
  applied text; note text;
begin
  if t is null then return jsonb_build_object('ok', false, 'why', 'notrainee'); end if;
  m := regexp_match(trim(coalesce(p_code, '')), '^H1\.([A-Z2-9]{10})\.([0-9]+|S)\.([A-Z2-9]{8})$');
  if m is null then return jsonb_build_object('ok', false, 'why', 'format'); end if;
  sid := m[1]; slot := m[2]; sig := m[3];
  select data into s from doc where col = 'qrs' and id = sid for update;
  if s is null then return jsonb_build_object('ok', false, 'why', 'unknown'); end if;
  select data->>'k' into k from doc where col = 'meta' and id = 'qrkey';
  g := coalesce((s->>'gen')::int, 1);
  if k is null then return jsonb_build_object('ok', false, 'why', 'unknown'); end if;
  if qr_sig(k, sid || '.' || g || '.' || slot) <> sig then
    for i in 1 .. g - 1 loop if qr_sig(k, sid || '.' || i || '.' || slot) = sig then return jsonb_build_object('ok', false, 'why', 'revoked'); end if; end loop;
    return jsonb_build_object('ok', false, 'why', 'forged');
  end if;
  if slot = 'S' and not coalesce((s->>'static')::boolean, false) then return jsonb_build_object('ok', false, 'why', 'forged'); end if;

  select data into sec from doc where col = 'sections' and id = s->>'crn';
  select x->>'name' into nm from jsonb_array_elements(sec->'rows') x where x->>'id' = t limit 1;
  if nm is null or nm like '%تم سحبه%' then return jsonb_build_object('ok', false, 'why', 'notin', 'course', s->>'course'); end if;
  dk := s->>'dk';
  prev := coalesce((select data->'m'->t->>dk from doc where col = 'marks' and id = s->>'crn'), '');
  if prev = 'سحب' then return jsonb_build_object('ok', false, 'why', 'notin', 'course', s->>'course'); end if;
  if exists (select 1 from doc q where q.col = 'qrs' and q.data->>'crn' = s->>'crn' and q.data->>'d' = s->>'d' and q.data->'ins' ? t) then
    return jsonb_build_object('ok', false, 'why', 'dup', 'course', s->>'course');
  end if;

  st_ms := floor(extract(epoch from (s->>'start')::timestamptz) * 1000);
  en_ms := floor(extract(epoch from (case when s->>'status' = 'closed' then s->>'closedAt' else s->>'end' end)::timestamptz) * 1000);
  if now_ms < st_ms - 5000 then return jsonb_build_object('ok', false, 'why', 'early'); end if;
  if now_ms > en_ms then return jsonb_build_object('ok', false, 'why', 'late'); end if;
  if slot <> 'S' then
    rot := coalesce((s->>'rotate')::int, 30); grc := coalesce((s->>'grace')::int, 90);
    s0 := slot::bigint * rot * 1000;
    if now_ms < s0 - 5000 or now_ms - s0 > (rot + grc) * 1000 then return jsonb_build_object('ok', false, 'why', 'stale'); end if;
  end if;

  -- التأخير من بداية المحاضرة في جدول الشعبة (الأقرب لبدء الجلسة)، بعد السماح
  dayname := (array['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'])[extract(dow from ((s->>'start')::timestamptz at time zone 'Asia/Riyadh'))::int + 1];
  select (date_trunc('day', (s->>'start')::timestamptz at time zone 'Asia/Riyadh') + (x->>'start')::time) at time zone 'Asia/Riyadh'
    into ls from jsonb_array_elements(sec->'meets') x
    where x->>'day' = dayname and coalesce(x->>'start', '') <> ''
    order by abs(extract(epoch from ((date_trunc('day', (s->>'start')::timestamptz at time zone 'Asia/Riyadh') + (x->>'start')::time) at time zone 'Asia/Riyadh') - (s->>'start')::timestamptz)) limit 1;
  grace := coalesce((select (data->>'lateGrace')::int from doc where col = 'meta' and id = 'qrcfg'), 3);
  if ls is not null and now_ms > greatest(floor(extract(epoch from ls) * 1000), st_ms) + grace * 60000 then
    late := greatest(1, floor((now_ms - extract(epoch from ls) * 1000) / 60000)::int);
  end if;
  code := case when late > 0 then 'م' || late else 'ح' end;
  applied := case when prev = '' or prev = 'غ' then 'سُجّل «' || code || '»' else 'بقي «' || prev || '»' end;

  perform set_config('haader.sys', '1', true);
  update doc set data = jsonb_deep_merge(data, jsonb_build_object('ins', jsonb_build_object(t, jsonb_build_object(
      'rid', 'direct', 'at', iso, 'opened', iso, 'e', t || '@tvtc.edu.sa', 'prev', prev, 'late', late,
      'applied', applied, 'by', 'trainee', 'on', iso, 'direct', true)),
      'log', jsonb_build_object(now_ms::text || t, jsonb_build_array(iso, 'تحضير مباشر', nm, applied))))
    where col = 'qrs' and id = sid;
  if prev = '' or prev = 'غ' then
    insert into doc (col, id, data) values ('marks', s->>'crn', jsonb_build_object('m', jsonb_build_object(t, jsonb_build_object(dk, code))))
      on conflict (col, id) do update set data = jsonb_deep_merge(doc.data, excluded.data);
    if late > 0 then
      note := coalesce((select data->'n'->t->>dk from doc where col = 'notes' and id = s->>'crn'), '');
      if position('QR:' in note) = 0 then
        insert into doc (col, id, data) values ('notes', s->>'crn', jsonb_build_object('n', jsonb_build_object(t, jsonb_build_object(dk,
            case when note = '' then '' else note || ' — ' end || 'QR: مسح ' || hhmm || '، تأخر ' || late || ' د'))))
          on conflict (col, id) do update set data = jsonb_deep_merge(doc.data, excluded.data);
      end if;
    end if;
    insert into doc (col, id, data) values ('meta', 'lectures', jsonb_build_object('l', jsonb_build_object((s->>'crn') || '_' || dk, jsonb_build_object('at', iso, 'by', s->>'trainer'))))
      on conflict (col, id) do update set data = case when doc.data->'l' ? ((s->>'crn') || '_' || dk) then doc.data else jsonb_deep_merge(doc.data, excluded.data) end;
    insert into doc (col, id, data) values ('meta', 'audit', jsonb_build_object('rows', jsonb_build_array(jsonb_build_array(iso, s->>'crn', t, nm, s->>'d', prev, code, 'QR مباشر', nm))))
      on conflict (col, id) do update set data = jsonb_build_object('rows',
        (select coalesce(jsonb_agg(r order by n), '[]'::jsonb) from (
          select r, n from jsonb_array_elements(coalesce(doc.data->'rows', '[]'::jsonb) || excluded.data->'rows') with ordinality a(r, n)
          order by n desc limit 800) z));
  end if;
  perform set_config('haader.sys', '', true);
  insert into audit (by_name, act, crn, trainee_id, old_val, new_val, det)
  values (nm, 'qr-direct', s->>'crn', t, prev, code, 'جلسة ' || sid || ' — ' || applied);
  return jsonb_build_object('ok', true, 'code', code, 'late', late, 'applied', applied, 'prev', prev,
    'course', s->>'course', 'crn', s->>'crn', 'd', s->>'d', 'at', iso);
end $$;
revoke all on function qr_checkin(text) from public, anon;
grant execute on function qr_checkin(text) to authenticated;

-- ---------- تنظيف ----------
-- إنشاء مسؤول بالتسجيل الذاتي لم يعد مسموحاً: الحسابات تُنشأ من المنصة فقط
drop function if exists claim_admin(text, text, text);
revoke all on function doc_merge(text, text, jsonb, text) from anon;

-- منع التسجيل الذاتي في نظام المصادقة: الحساب لا يُنشأ إلا من المنصة
create or replace function auth_block_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or new.email not like '%.haader.local' then
    raise exception 'التسجيل الذاتي غير متاح في منصة حاضر' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists haader_block_signup on auth.users;
create trigger haader_block_signup before insert on auth.users for each row execute function auth_block_signup();

-- الدوال المساعدة لا تُستدعى دون دخول (تبقى للمسجَّلين لأن سياسات الحماية تستعملها)
revoke execute on function my_trainee(), may_manage_trainee(text), doc_owner_of(text), advisor_of(text),
  doc_may_see2(text, text, text, jsonb), doc_may_write(text, text, text), qr_sig(text, text), haader_email(text, text),
  whoami(), auth_block_signup() from public, anon;
grant execute on function my_trainee(), may_manage_trainee(text), doc_owner_of(text), advisor_of(text),
  doc_may_see2(text, text, text, jsonb), doc_may_write(text, text, text), whoami() to authenticated;
