# TəhsilHub

Next.js 16 + Tailwind CSS 3 + Supabase.

- Yerləşdirmə və yeniləmə təlimatı: **DEPLOY.md**
- Verilənlər bazası: `01_supabase_schema.sql` (yeni quraşdırma), `00_preflight_readonly.sql`, `02_hardening_phase1.sql`, `03_hardening_phase2.sql`, `99_rollback.sql`
- Yerli işə salma: `.env.example` faylını `.env.local` kimi kopyalayın → `npm install` → `npm run dev` (Node 20.9+)
- SQL testləri: `tests/db`
