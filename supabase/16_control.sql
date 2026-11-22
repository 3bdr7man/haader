-- =====================================================================
-- منصة حاضر: الإدارة المركزية للتشغيل والمزامنة والتكامل
-- 1) وضع التشغيل: عام / صيانة / إيقاف الوصول العام — يُفرض على الخادم: me_role() وmy_legacy() وmy_trainee()
--    لا تعطي غير المسؤول أي دور خارج الوضع العام، فتمنع سياسات RLS والدوال كل قراءة وكتابة له.
-- 2) قناة الإتاحة: القناتان / تقني فقط / الموقع فقط — جلسة الدخول عبر تقني تُربط برقم الجلسة (session_id)
--    في ctl_session، فتُفرض القناة على الخادم دون الاعتماد على المتصفح.
-- 3) سجل خدمات التكامل (رايات، تقني، وأي نظام لاحق): لكل خدمة ثلاثة مستويات مستقلة
--    الظهور (visible) / التفعيل (enabled) / التفويض (all | roles | users).
-- 4) المزامنة لا تبدأ إلا بتذكرة من الخادم (sync_begin) موقعة HMAC قصيرة العمر، يتحقق منها الجسر داخل رايات
--    قبل أي قراءة أو كتابة (sync_check)؛ تعطيل الخدمة يُبطل التذاكر القائمة فوراً. منع التكرار المتزامن بمفتاح.
-- 5) أدوات إدارة Claude (claude_tool): طبقة أوامر محددة الصلاحيات، تُفعَّل وتُعطَّل من لوحة المسؤول، ومسجلة.
-- 6) سجل تدقيق لكل تغيير (المنفّذ، النظام، الخدمة، السابق، الجديد، الوقت، IP، السبب، القناة).
-- لا أسرار في هذه الجداول: رايات وتقني يُستعملان بجلسة المستخدم في متصفحه. سر توقيع التذاكر في جدول مغلق.
-- =====================================================================

create table if not exists platform_ctl (
  id int primary key default 1 check (id = 1),
  mode text not null default 'public' check (mode in ('public', 'maintenance', 'closed')),
  channel text not null default 'both' check (channel in ('both', 'taqni', 'web')),
  claude boolean not null default true,
  msg text not null default 'منصة حاضر في صيانة مؤقتة لتحسين الخدمة. نعود قريباً بإذن الله.',
  ver bigint not null default 1,
  at timestamptz not null default now(), by_name text
);
insert into platform_ctl (id) values (1) on conflict do nothing;

create table if not exists integ_system (
  id text primary key, name text not null, sort int not null default 0,
  endpoint text, auth_method text, conn_note text,
  retry jsonb not null default '{"max": 2, "backoff_s": 5, "timeout_s": 30}'::jsonb,
  last_ok timestamptz, last_sync timestamptz, last_error text, last_error_at timestamptz
);
create table if not exists integ_service (
  id text primary key, system text not null references integ_system(id), name text not null, descr text,
  impl boolean not null default false,                 -- موجودة فعلياً في المنصة الآن
  visible boolean not null default true, enabled boolean not null default true,
  auth_mode text not null default 'all' check (auth_mode in ('all', 'roles', 'users')),
  auth_roles text[] not null default '{}', auth_users text[] not null default '{}',
  sort int not null default 0,
  last_run timestamptz, last_status text, last_count int,
  updated_at timestamptz not null default now(), updated_by text
);
create table if not exists ctl_audit (
  id bigserial primary key, at timestamptz not null default now(),
  by_id uuid, by_name text, via text not null default 'platform',
  sys text, svc text, field text, old_val text, new_val text, reason text, ip text
);
create table if not exists sync_run (
  id text primary key, at timestamptz not null default now(), done_at timestamptz, exp timestamptz not null,
  by_id uuid, by_name text, svc text not null references integ_service(id), key text not null,
  status text not null default 'running' check (status in ('running', 'ok', 'fail', 'partial', 'cancelled', 'expired')),
  n int, detail text, checks int not null default 0
);
create index if not exists sync_run_svc on sync_run (svc, key, status);
create table if not exists ctl_session (
  session_id uuid primary key, user_id uuid not null, channel text not null check (channel in ('taqni', 'taqni-link')),
  crn text, at timestamptz not null default now(), exp timestamptz not null
);
create table if not exists ctl_secret (id int primary key default 1 check (id = 1), k text not null);
insert into ctl_secret (id, k) values (1, encode(extensions.gen_random_bytes(32), 'hex')) on conflict do nothing;
alter table platform_ctl enable row level security; alter table integ_system enable row level security;
alter table integ_service enable row level security; alter table ctl_audit enable row level security;
alter table sync_run enable row level security; alter table ctl_session enable row level security; alter table ctl_secret enable row level security;
revoke all on platform_ctl, integ_system, integ_service, ctl_audit, sync_run, ctl_session, ctl_secret from anon, authenticated;

-- سجل الخدمات: الموجودة فعلياً (impl) والمعرّفة للمستقبل (معطلة ومخفية حتى تُبنى)
insert into integ_system (id, name, sort, endpoint, auth_method, conn_note) values
  ('rayat', 'نظام رايات (Banner)', 1, 'https://rytfac-oc.tvtc.gov.sa/FacultySelfService/ssb/', 'جلسة المدرب في المتصفح (جسر حاضر)', 'لا تحفظ حاضر أي كلمة مرور لرايات؛ الجسر يعمل داخل تبويب رايات المفتوح بحساب المدرب.'),
  ('taqni', 'منصة تقني (Moodle)', 2, 'https://tvtclms.edu.sa/', 'LTI 1.3 أو رابط موقّع لكل شعبة', 'لا تحفظ حاضر أي كلمة مرور لتقني.')
on conflict (id) do nothing;
insert into integ_service (id, system, name, descr, impl, visible, enabled, sort) values
  ('rayat.att_push',    'rayat', 'مزامنة التحضير اليومي', 'رفع تحضير المحاضرات المحددة إلى رايات بعد المقارنة والتأكيد.', true, true, true, 1),
  ('rayat.att_pull',    'rayat', 'مقارنة التحضير وجلب الفروقات', 'قراءة تحضير رايات ومقارنته بحاضر دون كتابة.', true, true, true, 2),
  ('rayat.grades_push', 'rayat', 'مزامنة إدخال الدرجات', 'رفع درجات الشعبة إلى رايات بعملية موثقة قابلة للتحقق.', true, true, true, 3),
  ('rayat.grades_pull', 'rayat', 'مزامنة استيراد الدرجات (قراءة ومطابقة)', 'قراءة درجات رايات ومطابقتها بدرجات حاضر دون كتابة.', true, true, true, 4),
  ('rayat.trainees',    'rayat', 'مزامنة بيانات المتدربين', 'غير مبنية بعد: تُعرَّف هنا لتُدار عند بنائها.', false, false, false, 5),
  ('rayat.sections',    'rayat', 'مزامنة الشعب التدريبية', 'غير مبنية بعد.', false, false, false, 6),
  ('rayat.courses',     'rayat', 'مزامنة المقررات', 'غير مبنية بعد.', false, false, false, 7),
  ('taqni.embed',       'taqni', 'تشغيل حاضر داخل تقني', 'فتح حاضر داخل صفحة الشعبة في تقني (LTI 1.3 أو الرابط الموقّع).', true, true, true, 1),
  ('taqni.links',       'taqni', 'روابط حاضر وإعلانات الشعب', 'رابط وإعلان «منصة حاضر» لكل شعبة بخدماتها المختارة.', true, true, true, 2),
  ('taqni.grades',      'taqni', 'مزامنة إدخال الدرجات', 'غير مبنية بعد.', false, false, false, 3),
  ('taqni.attendance',  'taqni', 'مزامنة التحضير اليومي', 'غير مبنية بعد.', false, false, false, 4),
  ('taqni.trainees',    'taqni', 'مزامنة بيانات المتدربين', 'غير مبنية بعد.', false, false, false, 5),
  ('taqni.sections',    'taqni', 'مزامنة الشعب والمقررات', 'غير مبنية بعد.', false, false, false, 6)
on conflict (id) do nothing;

-- ---------- البوابة: وضع التشغيل والقناة ----------
create or replace function ctl_gate_open() returns boolean
language sql stable security definer set search_path = public as $$
  select case c.mode when 'public' then
           case c.channel
             when 'both' then true
             when 'taqni' then exists (select 1 from ctl_session s where s.session_id = nullif(auth.jwt()->>'session_id', '')::uuid and s.exp > now())
             else not exists (select 1 from ctl_session s where s.session_id = nullif(auth.jwt()->>'session_id', '')::uuid and s.exp > now()) end
         else false end
  from platform_ctl c where c.id = 1
$$;
create or replace function me_role() returns text
language sql stable security definer set search_path = public as $$
  select role from app_user where id = auth.uid() and active and (role = 'admin' or coalesce(ctl_gate_open(), true))
$$;
create or replace function my_legacy() returns text
language sql stable security definer set search_path = public as $$
  select legacy_id from app_user where id = auth.uid() and active and (role = 'admin' or coalesce(ctl_gate_open(), true))
$$;
create or replace function my_trainee() returns text
language sql stable security definer set search_path = public as $$
  select trainee_id from trainee_account where user_id = auth.uid() and st <> 'disabled' and coalesce(ctl_gate_open(), true)
$$;

create or replace function ctl_ip() returns text language sql stable as $$
  select nullif(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ''), ',', 1), '')
$$;
create or replace function ctl_is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_user where id = auth.uid() and active and role = 'admin')
$$;
create or replace function ctl_via() returns text language sql stable as $$
  select case when current_setting('haader.via', true) = 'claude' then 'claude' else 'platform' end
$$;
create or replace function ctl_log(p_sys text, p_svc text, p_field text, p_old text, p_new text, p_reason text)
returns void language sql security definer set search_path = public as $$
  insert into ctl_audit (by_id, by_name, via, sys, svc, field, old_val, new_val, reason, ip)
  values (auth.uid(), (select name from app_user where id = auth.uid()), ctl_via(), p_sys, p_svc, p_field, p_old, p_new, nullif(left(btrim(coalesce(p_reason, '')), 300), ''), ctl_ip());
$$;
-- حد للطلبات الحساسة: 40 تغييراً في الدقيقة لكل مستخدم
create or replace function ctl_rate() returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from ctl_audit where by_id = auth.uid() and at > now() - interval '1 minute') >= 40 then
    raise exception 'طلبات كثيرة متتالية. انتظر دقيقة ثم أعد المحاولة.' using errcode = '53400';
  end if;
end $$;
create or replace function ctl_need_admin() returns void language plpgsql security definer set search_path = public as $$
begin
  if not ctl_is_admin() then raise exception 'هذا الإجراء لمسؤول المنصة فقط.' using errcode = '42501'; end if;
  perform ctl_rate();
end $$;
create or replace function ctl_bump(p_by text) returns void language sql security definer set search_path = public as $$
  update platform_ctl set ver = ver + 1, at = now(), by_name = p_by where id = 1;
$$;

-- هل يحق للمستخدم الحالي تنفيذ الخدمة الآن؟
create or replace function svc_allowed(p_svc text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select s.enabled and (
             (select role from app_user where id = auth.uid() and active) = 'admin'
             or (s.auth_mode = 'all' and me_role() in ('trainer', 'head'))
             or (s.auth_mode = 'roles' and me_role() = any (s.auth_roles))
             or (s.auth_mode = 'users' and my_legacy() = any (s.auth_users)))
           from integ_service s where s.id = p_svc), false)
$$;

-- ---------- الإعدادات المخزنة مؤقتاً في المتصفح: استعلام واحد صغير، ورقم إصدار يبطل النسخة القديمة ----------
create or replace function ctl_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('v', c.ver, 'mode', c.mode, 'channel', c.channel, 'msg', c.msg, 'claude', c.claude,
    'taqni', coalesce(nullif(auth.jwt()->>'session_id', ''), '') <> '' and exists (select 1 from ctl_session s where s.session_id = nullif(auth.jwt()->>'session_id', '')::uuid and s.exp > now()),
    'svc', case when auth.uid() is null then '{}'::jsonb else coalesce((select jsonb_object_agg(s.id, jsonb_build_object('v', s.visible, 'e', s.enabled, 'a', svc_allowed(s.id))) from integ_service s), '{}'::jsonb) end)
  from platform_ctl c where c.id = 1
$$;

-- ---------- لوحة المسؤول ----------
create or replace function ctl_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not ctl_is_admin() then raise exception 'هذا الإجراء لمسؤول المنصة فقط.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'ctl', (select to_jsonb(c) from platform_ctl c where id = 1),
    'systems', (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort), '[]') from integ_system x),
    'services', (select coalesce(jsonb_agg(to_jsonb(x) order by x.system, x.sort), '[]') from integ_service x),
    'runs', (select coalesce(jsonb_agg(to_jsonb(r) - 'by_id' order by r.at desc), '[]') from (select * from sync_run order by at desc limit 30) r),
    'audit', (select coalesce(jsonb_agg(to_jsonb(a) - 'by_id' order by a.at desc), '[]') from (select * from ctl_audit order by at desc limit 60) a),
    'trainers', (select coalesce(jsonb_agg(jsonb_build_object('id', legacy_id, 'name', name, 'role', role) order by name), '[]') from app_user where active and role in ('trainer', 'head', 'admin')));
end $$;

create or replace function ctl_service_set(p_id text, p_field text, p_value boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s integ_service%rowtype; nm text; old boolean;
begin
  perform ctl_need_admin();
  if p_field not in ('visible', 'enabled') then raise exception 'حقل غير معروف.'; end if;
  select * into s from integ_service where id = p_id for update;
  if not found then raise exception 'الخدمة % غير معرّفة.', p_id; end if;
  if p_value and not s.impl and p_field = 'enabled' then raise exception 'الخدمة «%» غير مبنية بعد، فلا تُفعَّل.', s.name; end if;
  old := case p_field when 'visible' then s.visible else s.enabled end;
  if old = p_value then return jsonb_build_object('ok', true, 'changed', false); end if;
  select name into nm from app_user where id = auth.uid();
  if p_field = 'visible' then update integ_service set visible = p_value, updated_at = now(), updated_by = nm where id = p_id;
  else update integ_service set enabled = p_value, updated_at = now(), updated_by = nm where id = p_id; end if;
  -- التعطيل يوقف العمليات المفتوحة للخدمة (لا تُقبل تذاكرها بعد الآن) دون حذف سجلاتها
  if p_field = 'enabled' and not p_value then
    update sync_run set status = 'cancelled', done_at = now(), detail = coalesce(detail || ' — ', '') || 'أُوقفت بتعطيل الخدمة' where svc = p_id and status = 'running';
  end if;
  perform ctl_log(s.system, p_id, p_field, old::text, p_value::text, p_reason);
  perform ctl_bump(nm);
  return jsonb_build_object('ok', true, 'changed', true);
end $$;

create or replace function ctl_service_auth(p_id text, p_mode text, p_roles text[], p_users text[], p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s integ_service%rowtype; nm text;
begin
  perform ctl_need_admin();
  if p_mode not in ('all', 'roles', 'users') then raise exception 'نوع تفويض غير معروف.'; end if;
  select * into s from integ_service where id = p_id for update;
  if not found then raise exception 'الخدمة % غير معرّفة.', p_id; end if;
  select name into nm from app_user where id = auth.uid();
  update integ_service set auth_mode = p_mode,
    auth_roles = coalesce((select array_agg(distinct r) from unnest(coalesce(p_roles, '{}')) r where r in ('admin', 'head', 'trainer')), '{}'),
    auth_users = coalesce((select array_agg(distinct u) from unnest(coalesce(p_users, '{}')) u where exists (select 1 from app_user where legacy_id = u)), '{}'),
    updated_at = now(), updated_by = nm where id = p_id;
  perform ctl_log(s.system, p_id, 'auth', s.auth_mode || ':' || array_to_string(s.auth_roles || s.auth_users, ','), p_mode || ':' || array_to_string(coalesce(p_roles, '{}') || coalesce(p_users, '{}'), ','), p_reason);
  perform ctl_bump(nm);
  return jsonb_build_object('ok', true);
end $$;

create or replace function ctl_bulk(p_system text, p_field text, p_value boolean, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s record; n int := 0; r jsonb;
begin
  perform ctl_need_admin();
  for s in select id from integ_service where (p_system = '*' or system = p_system) and impl order by system, sort loop
    r := ctl_service_set(s.id, p_field, p_value, coalesce(p_reason, 'إجراء جماعي'));
    if (r->>'changed')::boolean then n := n + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'changed', n);
end $$;

create or replace function ctl_system_set(p_id text, p_patch jsonb, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s integ_system%rowtype; k text; nm text;
begin
  perform ctl_need_admin();
  select * into s from integ_system where id = p_id for update;
  if not found then raise exception 'النظام % غير معرّف.', p_id; end if;
  for k in select jsonb_object_keys(p_patch) loop
    if k ~* '(secret|password|token|key|pass)' then raise exception 'لا تُحفظ الأسرار هنا. المفاتيح تُخزَّن في خزنة الخادم (Vault) فقط.'; end if;
    if k not in ('endpoint', 'auth_method', 'conn_note', 'retry') then raise exception 'حقل غير معروف: %', k; end if;
  end loop;
  select name into nm from app_user where id = auth.uid();
  update integ_system set endpoint = coalesce(p_patch->>'endpoint', endpoint), auth_method = coalesce(p_patch->>'auth_method', auth_method),
    conn_note = coalesce(p_patch->>'conn_note', conn_note),
    retry = case when p_patch ? 'retry' then jsonb_build_object('max', least(greatest(coalesce((p_patch#>>'{retry,max}')::int, 2), 0), 5),
                  'backoff_s', least(greatest(coalesce((p_patch#>>'{retry,backoff_s}')::int, 5), 1), 120), 'timeout_s', least(greatest(coalesce((p_patch#>>'{retry,timeout_s}')::int, 30), 5), 120)) else retry end
    where id = p_id;
  perform ctl_log(p_id, null, 'system', to_jsonb(s)::text, p_patch::text, p_reason);
  perform ctl_bump(nm);
  return jsonb_build_object('ok', true);
end $$;

create or replace function ctl_platform_set(p_field text, p_value text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c platform_ctl%rowtype; nm text;
begin
  perform ctl_need_admin();
  select * into c from platform_ctl where id = 1 for update;
  select name into nm from app_user where id = auth.uid();
  if p_field = 'mode' then
    if p_value not in ('public', 'maintenance', 'closed') then raise exception 'وضع غير معروف.'; end if;
    if c.mode = p_value then return jsonb_build_object('ok', true, 'changed', false); end if;
    update platform_ctl set mode = p_value where id = 1; perform ctl_log('platform', null, 'mode', c.mode, p_value, p_reason);
  elsif p_field = 'channel' then
    if p_value not in ('both', 'taqni', 'web') then raise exception 'قناة غير معروفة.'; end if;
    if c.channel = p_value then return jsonb_build_object('ok', true, 'changed', false); end if;
    update platform_ctl set channel = p_value where id = 1; perform ctl_log('platform', null, 'channel', c.channel, p_value, p_reason);
  elsif p_field = 'claude' then
    if ctl_via() = 'claude' and p_value = 'true' then raise exception 'تفعيل إدارة Claude يتم من لوحة المنصة فقط.'; end if;
    if c.claude = (p_value = 'true') then return jsonb_build_object('ok', true, 'changed', false); end if;
    update platform_ctl set claude = (p_value = 'true') where id = 1; perform ctl_log('platform', null, 'claude', c.claude::text, (p_value = 'true')::text, p_reason);
  elsif p_field = 'msg' then
    update platform_ctl set msg = left(btrim(p_value), 500) where id = 1; perform ctl_log('platform', null, 'msg', c.msg, left(btrim(p_value), 500), p_reason);
  else raise exception 'حقل غير معروف.'; end if;
  perform ctl_bump(nm);
  return jsonb_build_object('ok', true, 'changed', true);
end $$;

create or replace function ctl_audit_log(p_limit int default 200, p_days int default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not ctl_is_admin() then raise exception 'هذا الإجراء لمسؤول المنصة فقط.' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(a) - 'by_id' order by a.at desc), '[]') from
          (select * from ctl_audit where p_days is null or at > now() - make_interval(days => p_days) order by at desc limit least(greatest(coalesce(p_limit, 200), 1), 1000)) a);
end $$;

-- ---------- تذاكر المزامنة ----------
create or replace function sync_sig(p text) returns text language sql stable security definer set search_path = public, extensions as $$
  select encode(extensions.hmac(p, (select k from ctl_secret where id = 1), 'sha256'), 'hex')
$$;
revoke all on function sync_sig(text) from public, anon, authenticated;

create or replace function sync_begin(p_svc text, p_key text, p_detail text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s integ_service%rowtype; r sync_run%rowtype; nm text; iid text; ex timestamptz := now() + interval '30 minutes';
begin
  if auth.uid() is null or me_role() is null then raise exception 'سجّل الدخول أولاً.' using errcode = '42501'; end if;
  select * into s from integ_service where id = p_svc;
  if not found then raise exception 'الخدمة غير معرّفة.'; end if;
  if not s.enabled then raise exception 'خدمة «%» معطلة من مسؤول المنصة.', s.name using errcode = '42501'; end if;
  if not svc_allowed(p_svc) then raise exception 'لا تملك صلاحية تنفيذ «%».', s.name using errcode = '42501'; end if;
  update sync_run set status = 'expired' where status = 'running' and exp < now();
  -- منع التكرار المتزامن للعملية نفسها: المفتاح نفسه للمستخدم نفسه يعيد التذكرة القائمة
  select * into r from sync_run where svc = p_svc and key = left(p_key, 200) and by_id = auth.uid() and status = 'running' order by at desc limit 1;
  if found then
    return jsonb_build_object('id', r.id, 'exp', r.exp, 'tk', r.id || '.' || extract(epoch from r.exp)::bigint || '.' || sync_sig(r.id || '|' || r.svc || '|' || extract(epoch from r.exp)::bigint), 'dup', true);
  end if;
  select name into nm from app_user where id = auth.uid();
  iid := 'SR' || to_char(now() at time zone 'utc', 'YYMMDDHH24MISS') || substr(md5(random()::text), 1, 6);
  insert into sync_run (id, exp, by_id, by_name, svc, key, detail) values (iid, ex, auth.uid(), nm, p_svc, left(p_key, 200), left(p_detail, 500));
  update integ_service set last_run = now(), last_status = 'running' where id = p_svc;
  return jsonb_build_object('id', iid, 'exp', ex, 'tk', iid || '.' || extract(epoch from ex)::bigint || '.' || sync_sig(iid || '|' || p_svc || '|' || extract(epoch from ex)::bigint), 'dup', false);
end $$;

-- يستدعيه الجسر داخل رايات (بلا جلسة حاضر): يتحقق من التوقيع والصلاحية والحالة الآن
create or replace function sync_check(p_tk text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a text[] := string_to_array(coalesce(p_tk, ''), '.'); r sync_run%rowtype; s integ_service%rowtype;
begin
  if array_length(a, 1) <> 3 then return jsonb_build_object('ok', false, 'msg', 'تذكرة المزامنة غير صالحة. انسخ الحزمة من منصة حاضر مرة أخرى.'); end if;
  select * into r from sync_run where id = a[1];
  if not found or a[3] <> sync_sig(r.id || '|' || r.svc || '|' || a[2]) or extract(epoch from r.exp)::bigint::text <> a[2] then
    return jsonb_build_object('ok', false, 'msg', 'تذكرة المزامنة غير صالحة. انسخ الحزمة من منصة حاضر مرة أخرى.');
  end if;
  update sync_run set checks = checks + 1 where id = r.id;
  if r.checks >= 30 then return jsonb_build_object('ok', false, 'msg', 'استُخدمت التذكرة مرات كثيرة. ابدأ عملية جديدة من حاضر.'); end if;
  select * into s from integ_service where id = r.svc;
  if not s.enabled then return jsonb_build_object('ok', false, 'msg', format('خدمة «%s» معطلة الآن من مسؤول المنصة. لم يُنفَّذ شيء.', s.name)); end if;
  if r.status <> 'running' then return jsonb_build_object('ok', false, 'msg', 'انتهت هذه العملية أو أُوقفت. ابدأ عملية جديدة من حاضر.'); end if;
  if r.exp < now() then update sync_run set status = 'expired' where id = r.id; return jsonb_build_object('ok', false, 'msg', 'انتهت صلاحية التذكرة (30 دقيقة). انسخ الحزمة من جديد.'); end if;
  if (select mode from platform_ctl where id = 1) <> 'public' then return jsonb_build_object('ok', false, 'msg', 'منصة حاضر في وضع الصيانة الآن. لم يُنفَّذ شيء.'); end if;
  return jsonb_build_object('ok', true, 'svc', r.svc, 'name', s.name, 'retry', (select retry from integ_system where id = s.system));
end $$;

create or replace function sync_end(p_id text, p_status text, p_n int default null, p_detail text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r sync_run%rowtype; s integ_service%rowtype;
begin
  select * into r from sync_run where id = p_id for update;
  if not found or (r.by_id <> auth.uid() and not ctl_is_admin()) then raise exception 'العملية غير موجودة.' using errcode = '42501'; end if;
  if p_status not in ('ok', 'fail', 'partial', 'cancelled') then raise exception 'حالة غير معروفة.'; end if;
  if r.status <> 'running' then return jsonb_build_object('ok', true, 'already', r.status); end if;
  update sync_run set status = p_status, done_at = now(), n = p_n, detail = left(coalesce(p_detail, detail), 1000) where id = p_id;
  select * into s from integ_service where id = r.svc;
  update integ_service set last_run = now(), last_status = p_status, last_count = p_n where id = r.svc;
  update integ_system set last_sync = now(),
    last_ok = case when p_status = 'ok' then now() else last_ok end,
    last_error = case when p_status in ('fail', 'partial') then left(regexp_replace(coalesce(p_detail, ''), '(?i)(token|password|secret)\S*', '***', 'g'), 500) else last_error end,
    last_error_at = case when p_status in ('fail', 'partial') then now() else last_error_at end
    where id = s.system;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- أدوات إدارة Claude ----------
-- تُستدعى من Claude بجلسة المسؤول (عبر موصل Supabase)، ويُسجَّل كل أمر بقناة «claude».
create or replace function claude_tool(p_tool text, p_args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c platform_ctl%rowtype; out jsonb; v_crn text := p_args->>'crn';
begin
  perform set_config('haader.via', 'claude', true);
  if not ctl_is_admin() then raise exception 'أدوات Claude لمسؤول المنصة فقط.' using errcode = '42501'; end if;
  select * into c from platform_ctl where id = 1;
  if not c.claude and p_tool <> 'get_platform_status' then
    raise exception 'إدارة المنصة عبر Claude معطلة. تُفعَّل من «إدارة تشغيل المنصة» داخل حاضر.' using errcode = '42501';
  end if;
  perform ctl_rate();
  case p_tool
  when 'get_platform_status' then
    out := jsonb_build_object('mode', c.mode, 'channel', c.channel, 'claude', c.claude, 'msg', c.msg, 'ver', c.ver, 'changed_at', c.at, 'changed_by', c.by_name,
      'sections', (select count(*) from doc where col = 'sections'), 'trainees', (select count(distinct r->>'id') from doc, jsonb_array_elements(data->'rows') r where col = 'sections'),
      'trainers', (select count(*) from app_user where active and role = 'trainer'),
      'services', (select jsonb_object_agg(id, jsonb_build_object('visible', visible, 'enabled', enabled, 'auth', auth_mode)) from integ_service where impl),
      'taqni_links', (select count(*) filter (where enabled) || '/' || count(*) from taqni_link));
  when 'enable_public_access' then out := ctl_platform_set('mode', 'public', p_args->>'reason');
  when 'disable_public_access' then out := ctl_platform_set('mode', 'closed', p_args->>'reason');
  when 'enable_maintenance_mode' then
    if coalesce(p_args->>'msg', '') <> '' then perform ctl_platform_set('msg', p_args->>'msg', p_args->>'reason'); end if;
    out := ctl_platform_set('mode', 'maintenance', p_args->>'reason');
  when 'disable_maintenance_mode' then out := ctl_platform_set('mode', 'public', p_args->>'reason');
  when 'set_access_channel' then out := ctl_platform_set('channel', p_args->>'channel', p_args->>'reason');
  when 'get_users' then
    out := (select jsonb_agg(jsonb_build_object('id', legacy_id, 'name', name, 'username', username, 'role', role, 'active', active) order by role, name) from app_user);
  when 'manage_users' then
    if p_args->>'action' not in ('activate', 'deactivate') then raise exception 'manage_users: action = activate | deactivate'; end if;
    if (select legacy_id from app_user where id = auth.uid()) = p_args->>'id' then raise exception 'لا يُعطَّل حساب المسؤول المنفّذ.'; end if;
    update app_user set active = (p_args->>'action' = 'activate') where legacy_id = p_args->>'id';
    if not found then raise exception 'الحساب غير موجود.'; end if;
    perform ctl_log('platform', null, 'user:' || (p_args->>'id'), null, p_args->>'action', p_args->>'reason');
    out := jsonb_build_object('ok', true);
  when 'get_courses' then
    out := (select jsonb_agg(jsonb_build_object('course', course, 'code', code, 'sections', secs) order by course) from
            (select data->>'course' course, max(data->>'code') code, jsonb_agg(id order by id) secs from doc where col = 'sections' group by data->>'course') x);
  when 'get_sections' then
    out := (select jsonb_agg(jsonb_build_object('crn', d.id, 'course', d.data->>'course', 'code', d.data->>'code', 'kind', d.data->>'kind',
              'trainer', (select name from app_user where legacy_id = d.data->>'trainer'), 'trainees', jsonb_array_length(coalesce(d.data->'rows', '[]')),
              'lectures', jsonb_array_length(coalesce(d.data->'dates', '[]')), 'taqni', (select jsonb_build_object('enabled', t.enabled, 'course_id', t.course_id) from taqni_link t where t.crn = d.id)) order by d.id)
            from doc d where d.col = 'sections');
  when 'get_trainees' then
    if v_crn is null then raise exception 'get_trainees يتطلب crn.'; end if;
    out := (select jsonb_agg(jsonb_build_object('id', r->>'id', 'name', r->>'name')) from doc, jsonb_array_elements(data->'rows') r where col = 'sections' and id = v_crn);
  when 'manage_sections', 'manage_trainees' then out := roster_apply(coalesce(p_args->'payload', p_args));
  when 'get_grades' then
    if v_crn is null then raise exception 'get_grades يتطلب crn.'; end if;
    out := jsonb_build_object('gsec', (select data - 'rows' from doc where col = 'gsec' and id = v_crn),
      'rows', (select jsonb_agg(jsonb_build_object('id', r->>'id', 'name', r->>'name', 'eligible', r->'el', 'items', (select data#>array['s', r->>'id'] from doc where col = 'gmarks' and id = v_crn)))
               from doc, jsonb_array_elements(data->'rows') r where col = 'gsec' and id = v_crn));
  when 'manage_grades' then raise exception 'تعديل الدرجات لا يتم عبر Claude: يُرصد من صفحات الدرجات بحساب المدرب لتبقى المسؤولية والتوثيق عنده.';
  when 'manage_courses' then raise exception 'المقررات تُدار من صفحة «الشعب» أو «إدارة الشعب والمتدربين».';
  when 'get_attendance' then
    if v_crn is null then raise exception 'get_attendance يتطلب crn.'; end if;
    out := (select jsonb_build_object('crn', v_crn, 'dates', s.data->'dates', 'marks', m.data->'m') from doc s left join doc m on m.col = 'marks' and m.id = s.id where s.col = 'sections' and s.id = v_crn);
  when 'get_platform_reports' then
    out := jsonb_build_object('sections', (select count(*) from doc where col = 'sections'),
      'trainees', (select count(distinct r->>'id') from doc, jsonb_array_elements(data->'rows') r where col = 'sections'),
      'logins_7d', (select count(*) from doc where col = 'logins' and updated_at > now() - interval '7 days'),
      'roster_imports_7d', (select count(*) from roster_import where at > now() - interval '7 days'),
      'grade_imports_7d', (select count(*) from grade_import where at > now() - interval '7 days'),
      'sync_runs_7d', (select jsonb_object_agg(status, n) from (select status, count(*) n from sync_run where at > now() - interval '7 days' group by status) x));
  when 'get_audit_logs' then
    out := jsonb_build_object('control', ctl_audit_log(200, coalesce((p_args->>'days')::int, 7)),
      'platform', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'by', by_name, 'act', act, 'det', det) order by at desc), '[]') from
                   (select * from audit where at > now() - make_interval(days => coalesce((p_args->>'days')::int, 7)) order by at desc limit 300) a));
  when 'get_taqni_integration_status' then
    out := jsonb_build_object('system', (select to_jsonb(s) from integ_system s where id = 'taqni'),
      'services', (select jsonb_agg(to_jsonb(x) order by sort) from integ_service x where system = 'taqni'),
      'links', (select coalesce(jsonb_agg(to_jsonb(t) order by crn), '[]') from taqni_link t), 'lti', (select coalesce(jsonb_agg(jsonb_build_object('issuer', issuer, 'client_id', client_id, 'active', active)), '[]') from lti_platform));
  when 'manage_taqni_section_links' then out := taqni_link_set(v_crn, coalesce(p_args->'patch', '{}'::jsonb), p_args->>'reason');
  when 'enable_taqni_integration' then out := ctl_bulk('taqni', 'enabled', true, coalesce(p_args->>'reason', 'عبر Claude'));
  when 'disable_taqni_integration' then out := ctl_bulk('taqni', 'enabled', false, coalesce(p_args->>'reason', 'عبر Claude'));
  else raise exception 'أداة غير معروفة: %', p_tool;
  end case;
  if p_tool like 'get\_%' then perform ctl_log('claude', null, 'read', null, p_tool, null); end if;
  return jsonb_build_object('tool', p_tool, 'ok', true, 'result', out, 'at', now());
end $$;
