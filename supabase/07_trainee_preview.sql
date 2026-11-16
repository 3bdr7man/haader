-- =====================================================================
-- منصة حاضر: معاينة بوابة المتدرب من حساب المسؤول (للاطلاع والتطوير)
-- trainee_data(t)    بيانات بوابة المتدرب لرقم تدريبي (داخلية، غير متاحة للواجهة)
-- trainee_me()       كما هي للمتدرب: بياناته وحده
-- trainee_preview(p) لمسؤول المنصة وحده: البيانات نفسها كما يراها المتدرب، مع سجل في audit
-- =====================================================================
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
  select jsonb_object_agg(d.id, case when d.id in ('calendar', 'settings') then d.data
      else jsonb_build_object('rows', (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(d.data->'rows') x where x::text like '%"' || t || '"%')) end)
    into meta from doc d where d.col = 'meta' and d.id in ('calendar', 'settings', 'excuses', 'reinstated');
  return jsonb_build_object(
    'id', t,
    'name', coalesce((select name from trainee where id = t),
      (select x->>'name' from doc d, jsonb_array_elements(d.data->'rows') x where d.col = 'sections' and x->>'id' = t limit 1)),
    'sections', secs, 'marks', mks, 'meta', coalesce(meta, '{}'::jsonb),
    'warn', (select coalesce(jsonb_agg(jsonb_build_object('at', w.data->>'at', 'crn', w.data->>'crn', 'course', w.data->>'course', 'type', w.data->>'type', 'reason', w.data->>'reason') order by w.data->>'at' desc), '[]'::jsonb)
             from doc w where w.col = 'warnlog' and w.data->>'id' = t and coalesce(w.data->>'status', 'ok') = 'ok'),
    'acc', (select jsonb_build_object('temp', a.temp, 'st', a.st, 'first', a.first_login, 'last', a.last_login) from trainee_account a where a.trainee_id = t));
end $$;
revoke all on function trainee_data(text) from public, anon, authenticated;

create or replace function trainee_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t text := my_trainee();
begin
  if t is null then raise exception 'ليس حساب متدرب نشطاً' using errcode = '42501'; end if;
  return trainee_data(t);
end $$;
revoke all on function trainee_me() from public, anon;
grant execute on function trainee_me() to authenticated;

create or replace function trainee_preview(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text := regexp_replace(coalesce(p_id, ''), '\D', '', 'g');
begin
  if coalesce(me_role(), '') <> 'admin' then raise exception 'معاينة بوابة المتدرب لمسؤول المنصة وحده.' using errcode = '42501'; end if;
  if not exists (select 1 from doc d where d.col = 'sections' and d.data->'rows' @> jsonb_build_array(jsonb_build_object('id', t))) then
    raise exception 'الرقم التدريبي % غير مسجل في أي شعبة.', t using errcode = 'P0001'; end if;
  insert into audit (by_id, by_name, act, trainee_id, det)
  values (auth.uid(), (select name from app_user where id = auth.uid()), 'trainee_preview', t, 'معاينة بوابة المتدرب من حساب المسؤول');
  return trainee_data(t);
end $$;
revoke all on function trainee_preview(text) from public, anon;
grant execute on function trainee_preview(text) to authenticated;
