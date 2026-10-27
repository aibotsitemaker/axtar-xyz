# TəhsilHub

Next.js 16 + Tailwind CSS 3 + Supabase. Mavi-ağ dizayn sistemi (tokenlər: `app/globals.css`, `tailwind.config.js`).

- Yerləşdirmə və yeniləmə təlimatı: **DEPLOY.md**
- Verilənlər bazası: `01_supabase_schema.sql` (yeni quraşdırma), `00_preflight_readonly.sql`, `02_hardening_phase1.sql`, `04_grants.sql`, `03_hardening_phase2.sql`, `99_rollback.sql` `05_backfill_profiles.sql` (sıra: 01 → 02 → 04 → 05 → 03)
- Yerli işə salma: `.env.example` faylını `.env.local` kimi kopyalayın → `npm install` → `npm run dev` (Node 20.9+)
- SQL testləri: `tests/db`
- Lint: `npm run lint` · Brauzer testləri: `tests/browser` · Ekran görüntüləri: `screenshots/`
- Hesabatlar: `DESIGN_UPDATE_REPORT.md`, `TEST_REPORT.md`
