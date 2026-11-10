-- =====================================================================
-- 06 — HESAB TİPİ (müəllim / şagird / tələbə) + FORUM SİSTEMİ
-- Əvvəlki fayllara (01–05) toxunmur; yalnız ƏLAVƏ edir. Təkrar işlədilə bilər.
-- Sıra: 01 → 02 → 04 → 05 → (03) → 06 → 07 → (08 yalnız əl ilə, bir dəfə)
-- Məlumat silinmir. Geri qaytarma: 98_rollback_06_07.sql
--
-- Dizayn qərarları:
--  * Forum cədvəllərinə brauzerdən birbaşa yazmaq QADAĞANDIR (INSERT/UPDATE/DELETE icazəsi yoxdur).
--    Bütün yazma əməliyyatları aşağıdakı SECURITY DEFINER funksiyaları (RPC) ilə gedir:
--    orada autentifikasiya, bloklanma, uzunluq, HTML/skript, spam, təkrar məzmun və limit yoxlanılır.
--  * Oxuma RLS ilə qorunur: qonaq və istifadəçi yalnız 'active' məzmunu görür; admin hamısını görür.
--  * Silinmə "yumşaq"dır (status='deleted'); müzakirə tarixçəsi itmir.
--  * Hesab tipi profiles.account_type sütunundadır (profiles.role yalnız user/admin üçündür).
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- A. HESAB TİPİ
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists account_type text;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'profiles_account_type_check') then
        alter table public.profiles
            add constraint profiles_account_type_check
            check (account_type is null or account_type in ('teacher', 'student', 'university_student'));
    end if;
end
$$;

-- Köhnə istifadəçilər: NULL = "təyin edilməyib" (uydurma tip yazılmır; istifadəçi bir dəfə özü seçir).
-- Yeni qeydiyyatlarda NULL qalmasına aşağıdakı handle_new_user() icazə vermir.

-- Brauzer yalnız oxuya bilər (03 sütun siyahısını məhdudlaşdırdığı üçün bu sütun ayrıca açılır)
grant select (account_type) on public.profiles to anon, authenticated;
-- Qeyd: account_type sütununu UPDATE etmək icazəsi verilmir (04 yalnız ad/şəhər/bio... açır).

-- Dəyişməyə qarşı əlavə qoruma (admin RPC-ləri və bir dəfəlik seçim istisna)
create or replace function public.protect_account_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.account_type is distinct from old.account_type
       and coalesce(current_setting('app.allow_account_type_update', true), '') <> 'on'
       and auth.uid() is not null then
        raise exception 'Hesab tipi birbaşa dəyişdirilə bilməz.' using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_protect_account_type on public.profiles;
create trigger trg_protect_account_type
    before update on public.profiles
    for each row execute function public.protect_account_type();

-- Qeydiyyatda profil yaradılır. Hesab tipi SERVERDƏ yoxlanılır: yalnız 3 dəyər; 'admin' və s. rədd edilir.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_type text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'account_type', '')), '');
    v_name text;
begin
    if v_type is null or v_type not in ('teacher', 'student', 'university_student') then
        raise exception 'Qeydiyyat üçün hesab tipi seçilməlidir: teacher, student və ya university_student.'
            using errcode = '22023';
    end if;
    v_name := left(btrim(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1), '')), 100);
    insert into public.profiles (id, full_name, account_type)
    values (new.id, v_name, v_type)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Köhnə hesab (account_type boşdur) tipini YALNIZ BİR DƏFƏ özü seçə bilər. Sonra yalnız admin dəyişir.
create or replace function public.set_my_account_type(p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    cur text;
begin
    if me is null then raise exception 'Giriş tələb olunur'; end if;
    if p_type is null or p_type not in ('teacher', 'student', 'university_student') then
        raise exception 'Yanlış hesab tipi.' using errcode = '22023';
    end if;
    select account_type into cur from public.profiles where id = me;
    if not found then raise exception 'Profil tapılmadı.'; end if;
    if cur is not null then
        raise exception 'Hesab tipi artıq seçilib. Dəyişmək üçün administrasiyaya müraciət edin.' using errcode = '42501';
    end if;
    perform set_config('app.allow_account_type_update', 'on', true);
    update public.profiles set account_type = p_type where id = me;
    perform set_config('app.allow_account_type_update', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------
-- B. İSTİFADƏÇİNİN MÜVƏQQƏTİ BLOKLANMASI (məlumat yalnız admin RPC-ləri ilə dəyişir)
-- ---------------------------------------------------------------------
create table if not exists public.user_moderation (
    user_id        uuid primary key references public.profiles(id) on delete cascade,
    blocked_until  timestamptz,
    block_reason   text check (block_reason is null or char_length(block_reason) <= 300),
    blocked_by     uuid references public.profiles(id) on delete set null,
    updated_at     timestamptz not null default now()
);
alter table public.user_moderation enable row level security;
revoke all on public.user_moderation from anon, authenticated;

create or replace function public.is_user_blocked(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.user_moderation m
        where m.user_id = p_user and m.blocked_until is not null and m.blocked_until > now()
    );
$$;

-- Bloklanmış istifadəçi yeni elan, PDF və mesaj yaza bilməsin (mövcud siyasətləri dəyişmədən, RESTRICTIVE əlavə siyasət)
drop policy if exists "books_insert_not_blocked" on public.books;
create policy "books_insert_not_blocked" on public.books
    as restrictive for insert to authenticated with check (not public.is_user_blocked(auth.uid()));
drop policy if exists "pdfs_insert_not_blocked" on public.pdfs;
create policy "pdfs_insert_not_blocked" on public.pdfs
    as restrictive for insert to authenticated with check (not public.is_user_blocked(auth.uid()));
drop policy if exists "chat_messages_insert_not_blocked" on public.chat_messages;
create policy "chat_messages_insert_not_blocked" on public.chat_messages
    as restrictive for insert to authenticated with check (not public.is_user_blocked(auth.uid()));

-- ---------------------------------------------------------------------
-- C. FORUM CƏDVƏLLƏRİ
-- ---------------------------------------------------------------------
create table if not exists public.forum_categories (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique check (slug ~ '^[a-z0-9-]{2,70}$'),
    name        text not null check (char_length(name) between 2 and 60),
    description text check (description is null or char_length(description) <= 200),
    sort_order  integer not null default 100,
    is_active   boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create unique index if not exists uq_forum_categories_name on public.forum_categories (lower(name));

create table if not exists public.forum_topics (
    id                    uuid primary key default gen_random_uuid(),
    category_id           uuid not null references public.forum_categories(id) on delete restrict,
    author_id             uuid references public.profiles(id) on delete set null,
    title                 text not null check (char_length(title) between 5 and 150),
    body                  text not null check (char_length(body) between 10 and 10000),
    excerpt               text not null default '',
    status                text not null default 'active' check (status in ('active', 'hidden', 'deleted')),
    is_pinned             boolean not null default false,
    is_locked             boolean not null default false,
    pinned_at             timestamptz,
    reply_count           integer not null default 0 check (reply_count >= 0),
    last_reply_at         timestamptz,
    last_reply_author_id  uuid references public.profiles(id) on delete set null,
    last_activity_at      timestamptz not null default now(),
    content_hash          text not null,
    edited_at             timestamptz,
    deleted_at            timestamptz,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create index if not exists idx_forum_topics_list     on public.forum_topics (status, is_pinned desc, last_activity_at desc);
create index if not exists idx_forum_topics_replies  on public.forum_topics (status, is_pinned desc, reply_count desc, last_activity_at desc);
create index if not exists idx_forum_topics_new      on public.forum_topics (status, is_pinned desc, created_at desc);
create index if not exists idx_forum_topics_cat      on public.forum_topics (category_id, status, last_activity_at desc);
create index if not exists idx_forum_topics_author   on public.forum_topics (author_id, created_at desc);
create index if not exists idx_forum_topics_title_trgm on public.forum_topics using gin (title gin_trgm_ops);

create table if not exists public.forum_replies (
    id            uuid primary key default gen_random_uuid(),
    topic_id      uuid not null references public.forum_topics(id) on delete cascade,
    parent_id     uuid references public.forum_replies(id) on delete cascade,
    author_id     uuid references public.profiles(id) on delete set null,
    body          text not null check (char_length(body) between 1 and 5000),
    status        text not null default 'active' check (status in ('active', 'hidden', 'deleted')),
    content_hash  text not null,
    edited_at     timestamptz,
    deleted_at    timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists idx_forum_replies_topic  on public.forum_replies (topic_id, created_at);
create index if not exists idx_forum_replies_parent on public.forum_replies (parent_id) where parent_id is not null;
create index if not exists idx_forum_replies_author on public.forum_replies (author_id, created_at desc);

create table if not exists public.forum_reports (
    id               uuid primary key default gen_random_uuid(),
    reporter_id      uuid references public.profiles(id) on delete set null,
    topic_id         uuid not null references public.forum_topics(id) on delete cascade,
    reply_id         uuid references public.forum_replies(id) on delete cascade,
    reason           text not null check (reason in ('spam', 'abuse', 'offtopic', 'unsafe', 'other')),
    details          text check (details is null or char_length(details) <= 500),
    status           text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
    resolved_by      uuid references public.profiles(id) on delete set null,
    resolved_at      timestamptz,
    resolution_note  text check (resolution_note is null or char_length(resolution_note) <= 500),
    created_at       timestamptz not null default now()
);
-- Eyni istifadəçi eyni məzmunu yalnız bir dəfə şikayət edə bilər
create unique index if not exists uq_forum_reports_topic on public.forum_reports (reporter_id, topic_id) where reply_id is null;
create unique index if not exists uq_forum_reports_reply on public.forum_reports (reporter_id, reply_id) where reply_id is not null;
create index if not exists idx_forum_reports_status on public.forum_reports (status, created_at desc);
create index if not exists idx_forum_reports_topic  on public.forum_reports (topic_id);
create index if not exists idx_forum_reports_reporter_time on public.forum_reports (reporter_id, created_at desc);

create table if not exists public.notifications (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    actor_id    uuid references public.profiles(id) on delete set null,
    type        text not null check (type in ('forum_reply', 'forum_reply_to_reply', 'moderation')),
    title       text not null check (char_length(title) <= 200),
    body        text check (body is null or char_length(body) <= 300),
    link        text check (link is null or (link ~ '^/' and char_length(link) <= 200)),
    topic_id    uuid references public.forum_topics(id) on delete cascade,
    reply_id    uuid references public.forum_replies(id) on delete cascade,
    is_read     boolean not null default false,
    created_at  timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications (user_id, is_read, created_at desc);

drop trigger if exists trg_forum_categories_updated on public.forum_categories;
create trigger trg_forum_categories_updated before update on public.forum_categories
    for each row execute function public.set_updated_at();
drop trigger if exists trg_forum_topics_updated on public.forum_topics;
create trigger trg_forum_topics_updated before update on public.forum_topics
    for each row execute function public.set_updated_at();
drop trigger if exists trg_forum_replies_updated on public.forum_replies;
create trigger trg_forum_replies_updated before update on public.forum_replies
    for each row execute function public.set_updated_at();

-- İlkin kateqoriyalar (təkrar işlədildikdə dublikat yaranmır)
insert into public.forum_categories (slug, name, description, sort_order) values
    ('umumi-muzakire',              'Ümumi müzakirə',                'Hər mövzuda açıq söhbət.',                    10),
    ('tehsil-ve-mekteb',            'Təhsil və məktəb',              'Məktəb, dərslər və təhsil sistemi.',          20),
    ('universitet-ve-telebe-heyati','Universitet və tələbə həyatı',  'Universitet, qəbul, tələbə təcrübələri.',     30),
    ('muellimler-ucun',             'Müəllimlər üçün',               'Müəllimlərin təcrübə və metodik müzakirələri.', 40),
    ('imtahan-ve-sinaqlar',         'İmtahan və sınaqlar',           'DİM, IELTS, magistr və digər imtahanlar.',    50),
    ('kitablar-ve-pdf',             'Kitablar və PDF resursları',    'Dərsliklər, konspektlər və resurs tövsiyələri.', 60),
    ('texnologiya',                 'Texnologiya',                   'Proqramlaşdırma, alətlər və texnologiya.',    70),
    ('diger',                       'Digər',                         'Başqa kateqoriyaya sığmayan mövzular.',       80)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- D. DAXİLİ KÖMƏKÇİ FUNKSİYALAR (brauzer çağıra bilməz)
-- ---------------------------------------------------------------------
-- Mətnin təmizlənməsi və yoxlanması. Mətn HEÇ VAXT HTML kimi göstərilmir (React mətn kimi çıxarır);
-- bu funksiya əlavə təbəqədir: idarəedici/görünməz simvollar, kod parçaları, keçid və təkrar spamı.
create or replace function public.forum_clean_text(p_text text, p_min integer, p_max integer, p_label text)
returns text
language plpgsql
as $$
declare
    t text := coalesce(p_text, '');
begin
    t := replace(t, E'\r\n', E'\n');
    t := replace(t, E'\r', E'\n');
    t := regexp_replace(t, '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F​‎‏‪-‮⁦-⁩﻿]', '', 'g');
    t := regexp_replace(t, E'[ \t]+\n', E'\n', 'g');
    t := regexp_replace(t, E'\n{4,}', E'\n\n\n', 'g');
    t := btrim(t, E' \t\n');

    if char_length(t) < p_min then
        raise exception '% ən azı % simvol olmalıdır.', p_label, p_min using errcode = '22023';
    end if;
    if char_length(t) > p_max then
        raise exception '% ən çox % simvol ola bilər.', p_label, p_max using errcode = '22023';
    end if;
    if t ~* '<\s*/?\s*(script|iframe|object|embed|style|link|meta|svg|form|base)\y'
       or t ~* '(javascript|vbscript)\s*:'
       or t ~* 'data\s*:\s*text/html' then
        raise exception '% daxilində icazə verilməyən kod və ya HTML var.', p_label using errcode = '22023';
    end if;
    if (select count(*) from regexp_matches(t, 'https?://', 'gi')) > 5 then
        raise exception '% daxilində ən çox 5 keçid ola bilər.', p_label using errcode = '22023';
    end if;
    if t ~ '(.)\1{39,}' then
        raise exception '% spam kimi görünür (təkrarlanan simvollar).', p_label using errcode = '22023';
    end if;
    return t;
end;
$$;

create or replace function public.forum_hash(p_text text)
returns text
language sql
immutable
as $$
    select md5(lower(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')));
$$;

create or replace function public.forum_excerpt(p_text text)
returns text
language sql
immutable
as $$
    select left(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'), 200);
$$;

-- Mövzunun cavab sayını, son cavabı və son aktivlik vaxtını yenidən hesablayır
create or replace function public.forum_refresh_topic(p_topic uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.forum_topics t
       set reply_count = c.cnt,
           last_reply_at = c.last_at,
           last_reply_author_id = c.last_author,
           last_activity_at = greatest(t.created_at, coalesce(c.last_at, t.created_at))
      from (
          select count(*)::integer as cnt,
                 max(r.created_at) as last_at,
                 (array_agg(r.author_id order by r.created_at desc))[1] as last_author
          from public.forum_replies r
          where r.topic_id = p_topic and r.status = 'active'
      ) c
     where t.id = p_topic;
end;
$$;

create or replace function public.trg_forum_replies_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        perform public.forum_refresh_topic(old.topic_id);
    else
        perform public.forum_refresh_topic(new.topic_id);
    end if;
    return null;
end;
$$;

drop trigger if exists trg_forum_replies_refresh on public.forum_replies;
create trigger trg_forum_replies_refresh
    after insert or update of status or delete on public.forum_replies
    for each row execute function public.trg_forum_replies_refresh();

-- Sürət limitləri və təkrar məzmun (server tərəfi; RPC-dən asılı olmayaraq cədvəl səviyyəsində)
create or replace function public.limit_forum_topics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.author_id is null then return new; end if;
    if (select count(*) from public.forum_topics
        where author_id = new.author_id and created_at > now() - interval '1 hour') >= 10 then
        raise exception 'Saatlıq mövzu limiti (10) dolub. Bir az sonra yenidən cəhd edin.' using errcode = '54000';
    end if;
    if exists (select 1 from public.forum_topics
               where author_id = new.author_id and content_hash = new.content_hash
                 and status <> 'deleted' and created_at > now() - interval '24 hours') then
        raise exception 'Eyni məzmunlu mövzu artıq yaradılıb.' using errcode = '23505';
    end if;
    return new;
end;
$$;

create or replace function public.limit_forum_replies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    p record;
begin
    if new.author_id is null then return new; end if;
    if (select count(*) from public.forum_replies
        where author_id = new.author_id and created_at > now() - interval '1 hour') >= 30 then
        raise exception 'Saatlıq cavab limiti (30) dolub. Bir az sonra yenidən cəhd edin.' using errcode = '54000';
    end if;
    if exists (select 1 from public.forum_replies
               where author_id = new.author_id and content_hash = new.content_hash
                 and status <> 'deleted' and created_at > now() - interval '10 minutes') then
        raise exception 'Eyni cavab artıq göndərilib.' using errcode = '23505';
    end if;
    if new.parent_id is not null then
        select topic_id, parent_id into p from public.forum_replies where id = new.parent_id;
        if not found or p.topic_id <> new.topic_id then
            raise exception 'Cavab verilən şərh tapılmadı.' using errcode = '22023';
        end if;
        if p.parent_id is not null then
            raise exception 'Cavab zənciri yalnız bir səviyyə dərinliyə icazə verir.' using errcode = '22023';
        end if;
    end if;
    return new;
end;
$$;

create or replace function public.limit_forum_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.reporter_id is null then return new; end if;
    if (select count(*) from public.forum_reports
        where reporter_id = new.reporter_id and created_at > now() - interval '1 hour') >= 10 then
        raise exception 'Saatlıq şikayət limiti (10) dolub.' using errcode = '54000';
    end if;
    if (select count(*) from public.forum_reports
        where reporter_id = new.reporter_id and created_at > now() - interval '24 hours') >= 30 then
        raise exception 'Gündəlik şikayət limiti (30) dolub.' using errcode = '54000';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_forum_topics_rate on public.forum_topics;
create trigger trg_forum_topics_rate before insert on public.forum_topics
    for each row execute function public.limit_forum_topics();
drop trigger if exists trg_forum_replies_rate on public.forum_replies;
create trigger trg_forum_replies_rate before insert on public.forum_replies
    for each row execute function public.limit_forum_replies();
drop trigger if exists trg_forum_reports_rate on public.forum_reports;
create trigger trg_forum_reports_rate before insert on public.forum_reports
    for each row execute function public.limit_forum_reports();

-- Bloklanmış istifadəçiyə aydın mesaj
create or replace function public.forum_assert_can_write(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    until_ts timestamptz;
begin
    if p_user is null then
        raise exception 'Giriş tələb olunur' using errcode = '28000';
    end if;
    -- Eyni istifadəçinin yazma əməliyyatlarını sıraya düzür: təkrar klik / paralel sorğularda
    -- "təkrar məzmun" və saatlıq limit yoxlamaları yarışmasın (tranzaksiya bitəndə avtomatik buraxılır).
    perform pg_advisory_xact_lock(hashtextextended('forum_write:' || p_user::text, 0));
    if not exists (select 1 from public.profiles where id = p_user) then
        raise exception 'Profil tapılmadı.' using errcode = '28000';
    end if;
    select blocked_until into until_ts from public.user_moderation where user_id = p_user;
    if until_ts is not null and until_ts > now() then
        raise exception 'Hesabınız müvəqqəti məhdudlaşdırılıb (%-dək).',
            case when until_ts > now() + interval '100 years' then 'qeyri-müəyyən müddət' else to_char(until_ts at time zone 'UTC', 'DD.MM.YYYY HH24:MI') || ' UTC' end
            using errcode = '42501';
    end if;
end;
$$;

-- ---------------------------------------------------------------------
-- E. FORUM RPC-ləri (istifadəçi)
-- ---------------------------------------------------------------------
create or replace function public.forum_create_topic(p_category uuid, p_title text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    t text;
    b text;
    new_id uuid;
begin
    perform public.forum_assert_can_write(me);
    if not exists (select 1 from public.forum_categories where id = p_category and is_active) then
        raise exception 'Kateqoriya tapılmadı və ya deaktivdir.' using errcode = '22023';
    end if;
    t := public.forum_clean_text(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'), 5, 150, 'Başlıq');
    b := public.forum_clean_text(p_body, 10, 10000, 'Mətn');
    insert into public.forum_topics (category_id, author_id, title, body, excerpt, content_hash)
    values (p_category, me, t, b, public.forum_excerpt(b), public.forum_hash(t || ' ' || b))
    returning id into new_id;
    return new_id;
end;
$$;

create or replace function public.forum_update_topic(p_id uuid, p_title text, p_body text, p_category uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    r public.forum_topics%rowtype;
    t text;
    b text;
    by_admin boolean;
begin
    if me is null then raise exception 'Giriş tələb olunur' using errcode = '28000'; end if;
    select * into r from public.forum_topics where id = p_id for update;
    if not found or r.status = 'deleted' then raise exception 'Mövzu tapılmadı.' using errcode = 'P0002'; end if;
    by_admin := public.is_admin() and r.author_id is distinct from me;
    if not by_admin then
        if r.author_id is distinct from me then raise exception 'Yalnız müəllif redaktə edə bilər.' using errcode = '42501'; end if;
        perform public.forum_assert_can_write(me);
        if r.status <> 'active' then raise exception 'Bu mövzu redaktə edilə bilməz.' using errcode = '42501'; end if;
        if r.is_locked then raise exception 'Mövzu bağlanıb, redaktə mümkün deyil.' using errcode = '42501'; end if;
    end if;
    if p_category is distinct from r.category_id
       and not exists (select 1 from public.forum_categories where id = p_category and is_active) then
        raise exception 'Kateqoriya tapılmadı və ya deaktivdir.' using errcode = '22023';
    end if;
    t := public.forum_clean_text(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'), 5, 150, 'Başlıq');
    b := public.forum_clean_text(p_body, 10, 10000, 'Mətn');
    update public.forum_topics
       set title = t, body = b, excerpt = public.forum_excerpt(b), category_id = p_category,
           content_hash = public.forum_hash(t || ' ' || b), edited_at = now()
     where id = p_id;
    if by_admin then
        perform public.audit_write('forum.topic.edit', 'forum_topic', p_id::text, left(r.title, 80),
            jsonb_build_object('title_changed', r.title is distinct from t, 'body_changed', r.body is distinct from b,
                               'category_changed', r.category_id is distinct from p_category));
    end if;
end;
$$;

create or replace function public.forum_delete_topic(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    r public.forum_topics%rowtype;
    by_admin boolean;
begin
    if me is null then raise exception 'Giriş tələb olunur' using errcode = '28000'; end if;
    select * into r from public.forum_topics where id = p_id for update;
    if not found or r.status = 'deleted' then raise exception 'Mövzu tapılmadı.' using errcode = 'P0002'; end if;
    by_admin := public.is_admin() and r.author_id is distinct from me;
    if not by_admin and r.author_id is distinct from me then
        raise exception 'Yalnız müəllif silə bilər.' using errcode = '42501';
    end if;
    update public.forum_topics set status = 'deleted', deleted_at = now() where id = p_id;
    if by_admin then
        perform public.audit_write('forum.topic.delete', 'forum_topic', p_id::text, left(r.title, 80), '{}'::jsonb);
    end if;
end;
$$;

create or replace function public.forum_create_reply(p_topic uuid, p_body text, p_parent uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    tp public.forum_topics%rowtype;
    par public.forum_replies%rowtype;
    b text;
    new_id uuid;
    actor_name text;
begin
    perform public.forum_assert_can_write(me);
    select * into tp from public.forum_topics where id = p_topic;
    if not found or tp.status <> 'active' then raise exception 'Mövzu tapılmadı.' using errcode = 'P0002'; end if;
    if tp.is_locked then raise exception 'Mövzu bağlanıb, yeni cavab yazmaq mümkün deyil.' using errcode = '42501'; end if;
    if p_parent is not null then
        select * into par from public.forum_replies where id = p_parent;
        if not found or par.topic_id <> p_topic or par.status <> 'active' then
            raise exception 'Cavab verilən şərh tapılmadı.' using errcode = 'P0002';
        end if;
    end if;
    b := public.forum_clean_text(p_body, 1, 5000, 'Cavab');
    insert into public.forum_replies (topic_id, parent_id, author_id, body, content_hash)
    values (p_topic, p_parent, me, b, public.forum_hash(p_topic::text || ' ' || coalesce(p_parent::text, '') || ' ' || b))
    returning id into new_id;

    select coalesce(nullif(full_name, ''), 'İstifadəçi') into actor_name from public.profiles where id = me;
    -- Bildirişlər: şərhin müəllifinə və mövzunun müəllifinə (özünə yox; eyni şəxsə iki dəfə yox)
    if p_parent is not null and par.author_id is not null and par.author_id <> me then
        insert into public.notifications (user_id, actor_id, type, title, body, link, topic_id, reply_id)
        values (par.author_id, me, 'forum_reply_to_reply', left(actor_name, 60) || ' cavabınıza cavab yazdı',
                left(tp.title, 120), '/forum/' || p_topic::text, p_topic, new_id);
    end if;
    if tp.author_id is not null and tp.author_id <> me and tp.author_id is distinct from par.author_id then
        insert into public.notifications (user_id, actor_id, type, title, body, link, topic_id, reply_id)
        values (tp.author_id, me, 'forum_reply', left(actor_name, 60) || ' mövzunuza cavab yazdı',
                left(tp.title, 120), '/forum/' || p_topic::text, p_topic, new_id);
    end if;
    return new_id;
end;
$$;

create or replace function public.forum_update_reply(p_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    r public.forum_replies%rowtype;
    tp public.forum_topics%rowtype;
    b text;
    by_admin boolean;
begin
    if me is null then raise exception 'Giriş tələb olunur' using errcode = '28000'; end if;
    select * into r from public.forum_replies where id = p_id for update;
    if not found or r.status = 'deleted' then raise exception 'Cavab tapılmadı.' using errcode = 'P0002'; end if;
    by_admin := public.is_admin() and r.author_id is distinct from me;
    if not by_admin then
        if r.author_id is distinct from me then raise exception 'Yalnız müəllif redaktə edə bilər.' using errcode = '42501'; end if;
        perform public.forum_assert_can_write(me);
        if r.status <> 'active' then raise exception 'Bu cavab redaktə edilə bilməz.' using errcode = '42501'; end if;
        select * into tp from public.forum_topics where id = r.topic_id;
        if tp.status <> 'active' or tp.is_locked then raise exception 'Mövzu bağlanıb, redaktə mümkün deyil.' using errcode = '42501'; end if;
    end if;
    b := public.forum_clean_text(p_body, 1, 5000, 'Cavab');
    update public.forum_replies
       set body = b, content_hash = public.forum_hash(r.topic_id::text || ' ' || coalesce(r.parent_id::text, '') || ' ' || b), edited_at = now()
     where id = p_id;
    if by_admin then
        perform public.audit_write('forum.reply.edit', 'forum_reply', p_id::text, left(r.body, 80), '{}'::jsonb);
    end if;
end;
$$;

create or replace function public.forum_delete_reply(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    r public.forum_replies%rowtype;
    by_admin boolean;
begin
    if me is null then raise exception 'Giriş tələb olunur' using errcode = '28000'; end if;
    select * into r from public.forum_replies where id = p_id for update;
    if not found or r.status = 'deleted' then raise exception 'Cavab tapılmadı.' using errcode = 'P0002'; end if;
    by_admin := public.is_admin() and r.author_id is distinct from me;
    if not by_admin and r.author_id is distinct from me then
        raise exception 'Yalnız müəllif silə bilər.' using errcode = '42501';
    end if;
    update public.forum_replies set status = 'deleted', deleted_at = now() where id = p_id;
    if by_admin then
        perform public.audit_write('forum.reply.delete', 'forum_reply', p_id::text, left(r.body, 80), '{}'::jsonb);
    end if;
end;
$$;

create or replace function public.forum_report(p_target_type text, p_target uuid, p_reason text, p_details text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    v_topic uuid;
    v_reply uuid;
    v_author uuid;
    d text;
    new_id uuid;
begin
    perform public.forum_assert_can_write(me);
    if p_reason is null or p_reason not in ('spam', 'abuse', 'offtopic', 'unsafe', 'other') then
        raise exception 'Şikayət səbəbi yanlışdır.' using errcode = '22023';
    end if;
    if p_target_type = 'topic' then
        select id, author_id into v_topic, v_author from public.forum_topics where id = p_target and status = 'active';
        if v_topic is null then raise exception 'Məzmun tapılmadı.' using errcode = 'P0002'; end if;
    elsif p_target_type = 'reply' then
        select r.topic_id, r.id, r.author_id into v_topic, v_reply, v_author
          from public.forum_replies r join public.forum_topics t on t.id = r.topic_id
         where r.id = p_target and r.status = 'active' and t.status = 'active';
        if v_reply is null then raise exception 'Məzmun tapılmadı.' using errcode = 'P0002'; end if;
    else
        raise exception 'Şikayət növü yanlışdır.' using errcode = '22023';
    end if;
    if v_author = me then raise exception 'Öz məzmununuzu şikayət edə bilməzsiniz.' using errcode = '22023'; end if;
    d := nullif(public.forum_clean_text(coalesce(p_details, ''), 0, 500, 'Əlavə qeyd'), '');

    if v_reply is null then
        insert into public.forum_reports (reporter_id, topic_id, reply_id, reason, details)
        values (me, v_topic, null, p_reason, d)
        on conflict (reporter_id, topic_id) where reply_id is null do nothing
        returning id into new_id;
    else
        insert into public.forum_reports (reporter_id, topic_id, reply_id, reason, details)
        values (me, v_topic, v_reply, p_reason, d)
        on conflict (reporter_id, reply_id) where reply_id is not null do nothing
        returning id into new_id;
    end if;
    if new_id is null then
        raise exception 'Siz bu məzmunu artıq şikayət etmisiniz.' using errcode = '23505';
    end if;
    return new_id;
end;
$$;

-- Bildirişlər
create or replace function public.unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select count(*)::integer from public.notifications where user_id = auth.uid() and is_read = false;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
    update public.notifications set is_read = true where user_id = auth.uid() and is_read = false;
$$;

-- ---------------------------------------------------------------------
-- F. RLS (oxuma) və İCAZƏLƏR
-- ---------------------------------------------------------------------
alter table public.forum_categories enable row level security;
alter table public.forum_topics     enable row level security;
alter table public.forum_replies    enable row level security;
alter table public.forum_reports    enable row level security;
alter table public.notifications    enable row level security;

drop policy if exists "forum_categories_select" on public.forum_categories;
create policy "forum_categories_select" on public.forum_categories for select using (true);

drop policy if exists "forum_topics_select" on public.forum_topics;
create policy "forum_topics_select" on public.forum_topics
    for select using (status = 'active' or (select public.is_admin()));

drop policy if exists "forum_replies_select" on public.forum_replies;
create policy "forum_replies_select" on public.forum_replies
    for select using (
        (select public.is_admin())
        or (status = 'active' and exists (select 1 from public.forum_topics t where t.id = topic_id and t.status = 'active'))
    );

drop policy if exists "forum_reports_select_admin" on public.forum_reports;
create policy "forum_reports_select_admin" on public.forum_reports
    for select to authenticated using ((select public.is_admin()));

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
    for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
    for delete to authenticated using (user_id = auth.uid());
-- INSERT/UPDATE/DELETE siyasəti forum_* cədvəllərində YOXDUR: yazma yalnız RPC ilə.

-- Əvvəlcə hər şeyi bağla (köhnə layihələrdə avtomatik GRANT ALL ola bilər), sonra lazım olanı aç
revoke all on public.forum_categories, public.forum_topics, public.forum_replies,
              public.forum_reports, public.notifications from anon, authenticated;
grant select on public.forum_categories, public.forum_topics, public.forum_replies to anon, authenticated;
grant select on public.forum_reports to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

-- Funksiya icazələri: daxili köməkçilər bağlıdır; RPC-lər yalnız daxil olmuş istifadəçiyə açıqdır
revoke all on function public.forum_clean_text(text, integer, integer, text) from public, anon, authenticated;
revoke all on function public.forum_hash(text) from public, anon, authenticated;
revoke all on function public.forum_excerpt(text) from public, anon, authenticated;
revoke all on function public.forum_refresh_topic(uuid) from public, anon, authenticated;
revoke all on function public.trg_forum_replies_refresh() from public, anon, authenticated;
revoke all on function public.limit_forum_topics() from public, anon, authenticated;
revoke all on function public.limit_forum_replies() from public, anon, authenticated;
revoke all on function public.limit_forum_reports() from public, anon, authenticated;
revoke all on function public.forum_assert_can_write(uuid) from public, anon, authenticated;
revoke all on function public.protect_account_type() from public, anon, authenticated;

revoke all on function public.is_user_blocked(uuid) from public, anon;
grant execute on function public.is_user_blocked(uuid) to authenticated;

revoke all on function public.set_my_account_type(text) from public, anon;
revoke all on function public.forum_create_topic(uuid, text, text) from public, anon;
revoke all on function public.forum_update_topic(uuid, text, text, uuid) from public, anon;
revoke all on function public.forum_delete_topic(uuid) from public, anon;
revoke all on function public.forum_create_reply(uuid, text, uuid) from public, anon;
revoke all on function public.forum_update_reply(uuid, text) from public, anon;
revoke all on function public.forum_delete_reply(uuid) from public, anon;
revoke all on function public.forum_report(text, uuid, text, text) from public, anon;
revoke all on function public.unread_notification_count() from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.set_my_account_type(text) to authenticated;
grant execute on function public.forum_create_topic(uuid, text, text) to authenticated;
grant execute on function public.forum_update_topic(uuid, text, text, uuid) to authenticated;
grant execute on function public.forum_delete_topic(uuid) to authenticated;
grant execute on function public.forum_create_reply(uuid, text, uuid) to authenticated;
grant execute on function public.forum_update_reply(uuid, text) to authenticated;
grant execute on function public.forum_delete_reply(uuid) to authenticated;
grant execute on function public.forum_report(text, uuid, text, text) to authenticated;
grant execute on function public.unread_notification_count() to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ---------------------------------------------------------------------
-- G. REALTIME (yeni cavablar səhifəni yeniləsin; RLS realtime-a da tətbiq olunur)
-- ---------------------------------------------------------------------
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'forum_replies'
    ) then
        alter publication supabase_realtime add table public.forum_replies;
    end if;
end
$$;

commit;
