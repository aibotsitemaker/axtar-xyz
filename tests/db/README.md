# SQL testləri (real Postgres mühərriki, PGlite)

Supabase-in `auth` və `storage` sxemi sadə şəkildə təqlid olunur. Test 01 → 02 → 03 → 99 ardıcıllığını,
RLS qaydalarını, sürət limitlərini, sınaq funksiyalarını və geri qaytarmanı yoxlayır.

    cd tests/db && npm install && npm test

Bu real Supabase layihəsini əvəz etmir: Realtime serveri, Storage API və Auth servisi təqlid olunmur.
