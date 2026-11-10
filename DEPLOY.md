# Təhlükəsiz yeniləmə planı (TəhsilHub v4.2 — forum və admin)

Bu sənəd addım-addımdır. Heç bir addım avtomatik icra olunmur; hər birini siz özünüz edirsiniz.
Production sayta və real verilənlər bazasına toxunmazdan əvvəl 1–3-cü addımları edin.

## Forum / istifadəçi tipləri / admin yeniləməsi
- Bu yeniləmə `06_forum_roles_admin.sql` miqrasiyasını əlavə edir. Production bazasında miqrasiya tətbiq edilmədən forum və admin API işləməyəcək.
- Test bazasında ardıcıllıq: `01` → `02` → `04` → `05` → `06` → tətbiqi yoxlayın → `03`. Production-da əvvəl kodu yerləşdirib yoxlayın, sonra `06` miqrasiyasını tətbiq edin; `03` işlədilməyibsə, sonda tətbiq edin.
- Əvvəl ehtiyat nüsxə alın və SQL-i test mühitində yoxlayın. SQL production-da avtomatik icra edilmir.
- Əvvəlki dizayna qayıtmaq üçün: Vercel → Deployments → əvvəlki yerləşdirmə → Promote to Production (və ya `tehsilhub-nextjs-v3.2.zip`).
- Dizayn və testlər haqqında: `DESIGN_UPDATE_REPORT.md`, `TEST_REPORT.md`. Ekran görüntüləri: `screenshots/`.
- Yeni server mühit dəyişəni `SUPABASE_SERVICE_ROLE_KEY`-dir; admin istifadəçi API-si üçün Vercel-də server-only kimi təyin edin. Dəyişənlərin tam siyahısı `.env.example` faylındadır.
- `/admin` girişini server layout-u da qoruyur: girişdən sonra server yalnız `platform_admins` reyestrindəki istifadəçiyə qısaömürlü `HttpOnly` cookie verir. `SUPABASE_SERVICE_ROLE_KEY` verilməsə, admin səhifəsi/API aktiv olmayacaq.

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
1. SQL Editor-da ardıcıl işlədin: `01_supabase_schema.sql` → `02_hardening_phase1.sql` → `04_grants.sql` → `05_backfill_profiles.sql` → `06_forum_roles_admin.sql`.
2. Vercel-də repo-dan yeni branch (`v3`) üçün Preview yerləşdirmə yaradın və Preview mühit dəyişənlərinə test layihənin URL və anon key-ni yazın.
3. Preview linkində yoxlama siyahısı (aşağıda, 6-cı bölmə) edin. Yalnız bundan sonra production-a keçin.

## 3. Production verilənlər bazası (real Supabase)
1. `00_preflight_readonly.sql` işlədin (yalnız oxuyur). Nəticələr:
   - Hamı cədvəl `true` olmalıdır.
   - 3-cü cədvəl (https olmayan ünvanlar) boş olmalıdır. Sətir varsa mənə göndərin, 02-ni işlətməyin.
2. `02_hardening_phase1.sql` işlədin. Bu mərhələ köhnə (v2) saytı pozmur, məlumat silmir və dəyişmir. Xəta olarsa avtomatik geri qayıdır.
3. `04_grants.sql` işlədin. **Yeni Supabase layihələrində (30 may 2026-dan sonra yaradılmış) bu mütləqdir:** Supabase cədvəllərə avtomatik icazə vermir və bu fayl olmadan sayt "permission denied for table ..." xətası verir (PDF yükləmə, elan, favori və s. işləmir). Yalnız icazə əlavə edir, məlumata toxunmur, təkrar işlədilə bilər.
4. `05_backfill_profiles.sql` işlədin: trigger qurulmamışdan əvvəl qeydiyyatdan keçmiş istifadəçilərə profil yaradır. Bu olmadan onlar elan, PDF və ya favori əlavə edəndə `...violates foreign key constraint` xətası alırlar. Sonda nəticə `0` olmalıdır.
5. `06_forum_roles_admin.sql` işlədin. Forum və istifadəçi tipi strukturları əlavə edilir; mövcud production məlumatı silinmir.
6. Yeni versiyanı yerləşdirib yoxladıqdan sonra `03_hardening_phase2.sql` işlədin. `03`-ü `06`-dan sonra işlədin ki, `user_type` profilinin oxunma icazəsi qalsın.

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
Əvvəlcə `elielizade17@gmail.com` ilə adi qeydiyyat yaradıb e-poçtu təsdiqləyin. Sonra [ADMIN_SETUP.md](ADMIN_SETUP.md) sənədindəki SQL ilə həmin hesabı `platform_admins` cədvəlinə əlavə edin. `profiles.role='admin'` işlətməyin. Vercel-də server tərəfli `SUPABASE_SERVICE_ROLE_KEY` dəyişənini qurun; adını `NEXT_PUBLIC_` ilə başlamayın.

`06_forum_roles_admin.sql` miqrasiyasının forum məlumatını silən avtomatik rollback-i yoxdur. `99_rollback.sql` bu miqrasiya üçün rollback deyil. Əvvəlki versiyaya qayıtmaq lazım olsa, əvvəlki deploy-u bərpa edin; forum cədvəllərini məlumatları yoxlamadan silməyin.

## 8. Geri qayıtmaq
- Sayt: Vercel → Deployments → əvvəlki yerləşdirmə → Promote to Production.
- Verilənlər bazası: `99_rollback.sql` yalnız əvvəlki v3 mərhələlərinin rollback faylıdır; onu `06_forum_roles_admin.sql` üçün işlətməyin. Yeni forum cədvəlləri və istifadəçi yazıları saxlanılır. 06-nı geri qaytarmaq üçün ayrıca, məlumatı yoxlayan migration tələb olunur.
- Silinmiş istifadəçi hesabları geri qaytarılmır (yalnız Supabase ehtiyat nüsxəsindən).

## 9. AdSense (real məlumatlar olanda)
1. AdSense hesabında saytı əlavə edin; publisher ID (`ca-pub-...`) və reklam bloku ID-sini (rəqəm) götürün.
2. Vercel mühit dəyişənləri: `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT`. Yenidən yerləşdirin.
3. `https://www.axtar.xyz/ads.txt` avtomatik yaranır, yoxlayın.
4. Avropa İqtisadi Zonası ziyarətçiləri üçün AdSense → Privacy & messaging bölməsində razılıq (cookie) mesajını aktiv edin.
5. Hər yerləşdirmə üçün ayrıca blok istəsəniz: `<AdSlot slot="1234567890" />`.
