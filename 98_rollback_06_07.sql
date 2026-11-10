-- =====================================================================
-- 98 — 06 və 07 MİQRASİYALARININ GERİ QAYTARILMASI
--
-- ⚠ DİQQƏT: Bu fayl forum məlumatlarını (mövzular, cavablar, şikayətlər, bildirişlər, kateqoriyalar),
--   admin qeydlərini, bloklama məlumatını və audit jurnalını SİLİR. Əvvəlcə Supabase-də ehtiyat nüsxə alın
--   (Table Editor → Export CSV və ya Database → Backups).
-- Silinmir:
--   * Mövcud məlumat: elanlar, PDF-lər, mesajlar, sınaq nəticələri, profillər.
--   * profiles.account_type sütunu və dəyərləri (məlumat itməsin deyə saxlanılır; lazım olsa əl ilə silin:
--       alter table public.profiles drop constraint if exists profiles_account_type_check;
--       alter table public.profiles drop column if exists account_type;)
-- Geri qaytarılan funksiyalar: is_admin(), handle_new_user() (05-dəki versiya), delete_my_account() (02-dəki versiya).
-- Təkrar işlədilə bilər. Super Admin qeydləri (admin_users) silindiyi üçün adminlər yalnız köhnə üsulla
-- (profiles.role='admin') işləyəcək.
-- =====================================================================
begin;

-- 1) Əlavə siyasətlər və triggerlər
drop policy if exists "books_insert_not_blocked" on public.books;
drop policy if exists "pdfs_insert_not_blocked" on public.pdfs;
drop policy if exists "chat_messages_insert_not_blocked" on public.chat_messages;
drop trigger if exists trg_books_audit on public.books;
drop trigger if exists trg_pdfs_audit on public.pdfs;
drop trigger if exists trg_protect_account_type on public.profiles;

-- 2) Realtime
do $$
begin
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'forum_replies') then
        alter publication supabase_realtime drop table public.forum_replies;
    end if;
end
$$;

-- 3) Cədvəllər (asılılıq sırası ilə)
drop table if exists public.notifications;
drop table if exists public.forum_reports;
drop table if exists public.forum_replies;
drop table if exists public.forum_topics;
drop table if exists public.forum_categories;
drop table if exists public.admin_user_notes;
drop table if exists public.user_moderation;
drop table if exists public.admin_audit_log;
drop table if exists public.admin_users;

-- 4) Funksiyalar
drop function if exists public.set_my_account_type(text);
drop function if exists public.protect_account_type();
drop function if exists public.is_user_blocked(uuid);
drop function if exists public.forum_clean_text(text, integer, integer, text);
drop function if exists public.forum_hash(text);
drop function if exists public.forum_excerpt(text);
drop function if exists public.forum_refresh_topic(uuid);
drop function if exists public.trg_forum_replies_refresh();
drop function if exists public.limit_forum_topics();
drop function if exists public.limit_forum_replies();
drop function if exists public.limit_forum_reports();
drop function if exists public.forum_assert_can_write(uuid);
drop function if exists public.forum_create_topic(uuid, text, text);
drop function if exists public.forum_update_topic(uuid, text, text, uuid);
drop function if exists public.forum_delete_topic(uuid);
drop function if exists public.forum_create_reply(uuid, text, uuid);
drop function if exists public.forum_update_reply(uuid, text);
drop function if exists public.forum_delete_reply(uuid);
drop function if exists public.forum_report(text, uuid, text, text);
drop function if exists public.unread_notification_count();
drop function if exists public.mark_all_notifications_read();
drop function if exists public.forum_slugify(text);
drop function if exists public.my_context();
drop function if exists public.admin_dashboard_stats();
drop function if exists public.admin_list_users(text, text, text, integer, integer);
drop function if exists public.admin_get_user(uuid);
drop function if exists public.admin_add_user_note(uuid, text);
drop function if exists public.admin_set_account_type(uuid, text);
drop function if exists public.admin_block_user(uuid, timestamptz, text);
drop function if exists public.admin_unblock_user(uuid);
drop function if exists public.admin_delete_user(uuid, text);
drop function if exists public.admin_grant_admin(uuid);
drop function if exists public.admin_revoke_admin(uuid);
drop function if exists public.admin_list_admins();
drop function if exists public.admin_forum_topic_action(uuid, text, text);
drop function if exists public.admin_forum_reply_action(uuid, text, text);
drop function if exists public.admin_resolve_report(uuid, text, text);
drop function if exists public.admin_upsert_category(uuid, text, text, integer);
drop function if exists public.admin_set_category_active(uuid, boolean);
drop function if exists public.admin_create_quiz(text, text, text, integer, jsonb);
drop function if exists public.admin_update_quiz(uuid, text, text, text, integer, boolean);
drop function if exists public.admin_delete_quiz(uuid);
drop function if exists public.audit_content_change();
drop function if exists public.audit_write(text, text, text, text, jsonb);
drop function if exists public.audit_scrub(jsonb);
drop function if exists public.audit_log_immutable();
drop function if exists public.guard_admin_users();
drop function if exists public.is_super_admin();
drop function if exists public.assert_admin();
drop function if exists public.assert_super_admin();

-- 5) Əvvəlki funksiya versiyalarının bərpası
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

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

commit;
