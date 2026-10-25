-- =====================================================================
-- 04 — AÇIQ İCAZƏLƏR (GRANT)
-- Supabase 30 may 2026-dan yeni layihələrdə cədvəllərə və funksiyalara avtomatik icazə vermir.
-- Bu olmadan sayt "permission denied for table ..." xətası verir.
-- Yalnız icazə ƏLAVƏ EDİR (heç nə silmir, məlumata toxunmur). Təkrar işlədilə bilər.
-- Sıra: 01 → 02 → 04 (→ sonra 03). 02-dən əvvəl işlədilsə də zərər yoxdur.
-- RLS qaydaları yenə də qüvvədədir: icazə yalnız "qapını açır", kimin nəyi görəcəyini RLS müəyyən edir.
-- =====================================================================
begin;

grant usage on schema public to anon, authenticated;

-- Hamıya (daxil olmayanlar da) oxumaq
grant select on public.profiles             to anon, authenticated;
grant select on public.books                to anon, authenticated;
grant select on public.pdfs                 to anon, authenticated;
grant select on public.quizzes              to anon, authenticated;
grant select on public.quiz_questions       to anon, authenticated;
grant select on public.privacy_policy_terms to anon, authenticated;

-- Daxil olmuş istifadəçilər
grant insert, update, delete on public.books to authenticated;
grant insert, update, delete on public.pdfs  to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select on public.quiz_attempts to authenticated;
grant select on public.conversations to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant update (is_read) on public.chat_messages to authenticated;

-- Profil: yalnız bu sütunlar dəyişdirilə bilər (rol sütunu daxil deyil)
grant update (full_name, username, avatar_url, city, bio) on public.profiles to authenticated;

-- Funksiyalar (RPC və RLS qaydalarında istifadə olunanlar). Mövcud olmayanlar atlanır.
do $$
declare
    r record;
begin
    for r in
        select * from (values
            ('public.is_admin()',                             'anon, authenticated'),
            ('public.get_my_role()',                          'anon, authenticated'),
            ('public.is_conversation_member(uuid)',           'anon, authenticated'),
            ('public.all_https(text[])',                      'anon, authenticated'),
            ('public.increment_book_view(uuid)',              'anon, authenticated'),
            ('public.increment_pdf_view(uuid)',               'anon, authenticated'),
            ('public.increment_pdf_download(uuid)',           'anon, authenticated'),
            ('public.check_answer(uuid,integer)',             'anon, authenticated'),
            ('public.get_or_create_conversation(uuid,uuid)',  'authenticated'),
            ('public.unread_message_count()',                 'authenticated'),
            ('public.submit_quiz_attempt(uuid,jsonb,integer)', 'authenticated'),
            ('public.delete_my_account()',                    'authenticated')
        ) as t(sig, roles)
    loop
        if to_regprocedure(r.sig) is not null then
            execute format('grant execute on function %s to %s', r.sig, r.roles);
        end if;
    end loop;
end
$$;

commit;
