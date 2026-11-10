# TəhsilHub v5.0 — Forum, Super Admin və hesab tipi: yerləşdirmə təlimatı

> Bu bölmə v5.0 üçündür (forum, admin paneli, qeydiyyatda müəllim/şagird/tələbə). Aşağıdakı v4.0 təlimatı (1–9) əsas quraşdırma üçün qüvvədə qalır.
> **Heç bir SQL avtomatik işləmir və mən real production bazasına toxunmadım.** Hər şeyi əvvəlcə test layihəsində yoxlayın.

## A. Yeni mühit dəyişəni yoxdur
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (+ istəyə görə `NEXT_PUBLIC_ADSENSE_*`). **Service-role açarı sayta lazım deyil və heç bir yerə yazılmamalıdır.**

## B. SQL ardıcıllığı (Supabase → SQL Editor)
| Sıra | Fayl | Nə edir |
|---|---|---|
| 1–5 | `01` → `02` → `04` → `05` → (`03` yalnız yeni sayt işlədikdən sonra) | Mövcud (v4.0) quraşdırma. Artıq icra olunubsa təkrar lazım deyil |
| 6 | `06_roles_and_forum.sql` | Hesab tipi, forum cədvəlləri/RPC/RLS, bildirişlər, blok mexanizmi, realtime |
| 7 | `07_admin_panel_and_audit.sql` | Admin cədvəli (`admin_users`), admin RPC-ləri, audit jurnalı, `my_context()` |
| 8 | `08_bootstrap_super_admin.sql` | **Əl ilə, bir dəfə**: `elielizade17@gmail.com` üçün Super Admin. Ətraflı: `ADMIN_SETUP.md` |
| — | `98_rollback_06_07.sql` | 06+07-ni geri qaytarır (forum məlumatı silinir; əvvəlcə ehtiyat nüsxə) |

06 və 07 təkrar icra oluna bilər, mövcud elan/PDF/mesaj/sınaq/profil məlumatını silmir. Mövcud istifadəçilərin `account_type` dəyəri `NULL` qalır (uydurma tip yazılmır); onlar kabinetdə tipi bir dəfə özləri seçir.

**Vacib (qeydiyyat):** 06-dan sonra `auth.users`-ə hesab yalnız `account_type` (`teacher`/`student`/`university_student`) ilə yaradıla bilər. Sayt qeydiyyat formu bunu göndərir. Supabase Dashboard → Authentication → "Add user" ilə tipsiz hesab yaratmaq **xəta verəcək** — hesabları sayt üzərindən açın.

## C. Lokal işə salma
1. `cp .env.example .env.local` və öz test Supabase layihənizin dəyərlərini yazın.
2. Test layihədə SQL fayllarını B cədvəlindəki sıra ilə icra edin.
3. `npm ci` → `npm run lint` → `npm run build` → `npm run dev` (Node ≥ 20.9).
4. Lokal SQL testləri (öz PostgreSQL 16-nız varsa; Supabase tələb olunmur): `PGHOST=... PGPORT=... PGUSER=postgres tests/pg/run_all.sh`.

## D. Production yerləşdirmə
1. Supabase-də ehtiyat nüsxə alın (Database → Backups / CSV export).
2. Test layihədə 06 → 07 → (08) icra edin və `FORUM_GUIDE.md` / `TEST_REPORT.md` yoxlama siyahısını keçin.
3. Production-da 06 → 07 icra edin (səhv olarsa tranzaksiya geri qayıdır).
4. Kodu push edin (Vercel build). `node_modules`, `.next`, `.env*` repoda olmamalıdır.
5. Supabase → Authentication → URL Configuration: Site URL `https://www.axtar.xyz`; Redirect URLs: `https://www.axtar.xyz/**`. Providers → Email: **Confirm email aktiv** (Super Admin təsdiqlənmiş e-poçt tələb edir).
6. `ADMIN_SETUP.md` üzrə Super Admin təyin edin.
7. Supabase → Database → Replication: `forum_replies` cədvəli `supabase_realtime` publication-dadır (06 bunu özü edir; Realtime söndürülübsə cavablar yalnız səhifə yenilənəndə görünür).

## E. Geri qayıtmaq
Sayt: Vercel → əvvəlki yerləşdirmə → Promote. Baza: `98_rollback_06_07.sql`. Bu, forum/admin məlumatını silir; elan, PDF, mesaj, sınaq, profillər qalır.

---

# Təhlükəsiz yeniləmə planı (TəhsilHub v4.0 — mavi-ağ dizayn)

Bu sənəd addım-addımdır. Heç bir addım avtomatik icra olunmur; hər birini siz özünüz edirsiniz.
Production sayta və real verilənlər bazasına toxunmazdan əvvəl 1–3-cü addımları edin.

## Əvvəlcə bunu oxuyun: v4.0 yalnız dizayn yeniləməsidir
- Verilənlər bazasında **heç nə dəyişmir**. Əgər `01`, `02`, `04`, `05` (və lazım olsa `03`) SQL faylları artıq işlədilibsə, **yeni SQL işlətmək lazım deyil**: yalnız kodu yeniləyin (4-cü bölmə).
- Əvvəlki dizayna qayıtmaq üçün: Vercel → Deployments → əvvəlki yerləşdirmə → Promote to Production (və ya `tehsilhub-nextjs-v3.2.zip`).
- Dizayn və testlər haqqında: `DESIGN_UPDATE_REPORT.md`, `TEST_REPORT.md`. Ekran görüntüləri: `screenshots/`.
- Yeni mühit dəyişəni yoxdur. `.env.example` yalnız dəyişən adlarını saxlayır.

## 0. Nə dəyişib (təhlükəsizlik yeniləməsi, v3)
- Next.js 16 və React 19 (təhlükəsizlik yamaqları), `sitemap.xml`, `robots.txt`, 404/500 səhifələri, SEO metadata.
- Sınaq cavabları artıq brauzerə göndərilmir, yoxlama serverdə aparılır. Nəticə serverdə hesablanır.
- Sürət limitləri: çat, yeni söhbət, elan, PDF, sınaq. Baxış/yükləmə sayğacları saxtalaşdırıla bilmir.
- Şifrə bərpası, hesabı silmə, `https` olmayan fayl ünvanlarının bloklanması, təhlükəsizlik başlıqları.
- AdSense: real ID əlavə olunana qədər heç nə göstərilmir; ID əlavə olunanda `ads.txt`, meta tag və reklam blokları avtomatik işə düşür.
- `01_supabase_schema.sql` faylındakı iki xəta düzəldilib: `replicate identity` → `replica identity` və admin rolunun SQL ilə təyin edilməsini bloklayan trigger.

## 1. Ehtiyat nüsxələr (silinməz addım)
1. Supabase → Database → Backups: son ehtiyat nüsxənin tarixini yoxlayın (pulsuz planda yalnız gündəlik avtomatik nüsxə var, əl ilə nüsxə yoxdur). Vacibdirsə: Table Editor → hər cədvəl → Export CSV (`books`, `pdfs`, `profiles`, `favorites`, `quiz_attempts`, `conversations`, `chat_messages`).
2. Vercel → Deployments: cari production yerləşdirməsini qeyd edin. Geri qayıtmaq üçün lazım olacaq. Ona toxunmayın.
3. GitHub: cari repo vəziyyətini branch kimi saxlayın (məs. `backup-v2`).

## 2. Əvvəlcə test mühitində yoxlayın (tövsiyə olunur)
Real məlumata toxunmadan sınamaq üçün ikinci pulsuz Supabase layihəsi yaradın (məs. `tehsilhub-test`):
1. SQL Editor-da ardıcıl işlədin: `01_supabase_schema.sql` → `02_hardening_phase1.sql` → `04_grants.sql` → `05_backfill_profiles.sql` → `03_hardening_phase2.sql`.
2. Vercel-də repo-dan yeni branch (`v3`) üçün Preview yerləşdirmə yaradın və Preview mühit dəyişənlərinə test layihənin URL və anon key-ni yazın.
3. Preview linkində yoxlama siyahısı (aşağıda, 6-cı bölmə) edin. Yalnız bundan sonra production-a keçin.

## 3. Production verilənlər bazası (real Supabase)
1. `00_preflight_readonly.sql` işlədin (yalnız oxuyur). Nəticələr:
   - Hamı cədvəl `true` olmalıdır.
   - 3-cü cədvəl (https olmayan ünvanlar) boş olmalıdır. Sətir varsa mənə göndərin, 02-ni işlətməyin.
2. `02_hardening_phase1.sql` işlədin. Bu mərhələ köhnə (v2) saytı pozmur, məlumat silmir və dəyişmir. Xəta olarsa avtomatik geri qayıdır.
3. `04_grants.sql` işlədin. **Yeni Supabase layihələrində (30 may 2026-dan sonra yaradılmış) bu mütləqdir:** Supabase cədvəllərə avtomatik icazə vermir və bu fayl olmadan sayt "permission denied for table ..." xətası verir (PDF yükləmə, elan, favori və s. işləmir). Yalnız icazə əlavə edir, məlumata toxunmur, təkrar işlədilə bilər.
4. `05_backfill_profiles.sql` işlədin: trigger qurulmamışdan əvvəl qeydiyyatdan keçmiş istifadəçilərə profil yaradır. Bu olmadan onlar elan, PDF və ya favori əlavə edəndə `...violates foreign key constraint` xətası alırlar. Sonda nəticə `0` olmalıdır.
5. **Hələ 03-ü işlətməyin.**

## 4. Production saytı yeniləmək
1. Zip-in məzmununu repoya köçürün (`node_modules`, `.next`, `.env*` repoda olmamalıdır) və push edin.
2. Vercel → Settings → Environment Variables: `NEXT_PUBLIC_SITE_URL=https://www.axtar.xyz`, mövcud Supabase dəyişənləri dəyişməz qalır. Node versiyası 20.x və ya 22.x olmalıdır (Settings → General).
3. Vercel yeni yerləşdirməni özü quracaq. Hazır olduqda aşağıdakı 6-cı bölmə üzrə yoxlayın.
4. Supabase → Authentication:
   - URL Configuration: Site URL = `https://www.axtar.xyz`; Redirect URLs-ə `https://www.axtar.xyz/auth/reset` əlavə edin.
   - Providers → Email: minimum parol uzunluğunu 8 edin.
   - Rate Limits bölməsində standart limitləri saxlayın (və ya sərtləşdirin). İstəyə görə Bot protection (CAPTCHA) aktiv edin.

## 5. Kilidləmə (yalnız yeni sayt işlədiyi təsdiq olunandan sonra)
`03_hardening_phase2.sql` işlədin. Bundan sonra sınaq cavabları və admin rolu brauzerdən oxunmur, saxta nəticə yazmaq bloklanır. Köhnə v2 sayt sınaq və kabinet səhifələrində işləməyəcək, ona görə yeni sayt mütləq əvvəl yerləşdirilməlidir.

## 6. Yoxlama siyahısı (telefonda və kompüterdə)
1. `/` açılır; `/robots.txt`, `/sitemap.xml` açılır; `/olmayan-sehife` 404 səhifəsini göstərir.
2. Qeydiyyat → e-poçt təsdiqi → giriş → kabinet.
3. "Şifrəni unutdum" → e-poçt → yeni parol.
4. Kitab elanı + şəkil yüklə; elan siyahıda görünür; kabinetdə "Satıldı" və "Sil" işləyir.
5. PDF yüklə; "Bax" və "Yüklə" işləyir; sayğac artır.
6. İkinci hesabdan elana "Çat" → mesajlaşma ikinci pəncərədə anında görünür.
7. Sınaq: cavab seç → dərhal düzgün/səhv görünür → nəticə paneli → kabinetdə saxlanıb.
8. Favori əlavə et və kabinetdə gör.
9. Kabinet → Profil → "Hesabı sil" (yalnız test hesabında!).
10. Brauzer konsolunda (F12 → Console) qırmızı xəta olmamalıdır. `Content-Security-Policy-Report-Only` xəbərdarlıqları reklam əlavə olunana qədər normaldır.

## 7. Admin təyin etmək
v5.0-dan etibarən admin hüququ `public.admin_users` cədvəlindədir (Auth ID-yə bağlı). Super Admin üçün `ADMIN_SETUP.md`-ni izləyin; sonrakı adminləri Super Admin `/admin/admins` səhifəsindən verir. Köhnə üsul (`profiles.role='admin'`) geriyə uyğunluq üçün işləyir, lakin tövsiyə olunmur.

## 8. Geri qayıtmaq
- Sayt: Vercel → Deployments → əvvəlki yerləşdirmə → Promote to Production.
- Verilənlər bazası: `99_rollback.sql` işlədin (04-ün icazələri qalır, zərərsizdir). Elan, PDF, mesaj, nəticə kimi istifadəçi məlumatına toxunmur. Yalnız yeni əlavə olunan köməkçi cədvəl/sütun silinir.
- Silinmiş istifadəçi hesabları geri qaytarılmır (yalnız Supabase ehtiyat nüsxəsindən).

## 9. AdSense (real məlumatlar olanda)
1. AdSense hesabında saytı əlavə edin; publisher ID (`ca-pub-...`) və reklam bloku ID-sini (rəqəm) götürün.
2. Vercel mühit dəyişənləri: `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT`. Yenidən yerləşdirin.
3. `https://www.axtar.xyz/ads.txt` avtomatik yaranır, yoxlayın.
4. Avropa İqtisadi Zonası ziyarətçiləri üçün AdSense → Privacy & messaging bölməsində razılıq (cookie) mesajını aktiv edin.
5. Hər yerləşdirmə üçün ayrıca blok istəsəniz: `<AdSlot slot="1234567890" />`.

## v6 əlavə miqrasiyası
Hazırkı bazada 06–08 artıq tətbiq edilibsə, yalnız 09_social_trust_views.sql faylını icra edin. Ətraflı: DATABASE_MIGRATIONS.md.
