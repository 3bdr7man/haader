-- =====================================================================
-- منصة حاضر: إدارة ظهور الدرجات (Grade Visibility Management)
-- وثيقة gvis/<الشعبة> مستقلة عن الدرجات: { crn, v:{key:{on,at,by,byName}}, prev, sched:[{id,at,set:{key:on},by,byName}], hist }
--   المفاتيح: i:<المكوّن>:<البند> • c:<المكوّن> • total
-- - يكتبها مدرب الشعبة (ومسؤول المنصة)، ويقرؤها من يرى الشعبة. المتدرب لا يقرأ أي وثيقة مباشرة.
-- - trainee_grades يطبّق الظهور على الخادم: المخفي لا يُعاد أصلاً، والمكوّن المجمّع من بنود يُحجب
--   إن خُفي أحد بنوده، فلا يُستنتج المخفي من الإجمالي. ويُعاد hid بمفاتيح المخفي وحدها (بلا قيم).
-- - الجدولة تُطبَّق متى حلّ وقتها، دون مهمة مجدولة.
-- - الإخفاء لا يمس gmarks إطلاقاً.
-- =====================================================================

-- 1) الكتابة: إضافة gvis لما يكتبه مدرب الشعبة (التعريف كما في 04 مع gvis)
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
    when p_col in ('sections', 'marks', 'notes', 'gsec', 'gmarks', 'gsnap', 'gops', 'qrs', 'warnlog', 'gvis') then
      p_crn is not null and doc_owner_of(p_crn) = my_legacy()
    else false
  end
$$;
revoke execute on function doc_may_write(text, text, text) from public, anon;

-- وثيقة gvis تُربط بشعبتها: رقمها هو معرّفها (الزناد يأخذ crn من data.crn، فنثبّته)
create or replace function gvis_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.col = 'gvis' then
    new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{crn}', to_jsonb(new.id));
    new.crn := new.id;
  end if;
  return new;
end $$;
drop trigger if exists a0_gvis_guard on doc;
create trigger a0_gvis_guard before insert or update on doc for each row when (new.col = 'gvis') execute function gvis_guard();

-- 2) الحالة الفعلية لمعيار: الأساس ثم ما حلّ وقته من الجدولة (بالترتيب)
create or replace function gvis_on(p jsonb, k text) returns boolean
language plpgsql stable set search_path = public as $$
declare on_ boolean := coalesce((p->'v'->k->>'on')::boolean, true); e jsonb;
begin
  if p is null then return true; end if;
  for e in select x from jsonb_array_elements(coalesce(p->'sched', '[]'::jsonb)) x
           where (x->>'at')::timestamptz <= now() order by x->>'at' loop
    if e->'set' ? k then on_ := coalesce((e->'set'->>k)::boolean, on_); end if;
  end loop;
  return on_;
end $$;

-- 3) تطبيق الظهور على درجات متدرب واحد في شعبة: {g, s, hid}
create or replace function gvis_filter(p_sec jsonb, p_vis jsonb, p_g jsonb, p_s jsonb) returns jsonb
language plpgsql stable set search_path = public as $$
declare c jsonb; it jsonb; k text; n text; allv boolean; sk jsonb; g jsonb := '{}'::jsonb; s jsonb := '{}'::jsonb; hid jsonb := '[]'::jsonb;
begin
  for c in select x from jsonb_array_elements(coalesce(p_sec->'comps', '[]'::jsonb)) x loop
    k := c->>'k'; allv := true; sk := '{}'::jsonb;
    if jsonb_typeof(p_sec->'items'->k) = 'array' then
      for it in select y from jsonb_array_elements(p_sec->'items'->k) y loop
        n := it->>'n';
        if gvis_on(p_vis, 'i:' || k || ':' || n) then
          if coalesce(p_s->k, '{}'::jsonb) ? n then sk := sk || jsonb_build_object(n, p_s->k->n); end if;
        else
          hid := hid || to_jsonb('i:' || k || ':' || n); allv := false;
        end if;
      end loop;
      if sk <> '{}'::jsonb then s := s || jsonb_build_object(k, sk); end if;
    end if;
    if not gvis_on(p_vis, 'c:' || k) then
      hid := hid || to_jsonb('c:' || k);
    elsif allv and coalesce(p_g, '{}'::jsonb) ? k then
      g := g || jsonb_build_object(k, p_g->k);
    end if;
  end loop;
  if not gvis_on(p_vis, 'total') then hid := hid || to_jsonb('total'::text); end if;
  return jsonb_build_object('g', g, 's', s, 'hid', hid);
end $$;

-- 4) درجات المتدرب في بوابته (كما في 08) بعد تطبيق الظهور
create or replace function trainee_grades(t text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d record; mk jsonb; vis jsonb; f jsonb; out jsonb := '{}'::jsonb;
begin
  for d in select id, data from doc where col = 'gsec' and data->'rows' @> jsonb_build_array(jsonb_build_object('id', t)) loop
    select m.data into mk from doc m where m.col = 'gmarks' and m.id = d.id;
    select v.data into vis from doc v where v.col = 'gvis' and v.id = d.id;
    f := gvis_filter(d.data, vis, coalesce(mk->'g'->t, '{}'::jsonb), coalesce(mk->'s'->t, '{}'::jsonb));
    out := out || jsonb_build_object(d.id, jsonb_build_object(
      'crn', d.id, 'code', d.data->>'code', 'name', d.data->>'name', 'term', d.data->>'term', 'pair', d.data->>'pair',
      'comps', coalesce(d.data->'comps', '[]'::jsonb), 'items', coalesce(d.data->'items', '{}'::jsonb),
      'exam', coalesce(d.data->'exam', '{}'::jsonb),
      'row', (select jsonb_build_object('el', x->'el', 'st', x->'st') from jsonb_array_elements(d.data->'rows') x where x->>'id' = t limit 1),
      'g', f->'g', 's', f->'s', 'hid', f->'hid'));
    mk := null; vis := null;
  end loop;
  return out;
end $$;
revoke all on function trainee_grades(text) from public, anon, authenticated;
revoke all on function gvis_filter(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function gvis_on(jsonb, text) from public, anon, authenticated;
revoke all on function gvis_guard() from public, anon, authenticated;
