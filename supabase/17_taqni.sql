-- =====================================================================
-- منصة حاضر: الربط مع منصة تقني لكل شعبة
-- - taqni_link: جدول الربط المركزي بين الشعبة في حاضر ومقررها في تقني، وخدمات إعلان الشعبة وترتيبها
--   وأدوارها، ومدة الإتاحة، والتفعيل والإيقاف المؤقت دون حذف الإعدادات.
-- - الرابط الموقّع لكل شعبة: <crn>.<ver>.<HMAC>؛ تغيير الإصدار يبطل الروابط السابقة. الرابط وحده لا يعطي أي بيانات:
--   بعد الدخول يتحقق الخادم (taqni_enter) من أن المستخدم مدرب الشعبة أو متدرب مسجل فيها، ويعيد الخدمات المسموحة لدوره.
-- - lti_platform: إعداد LTI 1.3 لمنصة تقني (يملؤه مسؤول تقني عند تسجيل حاضر أداةً خارجية).
-- =====================================================================
create table if not exists taqni_link (
  crn text primary key,
  course_id text, course_name text,
  enabled boolean not null default false,
  title text not null default 'خدمات منصة حاضر',
  link_label text not null default 'الدخول إلى منصة حاضر',
  services jsonb not null default '[{"k":"home","on":true,"roles":["trainer","trainee"]},{"k":"attendance","on":true,"roles":["trainer","trainee"]},{"k":"reports","on":true,"roles":["trainer","trainee"]}]'::jsonb,
  start_at timestamptz, end_at timestamptz,
  ver int not null default 1,
  posted_at timestamptz, posted_by text, posted_note text,
  created_at timestamptz not null default now(), created_by text,
  updated_at timestamptz not null default now(), updated_by text
);
create table if not exists lti_platform (
  id bigserial primary key, issuer text not null, client_id text not null,
  auth_endpoint text not null, token_endpoint text, jwks_url text not null,
  deployment_ids text[] not null default '{}', active boolean not null default true,
  created_at timestamptz not null default now(), unique (issuer, client_id)
);
alter table taqni_link enable row level security; alter table lti_platform enable row level security;
revoke all on taqni_link, lti_platform from anon, authenticated;

create or replace function taqni_services_catalog() returns jsonb language sql immutable as $$
  select '[{"k":"home","n":"الدخول إلى منصة حاضر","v":"home"},
           {"k":"checkin","n":"تسجيل الحضور","v":"qr"},
           {"k":"attendance","n":"عرض سجل الحضور","v":"roll"},
           {"k":"homework","n":"متابعة الواجبات","v":"grades"},
           {"k":"notices","n":"الإعلانات والتنبيهات","v":"alerts"},
           {"k":"exams","n":"متابعة الاختبارات","v":"gexams"},
           {"k":"reports","n":"تقارير المتدرب","v":"reports"},
           {"k":"trainer","n":"خدمات المدرب وإدارة الشعبة","v":"roster"}]'::jsonb
$$;

create or replace function taqni_token(p_crn text) returns text
language sql stable security definer set search_path = public as $$
  select t.crn || '.' || t.ver || '.' || left(sync_sig('taqni|' || t.crn || '|' || t.ver), 32) from taqni_link t where t.crn = p_crn
$$;
revoke all on function taqni_token(text) from public, anon, authenticated;

create or replace function taqni_link_set(p_crn text, p_patch jsonb, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t taqni_link%rowtype; nm text; k text; was boolean; cat jsonb := taqni_services_catalog(); sv jsonb;
begin
  perform ctl_need_admin();
  if not exists (select 1 from doc where col = 'sections' and id = p_crn) then raise exception 'الشعبة % غير موجودة في حاضر.', p_crn; end if;
  for k in select jsonb_object_keys(p_patch) loop
    if k not in ('course_id', 'course_name', 'enabled', 'title', 'link_label', 'services', 'start_at', 'end_at', 'posted_note', 'posted', 'revoke') then raise exception 'حقل غير معروف: %', k; end if;
  end loop;
  select name into nm from app_user where id = auth.uid();
  insert into taqni_link (crn, created_by, course_name) values (p_crn, nm, (select data->>'course' from doc where col = 'sections' and id = p_crn)) on conflict (crn) do nothing;
  select * into t from taqni_link where crn = p_crn for update;
  was := t.enabled;
  if p_patch ? 'services' then
    -- الخدمات المعروفة وحدها، وبالترتيب المرسل، وبالأدوار المسموحة فقط
    select coalesce(jsonb_agg(jsonb_build_object('k', x->>'k', 'on', coalesce((x->>'on')::boolean, true),
             'roles', coalesce((select jsonb_agg(r) from jsonb_array_elements_text(coalesce(x->'roles', '["trainer","trainee"]')) r where r in ('trainer', 'trainee')), '[]'::jsonb)) order by o), '[]')
      into sv from jsonb_array_elements(p_patch->'services') with ordinality as e(x, o)
      where exists (select 1 from jsonb_array_elements(cat) c where c->>'k' = x->>'k');
  end if;
  update taqni_link set
    course_id = coalesce(nullif(btrim(p_patch->>'course_id'), ''), case when p_patch ? 'course_id' then null else course_id end),
    course_name = coalesce(nullif(btrim(p_patch->>'course_name'), ''), course_name),
    enabled = coalesce((p_patch->>'enabled')::boolean, enabled),
    title = coalesce(nullif(left(btrim(p_patch->>'title'), 120), ''), title),
    link_label = coalesce(nullif(left(btrim(p_patch->>'link_label'), 80), ''), link_label),
    services = coalesce(sv, services),
    start_at = case when p_patch ? 'start_at' then nullif(p_patch->>'start_at', '')::timestamptz else start_at end,
    end_at = case when p_patch ? 'end_at' then nullif(p_patch->>'end_at', '')::timestamptz else end_at end,
    posted_at = case when coalesce((p_patch->>'posted')::boolean, false) then now() else posted_at end,
    posted_by = case when coalesce((p_patch->>'posted')::boolean, false) then nm else posted_by end,
    posted_note = coalesce(p_patch->>'posted_note', posted_note),
    ver = ver + case when coalesce((p_patch->>'revoke')::boolean, false) then 1 else 0 end,
    updated_at = now(), updated_by = nm
  where crn = p_crn;
  perform ctl_log('taqni', 'link:' || p_crn, 'link', to_jsonb(t)::text, p_patch::text, p_reason);
  perform ctl_bump(nm);
  return jsonb_build_object('ok', true, 'link', (select to_jsonb(x) from taqni_link x where crn = p_crn), 'token', taqni_token(p_crn));
end $$;

create or replace function taqni_links() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not ctl_is_admin() then raise exception 'هذا الإجراء لمسؤول المنصة فقط.' using errcode = '42501'; end if;
  return jsonb_build_object('catalog', taqni_services_catalog(),
    'sections', (select coalesce(jsonb_agg(jsonb_build_object('crn', d.id, 'course', d.data->>'course', 'code', d.data->>'code', 'kind', d.data->>'kind',
        'trainer', (select name from app_user where legacy_id = d.data->>'trainer'), 'n', jsonb_array_length(coalesce(d.data->'rows', '[]')),
        'link', (select to_jsonb(t) from taqni_link t where t.crn = d.id), 'token', taqni_token(d.id)) order by d.id), '[]') from doc d where d.col = 'sections'),
    'lti', (select coalesce(jsonb_agg(jsonb_build_object('issuer', issuer, 'client_id', client_id, 'active', active)), '[]') from lti_platform));
end $$;

-- قبل الدخول (من إعلان الشعبة): عنوان الإعلان وحالته فقط، دون أي بيانات متدربين
create or replace function taqni_public(p_tk text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a text[] := string_to_array(coalesce(p_tk, ''), '.'); t taqni_link%rowtype; c platform_ctl%rowtype;
begin
  select * into c from platform_ctl where id = 1;
  if array_length(a, 1) <> 3 then return jsonb_build_object('ok', false, 'msg', 'رابط الشعبة غير صالح.'); end if;
  select * into t from taqni_link where crn = a[1];
  if not found or a[2] <> t.ver::text or a[3] <> left(sync_sig('taqni|' || t.crn || '|' || t.ver), 32) then
    return jsonb_build_object('ok', false, 'msg', 'رابط الشعبة غير صالح أو أُلغي. اطلب الرابط المحدّث من مسؤول المنصة.');
  end if;
  if not t.enabled or not (select enabled from integ_service where id = 'taqni.embed') then return jsonb_build_object('ok', false, 'msg', 'رابط حاضر لهذه الشعبة موقوف حالياً.'); end if;
  if (t.start_at is not null and now() < t.start_at) or (t.end_at is not null and now() > t.end_at) then return jsonb_build_object('ok', false, 'msg', 'رابط حاضر لهذه الشعبة خارج مدة الإتاحة.'); end if;
  return jsonb_build_object('ok', true, 'crn', t.crn, 'course', t.course_name, 'title', t.title, 'mode', c.mode, 'msg', case when c.mode <> 'public' then c.msg end);
end $$;

-- بعد الدخول: تحقق الخادم من الهوية والصلة بالشعبة، وربط الجلسة بقناة تقني
create or replace function taqni_enter(p_tk text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pub jsonb := taqni_public(p_tk); t taqni_link%rowtype; u app_user%rowtype; tr text; role text; sid uuid := nullif(auth.jwt()->>'session_id', '')::uuid; sv jsonb;
begin
  if auth.uid() is null then raise exception 'سجّل الدخول أولاً.' using errcode = '42501'; end if;
  if not (pub->>'ok')::boolean then return pub; end if;
  select * into t from taqni_link where crn = pub->>'crn';
  select * into u from app_user where id = auth.uid() and active;
  if found then
    role := case when u.role = 'admin' then 'trainer'
                 when u.role in ('trainer', 'head') and exists (select 1 from doc where col = 'sections' and id = t.crn and data->>'trainer' = u.legacy_id) then 'trainer' end;
  else
    select trainee_id into tr from trainee_account where user_id = auth.uid() and st <> 'disabled';
    if tr is not null and exists (select 1 from doc where col = 'sections' and id = t.crn and data->'rows' @> jsonb_build_array(jsonb_build_object('id', tr))) then role := 'trainee'; end if;
  end if;
  if role is null then
    insert into audit (by_id, by_name, act, det) values (auth.uid(), coalesce(u.name, tr), 'taqni-deny', 'محاولة دخول من رابط تقني لشعبة غير مرتبطة بالحساب: ' || t.crn);
    return jsonb_build_object('ok', false, 'msg', 'حسابك غير مرتبط بهذه الشعبة، فلا تُعرض بياناتها.');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('k', x->>'k', 'n', c->>'n', 'v', c->>'v') order by o), '[]') into sv
    from jsonb_array_elements(t.services) with ordinality e(x, o) join jsonb_array_elements(taqni_services_catalog()) c on c->>'k' = x->>'k'
    where coalesce((x->>'on')::boolean, true) and x->'roles' ? role;
  if sid is not null then
    insert into ctl_session (session_id, user_id, channel, crn, exp) values (sid, auth.uid(), 'taqni-link', t.crn, now() + interval '12 hours')
      on conflict (session_id) do update set crn = excluded.crn, exp = excluded.exp;
  end if;
  return jsonb_build_object('ok', true, 'crn', t.crn, 'course', t.course_name, 'title', t.title, 'role', role, 'services', sv, 'gate', ctl_gate_open());
end $$;

-- ---------- الصلاحيات على الدوال ----------
do $$ declare f text; begin
  foreach f in array array['ctl_gate_open()', 'ctl_is_admin()', 'ctl_log(text,text,text,text,text,text)', 'ctl_rate()', 'ctl_need_admin()', 'ctl_bump(text)',
    'svc_allowed(text)', 'ctl_overview()', 'ctl_service_set(text,text,boolean,text)', 'ctl_service_auth(text,text,text[],text[],text)', 'ctl_bulk(text,text,boolean,text)',
    'ctl_system_set(text,jsonb,text)', 'ctl_platform_set(text,text,text)', 'ctl_audit_log(int,int)', 'sync_begin(text,text,text)', 'sync_end(text,text,int,text)',
    'claude_tool(text,jsonb)', 'taqni_link_set(text,jsonb,text)', 'taqni_links()', 'taqni_enter(text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['ctl_config()', 'sync_check(text)', 'taqni_public(text)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
