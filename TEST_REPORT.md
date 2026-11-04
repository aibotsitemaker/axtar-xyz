# TəhsilHub v4.0 — Test hesabatı

**Mühit:** sandbox (Linux), Node 22, Next.js 16.4.2, headless Chromium 153. **Real Supabase hesabı, e-poçt, real telefon və Safari/Firefox yoxdur.** Brauzer testləri üçün PostgREST/Auth/Storage cavablarını təqlid edən saxta server (`tests/browser/mock.mjs`) işlədilib. Ekran görüntüləri sistem ehtiyat şrifti (Inter əvəzinə) ilə çəkilib, real cihazlarda mətn bir qədər fərqli görünə bilər.

## 1. Faktiki icra olunan və keçən testlər
| Test | Nəticə |
|---|---|
| `npm run build` (production) | Uğurlu, 16 marşrut |
| `npm run lint` | 0 xəta, 11 xəbərdarlıq (`set-state-in-effect`: məlumat yükləmə effektləri; qəsdən `warn`) |
| `npm audit` (inkişaf asılılıqları daxil) | 0 zəiflik; kilid faylı uyğun (`npm ci --dry-run`) |
| SQL testləri, köhnə rejim (`tests/db/test.mjs`) | 75/75 |
| SQL testləri, yeni Supabase rejimi (`test_newproject.mjs`) | 42/42 |
| **Brauzer: layout** — 17 marşrut × 4 ölçü (360/390/768/1280) | 68/68: üfüqi scroll yoxdur, hər səhifədə bir `h1`, `alt`-sız şəkil yoxdur |
| **Brauzer: interaksiyalar** (mobil 390 / desktop 1280) | 19/19 (aşağıda) |
| **axe-core WCAG 2.1 A/AA**, 8 səhifə × mobil/desktop | 16 skan, 0 pozuntu (rəng kontrastı daxil) |
| Konsol xətaları (bütün testlər) | Yalnız `/nope` səhifəsinin gözlənilən 404-ü |

**19 interaksiya yoxlaması:** hamburger menyu (açılır, keçid sonrası bağlanır); klaviatura “əsas məzmuna keç”; ana səhifənin canlı bölmələri və CTA; production-da boş reklam yeri göstərilmir; auth tabı, parolu göstər/gizlət, razılıqsız göndərmə xətası; kitablar (6 kart, mobil filtr, axtarış sorğusu, favori `aria-pressed`); sınaq axını (səhv cavab + izah, tam axın, nəticə RPC ilə göndərilir, klient `correct_index` sorğulamır, birbaşa INSERT yoxdur); çat (siyahı → söhbət → göndərmə → geri); kabinet (sınaq tarixçəsi, silmə modalı: təsdiqsiz düymə söndürülüb, Esc bağlayır); desktop profil menyusu və oxunmamış nişanı.

**Test zamanı tapılıb düzəldilən xətalar:** `DESIGN_UPDATE_REPORT.md`, 5-ci bölmə (modal fokusu, bildiriş rəngləri, çat scroll-u, kontrast).

## 2. Yalnız kod səviyyəsində yoxlanılanlar (işləyən mühitdə sınanmayıb)
Real Supabase ilə qeydiyyat/giriş/şifrə bərpası e-poçtları, real fayl yükləmə (Storage), RLS qaydalarının real bazada davranışı, hesab silmə (real `delete_my_account`). SQL məntiqi isə PGlite-da 117 testlə sınanıb.

## 3. Sınanmayıb
- Real Supabase: Realtime websocket (yalnız UI məntiqi sınanıb; saxta serverdə websocket yoxdur və bu xəbərdarlıqlar süzülüb), e-poçt təsdiqi, real Storage.
- Real AdSense reklamı (yalnız ID-lərin düzgün formatda işləndiyi sandbox-da saxta ID ilə yoxlanılıb, bu ID-lər ZIP-də yoxdur).
- Real telefonlar, Safari, Firefox, Edge; Lighthouse nəticələri; zəif şəbəkə sınağı.
- `Content-Security-Policy-Report-Only` mesajları: saxta `http://localhost` Supabase ünvanı səbəbilə sandbox-da çıxır, real `https://*.supabase.co` ilə çıxmamalıdır, amma yoxlanılmayıb.

## 4. Qalan problemlər və əl ilə addımlar
Yerləşdirmədən sonra `DEPLOY.md` 6-cı bölmədəki yoxlama siyahısını **real telefonda və kompüterdə** keçin. Reklam əlavə etdikdən sonra brauzer konsolunda CSP xəbərdarlıqlarına baxıb siyasəti tam rejimə keçirə bilərsiniz.
