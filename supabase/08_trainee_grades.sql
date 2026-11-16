-- =====================================================================
-- منصة حاضر: درجات المتدرب في بوابته (أعمال السنة والاختبارات: الأول والثاني والنهائي، نظري وعملي)
-- trainee_grades(t): لكل شعبة رصد فيها المتدرب — توزيع الدرجات المعتمد وبنوده، ودرجاته وحده
--   (g: درجات مكوّنات رايات، s: بنود أعمال السنة). لا يُعاد شيء من درجات غيره.
-- trainee_data(t): كما في 07 مع إضافة grades، ووثيقة الخط الزمني meta/timeline كاملة (تنبيه للمتدرب).
--   داخلية، غير متاحة للواجهة.
-- =====================================================================
create or replace function trainee_grades(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(d.id, jsonb_build_object(
      'crn', d.id, 'code', d.data->>'code', 'name', d.data->>'name', 'term', d.data->>'term', 'pair', d.data->>'pair',
      'comps', coalesce(d.data->'comps', '[]'::jsonb), 'items', coalesce(d.data->'items', '{}'::jsonb),
      'exam', coalesce(d.data->'exam', '{}'::jsonb),
      'row', (select jsonb_build_object('el', x->'el', 'st', x->'st') from jsonb_array_elements(d.data->'rows') x where x->>'id' = t limit 1),
      'g', coalesce((select m.data->'g'->t from doc m where m.col = 'gmarks' and m.id = d.id), '{}'::jsonb),
      's', coalesce((select m.data->'s'->t from doc m where m.col = 'gmarks' and m.id = d.id), '{}'::jsonb))), '{}'::jsonb)
  from doc d where d.col = 'gsec' and d.data->'rows' @> jsonb_build_array(jsonb_build_object('id', t))
$$;
revoke all on function trainee_grades(text) from public, anon, authenticated;

create or replace function trainee_data(t text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  secs jsonb := '{}'::jsonb; mks jsonb := '{}'::jsonb; q record; meta jsonb := '{}'::jsonb;
begin
  for q in select d.id, d.data from doc d where d.col = 'sections' and d.data->'rows' @> jsonb_build_array(jsonb_build_object('id', t)) loop
    secs := secs || jsonb_build_object(q.id, (q.data - 'rows' - 'sheet') || jsonb_build_object('rows',
      (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(q.data->'rows') x where x->>'id' = t),
      'trainerName', (select a.data->>'name' from doc a where a.col = 'accounts' and a.id = q.data->>'trainer')));
    mks := mks || jsonb_build_object(q.id, jsonb_build_object('m', jsonb_build_object(t,
      coalesce((select m.data->'m'->t from doc m where m.col = 'marks' and m.id = q.id), '{}'::jsonb))));
  end loop;
  select jsonb_object_agg(d.id, case when d.id in ('calendar', 'settings', 'timeline') then d.data
      else jsonb_build_object('rows', (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(d.data->'rows') x where x::text like '%"' || t || '"%')) end)
    into meta from doc d where d.col = 'meta' and d.id in ('calendar', 'settings', 'timeline', 'excuses', 'reinstated');
  return jsonb_build_object(
    'id', t,
    'name', coalesce((select name from trainee where id = t),
      (select x->>'name' from doc d, jsonb_array_elements(d.data->'rows') x where d.col = 'sections' and x->>'id' = t limit 1)),
    'sections', secs, 'marks', mks, 'meta', coalesce(meta, '{}'::jsonb),
    'warn', (select coalesce(jsonb_agg(jsonb_build_object('at', w.data->>'at', 'crn', w.data->>'crn', 'course', w.data->>'course', 'type', w.data->>'type', 'reason', w.data->>'reason') order by w.data->>'at' desc), '[]'::jsonb)
             from doc w where w.col = 'warnlog' and w.data->>'id' = t and coalesce(w.data->>'status', 'ok') = 'ok'),
    'acc', (select jsonb_build_object('temp', a.temp, 'st', a.st, 'first', a.first_login, 'last', a.last_login) from trainee_account a where a.trainee_id = t),
    'grades', trainee_grades(t));
end $$;
revoke all on function trainee_data(text) from public, anon, authenticated;
