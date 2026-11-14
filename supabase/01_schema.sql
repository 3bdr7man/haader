-- منصة حاضر — المخطط الأساسي وسياسات الحماية
-- المرحلة الأولى: المدربون ورئيس القسم ومسؤول المنصة. بوابة المتدرب في مرحلة تالية.
-- كل جدول محمي بـ RLS، ولا يُقرأ منه شيء إلا بسياسة صريحة أدناه.

create extension if not exists pgcrypto;

-- ---------- المستخدمون والأدوار ----------
create table if not exists app_user (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  name        text not null,
  role        text not null check (role in ('admin','trainer','head','viewer')),
  active      boolean not null default true,
  perms       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create or replace function me_role() returns text
language sql stable security definer set search_path = public as $$
  select role from app_user where id = auth.uid() and active
$$;
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$ select me_role() = 'admin' $$;
create or replace function is_staff_read() returns boolean
language sql stable security definer set search_path = public as $$ select me_role() in ('admin','head','viewer') $$;

-- ---------- الشعب ----------
create table if not exists section (
  crn        text primary key,
  course     text not null,
  kind       text,
  term       text,
  spec       text,
  trainer_id uuid references app_user(id) on delete set null,
  meta       jsonb not null default '{}'::jsonb,   -- التواريخ والمواعيد وما لا يُستعلم عنه
  updated_at timestamptz not null default now()
);
create index if not exists section_trainer_idx on section(trainer_id);

create or replace function owns_section(p_crn text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from section s where s.crn = p_crn and s.trainer_id = auth.uid())
$$;
-- الشعبة لمدربها، ومسؤول المنصة يتولى غير المسندة
create or replace function may_edit(p_crn text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when owns_section(p_crn) then true
    when is_admin() and not exists (select 1 from section s where s.crn = p_crn and s.trainer_id is not null) then true
    else false end
$$;
create or replace function may_see(p_crn text) returns boolean
language sql stable security definer set search_path = public as $$
  select owns_section(p_crn) or is_staff_read()
$$;

-- ---------- المتدربون والتسجيل ----------
create table if not exists trainee (
  id   text primary key,              -- الرقم التدريبي، ثابت لا يُعدَّل
  name text not null
);
create table if not exists enrollment (
  crn        text references section(crn) on delete cascade,
  trainee_id text references trainee(id) on delete cascade,
  status     text,
  eligible   boolean not null default true,
  ord        int,
  primary key (crn, trainee_id)
);
create index if not exists enrollment_trainee_idx on enrollment(trainee_id);

-- ---------- التحضير ----------
create table if not exists mark (
  crn        text,
  trainee_id text,
  d          text not null,           -- مفتاح التاريخ الهجري كما في المنصة
  code       text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_user(id),
  primary key (crn, trainee_id, d),
  foreign key (crn, trainee_id) references enrollment(crn, trainee_id) on delete cascade
);
create table if not exists note (
  crn        text,
  trainee_id text,
  d          text not null,
  body       text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_user(id),
  primary key (crn, trainee_id, d),
  foreign key (crn, trainee_id) references enrollment(crn, trainee_id) on delete cascade
);

-- ---------- الدرجات ----------
create table if not exists grade_section (
  crn        text primary key references section(crn) on delete cascade,
  code       text,
  name       text,
  term       text,
  hours      numeric,
  comps      jsonb not null default '[]'::jsonb,   -- توزيع الدرجات المستورد
  exam       jsonb not null default '{}'::jsonb,
  flow       jsonb not null default '{}'::jsonb,   -- الاعتماد والتجميد والجدولة
  src        jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists grade (
  crn        text,
  trainee_id text,
  comp       text not null,
  value      numeric,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_user(id),
  primary key (crn, trainee_id, comp),
  foreign key (crn, trainee_id) references enrollment(crn, trainee_id) on delete cascade
);

-- ---------- حسابات المتدربين ----------
create table if not exists trainee_account (
  trainee_id text primary key references trainee(id) on delete cascade,
  username   text unique not null,    -- الرقم التدريبي نفسه
  pw_hash    text,                    -- bcrypt عبر pgcrypto، لا نص صريح أبداً
  temp       boolean not null default true,
  st         text not null default 'new' check (st in ('new','active','disabled')),
  deliv      jsonb not null default '{}'::jsonb,
  last_login timestamptz,
  made_at    timestamptz not null default now(),
  made_by    uuid references app_user(id)
);

-- ---------- سجل التدقيق ----------
create table if not exists audit (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  by_id      uuid references app_user(id),
  by_name    text,
  act        text not null,
  crn        text,
  trainee_id text,
  comp       text,
  old_val    text,
  new_val    text,
  det        text
);
create index if not exists audit_at_idx on audit(at desc);
create index if not exists audit_crn_idx on audit(crn);

-- ---------- تفعيل الحماية على كل جدول ----------
alter table app_user        enable row level security;
alter table section         enable row level security;
alter table trainee         enable row level security;
alter table enrollment      enable row level security;
alter table mark            enable row level security;
alter table note            enable row level security;
alter table grade_section   enable row level security;
alter table grade           enable row level security;
alter table trainee_account enable row level security;
alter table audit           enable row level security;

-- ---------- السياسات: مطابقة لمصفوفة الصلاحيات المعتمدة ----------
-- المستخدمون: كلٌّ يقرأ نفسه، والمسؤول يقرأ ويكتب الكل، ورئيس القسم يطّلع
drop policy if exists au_self on app_user;
create policy au_self on app_user for select to authenticated using (id = auth.uid() or is_staff_read());
drop policy if exists au_admin on app_user;
create policy au_admin on app_user for all to authenticated using (is_admin()) with check (is_admin());

-- الشعب: المدرب شعبه، ورئيس القسم والاطلاع الكل، والتعديل لمسؤول المنصة
drop policy if exists sec_read on section;
create policy sec_read on section for select to authenticated using (may_see(crn));
drop policy if exists sec_write on section;
create policy sec_write on section for all to authenticated using (is_admin()) with check (is_admin());

-- المتدرب يُقرأ لمن يرى شعبةً هو فيها
drop policy if exists tr_read on trainee;
create policy tr_read on trainee for select to authenticated using (
  is_staff_read() or exists (select 1 from enrollment e where e.trainee_id = trainee.id and owns_section(e.crn))
);
drop policy if exists tr_write on trainee;
create policy tr_write on trainee for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists en_read on enrollment;
create policy en_read on enrollment for select to authenticated using (may_see(crn));
drop policy if exists en_write on enrollment;
create policy en_write on enrollment for all to authenticated using (may_edit(crn)) with check (may_edit(crn));

-- التحضير والملاحظات والدرجات: القراءة لمن يرى الشعبة، والكتابة لمدربها وحده
drop policy if exists mk_read on mark;
create policy mk_read on mark for select to authenticated using (may_see(crn));
drop policy if exists mk_write on mark;
create policy mk_write on mark for all to authenticated using (may_edit(crn)) with check (may_edit(crn));

drop policy if exists nt_read on note;
create policy nt_read on note for select to authenticated using (may_see(crn));
drop policy if exists nt_write on note;
create policy nt_write on note for all to authenticated using (may_edit(crn)) with check (may_edit(crn));

drop policy if exists gs_read on grade_section;
create policy gs_read on grade_section for select to authenticated using (may_see(crn));
drop policy if exists gs_write on grade_section;
create policy gs_write on grade_section for all to authenticated using (may_edit(crn)) with check (may_edit(crn));

drop policy if exists gr_read on grade;
create policy gr_read on grade for select to authenticated using (may_see(crn));
drop policy if exists gr_write on grade;
create policy gr_write on grade for all to authenticated using (may_edit(crn)) with check (may_edit(crn));

-- حسابات المتدربين: لمدرب الشعبة ولمسؤول المنصة، ولا تُقرأ البصمة من العميل إطلاقاً
drop policy if exists ta_read on trainee_account;
create policy ta_read on trainee_account for select to authenticated using (
  is_staff_read() or exists (select 1 from enrollment e where e.trainee_id = trainee_account.trainee_id and owns_section(e.crn))
);
drop policy if exists ta_write on trainee_account;
create policy ta_write on trainee_account for all to authenticated using (
  is_admin() or exists (select 1 from enrollment e where e.trainee_id = trainee_account.trainee_id and owns_section(e.crn))
) with check (
  is_admin() or exists (select 1 from enrollment e where e.trainee_id = trainee_account.trainee_id and owns_section(e.crn))
);
revoke select (pw_hash) on trainee_account from authenticated, anon;

-- سجل التدقيق: يُكتب ولا يُعدَّل ولا يُحذف، ويقرؤه صاحبه ورئيس القسم والمسؤول
drop policy if exists ad_read on audit;
create policy ad_read on audit for select to authenticated using (by_id = auth.uid() or is_staff_read() or (crn is not null and owns_section(crn)));
drop policy if exists ad_insert on audit;
create policy ad_insert on audit for insert to authenticated with check (by_id = auth.uid());
revoke update, delete on audit from authenticated, anon;

-- لا شيء لغير المسجَّل في هذه المرحلة
revoke all on all tables in schema public from anon;
