-- =====================================================================
-- 00 — ƏVVƏLCƏDƏN YOXLAMA (YALNIZ OXUYUR, HEÇ NƏYİ DƏYİŞMİR)
-- Supabase SQL Editor-da işlədin. Nəticələri 02 faylından əvvəl yoxlayın.
-- =====================================================================

-- 1) Gözlənilən cədvəllər mövcuddurmu? (hamısı "true" olmalıdır)
select t.name as cedvel, to_regclass('public.' || t.name) is not null as movcuddur
from (values ('profiles'), ('books'), ('pdfs'), ('favorites'), ('quizzes'), ('quiz_questions'),
             ('quiz_attempts'), ('conversations'), ('chat_messages'), ('privacy_policy_terms')) as t(name);

-- 2) 02 faylının əlavə edəcəyi obyektlər artıq varmı? (hamısı "false" olmalıdır; "true" olarsa 02 təkrar işləyə bilər, problem deyil)
select 'view_events cedveli' as obyekt, to_regclass('public.view_events') is not null as artiq_var
union all
select 'conversations.created_by', exists (select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'conversations' and column_name = 'created_by');

-- 3) https olmayan fayl ünvanları (0 sətir olmalıdır; sətir varsa onları ƏL İLƏ yoxlayın)
select 'pdfs' as cedvel, id, file_url as unvan from public.pdfs where file_url !~* '^https://'
union all
select 'books', id, u from public.books, unnest(image_urls) as u where u !~* '^https://';

-- 4) Mövcud məlumatın həcmi (məlumat ehtiyat nüsxəsi üçün istinad)
select 'profiles' as cedvel, count(*) as say from public.profiles
union all select 'books', count(*) from public.books
union all select 'pdfs', count(*) from public.pdfs
union all select 'favorites', count(*) from public.favorites
union all select 'quiz_attempts', count(*) from public.quiz_attempts
union all select 'conversations', count(*) from public.conversations
union all select 'chat_messages', count(*) from public.chat_messages;
