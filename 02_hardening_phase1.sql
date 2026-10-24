-- =====================================================================
-- 02 — TƏHLÜKƏSİZLİK, 1-Cİ MƏRHƏLƏ (ƏLAVƏ EDİR, KÖHNƏ SAYTI POZMUR)
-- Heç bir məlumat silinmir və ya dəyişdirilmir. Hamısı bir tranzaksiyadadır:
-- xəta olarsa, hər şey avtomatik geri qaytarılır.
-- Əvvəlcə 00_preflight_readonly.sql işlədin. Sonra bu faylı işlədin.
-- Sonra yeni saytı (v3) Vercel-ə yerləşdirin. Yalnız bundan SONRA 03 faylını işlədin.
-- Geri qaytarma: 99_rollback.sql
-- =====================================================================
begin;

-- A. Fayl ünvanları yalnız https:// olmalıdır (NOT VALID = mövcud sətirlər yoxlanılmır)
create or replace function public.all_https(urls text[])
returns boolean
language sql
immutable
as $$
    select coalesce(bool_and(u ~* '^https://'), true) from unnest(urls) as u;
$$;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'pdfs_file_url_https') then
        alter table public.pdfs
            add constraint pdfs_file_url_https check (file_url ~* '^https://') not valid;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'books_image_urls_https') then
        alter table public.books
            add constraint books_image_urls_https check (public.all_https(image_urls)) not valid;
    end if;
end
$$;

-- B. Yeni sütun və cədvəl
alter table public.conversations
    add column if not exists created_by uuid references public.profiles(id) on delete set null;

create table if not exists public.view_events (
    user_id    uuid not null references public.profiles(id) on delete cascade,
    item_type  text not null check (item_type in ('book_view', 'pdf_view', 'pdf_download')),
    item_id    uuid not null,
    day        date not null default current_date,
    primary key (user_id, item_type, item_id, day)
);
alter table public.view_events enable row level security;  -- siyasət yoxdur: yalnız funksiyalar yaza bilər

-- C. Sürət üçün indekslər
create index if not exists idx_chat_messages_sender_time on public.chat_messages (sender_id, created_at desc);
create index if not exists idx_conversations_creator_time on public.conversations (created_by, created_at desc);
create index if not exists idx_books_seller_time on public.books (seller_id, created_at desc);
create index if not exists idx_pdfs_uploader_time on public.pdfs (uploader_id, created_at desc);
create index if not exists idx_quiz_attempts_user_time on public.quiz_attempts (user_id, created_at desc);

-- D. Sayğacları birbaşa API ilə dəyişmək qadağandır (yalnız aşağıdakı funksiyalar dəyişə bilər)
create or replace function public.protect_book_counters()
returns trigger
language plpgsql
as $$
begin
    if coalesce(current_setting('app.allow_counter_update', true), '') = 'on' then
        return new;
    end if;
    if tg_op = 'INSERT' then
        new.view_count := 0;
    else
        new.view_count := old.view_count;
    end if;
    return new;
end;
$$;

create or replace function public.protect_pdf_counters()
returns trigger
language plpgsql
as $$
begin
    if coalesce(current_setting('app.allow_counter_update', true), '') = 'on' then
        return new;
    end if;
    if tg_op = 'INSERT' then
        new.view_count := 0;
        new.download_count := 0;
    else
        new.view_count := old.view_count;
        new.download_count := old.download_count;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_books_protect_counters on public.books;
create trigger trg_books_protect_counters before insert or update on public.books
    for each row execute function public.protect_book_counters();

drop trigger if exists trg_pdfs_protect_counters on public.pdfs;
create trigger trg_pdfs_protect_counters before insert or update on public.pdfs
    for each row execute function public.protect_pdf_counters();

-- E. Sayğac funksiyaları: giriş etmiş istifadəçi başına gündə 1 dəfə, öz elanı sayılmır
create or replace function public.increment_book_view(p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
begin
    if me is null then return; end if;
    if not exists (select 1 from public.books where id = p_book_id and status = 'active' and seller_id <> me) then
        return;
    end if;
    insert into public.view_events (user_id, item_type, item_id) values (me, 'book_view', p_book_id)
    on conflict do nothing;
    if found then
        perform set_config('app.allow_counter_update', 'on', true);
        update public.books set view_count = view_count + 1 where id = p_book_id;
        perform set_config('app.allow_counter_update', 'off', true);
    end if;
end;
$$;

create or replace function public.increment_pdf_view(p_pdf_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
begin
    if me is null then return; end if;
    if not exists (select 1 from public.pdfs where id = p_pdf_id and status = 'active' and uploader_id <> me) then
        return;
    end if;
    insert into public.view_events (user_id, item_type, item_id) values (me, 'pdf_view', p_pdf_id)
    on conflict do nothing;
    if found then
        perform set_config('app.allow_counter_update', 'on', true);
        update public.pdfs set view_count = view_count + 1 where id = p_pdf_id;
        perform set_config('app.allow_counter_update', 'off', true);
    end if;
end;
$$;

create or replace function public.increment_pdf_download(p_pdf_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
begin
    if me is null then return; end if;
    if not exists (select 1 from public.pdfs where id = p_pdf_id and status = 'active' and uploader_id <> me) then
        return;
    end if;
    insert into public.view_events (user_id, item_type, item_id) values (me, 'pdf_download', p_pdf_id)
    on conflict do nothing;
    if found then
        perform set_config('app.allow_counter_update', 'on', true);
        update public.pdfs set download_count = download_count + 1 where id = p_pdf_id;
        perform set_config('app.allow_counter_update', 'off', true);
    end if;
end;
$$;

-- F. Sürət limitləri (spam qorunması)
create or replace function public.limit_chat_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (select count(*) from public.chat_messages
        where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
        raise exception 'Çox tez mesaj göndərirsiniz. Bir az gözləyin.';
    end if;
    if (select count(*) from public.chat_messages
        where sender_id = new.sender_id and created_at > now() - interval '1 hour') >= 300 then
        raise exception 'Saatlıq mesaj limiti dolub. Bir az sonra yenidən cəhd edin.';
    end if;
    return new;
end;
$$;

create or replace function public.limit_book_inserts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (select count(*) from public.books
        where seller_id = new.seller_id and created_at > now() - interval '24 hours') >= 15 then
        raise exception 'Gündəlik elan limiti (15) dolub.';
    end if;
    return new;
end;
$$;

create or replace function public.limit_pdf_inserts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (select count(*) from public.pdfs
        where uploader_id = new.uploader_id and created_at > now() - interval '24 hours') >= 15 then
        raise exception 'Gündəlik PDF yükləmə limiti (15) dolub.';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_chat_rate on public.chat_messages;
create trigger trg_chat_rate before insert on public.chat_messages
    for each row execute function public.limit_chat_rate();

drop trigger if exists trg_books_rate on public.books;
create trigger trg_books_rate before insert on public.books
    for each row execute function public.limit_book_inserts();

drop trigger if exists trg_pdfs_rate on public.pdfs;
create trigger trg_pdfs_rate before insert on public.pdfs
    for each row execute function public.limit_pdf_inserts();

-- G. Söhbət açma: yoxlamalar və limit (imza dəyişmir)
create or replace function public.get_or_create_conversation(p_other_user uuid, p_book_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    me    uuid := auth.uid();
    a     uuid;
    b     uuid;
    conv  uuid;
    zero  uuid := '00000000-0000-0000-0000-000000000000';
begin
    if me is null then
        raise exception 'Giriş tələb olunur';
    end if;
    if me = p_other_user then
        raise exception 'Özünüzlə söhbət aça bilməzsiniz';
    end if;
    if not exists (select 1 from public.profiles where id = p_other_user) then
        raise exception 'İstifadəçi tapılmadı';
    end if;
    if p_book_id is not null
       and not exists (select 1 from public.books where id = p_book_id and seller_id = p_other_user) then
        raise exception 'Elan bu istifadəçiyə aid deyil';
    end if;

    if me < p_other_user then
        a := me; b := p_other_user;
    else
        a := p_other_user; b := me;
    end if;

    select id into conv
    from public.conversations
    where user_a = a and user_b = b and coalesce(book_id, zero) = coalesce(p_book_id, zero)
    limit 1;

    if conv is null then
        if (select count(*) from public.conversations
            where created_by = me and created_at > now() - interval '1 hour') >= 10 then
            raise exception 'Çox sayda yeni söhbət açmısınız. Bir az sonra yenidən cəhd edin.';
        end if;
        if (select count(*) from public.conversations
            where created_by = me and created_at > now() - interval '24 hours') >= 30 then
            raise exception 'Gündəlik yeni söhbət limiti dolub.';
        end if;
        insert into public.conversations (user_a, user_b, book_id, created_by)
        values (a, b, p_book_id, me)
        returning id into conv;
    end if;

    return conv;
end;
$$;

-- H. Sınaq: cavabın yoxlanması və nəticənin hesablanması YALNIZ serverdə
create or replace function public.check_answer(p_question_id uuid, p_picked integer)
returns table (r_correct boolean, r_index integer, r_explanation text)
language sql
stable
security definer
set search_path = public
as $$
    select (q.correct_index = p_picked), q.correct_index, q.explanation
    from public.quiz_questions q
    join public.quizzes z on z.id = q.quiz_id
    where q.id = p_question_id and z.is_published = true;
$$;

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb, p_seconds integer)
returns table (r_correct integer, r_total integer, r_percent numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
    me    uuid := auth.uid();
    dur   integer;
    total integer;
    ok    integer;
    pct   numeric;
    secs  integer;
begin
    if me is null then
        raise exception 'Giriş tələb olunur';
    end if;
    if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
        raise exception 'Yanlış cavab formatı';
    end if;

    select duration_seconds into dur from public.quizzes where id = p_quiz_id and is_published = true;
    if dur is null then
        raise exception 'Sınaq tapılmadı';
    end if;

    if (select count(*) from public.quiz_attempts
        where user_id = me and created_at > now() - interval '1 hour') >= 60 then
        raise exception 'Saatlıq sınaq limiti dolub.';
    end if;

    select count(*) into total from public.quiz_questions where quiz_id = p_quiz_id;

    select count(*) into ok
    from public.quiz_questions q
    join (
        select distinct on (a ->> 'q') (a ->> 'q') as qid, (a ->> 'picked') as picked
        from jsonb_array_elements(p_answers) as a
    ) x on x.qid = q.id::text and x.picked = q.correct_index::text
    where q.quiz_id = p_quiz_id;

    secs := least(greatest(coalesce(p_seconds, 0), 0), dur);
    pct  := case when total = 0 then 0 else round(ok * 100.0 / total, 2) end;

    insert into public.quiz_attempts (quiz_id, user_id, correct_count, total_questions, score_percent, seconds_used, answers)
    values (p_quiz_id, me, ok, total, pct, secs, p_answers);

    return query select ok, total, pct;
end;
$$;

revoke all on function public.submit_quiz_attempt(uuid, jsonb, integer) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid, jsonb, integer) to authenticated;
grant execute on function public.check_answer(uuid, integer) to anon, authenticated;

-- I. Hesabı silmək (məxfilik siyasətindəki vədin icrası; yalnız istifadəçinin öz hesabı)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if auth.uid() is null then
        raise exception 'Giriş tələb olunur';
    end if;
    delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- J. Düzəliş: admin rolunu SQL Editor / service_role ilə təyin etmək mümkün olsun
--    (əvvəlki trigger bunu da bloklayırdı). Adi istifadəçi öz rolunu dəyişə bilməz.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
        new.role = old.role;
    end if;
    return new;
end;
$$;

commit;
