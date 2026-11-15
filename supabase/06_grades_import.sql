-- =====================================================================
-- منصة حاضر: استيراد الدرجات من Excel على الخادم (التحقق والحفظ والتراجع)
-- - grade_import: سجل كل عملية استيراد بقيمها القديمة والجديدة (للتراجع والتدقيق)
-- - grade_check(): التحقق من درجة واحدة كما في المنصة (رقم، غير سالب، لا يتجاوز الحد، خانتان)
-- - grades_import(): يتحقق من الصلاحية والمصنف وكل خلية، ثم يحفظ في gmarks ويسجل
-- - grades_import_undo(): يعيد القيم السابقة لما لم يُعدَّل بعد الاستيراد
-- - doc_guard_gmarks: كل كتابة على الدرجات (يدوية أو غيرها) تمر بالتحقق نفسه على الخادم
-- =====================================================================

create table if not exists grade_import (
  id          text primary key,
  crn         text not null,
  at          timestamptz not null default now(),
  by_uid      uuid,
  by_legacy   text,
  by_name     text,
  file        text,
  wb          jsonb not null default '{}'::jsonb,   -- معرّف المصنف: الفصل والمدرب والشعب
  overwrite   boolean not null default false,
  n_add       int not null default 0,
  n_chg       int not null default 0,
  n_same      int not null default 0,
  n_kept      int not null default 0,
  n_bad       int not null default 0,
  changes     jsonb not null default '[]'::jsonb,   -- [[الرقم، المكوّن، القديمة، الجديدة]]
  subs        jsonb not null default '{}'::jsonb,   -- البنود قبل الاستيراد {الرقم:{المكوّن: {...}|null}}
  subs_new    jsonb not null default '{}'::jsonb,
  bad         jsonb not null default '[]'::jsonb,
  status      text not null default 'done' check (status in ('done', 'undone')),
  undone_at   timestamptz,
  undone_by   text,
  undo_skip   jsonb not null default '[]'::jsonb
);
create index if not exists grade_import_crn_idx on grade_import(crn, at desc);
alter table grade_import enable row level security;
revoke all on grade_import from anon, authenticated;

-- مالك شعبة الدرجات: مدرب شعبة التحضير، وإلا المسند في gsec
create or replace function grade_owner(p_crn text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(d.data->>'trainer', '') from doc d where d.col = 'sections' and d.id = p_crn),
    (select nullif(g.data->>'trainer', '') from doc g where g.col = 'gsec' and g.id = p_crn
       and exists (select 1 from doc a where a.col = 'accounts' and a.id = g.data->>'trainer')))
$$;

-- من يعمل في الشعبة: مدربها وحده، والشعبة غير المسندة لمسؤول المنصة (كما في الواجهة)
create or replace function grade_may(p_crn text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when me_role() is null or me_role() = 'viewer' then false
              when grade_owner(p_crn) is not null then grade_owner(p_crn) = my_legacy()
              else me_role() = 'admin' end
$$;

-- حالة الشعبة: مغلقة، أو عملية رفع جارية، أو مجمدة بعد الاعتماد
create or replace function grade_gate(p_sec jsonb) returns text
language sql immutable as $$
  select case
    when p_sec is null then 'الشعبة غير موجودة في قاعدة بيانات الدرجات.'
    when (p_sec #>> '{flow,closed,at}') is not null and coalesce((p_sec #>> '{flow,corr,open}')::boolean, false) = false
      then 'عملية الرصد مغلقة. أي تعديل يتطلب إجراء تصحيح موثقاً ومراجعة جديدة.'
    when (p_sec #>> '{flow,op,st}') = 'prepared' then 'توجد عملية رفع جارية لهذه الشعبة. أنهِها أو ألغِها قبل التعديل.'
    when coalesce((p_sec #>> '{flow,lock,on}')::boolean, false) then 'الدرجات مجمدة بعد الاعتماد. التعديل يتطلب فك التجميد ممن يملك الصلاحية.'
    else null end
$$;

-- قيمة رقمية من خلية (رقم، أو نص بأرقام عربية أو إنجليزية). null للفارغ، و'NaN' للنص
create or replace function grade_num(p jsonb) returns numeric
language plpgsql immutable as $$
declare s text;
begin
  if p is null or jsonb_typeof(p) = 'null' then return null; end if;
  if jsonb_typeof(p) = 'number' then return (p #>> '{}')::numeric; end if;
  if jsonb_typeof(p) <> 'string' then return 'NaN'::numeric; end if;
  s := btrim(translate(p #>> '{}', '٠١٢٣٤٥٦٧٨٩٫،', '0123456789..'));
  if s = '' or s ~ '^[—–-]+$' then return null; end if;
  if s !~ '^-?[0-9]+(\.[0-9]+)?$' then return 'NaN'::numeric; end if;
  return s::numeric;
end $$;

-- التحقق من درجة واحدة: يعيد نص الخطأ أو null
create or replace function grade_check(p_k text, p_v numeric, p_max numeric) returns text
language sql immutable as $$
  select case
    when p_max is null or p_max <= 0 then format('الحد الأعلى للمكوّن %s غير معرّف في توزيع الدرجات.', p_k)
    when p_v is null then null
    when p_v = 'NaN'::numeric then format('حقل الدرجة في %s يقبل الأرقام فقط.', p_k)
    when p_v < 0 then format('لا تُقبل الدرجات السالبة (%s في %s).', p_v, p_k)
    when p_v > p_max then format('الدرجة %s في %s تتجاوز الحد الأعلى المعتمد %s.', p_v, p_k, p_max)
    when round(p_v, 2) <> p_v then format('الدرجة %s في %s فيها أكثر من خانتين عشريتين.', p_v, p_k)
    else null end
$$;

create or replace function grade_comp_max(p_sec jsonb, p_k text) returns numeric
language sql immutable as $$
  select (c->>'max')::numeric from jsonb_array_elements(coalesce(p_sec->'comps', '[]'::jsonb)) c where c->>'k' = p_k limit 1
$$;

-- ---------------------------------------------------------------------
-- الاستيراد. p_rows: [{"id":"…","k":"LEC2","v":18}]  p_items: {"الرقم":{"LEC1":{"الواجبات":5,…}}}
-- p_wb: معرّف المصنف {"id","term","trainer","crns":[…]} (فارغ للمصنفات القديمة)
-- ---------------------------------------------------------------------
create or replace function grades_import(p_crn text, p_rows jsonb, p_items jsonb default '{}'::jsonb,
  p_overwrite boolean default false, p_file text default '', p_wb jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sec jsonb; mk jsonb; gate text; me text := my_legacy(); nm text; iid text; iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  r jsonb; tid text; k text; v numeric; mx numeric; err text; row jsonb; old numeric; okey text;
  seen jsonb := '{}'::jsonb; bad jsonb := '[]'::jsonb; chg jsonb := '[]'::jsonb; vals jsonb := '[]'::jsonb;
  pg jsonb := '{}'::jsonb; pt jsonb := '{}'::jsonb; ps jsonb := '{}'::jsonb; subs_old jsonb := '{}'::jsonb;
  n_add int := 0; n_chg int := 0; n_same int := 0; n_kept int := 0;
  it jsonb; its jsonb; e record; iv numeric; imax numeric; tot numeric; missing int; ibad boolean; one jsonb;
begin
  if me_role() is null then raise exception 'سجّل الدخول أولاً.' using errcode = '42501'; end if;
  if not grade_may(p_crn) then raise exception 'الشعبة % غير مسندة إليك، فلا تُستورد درجاتها.', p_crn using errcode = '42501'; end if;
  select data into sec from doc where col = 'gsec' and id = p_crn for update;
  gate := grade_gate(sec);
  if gate is not null then raise exception '%', gate using errcode = 'P0001'; end if;
  -- معرّف المصنف: لا يُقبل مصنف فصل تدريبي آخر ولا مصنف مدرب آخر ولا شعبة خارج المصنف
  if coalesce(p_wb->>'id', '') <> '' then
    if coalesce(p_wb->>'term', '') <> coalesce(sec->>'term', '') then
      raise exception 'هذا المصنف للفصل «%» والشعبة % مسجلة في «%». نزّل نموذجاً جديداً من المنصة.', p_wb->>'term', p_crn, sec->>'term' using errcode = 'P0001'; end if;
    if coalesce(p_wb->>'trainer', '') <> coalesce(me, '') then
      raise exception 'هذا المصنف أُنشئ لحساب مدرب آخر، فلا تُستورد منه درجات بحسابك.' using errcode = '42501'; end if;
    if not coalesce(p_wb->'crns', '[]'::jsonb) ? p_crn then
      raise exception 'الشعبة % ليست ضمن شعب هذا المصنف.', p_crn using errcode = 'P0001'; end if;
  end if;
  select data into mk from doc where col = 'gmarks' and id = p_crn for update;
  mk := coalesce(mk, '{}'::jsonb);
  select name into nm from app_user where id = auth.uid();

  -- 1) البنود التفصيلية: كل بند يُتحقق منه، والمكوّن = مجموعها عند اكتمالها
  for e in select key as tid, value as kv from jsonb_each(coalesce(p_items, '{}'::jsonb)) loop
    row := (select x from jsonb_array_elements(sec->'rows') x where x->>'id' = e.tid limit 1);
    if row is null then bad := bad || jsonb_build_object('id', e.tid, 'msg', format('الرقم التدريبي %s غير موجود في الشعبة %s.', e.tid, p_crn)); continue; end if;
    if not coalesce((row->>'el')::boolean, false) then bad := bad || jsonb_build_object('id', e.tid, 'msg', format('%s: غير قابل للرصد (%s)، فلم تُستورد درجاته.', row->>'name', coalesce(row->>'st', ''))); continue; end if;
    for k, it in select key, value from jsonb_each(e.kv) loop
      its := sec->'items'->k;
      if its is null or jsonb_typeof(its) <> 'array' then bad := bad || jsonb_build_object('id', e.tid, 'k', k, 'msg', format('%s: المكوّن %s بلا بنود في التوزيع المعتمد.', row->>'name', k)); continue; end if;
      mx := grade_comp_max(sec, k);
      if mx is null then bad := bad || jsonb_build_object('id', e.tid, 'k', k, 'msg', format('المكوّن %s غير معتمد في توزيع الشعبة %s.', k, p_crn)); continue; end if;
      if (select sum((x->>'max')::numeric) from jsonb_array_elements(its) x) <> mx then
        bad := bad || jsonb_build_object('id', e.tid, 'k', k, 'msg', format('مجموع حدود بنود %s لا يساوي حدها المعتمد %s.', k, mx)); continue; end if;
      one := '{}'::jsonb; tot := 0; missing := 0; ibad := false;
      for r in select x from jsonb_array_elements(its) x loop
        imax := (r->>'max')::numeric; iv := grade_num(it->(r->>'n'));
        if iv is null then missing := missing + 1; continue; end if;
        err := grade_check(r->>'n', iv, imax);
        if err is not null then ibad := true; bad := bad || jsonb_build_object('id', e.tid, 'k', k, 'msg', format('%s: %s (%s)', row->>'name', err, k)); continue; end if;
        one := one || jsonb_build_object(r->>'n', iv); tot := tot + iv;
      end loop;
      if ibad then continue; end if;
      if one = '{}'::jsonb then continue; end if;
      subs_old := jsonb_set(subs_old, array[e.tid], coalesce(subs_old->e.tid, '{}'::jsonb) || jsonb_build_object(k, coalesce(mk->'s'->e.tid->k, 'null'::jsonb)));
      ps := jsonb_set(ps, array[e.tid], coalesce(ps->e.tid, '{}'::jsonb) || jsonb_build_object(k, one));
      if missing > 0 then
        bad := bad || jsonb_build_object('id', e.tid, 'k', k, 'msg', format('%s: بنود %s ناقصة (%s من %s)، فحُفظت البنود ولم تُحسب درجة %s.', row->>'name', k, jsonb_array_length(its) - missing, jsonb_array_length(its), k));
      else
        vals := vals || jsonb_build_object('id', e.tid, 'k', k, 'v', tot);
      end if;
    end loop;
  end loop;

  -- 2) درجات المكوّنات المباشرة
  for r in select x from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x loop
    if sec->'items'->(r->>'k') is not null and jsonb_typeof(sec->'items'->(r->>'k')) = 'array' then
      bad := bad || jsonb_build_object('id', r->>'id', 'k', r->>'k', 'msg', format('درجة %s تُحسب من بنودها، فلا تُستورد مباشرة.', r->>'k')); continue; end if;
    vals := vals || r;
  end loop;

  for r in select x from jsonb_array_elements(vals) x loop
    tid := r->>'id'; k := r->>'k'; v := grade_num(r->'v'); okey := tid || '|' || k;
    if v is null then continue; end if;
    if seen ? okey then bad := bad || jsonb_build_object('id', tid, 'k', k, 'msg', format('الرقم التدريبي %s مكرر في المكوّن %s.', tid, k)); continue; end if;
    seen := seen || jsonb_build_object(okey, true);
    row := (select x from jsonb_array_elements(sec->'rows') x where x->>'id' = tid limit 1);
    if row is null then bad := bad || jsonb_build_object('id', tid, 'k', k, 'msg', format('الرقم التدريبي %s غير موجود في الشعبة %s.', tid, p_crn)); continue; end if;
    if not coalesce((row->>'el')::boolean, false) then bad := bad || jsonb_build_object('id', tid, 'k', k, 'msg', format('%s: غير قابل للرصد (%s).', row->>'name', coalesce(row->>'st', ''))); continue; end if;
    mx := grade_comp_max(sec, k);
    if mx is null then bad := bad || jsonb_build_object('id', tid, 'k', k, 'msg', format('المكوّن %s غير معتمد في توزيع الشعبة %s.', k, p_crn)); continue; end if;
    err := grade_check(k, v, mx);
    if err is not null then bad := bad || jsonb_build_object('id', tid, 'k', k, 'msg', format('%s: %s', row->>'name', err)); continue; end if;
    old := grade_num(mk->'g'->tid->k);
    if old is not null and old = v then n_same := n_same + 1; continue; end if;
    if old is not null and not p_overwrite then n_kept := n_kept + 1; continue; end if;
    if old is null then n_add := n_add + 1; else n_chg := n_chg + 1; end if;
    chg := chg || jsonb_build_array(jsonb_build_array(tid, k, old, v));
    pg := jsonb_set(pg, array[tid], coalesce(pg->tid, '{}'::jsonb) || jsonb_build_object(k, v));
    pt := jsonb_set(pt, array[tid], coalesce(pt->tid, '{}'::jsonb) || jsonb_build_object(k, jsonb_build_array(iso, me)));
  end loop;

  if chg = '[]'::jsonb and ps = '{}'::jsonb then
    return jsonb_build_object('id', null, 'add', 0, 'chg', 0, 'same', n_same, 'kept', n_kept, 'bad', bad, 'changes', '[]'::jsonb, 's', '{}'::jsonb);
  end if;

  perform set_config('haader.sys', '1', true);
  insert into doc (col, id, data) values ('gmarks', p_crn, jsonb_build_object('g', pg, 't', pt, 's', ps))
  on conflict (col, id) do update set data = jsonb_deep_merge(doc.data, excluded.data);
  perform set_config('haader.sys', '', true);

  iid := 'GI' || to_char(now() at time zone 'utc', 'YYMMDDHH24MISS') || '-' || p_crn || '-' || substr(md5(random()::text), 1, 4);
  insert into grade_import (id, crn, by_uid, by_legacy, by_name, file, wb, overwrite, n_add, n_chg, n_same, n_kept, n_bad, changes, subs, subs_new, bad)
  values (iid, p_crn, auth.uid(), me, nm, left(coalesce(p_file, ''), 200), coalesce(p_wb, '{}'::jsonb), p_overwrite, n_add, n_chg, n_same, n_kept, jsonb_array_length(bad), chg, subs_old, ps, bad);
  insert into audit (by_id, by_name, act, crn, trainee_id, comp, old_val, new_val, det)
  select auth.uid(), nm, 'grade_import', p_crn, c->>0, c->>1, c->>2, c->>3, iid || ' ' || left(coalesce(p_file, ''), 120)
  from jsonb_array_elements(chg) c;
  return jsonb_build_object('id', iid, 'add', n_add, 'chg', n_chg, 'same', n_same, 'kept', n_kept, 'bad', bad, 'changes', chg, 's', ps, 'at', iso, 'by', me);
end $$;

-- ---------------------------------------------------------------------
-- التراجع: يعيد القيمة السابقة لكل خلية لم تتغير بعد الاستيراد، ويبلغ عن غيرها
-- ---------------------------------------------------------------------
create or replace function grades_import_undo(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  gi grade_import%rowtype; sec jsonb; mk jsonb; gate text; c jsonb; cur numeric; me text := my_legacy(); nm text;
  pg jsonb := '{}'::jsonb; ps jsonb := '{}'::jsonb; skip jsonb := '[]'::jsonb; done jsonb := '[]'::jsonb; e record; f record;
  iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  select * into gi from grade_import where id = p_id for update;
  if not found then raise exception 'عملية الاستيراد غير موجودة.' using errcode = 'P0001'; end if;
  if not grade_may(gi.crn) then raise exception 'لا يملك هذا الحساب التراجع عن استيراد الشعبة %.', gi.crn using errcode = '42501'; end if;
  if gi.status = 'undone' then raise exception 'تم التراجع عن هذه العملية من قبل.' using errcode = 'P0001'; end if;
  select data into sec from doc where col = 'gsec' and id = gi.crn for update;
  gate := grade_gate(sec);
  if gate is not null then raise exception '%', gate using errcode = 'P0001'; end if;
  select data into mk from doc where col = 'gmarks' and id = gi.crn for update;
  mk := coalesce(mk, '{}'::jsonb);
  for c in select x from jsonb_array_elements(gi.changes) x loop
    cur := grade_num(mk->'g'->(c->>0)->(c->>1));
    if cur is distinct from (c->>3)::numeric then
      skip := skip || jsonb_build_array(jsonb_build_array(c->>0, c->>1, cur, c->>3)); continue; end if;
    pg := jsonb_set(pg, array[c->>0], coalesce(pg->(c->>0), '{}'::jsonb) || jsonb_build_object(c->>1, c->2));
    done := done || jsonb_build_array(jsonb_build_array(c->>0, c->>1, c->>3, c->2));
  end loop;
  for e in select key as tid, value as kv from jsonb_each(gi.subs) loop
    for f in select key as k, value as ov from jsonb_each(e.kv) loop
      if (mk->'s'->e.tid->f.k) is distinct from (gi.subs_new->e.tid->f.k) then continue; end if;
      ps := jsonb_set(ps, array[e.tid], coalesce(ps->e.tid, '{}'::jsonb) || jsonb_build_object(f.k, f.ov));
    end loop;
  end loop;
  perform set_config('haader.sys', '1', true);
  -- القيم المعادة: null تعني «لا درجة» كما في المنصة. البنود السابقة تُستبدل كاملة
  update doc set data = jsonb_deep_merge(data, jsonb_build_object('g', pg))
    where col = 'gmarks' and id = gi.crn;
  for e in select key as tid, value as kv from jsonb_each(ps) loop
    for f in select key as k, value as ov from jsonb_each(e.kv) loop
      update doc set data = jsonb_set(data, array['s', e.tid, f.k], f.ov, true) where col = 'gmarks' and id = gi.crn;
    end loop;
  end loop;
  perform set_config('haader.sys', '', true);
  select name into nm from app_user where id = auth.uid();
  update grade_import set status = 'undone', undone_at = now(), undone_by = coalesce(nm, me), undo_skip = skip where id = p_id;
  insert into audit (by_id, by_name, act, crn, trainee_id, comp, old_val, new_val, det)
  select auth.uid(), nm, 'grade_import_undo', gi.crn, d->>0, d->>1, d->>2, d->>3, 'تراجع عن ' || p_id from jsonb_array_elements(done) d;
  return jsonb_build_object('id', p_id, 'restored', done, 'skipped', skip, 's', ps, 'at', iso);
end $$;

-- سجل عمليات الاستيراد للشعبة: لمن يعمل فيها ولرئيس القسم ومسؤول المنصة
create or replace function grades_imports(p_crn text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at', at, 'by', by_name, 'file', file, 'overwrite', overwrite,
    'add', n_add, 'chg', n_chg, 'same', n_same, 'kept', n_kept, 'bad', n_bad, 'status', status, 'undone_at', undone_at,
    'undone_by', undone_by, 'changes', changes, 'skip', undo_skip, 'wb', wb) order by at desc), '[]'::jsonb)
  from grade_import where crn = p_crn and (grade_may(p_crn) or me_role() in ('admin', 'head'))
$$;

-- ---------------------------------------------------------------------
-- حارس الدرجات: أي كتابة على gmarks خارج دوال الخادم تمر بالتحقق نفسه
-- ---------------------------------------------------------------------
create or replace function doc_guard_gmarks() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sec jsonb; gate text; e record; f record; v numeric; o numeric; mx numeric; err text; row jsonb; changed boolean := false;
begin
  if coalesce(current_setting('haader.sys', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' and exists (select 1 from doc where col = new.col and id = new.id) then return new; end if;
  select data into sec from doc where col = 'gsec' and id = new.id;
  if sec is null then raise exception 'الشعبة % غير موجودة في قاعدة بيانات الدرجات.', new.id using errcode = 'P0001'; end if;
  for e in select key as tid, value as kv from jsonb_each(coalesce(new.data->'g', '{}'::jsonb)) loop
    for f in select key as k, value as val from jsonb_each(e.kv) loop
      v := grade_num(f.val);
      o := case when tg_op = 'UPDATE' then grade_num(old.data->'g'->e.tid->f.k) else null end;
      if v is not distinct from o then continue; end if;
      changed := true;
      if v is null then continue; end if;   -- المسح مسموح
      row := (select x from jsonb_array_elements(sec->'rows') x where x->>'id' = e.tid limit 1);
      if row is null then raise exception 'الرقم التدريبي % غير موجود في الشعبة %.', e.tid, new.id using errcode = 'P0001'; end if;
      if not coalesce((row->>'el')::boolean, false) then raise exception 'لا تُرصد درجة للمتدرب %: غير قابل للرصد.', row->>'name' using errcode = 'P0001'; end if;
      mx := grade_comp_max(sec, f.k);
      if mx is null then raise exception 'المكوّن % غير معتمد في توزيع الشعبة %.', f.k, new.id using errcode = 'P0001'; end if;
      err := grade_check(f.k, v, mx);
      if err is not null then raise exception 'لا تُحفظ الدرجة: %', err using errcode = 'P0001'; end if;
    end loop;
  end loop;
  if changed then
    gate := grade_gate(sec);
    if gate is not null then raise exception '%', gate using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
drop trigger if exists doc_guard_gmarks on doc;
create trigger doc_guard_gmarks before insert or update on doc for each row when (new.col = 'gmarks') execute function doc_guard_gmarks();

revoke execute on function grades_import(text, jsonb, jsonb, boolean, text, jsonb) from anon, public;
revoke execute on function grades_import_undo(text) from anon, public;
revoke execute on function grades_imports(text) from anon, public;
revoke execute on function grade_owner(text) from anon, public;
revoke execute on function grade_may(text) from anon, public;
revoke execute on function doc_guard_gmarks() from anon, public;
grant execute on function grades_import(text, jsonb, jsonb, boolean, text, jsonb) to authenticated;
grant execute on function grades_import_undo(text) to authenticated;
grant execute on function grades_imports(text) to authenticated;

-- تقوية: مسار بحث ثابت، والدوال الداخلية لا تُستدعى من الواجهة
alter function grade_gate(jsonb) set search_path = public;
alter function grade_num(jsonb) set search_path = public;
alter function grade_check(text, numeric, numeric) set search_path = public;
alter function grade_comp_max(jsonb, text) set search_path = public;
revoke execute on function doc_guard_gmarks() from authenticated;
revoke execute on function grade_owner(text) from authenticated;
revoke execute on function grade_may(text) from authenticated;
