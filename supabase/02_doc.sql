-- منصة حاضر — مخزن الوثائق الذي تعمل عليه المنصة نفسها
-- يحاكي مجموعات Claude: لكل وثيقة (المجموعة، المعرّف، البيانات JSON)
-- والحماية على مستوى الصف: الشعبة لمدربها، ورئيس القسم والاطلاع للقراءة.

-- ربط حساب الدخول بحساب المنصة الداخلي
alter table app_user add column if not exists legacy_id text;
create index if not exists app_user_legacy_idx on app_user(legacy_id);

create or replace function my_legacy() returns text
language sql stable security definer set search_path = public as $$
  select legacy_id from app_user where id = auth.uid() and active
$$;

create table if not exists doc (
  col        text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  crn        text,                       -- الشعبة إن كانت الوثيقة تخص شعبة
  updated_at timestamptz not null default now(),
  updated_by uuid references app_user(id),
  primary key (col, id)
);
create index if not exists doc_col_idx on doc(col);
create index if not exists doc_crn_idx on doc(crn);

-- المجموعات العامة: إعدادات وتقويم وحسابات، يقرؤها الجميع ويكتبها المسؤول
create or replace function doc_global(p_col text) returns boolean
language sql immutable as $$
  select p_col in ('meta','accounts','bosla','bforms','gcfg','logins')
$$;

-- مدرب الشعبة كما هو مسجَّل في وثيقة الشعبة
create or replace function doc_trainer(p_crn text) returns text
language sql stable security definer set search_path = public as $$
  select d.data->>'trainer' from doc d where d.col = 'sections' and d.id = p_crn
$$;

create or replace function doc_may_see(p_col text, p_crn text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when me_role() is null then false
    when doc_global(p_col) then true
    when me_role() in ('admin','head','viewer') then true
    when p_crn is null then true
    else doc_trainer(p_crn) = my_legacy()
  end
$$;

create or replace function doc_may_edit(p_col text, p_crn text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when me_role() is null then false
    when me_role() = 'viewer' then false
    when me_role() = 'head' then false
    when me_role() = 'admin' then true
    when doc_global(p_col) then false            -- الإعدادات والحسابات للمسؤول
    when p_crn is null then false
    else doc_trainer(p_crn) = my_legacy()        -- المدرب في شعبه وحدها
  end
$$;

alter table doc enable row level security;

drop policy if exists doc_read on doc;
create policy doc_read on doc for select to authenticated using (doc_may_see(col, crn));

drop policy if exists doc_ins on doc;
create policy doc_ins on doc for insert to authenticated with check (doc_may_edit(col, crn));

drop policy if exists doc_upd on doc;
create policy doc_upd on doc for update to authenticated using (doc_may_edit(col, crn)) with check (doc_may_edit(col, crn));

drop policy if exists doc_del on doc;
create policy doc_del on doc for delete to authenticated using (doc_may_edit(col, crn));

-- سجل التدقيق: وثيقة لكل مستخدم، لا يكتب فيها غيره (كما في النسخة الحالية)
create or replace function doc_log_mine(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_id = coalesce(my_legacy(), '~')
$$;

-- دمج جزئي للوثيقة كما يفعل update في المنصة
create or replace function doc_merge(p_col text, p_id text, p_patch jsonb, p_crn text default null)
returns void language plpgsql security invoker set search_path = public as $$
begin
  insert into doc (col, id, data, crn, updated_at, updated_by)
  values (p_col, p_id, p_patch, p_crn, now(), auth.uid())
  on conflict (col, id) do update
    set data = doc.data || excluded.data,
        crn = coalesce(excluded.crn, doc.crn),
        updated_at = now(),
        updated_by = auth.uid();
end $$;

-- أول حساب: يربط مستخدم الدخول بدور مسؤول المنصة إذا لم يوجد مسؤول بعد
create or replace function claim_admin(p_name text, p_username text, p_legacy text)
returns text language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from app_user where role = 'admin';
  if n > 0 then
    if exists (select 1 from app_user where id = auth.uid()) then return 'exists'; end if;
    return 'denied';
  end if;
  insert into app_user (id, username, name, role, legacy_id)
  values (auth.uid(), p_username, p_name, 'admin', p_legacy)
  on conflict (id) do update set name = excluded.name, legacy_id = excluded.legacy_id;
  return 'admin';
end $$;
revoke all on function claim_admin(text, text, text) from anon;
