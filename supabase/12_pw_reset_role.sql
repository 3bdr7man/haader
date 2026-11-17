-- =====================================================================
-- منصة حاضر: «نسيت كلمة المرور؟» بنوع الحساب (متدرب، مدرب، رئيس القسم)
-- يختار صاحب الطلب نوع حسابه؛ فيُطابَق المتدرب برقمه التدريبي أو بريده التدريبي، والمدرب ورئيس
-- القسم باسم المستخدم أو البريد المسجل. الرد واحد دائماً. يُحفظ النوع المختار ليظهر للمسؤول.
-- =====================================================================
alter table pw_reset add column if not exists asked text;

drop function if exists pw_reset_request(text);
create or replace function pw_reset_request(p_login text, p_as text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m record; a text := case when p_as in ('trainee', 'trainer', 'head') then p_as end;
begin
  select * into m from pw_reset_match(p_login);
  if m.kind is not null and a is not null and (m.kind = 'trainee') <> (a = 'trainee') then m.kind := null; end if;
  if m.kind is not null
     and (select count(*) from pw_reset where at > now() - interval '1 hour') < 60
     and not exists (select 1 from pw_reset where kind = m.kind and ref = m.ref and status = 'new')
     and (select count(*) from pw_reset where kind = m.kind and ref = m.ref and at > now() - interval '1 day') < 3 then
    insert into pw_reset (kind, ref, via, asked) values (m.kind, m.ref, m.via, a);
  end if;
  return jsonb_build_object('ok', true);   -- الرد نفسه دائماً
end $$;
revoke all on function pw_reset_request(text, text) from public;
grant execute on function pw_reset_request(text, text) to anon, authenticated;

create or replace function pw_reset_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pw_reset_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'at', r.at, 'kind', r.kind, 'ref', r.ref, 'via', r.via, 'asked', r.asked, 'status', r.status,
      'action', r.action, 'action_at', r.action_at, 'action_by_name', r.action_by_name,
      'token_exp', r.token_exp, 'used_at', r.used_at, 'who', pw_reset_who(r.kind, r.ref)) order by r.at desc)
    from (select * from pw_reset order by at desc limit 300) r), '[]'::jsonb);
end $$;
