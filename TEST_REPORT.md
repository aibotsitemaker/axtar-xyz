# TEST_REPORT — v5.0 (forum, Super Admin, hesab tipi)

Bu hesabat **real icra olunanları** və **icra oluna bilməyənləri** ayrı göstərir.

## 1. Real PostgreSQL 16 üzərində icra olundu (`tests/pg`, 365 yoxlama, 0 uğursuz)
Supabase `auth` sxemi minimal təqlid olunub (`tests/pg/00_supabase_stub.sql`); RLS, rollar (`anon`/`authenticated`), `auth.uid()` real Postgres mexanizmləridir. Bu real Supabase deyil, lakin SQL/RLS məntiqini sübut edir.
- **Forum (əsas test faylı: 329 yoxlama):** qeydiyyatlı istifadəçi mövzu yaradır; ikinci istifadəçi görür və cavab yazır; başqasının mövzu/cavabını dəyişə bilmir; müəllif redaktə/silir (yumşaq silmə); admin istənilən mövzu/cavabı idarə edir; qonaq yaza bilmir; mövzu/cavab/şikayət **rate limit** işləyir; təkrar məzmun, HTML/skript, çox keçid, spam rədd edilir; paralel təkrar klik.
- **RLS:** bütün `public` cədvəllərində RLS aktiv; `anon` yazma icazəsi yoxdur; forum/admin cədvəllərinə birbaşa yazma yoxdur; daxili funksiyalar bağlıdır; bütün `SECURITY DEFINER` funksiyalarında `search_path` var; qonaq `role`/e-poçt sütunlarını oxuya bilmir.
- **Admin:** adi istifadəçi admin RPC-lərini çağıra bilmir; özünü admin edə bilmir (`role`, `admin_users`, `set_my_account_type('admin')` bloklanır); bootstrap yalnız təsdiqlənmiş hesab üçün; yeni hesab eyni e-poçtla admin olmur; admin istifadəçi bloklayır/blokdan çıxarır/tip dəyişir/silir; sonuncu Super Admin qorunur; elan, PDF, sınaq idarəsi; audit hər kritik əməliyyatı yazır, dəyişdirilə/silinə bilmir, sirləri təmizləyir.
- **Qeydiyyat:** tip seçilmədən yaradılma rədd edilir; `teacher`/`student`/`university_student` düzgün saxlanır; `admin` və naməlum dəyər rədd edilir; profil üçün tip birbaşa dəyişdirilə bilmir.
- **Köhnə baza (`test_legacy.mjs`, 36 yoxlama):** mövcud istifadəçilər/elan/PDF miqrasiyadan sonra salamat; köhnə admin işləyir; 06/07 **iki dəfə** icra olunur; 08 hər halda düzgün; 98 geri qaytarma və yenidən tətbiq işləyir.

İcra: `PGHOST=... PGPORT=... PGUSER=postgres tests/pg/run_all.sh`.

## 2. Kod səviyyəsində yoxlandı (stub mühitində)
- **esbuild ilə hər `app/`, `components/`, `lib/` faylının bundle yoxlaması:** sintaksis, import yolları və adlandırılmış export-lar. Bu yoxlama `ConfirmDialog`, `ListSkeleton`, `LoadMore` komponentlərinin çatışmadığını tapdı; əlavə edildi. İndi 0 xəta.
- **ESLint (yalnız `no-undef` və əsas düzgünlük qaydaları, müstəqil konfiq):** 0 real xəta (yalnız konfiqin özünə aid 2 xəbərdarlıq).
- **İkon adları:** bütün istifadə olunan ikonlar `Icons.js`-də var (17 çatışan ikon əlavə edildi).
- **SSR smoke-render (react-dom/server, Next və Supabase stub):** 21 səhifənin hamısı ilk renderdə xətasız.
- **Real Chromium-da qeydiyyat testi (Playwright, stub Supabase):** 3 kart var; tip seçilmədən göndərmə `signUp`-ı çağırmır; klaviatura (Space) ilə seçim işləyir; `signUp` metadata-sı `{full_name, account_type:"student"}`; konsol xətası yoxdur.

## 3. İCRA OLUNA BİLMƏDİ (bu mühitdə)
Bu mühitdə npm reyestrinə şəbəkə girişi bloklu idi, ona görə Next.js/ESLint/Tailwind quraşdırıla bilmədi. **Aşağıdakıları öz mühitinizdə mütləq icra edin:**
- `npm ci && npm run lint && npm run build` — **production build keçdi deyə iddia etmirəm**. (Layihədə TypeScript yoxdur, `typecheck` skripti yoxdur.)
- Real Supabase ilə inteqrasiya (Auth, e-poçt təsdiqi, şifrə bərpası, Realtime, Storage).
- Tailwind CSS ilə mobil/desktop **vizual** yoxlama və ekran görüntüləri (forum/admin üçün yeni ekran görüntüsü çəkilmədi).
- Forum/admin səhifələrinin brauzerdə tam axını (yalnız SSR ilk render və qeydiyyat axını yoxlandı).
- Brauzer konsolu / server log xətaları Next.js işləyərkən.
- e-poçt bildirişləri (mövcud deyil).

## 4. Yerləşdirmədən sonra əl ilə yoxlama siyahısı
1. Test layihədə 06 → 07 icra; mövcud hesabla giriş, elan/PDF/sınaq/çat işləyir.
2. Yeni qeydiyyat: tip seçilmədən göndərmək olmur; 3 tipin hər biri profildə və forumda rozetlə görünür; e-poçt təsdiqi və şifrə bərpası işləyir.
3. Köhnə hesab: kabinet → "Hesab tipini seçin" (bir dəfə).
4. Forum: mövzu yarat → ikinci hesabdan cavab → bildiriş zəngi → şikayət → admin gizlət/sil/bərpa/sabitlə/bağla.
5. `ADMIN_SETUP.md` üzrə Super Admin; adi hesabla `/admin` "İcazə yoxdur" göstərməlidir.
6. Brauzer konsolunda (F12) qırmızı xəta yoxdur.

## v6 əlavə audit qeydləri
Yeni /feed səhifəsi və 09 SQL migrasiyası əlavə edildi. Quiz check_answer RPC-si cari cavab yoxlamasında düzgün cavab indeksini test bitməmiş qaytarır; bu təhlükəsizlik problemi həll edilməyib. Migration real Supabase-ə tətbiq edilməyib. Lint/build hələ icra edilməyib.

Əlavə: 
pm ci asılılıqları quraşdıra bilməyib və dayandırılıb. 
pm run lint / 
pm run build executable eslint / next tapılmadığına görə baş tutmadı. Canlı Supabase/RLS/storage və browser/device sınağı bu v6 işi üçün aparılmayıb. Guest view UUID-ni hazırda client ötürür; anonim sessiya imzası production-da əlavə olunmalıdır. v6 UI çatışmazlıqlarına verification workflow, review UI, qlobal axtarış, bildiriş inteqrasiyası, bütün məzmun bookmark-ı və admin analytics daxildir.
