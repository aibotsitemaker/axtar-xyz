-- =====================================================================
-- 03 — TƏHLÜKƏSİZLİK, 2-Cİ MƏRHƏLƏ (KİLİDLƏMƏ)
-- DİQQƏT: Bu faylı YALNIZ yeni sayt (v3) Vercel-ə yerləşdirildikdən və yoxlandıqdan SONRA işlədin.
-- Köhnə sayt (v2) bu mərhələdən sonra sınaq və profil səhifələrində xəta verəcək.
-- 02 faylı işlədilməyibsə, bu fayl işləməməlidir.
-- Məlumat silinmir. Geri qaytarma: 99_rollback.sql
-- =====================================================================
begin;

-- Sınaq cavabları brauzerə göndərilməsin (correct_index və explanation gizlədilir)
revoke select on public.quiz_questions from anon, authenticated;
grant select (id, quiz_id, position, question_text, options, created_at)
    on public.quiz_questions to anon, authenticated;

-- Profil: rol sütunu gizlədilir (admin hesabları açıqlanmasın)
revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, username, avatar_url, city, bio, created_at)
    on public.profiles to anon, authenticated;

-- Nəticə və söhbət yalnız təhlükəsiz funksiyalarla yaradılır (saxta nəticə və spam söhbətlərin qarşısı)
drop policy if exists "quiz_attempts_insert_own" on public.quiz_attempts;
drop policy if exists "conversations_insert_member" on public.conversations;

-- Storage: bütün faylların siyahısını görmək qadağandır (birbaşa linklər işləməyə davam edir)
drop policy if exists "storage_public_read" on storage.objects;
drop policy if exists "storage_select_own_folder" on storage.objects;
create policy "storage_select_own_folder" on storage.objects
    for select to authenticated using (
        bucket_id in ('book-images', 'pdf-files', 'avatars')
        and (storage.foldername(name))[1] = auth.uid()::text
    );

commit;
