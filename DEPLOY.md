# Təhlükəsiz yeniləmə planı (TəhsilHub v3)

Bu sənəd addım-addımdır. Heç bir addım avtomatik icra olunmur; hər birini siz özünüz edirsiniz.
Production sayta və real verilənlər bazasına toxunmazdan əvvəl 1–3-cü addımları edin.

## 0. Nə dəyişib
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
1. SQL Editor-da ardıcıl işlədin: `01_supabase_schema.sql` → `02_hardening_phase1.sql` → `04_grants.sql` → `03_hardening_phase2.sql`.
2. Vercel-də repo-dan yeni branch (`v3`) üçün Preview yerləşdirmə yaradın və Preview mühit dəyişənlərinə test layihənin URL və anon key-ni yazın.
3. Preview linkində yoxlama siyahısı (aşağıda, 6-cı bölmə) edin. Yalnız bundan sonra production-a keçin.

## 3. Production verilənlər bazası (real Supabase)
1. `00_preflight_readonly.sql` işlədin (yalnız oxuyur). Nəticələr:
   - Hamı cədvəl `true` olmalıdır.
   - 3-cü cədvəl (https olmayan ünvanlar) boş olmalıdır. Sətir varsa mənə göndərin, 02-ni işlətməyin.
2. `02_hardening_phase1.sql` işlədin. Bu mərhələ köhnə (v2) saytı pozmur, məlumat silmir və dəyişmir. Xəta olarsa avtomatik geri qayıdır.
3. `04_grants.sql` işlədin. **Yeni Supabase layihələrində (30 may 2026-dan sonra yaradılmış) bu mütləqdir:** Supabase cədvəllərə avtomatik icazə vermir və bu fayl olmadan sayt "permission denied for table ..." xətası verir (PDF yükləmə, elan, favori və s. işləmir). Yalnız icazə əlavə edir, məlumata toxunmur, təkrar işlədilə bilər.
4. **Hələ 03-ü işlətməyin.**

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
Qeydiyyatdan sonra SQL Editor-da: `update public.profiles set role='admin' where id = (select id from auth.users where email='SİZİN_EPOÇT');`

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
