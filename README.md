# TəhsilHub

Platforma buraxılışı: **v6.7**. Sosial Feed-də mətn/şəkil/sual/sorğu, müəllim izləmə və təhsil layihələri bölməsi əlavə olunub. Mövcud Supabase bazasını yeniləmək üçün əvvəlki miqrasiyaları qoruyaraq `DATABASE_MIGRATIONS.md` üzrə 14-cü SQL faylını tətbiq edin.

Next.js 16 + Tailwind CSS 3 + Supabase. Indigo-ağ dizayn sistemi (tokenlər: `app/globals.css`, `tailwind.config.js`).

- Yerləşdirmə: **DEPLOY.md** · Super Admin: **ADMIN_SETUP.md** · Forum: **FORUM_GUIDE.md** · Test nəticələri: **TEST_REPORT.md**
- SQL sırası: `01 → 02 → 04 → 05 → (03) → 06 → 07 → 08 (əl ilə)`; geri qaytarma: `98_rollback_06_07.sql`, `99_rollback.sql`
- Yerli işə salma: `.env.example` → `.env.local` → `npm ci` → `npm run dev` (Node 20.9+)
- Testlər: `tests/pg` (real PostgreSQL), `tests/db` (köhnə), `tests/browser`
- Lint: `npm run lint`


