# TəhsilHub

Platforma buraxılışı: **v6.4**. Bu versiyada sınaqlar üçün əlavə sual formatları və müəllim sınaqlarının idarəetmə səhifəsi var. Mövcud Supabase bazasını yeniləmək üçün [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md) üzrə additive 13-cü miqrasiyanı tətbiq edin.

Next.js 16 + Tailwind CSS 3 + Supabase. Mavi-ağ dizayn sistemi (tokenlər: `app/globals.css`, `tailwind.config.js`).

- Yerləşdirmə: **DEPLOY.md** · Super Admin: **ADMIN_SETUP.md** · Forum: **FORUM_GUIDE.md** · Test nəticələri: **TEST_REPORT.md**
- SQL sırası: `01 → 02 → 04 → 05 → (03) → 06 → 07 → 08 (əl ilə)`; geri qaytarma: `98_rollback_06_07.sql`, `99_rollback.sql`
- Yerli işə salma: `.env.example` → `.env.local` → `npm ci` → `npm run dev` (Node 20.9+)
- Testlər: `tests/pg` (real PostgreSQL), `tests/db` (köhnə), `tests/browser`
- Lint: `npm run lint`
