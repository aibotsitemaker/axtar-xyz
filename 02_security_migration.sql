-- =====================================================================
-- 02 — TƏHLÜKƏSİZLİK MİGRASİYASI (silmə yoxdur, mövcud məlumata toxunmur)
-- Yalnız YENİ yazılan sətirlərdə fayl ünvanlarının https:// olmasını tələb edir.
-- Supabase SQL Editor-da işlətməzdən əvvəl Database > Backups-dan ehtiyat nüsxə yoxlayın.
-- Geri qaytarmaq üçün faylın sonundakı ROLLBACK bölməsinə baxın.
-- =====================================================================

create or replace function public.all_https(urls text[])
returns boolean
language sql
immutable
as $$
    select coalesce(bool_and(u ~* '^https://'), true) from unnest(urls) as u;
$$;

-- NOT VALID: köhnə sətirləri yoxlamır, yalnız yeni INSERT/UPDATE-ləri yoxlayır.
alter table public.pdfs
    add constraint pdfs_file_url_https check (file_url ~* '^https://') not valid;

alter table public.books
    add constraint books_image_urls_https check (public.all_https(image_urls)) not valid;

-- ROLLBACK (lazım olarsa):
-- alter table public.pdfs  drop constraint if exists pdfs_file_url_https;
-- alter table public.books drop constraint if exists books_image_urls_https;
-- drop function if exists public.all_https(text[]);
