-- =====================================================================
-- 99 — GERİ QAYTARMA (02 və 03 mərhələlərini ləğv edir)
-- İstənilən mərhələdən sonra təhlükəsiz işlədilə bilər (təkrar işləyə bilər).
-- İstifadəçi məlumatlarına (elanlar, PDF-lər, mesajlar, sınaq nəticələri) toxunmur.
-- Yalnız 02-nin yaratdığı view_events cədvəli (baxış təkrarını izləyir) və
-- conversations.created_by sütunu silinir. Sayğac dəyərləri olduğu kimi qalır.
-- protect_profile_role düzəlişi (admin təyinatı) bilərəkdən geri qaytarılmır: köhnə versiya xətalı idi.
-- Hesab silinməsi (delete_my_account) geri qaytarıla bilməz; silinmiş hesab bərpa olunmur.
-- =====================================================================
begin;

-- 03-ün geri qaytarılması
revoke select (id, quiz_id, position, question_text, options, created_at)
    on public.quiz_questions from anon, authenticated;
grant select on public.quiz_questions to anon, authenticated;

revoke select (id, full_name, username, avatar_url, city, bio, created_at)
    on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;

drop policy if exists "quiz_attempts_insert_own" on public.quiz_attempts;
create policy "quiz_attempts_insert_own" on public.quiz_attempts
    for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "conversations_insert_member" on public.conversations;
create policy "conversations_insert_member" on public.conversations
    for insert to authenticated with check ((user_a = auth.uid() or user_b = auth.uid()) and user_a < user_b);

drop policy if exists "storage_select_own_folder" on storage.objects;
drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read" on storage.objects
    for select using (bucket_id in ('book-images', 'pdf-files', 'avatars'));

-- 02-nin geri qaytarılması
drop trigger if exists trg_books_protect_counters on public.books;
drop trigger if exists trg_pdfs_protect_counters on public.pdfs;
drop trigger if exists trg_chat_rate on public.chat_messages;
drop trigger if exists trg_books_rate on public.books;
drop trigger if exists trg_pdfs_rate on public.pdfs;

drop function if exists public.protect_book_counters();
drop function if exists public.protect_pdf_counters();
drop function if exists public.limit_chat_rate();
drop function if exists public.limit_book_inserts();
drop function if exists public.limit_pdf_inserts();
drop function if exists public.check_answer(uuid, integer);
drop function if exists public.submit_quiz_attempt(uuid, jsonb, integer);
drop function if exists public.delete_my_account();

create or replace function public.increment_book_view(p_book_id uuid)
returns void language sql security definer set search_path = public
as $$
    update public.books set view_count = view_count + 1 where id = p_book_id and status = 'active';
$$;

create or replace function public.increment_pdf_view(p_pdf_id uuid)
returns void language sql security definer set search_path = public
as $$
    update public.pdfs set view_count = view_count + 1 where id = p_pdf_id and status = 'active';
$$;

create or replace function public.increment_pdf_download(p_pdf_id uuid)
returns void language sql security definer set search_path = public
as $$
    update public.pdfs set download_count = download_count + 1 where id = p_pdf_id and status = 'active';
$$;

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

alter table public.pdfs  drop constraint if exists pdfs_file_url_https;
alter table public.books drop constraint if exists books_image_urls_https;
drop function if exists public.all_https(text[]);

drop index if exists public.idx_chat_messages_sender_time;
drop index if exists public.idx_conversations_creator_time;
drop index if exists public.idx_books_seller_time;
drop index if exists public.idx_pdfs_uploader_time;
drop index if exists public.idx_quiz_attempts_user_time;

drop table if exists public.view_events;
alter table public.conversations drop column if exists created_by;

commit;
