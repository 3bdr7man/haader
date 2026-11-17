-- =====================================================================
-- منصة حاضر: استبعاد البريد الإلكتروني من قاعدة البيانات
--  1) كل بريد ينتهي نطاقه بـ tvtc.gov.sa (النطاق نفسه وكل نطاق فرعي منه) — بقاعدة عامة لا بقائمة عناوين
--  2) كل بريد يعود لصاحب المنصة: صاحب المنصة هو أول حساب مسؤول أُنشئ، فلا يُحفظ لحسابه بريد،
--     وكل بريد يكتبه في حسابه تُحفظ بصمته (SHA-256) وحدها في جدول خاص لا تقرؤه الواجهة،
--     فيُرفض بعدها في أي حساب أو وثيقة
-- يعمل الاستبعاد على كل كتابة في doc وفي audit (مُشغّل قبل الحفظ)، فيشمل البريد الموجود والمضاف لاحقاً.
-- الواجهة تسأل email_check قبل الحفظ لتعرض للمستخدم سبب الرفض.
-- =====================================================================

create table if not exists email_block (
  h text primary key,                          -- بصمة SHA-256 للبريد بعد تحويله لأحرف صغيرة
  at timestamptz not null default now()
);
alter table email_block enable row level security;
revoke all on email_block from public, anon, authenticated;

create or replace function email_hash(e text) returns text
language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(lower(btrim(coalesce(e, ''))), 'UTF8')), 'hex')
$$;

create or replace function email_gov(e text) returns boolean
language sql immutable set search_path = public as $$
  select lower(btrim(coalesce(e, ''))) ~ '@([a-z0-9-]+\.)*tvtc\.gov\.sa$'
$$;

-- صاحب المنصة: أول حساب مسؤول أُنشئ (معرّفه في وثائق الحسابات)
create or replace function owner_legacy() returns text
language sql stable security definer set search_path = public as $$
  select legacy_id from app_user where role = 'admin' and legacy_id is not null order by created_at, legacy_id limit 1
$$;

-- سبب رفض البريد: format صيغة غير صحيحة، gov نطاق tvtc.gov.sa، owner بريد يعود لصاحب المنصة، وإلا null
create or replace function email_blocked(e text) returns text
language plpgsql stable security definer set search_path = public as $$
declare v text := lower(btrim(coalesce(e, '')));
begin
  if v = '' then return null; end if;
  if v !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then return 'format'; end if;
  if email_gov(v) then return 'gov'; end if;
  if exists (select 1 from email_block b where b.h = email_hash(v)) then return 'owner'; end if;
  return null;
end $$;

-- إزالة كل بريد مستبعد من نص (يبقى ما سواه كما هو)
create or replace function email_scrub_text(t text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  pat constant text := '([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})';
  parts text[]; mats text[]; out text; i int; hs boolean;
begin
  if t is null or position('@' in t) = 0 then return t; end if;
  mats := array(select m[1] from regexp_matches(t, pat, 'g') with ordinality as x(m, n) order by n);
  if coalesce(array_length(mats, 1), 0) = 0 then return t; end if;
  hs := exists (select 1 from email_block);
  if not hs and not exists (select 1 from unnest(mats) u where email_gov(u)) then return t; end if;
  parts := regexp_split_to_array(t, pat);
  out := parts[1];
  for i in 1 .. array_length(mats, 1) loop
    out := out || case when email_gov(mats[i]) or (hs and exists (select 1 from email_block b where b.h = email_hash(mats[i]))) then '' else mats[i] end
               || coalesce(parts[i + 1], '');
  end loop;
  return out;
end $$;

create or replace function email_scrub(j jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t text;
begin
  if j is null then return j; end if;
  t := j::text;
  if position('@' in t) = 0 then return j; end if;
  return email_scrub_text(t)::jsonb;
end $$;

-- قبل كل حفظ في doc: حساب صاحب المنصة بلا بريد (وتُحفظ بصمة ما كُتب فيه)، ثم إزالة كل بريد مستبعد
create or replace function doc_email_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  if new.col = 'accounts' and new.id = owner_legacy() and new.data ? 'email' then
    e := lower(btrim(coalesce(new.data->>'email', '')));
    if e ~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' and not email_gov(e) then
      insert into email_block (h) values (email_hash(e)) on conflict do nothing;
    end if;
    new.data := new.data - 'email';
  end if;
  new.data := email_scrub(new.data);
  return new;
end $$;
drop trigger if exists a_doc_email_guard on doc;
create trigger a_doc_email_guard before insert or update of data on doc for each row execute function doc_email_guard();

create or replace function audit_email_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.det := email_scrub_text(new.det);
  new.old_val := email_scrub_text(new.old_val);
  new.new_val := email_scrub_text(new.new_val);
  return new;
end $$;
drop trigger if exists a_audit_email_guard on audit;
create trigger a_audit_email_guard before insert or update on audit for each row execute function audit_email_guard();

-- للواجهة: سبب رفض البريد قبل حفظه
create or replace function email_check(p text) returns text
language sql stable security definer set search_path = public as $$
  select email_blocked(p)
$$;

-- لصاحب المنصة وحده: إضافة بريد يعود له إلى الاستبعاد (تُحفظ بصمته فقط)، وإزالته من كل الوثائق
create or replace function email_block_add(p text) returns int
language plpgsql security definer set search_path = public as $$
declare v text := lower(btrim(coalesce(p, ''))); n int;
begin
  if my_legacy() is distinct from owner_legacy() then raise exception 'إضافة بريد إلى الاستبعاد لصاحب المنصة وحده.' using errcode = '42501'; end if;
  if v !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then raise exception 'صيغة البريد غير صحيحة.' using errcode = '22023'; end if;
  insert into email_block (h) values (email_hash(v)) on conflict do nothing;
  perform set_config('haader.sys', '1', true);
  update doc set data = data where position(v in lower(data::text)) > 0;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function email_hash(text), email_gov(text), owner_legacy(), email_blocked(text), email_scrub_text(text), email_scrub(jsonb),
  doc_email_guard(), audit_email_guard() from public, anon, authenticated;
revoke all on function email_check(text), email_block_add(text) from public, anon;
grant execute on function email_check(text), email_block_add(text) to authenticated;

-- تنظيف ما هو موجود الآن
select set_config('haader.sys', '1', true);
update doc set data = data where data::text ~* '@([a-z0-9-]+\.)*tvtc\.gov\.sa' or (col = 'accounts' and id = owner_legacy() and data ? 'email');
update audit set det = det where concat_ws(' ', det, old_val, new_val) ~* '@([a-z0-9-]+\.)*tvtc\.gov\.sa';
