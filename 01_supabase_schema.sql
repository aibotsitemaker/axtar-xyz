-- =====================================================================
-- TƏHSİL HUB — SUPABASE TAM SQL SXEMİ
-- Supabase Dashboard > SQL Editor > New query > yapışdır > Run
-- Təmiz layihədə bir dəfə işlədin.
-- DİQQƏT: 30 may 2026-dan sonra yaradılan Supabase layihələrində bundan sonra 02 və 04_grants.sql da işlədilməlidir,
-- yoxsa sayt "permission denied for table" xətası verir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. GENİŞLƏNMƏLƏR
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- 1. PROFİLLƏR (auth.users ilə 1-ə-1 əlaqə)
-- ---------------------------------------------------------------------
create table public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    full_name   text not null default '',
    username    text unique,
    avatar_url  text,
    city        text,
    bio         text,
    role        text not null default 'user' check (role in ('user', 'admin')),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. 2-Cİ ƏL KİTAB BAZARI
-- ---------------------------------------------------------------------
create table public.books (
    id           uuid primary key default gen_random_uuid(),
    seller_id    uuid not null references public.profiles(id) on delete cascade,
    title        text not null check (char_length(title) between 3 and 150),
    author       text,
    description  text,
    category     text not null check (category in ('DİM', 'Magistr', 'IELTS', 'Universitet', 'Digər')),
    condition    text not null default 'Yaxşı' check (condition in ('Yeni kimi', 'Yaxşı', 'Orta', 'Köhnə')),
    price        numeric(10,2) not null check (price >= 0),
    city         text not null default 'Bakı',
    metro        text,
    image_urls   text[] not null default '{}',
    whatsapp     text,
    status       text not null default 'active' check (status in ('active', 'sold', 'hidden')),
    view_count   integer not null default 0,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index idx_books_seller   on public.books(seller_id);
create index idx_books_category on public.books(category);
create index idx_books_city     on public.books(city);
create index idx_books_status   on public.books(status, created_at desc);
create index idx_books_title_trgm on public.books using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 3. PDF & KONSPEKT ARXİVİ
-- ---------------------------------------------------------------------
create table public.pdfs (
    id              uuid primary key default gen_random_uuid(),
    uploader_id     uuid not null references public.profiles(id) on delete cascade,
    title           text not null check (char_length(title) between 3 and 150),
    description     text,
    level           text not null check (level in ('Orta məktəb', 'DİM', 'Bakalavr', 'Magistr', 'IELTS', 'Digər')),
    subject         text not null,
    year            integer check (year between 1990 and 2100),
    file_url        text not null,
    file_size_kb    integer,
    view_count      integer not null default 0,
    download_count  integer not null default 0,
    status          text not null default 'active' check (status in ('active', 'hidden')),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index idx_pdfs_uploader on public.pdfs(uploader_id);
create index idx_pdfs_level    on public.pdfs(level);
create index idx_pdfs_subject  on public.pdfs(subject);
create index idx_pdfs_year     on public.pdfs(year);
create index idx_pdfs_title_trgm on public.pdfs using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 4. FAVORİLƏR (kitab və ya PDF)
-- ---------------------------------------------------------------------
create table public.favorites (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    item_type   text not null check (item_type in ('book', 'pdf')),
    book_id     uuid references public.books(id) on delete cascade,
    pdf_id      uuid references public.pdfs(id) on delete cascade,
    created_at  timestamptz not null default now(),
    constraint favorites_one_target check (
        (item_type = 'book' and book_id is not null and pdf_id is null) or
        (item_type = 'pdf'  and pdf_id  is not null and book_id is null)
    ),
    constraint favorites_unique_book unique (user_id, book_id),
    constraint favorites_unique_pdf  unique (user_id, pdf_id)
);

create index idx_favorites_user on public.favorites(user_id);

-- ---------------------------------------------------------------------
-- 5. SINAQLAR (QUIZ ENGINE)
-- ---------------------------------------------------------------------
create table public.quizzes (
    id                uuid primary key default gen_random_uuid(),
    created_by        uuid references public.profiles(id) on delete set null,
    title             text not null,
    description       text,
    category          text not null check (category in ('DİM', 'Magistr', 'IELTS', 'Universitet', 'Digər')),
    duration_seconds  integer not null default 600 check (duration_seconds > 0),
    is_published      boolean not null default true,
    created_at        timestamptz not null default now()
);

create index idx_quizzes_category on public.quizzes(category, is_published);

create table public.quiz_questions (
    id             uuid primary key default gen_random_uuid(),
    quiz_id        uuid not null references public.quizzes(id) on delete cascade,
    position       integer not null default 1,
    question_text  text not null,
    options        jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
    correct_index  integer not null check (correct_index >= 0),
    explanation    text,
    created_at     timestamptz not null default now()
);

create index idx_quiz_questions_quiz on public.quiz_questions(quiz_id, position);

create table public.quiz_attempts (
    id              uuid primary key default gen_random_uuid(),
    quiz_id         uuid not null references public.quizzes(id) on delete cascade,
    user_id         uuid not null references public.profiles(id) on delete cascade,
    correct_count   integer not null default 0,
    total_questions integer not null default 0,
    score_percent   numeric(5,2) not null default 0,
    seconds_used    integer not null default 0,
    answers         jsonb not null default '[]'::jsonb,
    created_at      timestamptz not null default now()
);

create index idx_quiz_attempts_user on public.quiz_attempts(user_id, created_at desc);
create index idx_quiz_attempts_quiz on public.quiz_attempts(quiz_id);

-- ---------------------------------------------------------------------
-- 6. CANLI ÇAT (Realtime)
-- ---------------------------------------------------------------------
create table public.conversations (
    id          uuid primary key default gen_random_uuid(),
    user_a      uuid not null references public.profiles(id) on delete cascade,
    user_b      uuid not null references public.profiles(id) on delete cascade,
    book_id     uuid references public.books(id) on delete set null,
    created_at  timestamptz not null default now(),
    constraint conversations_order check (user_a < user_b)
);

create unique index uq_conversations_pair
    on public.conversations (user_a, user_b, coalesce(book_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index idx_conversations_user_a on public.conversations(user_a);
create index idx_conversations_user_b on public.conversations(user_b);

create table public.chat_messages (
    id               uuid primary key default gen_random_uuid(),
    conversation_id  uuid not null references public.conversations(id) on delete cascade,
    sender_id        uuid not null references public.profiles(id) on delete cascade,
    content          text not null check (char_length(content) between 1 and 2000),
    is_read          boolean not null default false,
    created_at       timestamptz not null default now()
);

create index idx_chat_messages_conv on public.chat_messages(conversation_id, created_at);

-- ---------------------------------------------------------------------
-- 7. HÜQUQİ SƏNƏDLƏR (Məxfilik Siyasəti & İstifadə Şərtləri)
-- ---------------------------------------------------------------------
create table public.privacy_policy_terms (
    id              uuid primary key default gen_random_uuid(),
    doc_type        text not null check (doc_type in ('privacy_policy', 'terms_of_service', 'cookie_policy')),
    title           text not null,
    content         text not null,
    version         text not null default '1.0',
    language        text not null default 'az',
    effective_date  date not null default current_date,
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    unique (doc_type, version, language)
);

-- ---------------------------------------------------------------------
-- 8. KÖMƏKÇİ FUNKSİYALAR
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_profiles_updated before update on public.profiles
    for each row execute function public.set_updated_at();
create trigger trg_books_updated before update on public.books
    for each row execute function public.set_updated_at();
create trigger trg_pdfs_updated before update on public.pdfs
    for each row execute function public.set_updated_at();

-- İstifadəçinin rolunu RLS rekursiyası olmadan oxuyur
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_conversation_member(conv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.conversations c
        where c.id = conv_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
    );
$$;

-- Yeni qeydiyyatdan sonra avtomatik profil yaradır
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- İstifadəçi öz rolunu dəyişə bilməsin
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

create trigger trg_protect_profile_role
    before update on public.profiles
    for each row execute function public.protect_profile_role();

-- Mesajda yalnız is_read dəyişə bilsin
create or replace function public.protect_chat_message_update()
returns trigger
language plpgsql
as $$
begin
    new.id              = old.id;
    new.conversation_id = old.conversation_id;
    new.sender_id       = old.sender_id;
    new.content         = old.content;
    new.created_at      = old.created_at;
    return new;
end;
$$;

create trigger trg_protect_chat_message_update
    before update on public.chat_messages
    for each row execute function public.protect_chat_message_update();

-- Baxış / yükləmə sayğacları (RPC)
create or replace function public.increment_book_view(p_book_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.books set view_count = view_count + 1 where id = p_book_id and status = 'active';
$$;

create or replace function public.increment_pdf_view(p_pdf_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.pdfs set view_count = view_count + 1 where id = p_pdf_id and status = 'active';
$$;

create or replace function public.increment_pdf_download(p_pdf_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.pdfs set download_count = download_count + 1 where id = p_pdf_id and status = 'active';
$$;

-- İki istifadəçi arasında söhbəti tapır və ya yaradır (RPC)
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
begin
    if me is null then
        raise exception 'Giriş tələb olunur';
    end if;
    if me = p_other_user then
        raise exception 'Özünüzlə söhbət aça bilməzsiniz';
    end if;

    if me < p_other_user then
        a := me; b := p_other_user;
    else
        a := p_other_user; b := me;
    end if;

    select id into conv
    from public.conversations
    where user_a = a and user_b = b
      and coalesce(book_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_book_id, '00000000-0000-0000-0000-000000000000'::uuid)
    limit 1;

    if conv is null then
        insert into public.conversations (user_a, user_b, book_id)
        values (a, b, p_book_id)
        returning id into conv;
    end if;

    return conv;
end;
$$;

-- Oxunmamış mesajların sayı (RPC)
create or replace function public.unread_message_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select count(*)::integer
    from public.chat_messages m
    join public.conversations c on c.id = m.conversation_id
    where m.is_read = false
      and m.sender_id <> auth.uid()
      and (c.user_a = auth.uid() or c.user_b = auth.uid());
$$;

grant execute on function public.increment_book_view(uuid)         to anon, authenticated;
grant execute on function public.increment_pdf_view(uuid)          to anon, authenticated;
grant execute on function public.increment_pdf_download(uuid)      to anon, authenticated;
grant execute on function public.get_or_create_conversation(uuid, uuid) to authenticated;
grant execute on function public.unread_message_count()            to authenticated;

-- ---------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.books                enable row level security;
alter table public.pdfs                 enable row level security;
alter table public.favorites            enable row level security;
alter table public.quizzes              enable row level security;
alter table public.quiz_questions       enable row level security;
alter table public.quiz_attempts        enable row level security;
alter table public.conversations        enable row level security;
alter table public.chat_messages        enable row level security;
alter table public.privacy_policy_terms enable row level security;

-- profiles
create policy "profiles_select_all" on public.profiles
    for select using (true);
create policy "profiles_insert_own" on public.profiles
    for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
    for update to authenticated using (id = auth.uid() or public.is_admin())
    with check (id = auth.uid() or public.is_admin());

-- books
create policy "books_select_active_or_own" on public.books
    for select using (status = 'active' or seller_id = auth.uid() or public.is_admin());
create policy "books_insert_own" on public.books
    for insert to authenticated with check (seller_id = auth.uid());
create policy "books_update_own" on public.books
    for update to authenticated using (seller_id = auth.uid() or public.is_admin())
    with check (seller_id = auth.uid() or public.is_admin());
create policy "books_delete_own" on public.books
    for delete to authenticated using (seller_id = auth.uid() or public.is_admin());

-- pdfs
create policy "pdfs_select_active_or_own" on public.pdfs
    for select using (status = 'active' or uploader_id = auth.uid() or public.is_admin());
create policy "pdfs_insert_own" on public.pdfs
    for insert to authenticated with check (uploader_id = auth.uid());
create policy "pdfs_update_own" on public.pdfs
    for update to authenticated using (uploader_id = auth.uid() or public.is_admin())
    with check (uploader_id = auth.uid() or public.is_admin());
create policy "pdfs_delete_own" on public.pdfs
    for delete to authenticated using (uploader_id = auth.uid() or public.is_admin());

-- favorites
create policy "favorites_select_own" on public.favorites
    for select to authenticated using (user_id = auth.uid());
create policy "favorites_insert_own" on public.favorites
    for insert to authenticated with check (user_id = auth.uid());
create policy "favorites_delete_own" on public.favorites
    for delete to authenticated using (user_id = auth.uid());

-- quizzes
create policy "quizzes_select_published" on public.quizzes
    for select using (is_published = true or public.is_admin());
create policy "quizzes_admin_insert" on public.quizzes
    for insert to authenticated with check (public.is_admin());
create policy "quizzes_admin_update" on public.quizzes
    for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "quizzes_admin_delete" on public.quizzes
    for delete to authenticated using (public.is_admin());

-- quiz_questions
create policy "quiz_questions_select_published" on public.quiz_questions
    for select using (
        exists (select 1 from public.quizzes q where q.id = quiz_id and (q.is_published = true or public.is_admin()))
    );
create policy "quiz_questions_admin_insert" on public.quiz_questions
    for insert to authenticated with check (public.is_admin());
create policy "quiz_questions_admin_update" on public.quiz_questions
    for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "quiz_questions_admin_delete" on public.quiz_questions
    for delete to authenticated using (public.is_admin());

-- quiz_attempts
create policy "quiz_attempts_select_own" on public.quiz_attempts
    for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "quiz_attempts_insert_own" on public.quiz_attempts
    for insert to authenticated with check (user_id = auth.uid());

-- conversations
create policy "conversations_select_member" on public.conversations
    for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());
create policy "conversations_insert_member" on public.conversations
    for insert to authenticated with check ((user_a = auth.uid() or user_b = auth.uid()) and user_a < user_b);

-- chat_messages
create policy "chat_messages_select_member" on public.chat_messages
    for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "chat_messages_insert_member" on public.chat_messages
    for insert to authenticated with check (
        sender_id = auth.uid() and public.is_conversation_member(conversation_id)
    );
create policy "chat_messages_update_read" on public.chat_messages
    for update to authenticated using (
        public.is_conversation_member(conversation_id) and sender_id <> auth.uid()
    ) with check (
        public.is_conversation_member(conversation_id) and sender_id <> auth.uid()
    );

-- privacy_policy_terms
create policy "legal_select_active" on public.privacy_policy_terms
    for select using (is_active = true or public.is_admin());
create policy "legal_admin_insert" on public.privacy_policy_terms
    for insert to authenticated with check (public.is_admin());
create policy "legal_admin_update" on public.privacy_policy_terms
    for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "legal_admin_delete" on public.privacy_policy_terms
    for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 10. REALTIME PUBLICATION
-- ---------------------------------------------------------------------
alter table public.chat_messages replica identity full;

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
    ) then
        alter publication supabase_realtime add table public.chat_messages;
    end if;
end
$$;

-- ---------------------------------------------------------------------
-- 11. STORAGE (şəkillər və PDF-lər)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('book-images', 'book-images', true, 5242880,  array['image/jpeg', 'image/png', 'image/webp']),
    ('pdf-files',   'pdf-files',   true, 31457280, array['application/pdf']),
    ('avatars',     'avatars',     true, 2097152,  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "storage_public_read" on storage.objects
    for select using (bucket_id in ('book-images', 'pdf-files', 'avatars'));

create policy "storage_insert_own_folder" on storage.objects
    for insert to authenticated with check (
        bucket_id in ('book-images', 'pdf-files', 'avatars')
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy "storage_update_own_folder" on storage.objects
    for update to authenticated using (
        bucket_id in ('book-images', 'pdf-files', 'avatars')
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy "storage_delete_own_folder" on storage.objects
    for delete to authenticated using (
        bucket_id in ('book-images', 'pdf-files', 'avatars')
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- ---------------------------------------------------------------------
-- 12. SEED: MƏXFİLİK SİYASƏTİ
-- ---------------------------------------------------------------------
insert into public.privacy_policy_terms (doc_type, title, content, version, language, effective_date)
values (
'privacy_policy',
'Məxfilik Siyasəti',
$policy$
# Məxfilik Siyasəti

**Qüvvəyə minmə tarixi:** 18 oktyabr 2026
**Operator:** TəhsilHub ("Platforma", "biz")
**Əlaqə:** info@tehsilhub.az

Bu Məxfilik Siyasəti TəhsilHub platformasından istifadə zamanı şəxsi məlumatlarınızın necə toplandığını, istifadə edildiyini, saxlandığını və qorunduğunu izah edir. Platformadan istifadə etməklə bu siyasətin şərtləri ilə razılaşmış olursunuz.

## 1. Toplanan məlumatlar

**a) Sizin təqdim etdiyiniz məlumatlar:**
- Qeydiyyat zamanı: ad-soyad, e-poçt ünvanı, parol (yalnız şifrələnmiş formada saxlanılır).
- Profil məlumatları: istifadəçi adı, şəhər, qısa bio, profil şəkli.
- Elan məlumatları: kitab başlığı, təsvir, qiymət, şəkillər, şəhər/metro, əlaqə üçün WhatsApp nömrəsi (yalnız siz elanda göstərdiyiniz halda).
- Yüklədiyiniz PDF və konspektlər.
- Platforma daxilindəki mesajlar (istifadəçilər arası çat).
- Onlayn sınaq nəticələri.

**b) Avtomatik toplanan məlumatlar:**
- IP ünvanı, brauzer növü, cihaz məlumatı, əməliyyat sistemi, baxılan səhifələr, giriş vaxtı.
- Cookie və oxşar texnologiyalar vasitəsilə toplanan məlumatlar (bax: 5-ci bölmə).

## 2. Məlumatlardan istifadə məqsədləri

- Hesabınızı yaratmaq və idarə etmək;
- Kitab elanlarını, PDF arxivini, sınaqları və çat xidmətini təmin etmək;
- Alıcı və satıcı arasında əlaqəni yaratmaq;
- Platformanın təhlükəsizliyini qorumaq, saxtakarlığın və sui-istifadənin qarşısını almaq;
- Xidmətin keyfiyyətini analiz etmək və təkmilləşdirmək;
- Reklam göstərmək (Google AdSense vasitəsilə);
- Qüvvədə olan qanunvericiliyin tələblərini yerinə yetirmək.

## 3. Hüquqi əsaslar

Məlumatlarınız aşağıdakı əsaslarla işlənir: (i) razılığınız, (ii) sizinlə bağlanmış istifadə müqaviləsinin icrası, (iii) qanuni maraqlarımız (təhlükəsizlik, təkmilləşdirmə), (iv) qanuni öhdəliklərin yerinə yetirilməsi. Tətbiq olunan çərçivələr: Azərbaycan Respublikasının "Fərdi məlumatlar haqqında" Qanunu, Avropa İttifaqının Ümumi Məlumatların Mühafizəsi Qaydası (GDPR) və Türkiyə Respublikasının 6698 saylı KVKK qanunu (həmin ölkələrin vətəndaşları üçün).

## 4. Google AdSense və üçüncü tərəf reklam tərəfdaşları

Platformada Google AdSense vasitəsilə reklamlar göstərilir. Bu barədə vacib məqamlar:
- Google də daxil olmaqla üçüncü tərəf təchizatçılar, istifadəçinin bu və ya digər saytlara əvvəlki səfərlərinə əsasən reklam göstərmək üçün cookie-lərdən istifadə edirlər.
- Google-un reklam cookie-lərindən istifadəsi Google və tərəfdaşlarına bu saytda və/və ya internetdəki digər saytlarda səfərləriniz əsasında sizə reklam göstərməyə imkan verir.
- Fərdiləşdirilmiş reklamdan imtina etmək üçün https://adssettings.google.com ünvanına daxil ola bilərsiniz. Alternativ olaraq https://www.aboutads.info ünvanında üçüncü tərəf təchizatçıların fərdiləşdirilmiş reklam üçün cookie istifadəsindən imtina edə bilərsiniz.
- Google-un məlumatları necə istifadə etdiyi barədə ətraflı: https://policies.google.com/technologies/partner-sites
- Avropa İqtisadi Zonası, Böyük Britaniya və İsveçrədən olan istifadəçilər üçün Platforma Google tərəfindən sertifikatlaşdırılmış razılıq idarəetmə mexanizmindən (CMP) istifadə edir və fərdiləşdirilmiş reklam yalnız sizin razılığınızla göstərilir.

## 5. Cookie-lər

Cookie-lərdən aşağıdakı məqsədlərlə istifadə edirik:
- **Zəruri cookie-lər:** giriş sessiyası və təhlükəsizlik üçün (imtina edilə bilməz);
- **Funksional cookie-lər:** seçimlərinizi (məsələn, filtrlər) yadda saxlamaq üçün;
- **Analitik cookie-lər:** istifadə statistikasını anlamaq üçün;
- **Reklam cookie-ləri:** Google AdSense və tərəfdaşları tərəfindən.

Cookie-ləri brauzer tənzimləmələrindən silə və ya bloklaya bilərsiniz; bu halda Platformanın bəzi funksiyaları düzgün işləməyə bilər.

## 6. Məlumatların paylaşılması

Şəxsi məlumatlarınızı satmırıq. Məlumatlar yalnız aşağıdakı hallarda paylaşıla bilər:
- Xidmət təchizatçıları ilə (Supabase — verilənlər bazası və autentifikasiya; Vercel/Streamlit — hostinq; Google — reklam və analitika), onlar yalnız bizim göstərişlərimizlə məlumatı emal edir;
- Elanda göstərdiyiniz ictimai məlumatlar (ad, şəhər, əlaqə nömrəsi) digər istifadəçilərə görünür;
- Qanunvericiliyin tələb etdiyi hallarda səlahiyyətli dövlət orqanlarına;
- Platformanın hüquq və təhlükəsizliyinin qorunması üçün zəruri olduqda.

## 7. Məlumatların saxlanma müddəti

Məlumatlar hesabınız aktiv olduğu müddətdə və ya qanunla tələb olunan müddət ərzində saxlanılır. Hesabınızı sildikdə şəxsi məlumatlarınız ağlabatan müddət ərzində silinir və ya anonimləşdirilir.

## 8. Məlumat təhlükəsizliyi

Məlumatlarınızı qorumaq üçün şifrələmə (HTTPS/TLS), parolların hash-lənməsi, Row Level Security (sətir səviyyəsində giriş nəzarəti) və girişin məhdudlaşdırılması kimi texniki və təşkilati tədbirlər görürük. Lakin internet üzərindən ötürülmənin 100% təhlükəsiz olduğuna təminat verilə bilməz.

## 9. Sizin hüquqlarınız

Qüvvədə olan qanunvericiliyə (o cümlədən GDPR və KVKK) əsasən aşağıdakı hüquqlara maliksiniz:
- məlumatlarınıza çıxış və onların surətini almaq;
- yanlış məlumatların düzəldilməsini tələb etmək;
- məlumatların silinməsini ("unudulmaq hüququ") tələb etmək;
- emalın məhdudlaşdırılmasına və ya emala etiraz etmək;
- məlumatların ötürülə bilənliyi (portability);
- verdiyiniz razılığı istənilən vaxt geri götürmək;
- səlahiyyətli nəzarət orqanına şikayət vermək.

Bu hüquqlardan istifadə üçün info@tehsilhub.az ünvanına müraciət edin. Müraciətlərə 30 gün ərzində cavab verilir.

## 10. Uşaqların məxfiliyi

Platforma 16 yaşından kiçik şəxslər üçün nəzərdə tutulmayıb. 16 yaşından kiçik şəxslərin məlumatlarını bilərəkdən toplamırıq. Belə məlumatın toplandığını aşkar etsəniz, bizimlə əlaqə saxlayın, dərhal siləcəyik.

## 11. Beynəlxalq ötürmələr

Məlumatlarınız Azərbaycandan kənardakı serverlərdə (məsələn, Avropa İttifaqı və ya ABŞ) emal oluna bilər. Belə hallarda ötürmə uyğun qoruyucu mexanizmlərlə (məsələn, standart müqavilə bəndləri) həyata keçirilir.

## 12. Siyasətdə dəyişikliklər

Bu siyasəti vaxtaşırı yeniləyə bilərik. Əhəmiyyətli dəyişikliklər barədə Platforma vasitəsilə məlumat veriləcək. Yenilənmiş siyasət dərc edildiyi andan qüvvəyə minir.

## 13. Əlaqə

Suallarınız üçün: **info@tehsilhub.az**
$policy$,
'1.0', 'az', date '2026-10-18'
);

-- ---------------------------------------------------------------------
-- 13. SEED: İSTİFADƏ ŞƏRTLƏRİ
-- ---------------------------------------------------------------------
insert into public.privacy_policy_terms (doc_type, title, content, version, language, effective_date)
values (
'terms_of_service',
'İstifadə Şərtləri',
$terms$
# İstifadə Şərtləri

**Qüvvəyə minmə tarixi:** 18 oktyabr 2026
**Operator:** TəhsilHub ("Platforma", "biz")
**Əlaqə:** info@tehsilhub.az

Platformaya daxil olmaqla və ya qeydiyyatdan keçməklə aşağıdakı şərtləri qəbul etmiş olursunuz. Şərtlərlə razı deyilsinizsə, Platformadan istifadə etməyin.

## 1. Xidmətin təsviri

TəhsilHub aşağıdakı xidmətləri təqdim edir: (a) ikinci əl kitab və dərsliklərin istifadəçilər arasında alqı-satqısı üçün elan bazarı; (b) PDF və konspekt arxivi; (c) onlayn sınaqlar; (d) istifadəçilər arasında canlı çat.

**Platforma yalnız vasitəçi (elan yerləşdirmə) xidmətidir.** Biz alıcı və satıcı arasında bağlanan sövdələşmələrin tərəfi deyilik, ödənişləri emal etmirik və malın keyfiyyətinə, çatdırılmasına, qiymətinə görə məsuliyyət daşımırıq.

## 2. Qeydiyyat və hesab

- Qeydiyyat üçün 16 yaşını tamamlamış olmalısınız.
- Verdiyiniz məlumatlar düzgün və aktual olmalıdır.
- Hesabınızın və parolunuzun təhlükəsizliyinə siz cavabdehsiniz. Hesabınızdan həyata keçirilən bütün fəaliyyət sizin sayılır.
- Hər şəxs yalnız bir hesab aça bilər.

## 3. İstifadəçi öhdəlikləri və qadağalar

Aşağıdakılar qəti qadağandır:
- saxta, yanıldıcı və ya aldadıcı elanlar yerləşdirmək;
- qanunsuz, təhqiramiz, nifrət, zorakılıq və ya ayrı-seçkilik təbliğ edən məzmun yaymaq;
- müəllif hüquqları və əlaqəli hüquqlar pozulmaqla əldə edilmiş materialları (kitab skanları, ödənişli kurs materialları və s.) yükləmək;
- başqa istifadəçilərə spam, təqib, hədə və ya fırıldaq məqsədli mesajlar göndərmək;
- zərərli proqram təminatı yükləmək, Platformanın təhlükəsizliyini pozmağa cəhd etmək;
- avtomatlaşdırılmış vasitələrlə (bot, scraper) icazəsiz məlumat toplamaq;
- reklamlara süni klik etmək və ya başqalarını buna təşviq etmək (Google AdSense qaydalarının pozulması hesabın bağlanmasına səbəb olur);
- Platformanı qanunla qadağan edilmiş mallar və ya xidmətlər üçün istifadə etmək.

## 4. İstifadəçi məzmunu və müəllif hüquqları

- Yüklədiyiniz məzmunun (şəkil, PDF, mətn) müəllifi olduğunuzu və ya onu yaymaq üçün lazımi hüquqlara malik olduğunuzu təsdiq edirsiniz.
- Məzmunu Platformada göstərmək, saxlamaq və təqdim etmək üçün bizə qeyri-müstəsna, dünya miqyasında, royalti-free lisenziya verirsiniz. Məzmunu sildikdə lisenziya xitam olunur.
- Müəllif hüququnun pozulduğunu düşünürsünüzsə, info@tehsilhub.az ünvanına əsaslandırılmış bildiriş göndərin. Əsaslı şikayət alındıqda məzmun dərhal götürülür.
- Platformanın dizaynı, loqosu, proqram kodu və orijinal məzmunu bizə məxsusdur.

## 5. Alqı-satqı qaydaları

- Satıcı kitabın vəziyyətini, qiymətini və əlaqə məlumatını düzgün göstərməlidir.
- Tərəflər görüş və ödənişi öz məsuliyyətləri ilə həyata keçirirlər. Təhlükəsizlik üçün ictimai yerlərdə (məsələn, metro stansiyaları) görüşməyi və malı yoxladıqdan sonra ödəniş etməyi tövsiyə edirik.
- Platforma qabaqcadan ödəniş tələb edən şübhəli təkliflərə qarşı ehtiyatlı olmağı tövsiyə edir.
- Satılmış kitabların elanı "satılıb" statusuna keçirilməlidir.

## 6. Onlayn sınaqlar və təhsil məzmunu

Sınaq və arxiv materialları yalnız məlumat və hazırlıq məqsədi daşıyır. Rəsmi imtahanlarda (DİM, IELTS və s.) konkret nəticə əldə edəcəyinizə zəmanət vermirik.

## 7. Reklamlar

Platformada Google AdSense və digər tərəfdaşlar tərəfindən reklamlar göstərilir. Reklamlar üçüncü tərəflərə məxsusdur və biz reklam verənlərin təqdim etdiyi məhsul və xidmətlərə görə məsuliyyət daşımırıq. Ətraflı məlumat Məxfilik Siyasətində verilib.

## 8. Moderasiya və hesabın dayandırılması

Şərtləri pozan elanları, məzmunu və ya hesabları xəbərdarlıqla və ya xəbərdarlıqsız silmək, məhdudlaşdırmaq və ya bloklamaq hüququmuz var. Hesabınızı istənilən vaxt silə bilərsiniz.

## 9. Məsuliyyətin məhdudlaşdırılması

Platforma "olduğu kimi" və "mövcud olduğu kimi" təqdim olunur. Qanunla icazə verilən maksimum həddə:
- xidmətin fasiləsiz və ya xətasız işləməsinə təminat vermirik;
- istifadəçilər arasındakı mübahisələrə, istifadəçi məzmununa və üçüncü tərəf saytlarına görə məsuliyyət daşımırıq;
- dolayı, təsadüfi və ya nəticə zərərlərinə görə məsuliyyət daşımırıq.

Bu bənd istehlakçının imperativ qanuni hüquqlarını məhdudlaşdırmır.

## 10. Şərtlərdə dəyişikliklər

Şərtləri dəyişdirmək hüququmuz saxlanılır. Dəyişikliklər Platformada dərc edildiyi andan qüvvəyə minir. Dəyişikliklərdən sonra Platformadan istifadəni davam etdirməyiniz yeni şərtləri qəbul etdiyiniz mənasına gəlir.

## 11. Tətbiq olunan hüquq və mübahisələrin həlli

Bu Şərtlər Azərbaycan Respublikasının qanunvericiliyi ilə tənzimlənir. Mübahisələr əvvəlcə danışıqlar yolu ilə, razılıq əldə olunmadıqda Azərbaycan Respublikasının səlahiyyətli məhkəmələrində həll edilir.

## 12. Əlaqə

Suallar və şikayətlər üçün: **info@tehsilhub.az**
$terms$,
'1.0', 'az', date '2026-10-18'
);

-- ---------------------------------------------------------------------
-- 14. SEED: NÜMUNƏ SINAQLAR
-- ---------------------------------------------------------------------
with q as (
    insert into public.quizzes (title, description, category, duration_seconds)
    values ('DİM Riyaziyyat — Sürətli Yoxlama', 'Əsas riyaziyyat bilikləri üzrə 5 sualdan ibarət qısa test.', 'DİM', 300)
    returning id
)
insert into public.quiz_questions (quiz_id, position, question_text, options, correct_index, explanation)
select q.id, t.pos, t.qtext, t.opts::jsonb, t.correct, t.expl
from q,
(values
    (1, '2x + 6 = 20 tənliyində x neçədir?',        '["5","6","7","8"]',      2, '2x = 14, deməli x = 7.'),
    (2, '15% ədədin 45-i təşkil edir. Ədəd neçədir?', '["200","250","300","350"]', 2, '45 / 0.15 = 300.'),
    (3, 'Düzbucaqlı üçbucağın katetləri 6 və 8-dir. Hipotenuz neçədir?', '["9","10","12","14"]', 1, 'Pifaqor teoremi: √(36+64) = 10.'),
    (4, '3² + 4² ifadəsinin qiyməti neçədir?',        '["12","24","25","49"]',  2, '9 + 16 = 25.'),
    (5, 'Hansı ədəd sadə ədəddir?',                  '["21","27","29","33"]',  2, '29 yalnız 1-ə və özünə bölünür.')
) as t(pos, qtext, opts, correct, expl);

with q as (
    insert into public.quizzes (title, description, category, duration_seconds)
    values ('IELTS Grammar — Əsaslar', 'IELTS üçün əsas qrammatika qaydaları üzrə 5 sual.', 'IELTS', 300)
    returning id
)
insert into public.quiz_questions (quiz_id, position, question_text, options, correct_index, explanation)
select q.id, t.pos, t.qtext, t.opts::jsonb, t.correct, t.expl
from q,
(values
    (1, 'She ___ to the library every Saturday.',                 '["go","goes","going","gone"]',                   1, 'Third person singular Present Simple: goes.'),
    (2, 'If I ___ more time, I would learn another language.',    '["have","had","will have","having"]',            1, 'Second conditional: If + Past Simple, would + verb.'),
    (3, 'The report ___ by the manager yesterday.',               '["wrote","was written","has written","is writing"]', 1, 'Passive Past Simple: was written.'),
    (4, 'Choose the correct sentence.',                           '["He don''t like tea.","He doesn''t likes tea.","He doesn''t like tea.","He not like tea."]', 2, 'Doesn''t + base verb.'),
    (5, 'I have lived here ___ 2019.',                            '["for","since","during","from"]',                1, '"Since" is used with a point in time.')
) as t(pos, qtext, opts, correct, expl);

with q as (
    insert into public.quizzes (title, description, category, duration_seconds)
    values ('Magistr Məntiq — Giriş Səviyyəsi', 'Magistr qəbul imtahanı üçün məntiq və təhlil sualları.', 'Magistr', 300)
    returning id
)
insert into public.quiz_questions (quiz_id, position, question_text, options, correct_index, explanation)
select q.id, t.pos, t.qtext, t.opts::jsonb, t.correct, t.expl
from q,
(values
    (1, 'Sıranı davam etdirin: 2, 6, 12, 20, ?',        '["28","30","32","36"]', 1, 'Fərqlər 4, 6, 8, 10 → 20 + 10 = 30.'),
    (2, 'Bütün A-lar B-dir. Bütün B-lər C-dir. Nəticə hansıdır?', '["Bütün C-lər A-dır","Bütün A-lar C-dir","Heç bir A C deyil","Bəzi C-lər A deyil"]', 1, 'Tranzitivlik: A ⊂ B ⊂ C.'),
    (3, '5 işçi bir işi 12 günə görür. 10 işçi neçə günə görər?', '["4","6","8","24"]', 1, 'İşçi sayı 2 dəfə artdıqda müddət 2 dəfə azalır: 6 gün.'),
    (4, 'Bir saatın dəqiqə əqrəbi 3-də, saat əqrəbi 12-dədir. Saat neçədir?', '["12:15","3:00","12:03","3:12"]', 0, 'Dəqiqə əqrəbi 3-də = 15 dəqiqə, saat əqrəbi 12-də.'),
    (5, '"Kitab : oxumaq" münasibəti hansına bənzəyir?', '["Qələm : yazmaq","Su : yemək","Mətbəx : yatmaq","Pəncərə : eşitmək"]', 0, 'Əşya və onun əsas istifadə məqsədi.')
) as t(pos, qtext, opts, correct, expl);

-- ---------------------------------------------------------------------
-- 15. ADMİN TƏYİN ETMƏK (qeydiyyatdan sonra e-poçtunuzu yazıb ayrıca işlədin)
-- ---------------------------------------------------------------------
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'SİZİN_EPOÇTUNUZ@gmail.com');
