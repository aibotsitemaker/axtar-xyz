# SQL testləri (real Postgres mühərriki, PGlite)

Supabase-in `auth` və `storage` sxemi sadə şəkildə təqlid olunur. Testlər 01 → 02 → 03 → 99 ardıcıllığını,
RLS qaydalarını, sürət limitlərini, sınaq funksiyalarını və geri qaytarmanı yoxlayır. `test_newproject.mjs` əlavə olaraq
`06_forum_roles_admin.sql` miqrasiyasını, forum icazələrini, admin reyestrini, report/bildirişləri, limitləri və hesab silinəndə forum tarixçəsinin saxlanmasını yoxlayır.

    cd tests/db && npm install && npm test

Bu real Supabase layihəsini əvəz etmir: Realtime serveri, Storage API və Auth servisi təqlid olunmur.
